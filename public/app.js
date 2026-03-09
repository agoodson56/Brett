/* ═══════════════════════════════════════════════════════════════
   BRETT — Frontend Application Logic
   Warehouse Parts Inventory Management System
   Powered by Gemini 3.1 Pro
   ═══════════════════════════════════════════════════════════════ */

const API = '';
let allParts = [];
let currentPartId = null;
let currentSort = { column: 'created_at', order: 'DESC' };

// ─── Mobile Detection ─────────────────────────────────────────
const isMobile = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    || (window.innerWidth <= 768);

// ─── Initialize ───────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    loadStats();
    loadParts();
    showTab('dashboard');
    initMobile();
});

// ─── Mobile Initialization ────────────────────────────────────
function initMobile() {
    // Update upload text for mobile
    const uploadText = document.getElementById('uploadText');
    if (isMobile && uploadText) {
        uploadText.innerHTML = `
            <strong>Tap to take photo</strong> or choose from gallery<br>
            JPG, PNG, WebP up to 10MB
        `;
    }
}

// ─── Mobile Search Toggle ─────────────────────────────────────
function toggleMobileSearch() {
    const bar = document.getElementById('mobileSearchBar');
    bar.classList.toggle('active');
    if (bar.classList.contains('active')) {
        bar.querySelector('input').focus();
    } else {
        bar.querySelector('input').value = '';
        handleSearch('');
    }
}

// ═══════════════════════════════════════════════════════════════
//  NAVIGATION
// ═══════════════════════════════════════════════════════════════
function showTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('[id^="tab-"]').forEach(el => el.classList.add('hidden'));

    // Deactivate all nav buttons
    document.querySelectorAll('.nav-tab').forEach(el => el.classList.remove('active'));

    // Show selected tab
    const tab = document.getElementById(`tab-${tabName}`);
    if (tab) tab.classList.remove('hidden');

    // Activate nav button
    const navBtn = document.querySelector(`.nav-tab[data-tab="${tabName}"]`);
    if (navBtn) navBtn.classList.add('active');

    // Refresh data when switching tabs
    if (tabName === 'dashboard') loadStats();
    if (tabName === 'inventory') loadParts();
    if (tabName === 'activity') loadActivityLog();
    if (tabName === 'add') loadLocationsDropdown();
}

// ═══════════════════════════════════════════════════════════════
//  API CALLS
// ═══════════════════════════════════════════════════════════════

async function loadStats() {
    try {
        const res = await fetch(`${API}/api/stats`);
        const data = await res.json();

        document.getElementById('statTotalParts').textContent = data.totalParts;
        document.getElementById('statTotalQty').textContent = data.totalQuantity.toLocaleString();
        document.getElementById('statLowStock').textContent = data.lowStock;
        document.getElementById('statOutOfStock').textContent = data.outOfStock;

        // Render recent activity
        renderTransactions(data.recentTransactions, 'dashboardActivity');
    } catch (err) {
        console.error('Failed to load stats:', err);
    }
}

async function loadParts() {
    try {
        const search = document.getElementById('globalSearch')?.value || '';
        const location = document.getElementById('locationFilter')?.value || '';

        const params = new URLSearchParams({
            search,
            location,
            sort: currentSort.column,
            order: currentSort.order
        });

        const res = await fetch(`${API}/api/parts?${params}`);
        allParts = await res.json();

        renderPartsTable(allParts);
        document.getElementById('inventoryCount').textContent = allParts.length;

        // Update location filter dropdown
        updateLocationFilter();
    } catch (err) {
        console.error('Failed to load parts:', err);
    }
}

async function loadActivityLog() {
    try {
        const res = await fetch(`${API}/api/stats`);
        const data = await res.json();
        renderTransactions(data.recentTransactions, 'fullActivityLog');
    } catch (err) {
        console.error('Failed to load activity:', err);
    }
}

function loadLocationsDropdown() {
    const select = document.getElementById('addLocationSelect');
    const existingLocations = [...new Set(allParts.map(p => p.location).filter(Boolean))];
    select.innerHTML = '<option value="">— Type new or select —</option>';
    existingLocations.forEach(loc => {
        select.innerHTML += `<option value="${escapeHtml(loc)}">${escapeHtml(loc)}</option>`;
    });
}

// ═══════════════════════════════════════════════════════════════
//  RENDERING
// ═══════════════════════════════════════════════════════════════

function renderPartsTable(parts) {
    const tbody = document.getElementById('partsTableBody');
    const empty = document.getElementById('emptyInventory');

    if (parts.length === 0) {
        tbody.innerHTML = '';
        empty.classList.remove('hidden');
        return;
    }

    empty.classList.add('hidden');

    tbody.innerHTML = parts.map(part => {
        const qtyClass = part.quantity === 0 ? 'out' : part.quantity <= 5 ? 'low' : 'healthy';
        const qtyIcon = part.quantity === 0 ? '🔴' : part.quantity <= 5 ? '🟡' : '🟢';

        return `
            <tr onclick="openPartDetail(${part.id})">
                <td>
                    ${part.image_key
                ? `<img src="/api/parts/${part.id}/image" class="part-thumb" alt="${escapeHtml(part.part_number)}">`
                : `<div class="part-thumb-placeholder">📷</div>`
            }
                </td>
                <td class="part-number-cell">${escapeHtml(part.part_number)}</td>
                <td class="description-cell" title="${escapeHtml(part.description)}">${escapeHtml(part.description)}</td>
                <td>
                    <span class="qty-badge ${qtyClass}">
                        ${qtyIcon} ${part.quantity}
                    </span>
                </td>
                <td>
                    ${part.location ? `<span class="location-badge">📍 ${escapeHtml(part.location)}</span>` : '<span class="text-muted">—</span>'}
                </td>
                <td>
                    <div style="display:flex;gap:6px" onclick="event.stopPropagation()">
                        <button class="btn btn-ghost btn-sm" onclick="openPartDetail(${part.id})" title="View">👁️</button>
                        <button class="btn btn-danger btn-sm" onclick="quickTake(${part.id}, '${escapeHtml(part.part_number)}', ${part.quantity})" title="Take">📤</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function renderTransactions(transactions, containerId) {
    const container = document.getElementById(containerId);

    if (!transactions || transactions.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="padding:2rem">
                <div class="empty-icon">📋</div>
                <h3>No activity yet</h3>
                <p>Transactions will appear here as you manage inventory</p>
            </div>
        `;
        return;
    }

    container.innerHTML = transactions.map(t => {
        const actionClass = t.action === 'TAKEN' ? 'taken'
            : t.action === 'ADDED' ? 'added'
                : t.action === 'INITIAL STOCK' ? 'initial'
                    : 'adjustment';

        const actionIcon = t.action === 'TAKEN' ? '📤'
            : t.action === 'ADDED' ? '📥'
                : t.action === 'INITIAL STOCK' ? '📦'
                    : '🔧';

        const qtyDisplay = t.quantity_change > 0 ? `+${t.quantity_change}` : t.quantity_change;
        const timeAgo = formatTimeAgo(t.created_at);

        return `
            <div class="transaction-item">
                <div class="transaction-action ${actionClass}">
                    ${actionIcon} ${t.action}
                    ${t.part_number ? `<span style="color:var(--text-muted);font-weight:400;font-size:0.82rem;">· ${escapeHtml(t.part_number)}</span>` : ''}
                </div>
                <div>
                    <span class="transaction-qty" style="color:${t.quantity_change >= 0 ? 'var(--success)' : 'var(--danger)'}">${qtyDisplay}</span>
                    <span class="text-muted" style="margin:0 6px;">→</span>
                    <span class="transaction-qty">${t.quantity_after}</span>
                </div>
                <div class="transaction-time">${timeAgo}</div>
            </div>
        `;
    }).join('');
}

// ═══════════════════════════════════════════════════════════════
//  ADD PART
// ═══════════════════════════════════════════════════════════════

async function handleAddPart(event) {
    event.preventDefault();

    let partNumber = document.getElementById('addPartNumber').value.trim();
    const model = document.getElementById('addModel').value.trim();
    const manufacturer = document.getElementById('addManufacturer').value.trim();
    const quantity = document.getElementById('addQuantity').value || 0;
    const location = document.getElementById('addLocation').value.trim();
    const fileInput = document.getElementById('fileInput');

    // If no part number but has photo, auto-scan first
    if (!partNumber && fileInput.files[0]) {
        await scanPartNumber();
        partNumber = document.getElementById('addPartNumber').value.trim();
    }

    if (!partNumber) {
        showToast('Please enter a part number or upload a photo with a visible part number', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('part_number', partNumber);
    formData.append('model', model || document.getElementById('addModel').value.trim());
    formData.append('manufacturer', manufacturer || document.getElementById('addManufacturer').value.trim());
    formData.append('quantity', quantity);
    formData.append('location', location);

    if (fileInput.files[0]) {
        formData.append('image', fileInput.files[0]);
    }

    // Show loading
    document.getElementById('addPartLoading').classList.remove('hidden');
    document.getElementById('addSubmitBtn').disabled = true;

    try {
        const res = await fetch(`${API}/api/parts`, {
            method: 'POST',
            body: formData
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.error || 'Failed to add part');
        }

        showToast(`✅ Part ${data.part_number} added! AI description generated.`, 'success');
        resetAddForm();
        showTab('inventory');
        loadStats();
    } catch (err) {
        showToast(`❌ ${err.message}`, 'error');
    } finally {
        document.getElementById('addPartLoading').classList.add('hidden');
        document.getElementById('addSubmitBtn').disabled = false;
    }
}

function resetAddForm() {
    document.getElementById('addPartForm').reset();
    const zone = document.getElementById('uploadZone');
    zone.classList.remove('has-image');
    if (isMobile) {
        zone.innerHTML = `
            <div class="upload-icon">📸</div>
            <div class="upload-text" id="uploadText">
                <strong>Tap to take photo</strong> or choose from gallery<br>
                JPG, PNG, WebP up to 10MB
            </div>
        `;
    } else {
        zone.innerHTML = `
            <div class="upload-icon">📸</div>
            <div class="upload-text" id="uploadText">
                <strong>Click to upload</strong> or drag and drop<br>
                JPG, PNG, WebP up to 10MB
            </div>
        `;
    }
    document.getElementById('scanBtnContainer').style.display = 'none';
    document.getElementById('scanStatus').textContent = '';
}

// ═══════════════════════════════════════════════════════════════
//  FILE UPLOAD HANDLING
// ═══════════════════════════════════════════════════════════════

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) previewImage(file);
}

function handleDrop(event) {
    event.preventDefault();
    event.target.closest('.upload-zone').classList.remove('dragover');
    const file = event.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
        // Set the file to the input
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        document.getElementById('fileInput').files = dataTransfer.files;
        previewImage(file);
    }
}

function previewImage(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const zone = document.getElementById('uploadZone');
        zone.classList.add('has-image');
        zone.innerHTML = `
            <img src="${e.target.result}" class="upload-preview" alt="Preview">
            <button type="button" class="upload-remove" onclick="event.stopPropagation(); removeUpload()">✕</button>
        `;
        // Show the scan button and AUTO-SCAN immediately
        document.getElementById('scanBtnContainer').style.display = 'block';
        document.getElementById('scanStatus').textContent = '';
        scanPartNumber(); // Auto-scan on upload
    };
    reader.readAsDataURL(file);
}

function removeUpload() {
    document.getElementById('fileInput').value = '';
    const zone = document.getElementById('uploadZone');
    zone.classList.remove('has-image');
    if (isMobile) {
        zone.innerHTML = `
            <div class="upload-icon">📸</div>
            <div class="upload-text" id="uploadText">
                <strong>Tap to take photo</strong> or choose from gallery<br>
                JPG, PNG, WebP up to 10MB
            </div>
        `;
    } else {
        zone.innerHTML = `
            <div class="upload-icon">📸</div>
            <div class="upload-text" id="uploadText">
                <strong>Click to upload</strong> or drag and drop<br>
                JPG, PNG, WebP up to 10MB
            </div>
        `;
    }
    document.getElementById('scanBtnContainer').style.display = 'none';
}

// ═══════════════════════════════════════════════════════════════
//  SCAN PART NUMBER FROM PHOTO
// ═══════════════════════════════════════════════════════════════

async function scanPartNumber() {
    const fileInput = document.getElementById('fileInput');
    if (!fileInput.files[0]) {
        showToast('Upload a photo first', 'error');
        return;
    }

    const scanBtn = document.getElementById('scanBtn');
    const scanStatus = document.getElementById('scanStatus');

    scanBtn.disabled = true;
    scanBtn.textContent = '🔍 Scanning...';
    scanStatus.textContent = '🤖 Gemini AI is reading the part number from the photo...';
    scanStatus.style.color = 'var(--accent)';

    try {
        const formData = new FormData();
        formData.append('image', fileInput.files[0]);

        const res = await fetch(`${API}/api/scan`, {
            method: 'POST',
            body: formData
        });

        const data = await res.json();

        if (!res.ok) throw new Error(data.error || 'Scan failed');

        if (data.found) {
            if (data.part_number) document.getElementById('addPartNumber').value = data.part_number;
            if (data.model) document.getElementById('addModel').value = data.model;
            if (data.manufacturer) document.getElementById('addManufacturer').value = data.manufacturer;
            scanStatus.textContent = `✅ ${data.message}`;
            scanStatus.style.color = 'var(--success)';
            showToast(`🔍 ${data.message}`, 'success');
        } else {
            scanStatus.textContent = '⚠️ No part info found — please type it manually';
            scanStatus.style.color = 'var(--warning)';
            showToast('No part info detected in image. Enter it manually.', 'warning');
        }
    } catch (err) {
        scanStatus.textContent = `❌ ${err.message}`;
        scanStatus.style.color = 'var(--danger)';
        showToast(`❌ ${err.message}`, 'error');
    } finally {
        scanBtn.disabled = false;
        scanBtn.textContent = '🔍 Scan Part Info from Photo';
    }
}

// ═══════════════════════════════════════════════════════════════
//  PART DETAIL MODAL
// ═══════════════════════════════════════════════════════════════

async function openPartDetail(id) {
    try {
        const res = await fetch(`${API}/api/parts/${id}`);
        const part = await res.json();

        if (!res.ok) throw new Error(part.error);

        currentPartId = part.id;

        document.getElementById('modalPartTitle').textContent = `Part: ${part.part_number}`;
        document.getElementById('modalPartNumber').textContent = part.part_number;
        document.getElementById('modalDescription').textContent = part.description || 'No description available';
        document.getElementById('modalQuantity').textContent = part.quantity;
        document.getElementById('modalLocation').textContent = part.location || '—';
        document.getElementById('modalQtyInput').value = 1;

        // Image
        const imgContainer = document.getElementById('modalImageContainer');
        if (part.image_key) {
            imgContainer.innerHTML = `<img src="/api/parts/${part.id}/image" class="detail-image" alt="${escapeHtml(part.part_number)}">`;
        } else {
            imgContainer.innerHTML = `<div class="detail-image-placeholder">📷</div>`;
        }

        // Quantity color
        const qtyEl = document.getElementById('modalQuantity');
        qtyEl.style.color = part.quantity === 0 ? 'var(--danger)' : part.quantity <= 5 ? 'var(--warning)' : 'var(--success)';

        // Transactions
        renderTransactions(part.transactions, 'modalTransactions');

        // Show modal
        document.getElementById('partDetailModal').classList.add('active');
    } catch (err) {
        showToast(`❌ ${err.message}`, 'error');
    }
}

function closeModal() {
    document.getElementById('partDetailModal').classList.remove('active');
    currentPartId = null;
}

function adjustModalQty(delta) {
    const input = document.getElementById('modalQtyInput');
    let val = parseInt(input.value) + delta;
    if (val < 1) val = 1;
    input.value = val;
}

// ═══════════════════════════════════════════════════════════════
//  TAKE / ADD PARTS
// ═══════════════════════════════════════════════════════════════

async function takeParts() {
    if (!currentPartId) return;
    const qty = parseInt(document.getElementById('modalQtyInput').value);
    if (!qty || qty <= 0) {
        showToast('Enter a valid quantity', 'error');
        return;
    }

    try {
        const res = await fetch(`${API}/api/parts/${currentPartId}/take`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ quantity: qty })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        showToast(`📤 ${data.message}`, 'success');
        openPartDetail(currentPartId); // Refresh
        loadParts();
        loadStats();
    } catch (err) {
        showToast(`❌ ${err.message}`, 'error');
    }
}

async function addStock() {
    if (!currentPartId) return;
    const qty = parseInt(document.getElementById('modalQtyInput').value);
    if (!qty || qty <= 0) {
        showToast('Enter a valid quantity', 'error');
        return;
    }

    try {
        const res = await fetch(`${API}/api/parts/${currentPartId}/add`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ quantity: qty })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        showToast(`📥 ${data.message}`, 'success');
        openPartDetail(currentPartId); // Refresh
        loadParts();
        loadStats();
    } catch (err) {
        showToast(`❌ ${err.message}`, 'error');
    }
}

async function quickTake(id, partNumber, available) {
    // Use modal-style inline input instead of prompt() for mobile compatibility
    const qty = await showQuickTakeInput(partNumber, available);
    if (qty === null) return;

    const amount = parseInt(qty);
    if (!amount || amount <= 0) {
        showToast('Invalid quantity', 'error');
        return;
    }

    try {
        const res = await fetch(`${API}/api/parts/${id}/take`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ quantity: amount })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        showToast(`📤 ${data.message}`, 'success');
        loadParts();
        loadStats();
    } catch (err) {
        showToast(`❌ ${err.message}`, 'error');
    }
}

// Styled inline prompt replacement (works on all mobile browsers)
function showQuickTakeInput(partNumber, available) {
    return new Promise(resolve => {
        // Remove any existing quick-take overlay
        document.getElementById('quickTakeOverlay')?.remove();

        const overlay = document.createElement('div');
        overlay.id = 'quickTakeOverlay';
        overlay.className = 'modal-overlay active';
        overlay.style.zIndex = '2000';
        overlay.innerHTML = `
            <div class="modal" style="max-width:380px;">
                <div class="modal-header">
                    <div class="modal-title">📤 Take Parts</div>
                    <button class="modal-close" id="qtClose">&times;</button>
                </div>
                <div class="modal-body" style="text-align:center;">
                    <p style="margin-bottom:8px;color:var(--text-secondary);">
                        <strong style="color:var(--accent);">${partNumber}</strong>
                    </p>
                    <p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:16px;">
                        ${available} available
                    </p>
                    <div class="qty-input-group" style="justify-content:center;margin:0 auto;">
                        <button id="qtMinus">−</button>
                        <input type="number" id="qtInput" value="1" min="1" max="${available}" inputmode="numeric">
                        <button id="qtPlus">+</button>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-ghost" id="qtCancel">Cancel</button>
                    <button class="btn btn-danger" id="qtConfirm">📤 Take</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const input = document.getElementById('qtInput');
        input.focus();
        input.select();

        document.getElementById('qtMinus').onclick = () => {
            let v = parseInt(input.value) - 1;
            if (v < 1) v = 1;
            input.value = v;
        };
        document.getElementById('qtPlus').onclick = () => {
            let v = parseInt(input.value) + 1;
            if (v > available) v = available;
            input.value = v;
        };

        const close = () => { overlay.remove(); resolve(null); };
        document.getElementById('qtClose').onclick = close;
        document.getElementById('qtCancel').onclick = close;
        overlay.onclick = (e) => { if (e.target === overlay) close(); };

        document.getElementById('qtConfirm').onclick = () => {
            const val = input.value;
            overlay.remove();
            resolve(val);
        };

        // Enter key to confirm
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const val = input.value;
                overlay.remove();
                resolve(val);
            }
            if (e.key === 'Escape') close();
        });
    });
}

// ═══════════════════════════════════════════════════════════════
//  EDIT PART
// ═══════════════════════════════════════════════════════════════

async function editPart() {
    if (!currentPartId) return;

    try {
        const res = await fetch(`${API}/api/parts/${currentPartId}`);
        const part = await res.json();

        document.getElementById('editPartNumber').value = part.part_number;
        document.getElementById('editQuantity').value = part.quantity;
        document.getElementById('editLocation').value = part.location;
        document.getElementById('editDescription').value = part.description;
        document.getElementById('editRegenerate').value = 'false';
        document.getElementById('editFileInput').value = '';

        closeModal();
        document.getElementById('editPartModal').classList.add('active');
    } catch (err) {
        showToast(`❌ Failed to load part for editing`, 'error');
    }
}

function closeEditModal() {
    document.getElementById('editPartModal').classList.remove('active');
}

async function handleEditPart(event) {
    event.preventDefault();
    if (!currentPartId) return;

    const formData = new FormData();
    formData.append('part_number', document.getElementById('editPartNumber').value);
    formData.append('quantity', document.getElementById('editQuantity').value);
    formData.append('location', document.getElementById('editLocation').value);
    formData.append('description', document.getElementById('editDescription').value);
    formData.append('regenerate_description', document.getElementById('editRegenerate').value);

    const fileInput = document.getElementById('editFileInput');
    if (fileInput.files[0]) {
        formData.append('image', fileInput.files[0]);
    }

    document.getElementById('editPartLoading').classList.remove('hidden');

    try {
        const res = await fetch(`${API}/api/parts/${currentPartId}`, {
            method: 'PUT',
            body: formData
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        showToast(`✅ Part ${data.part_number} updated!`, 'success');
        closeEditModal();
        loadParts();
        loadStats();
    } catch (err) {
        showToast(`❌ ${err.message}`, 'error');
    } finally {
        document.getElementById('editPartLoading').classList.add('hidden');
    }
}

// ═══════════════════════════════════════════════════════════════
//  DELETE PART
// ═══════════════════════════════════════════════════════════════

async function deletePart() {
    if (!currentPartId) return;
    if (!confirm('Are you sure you want to delete this part? This cannot be undone.')) return;

    try {
        const res = await fetch(`${API}/api/parts/${currentPartId}`, { method: 'DELETE' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        showToast(`🗑️ ${data.message}`, 'success');
        closeModal();
        loadParts();
        loadStats();
    } catch (err) {
        showToast(`❌ ${err.message}`, 'error');
    }
}

// ═══════════════════════════════════════════════════════════════
//  SEARCH & SORT
// ═══════════════════════════════════════════════════════════════

let searchTimeout;
function handleSearch(value) {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        // Switch to inventory tab to show results
        if (value.length > 0) showTab('inventory');
        loadParts();
    }, 300);
}

function sortParts(column) {
    if (currentSort.column === column) {
        currentSort.order = currentSort.order === 'ASC' ? 'DESC' : 'ASC';
    } else {
        currentSort.column = column;
        currentSort.order = 'ASC';
    }
    loadParts();
}

function updateLocationFilter() {
    const select = document.getElementById('locationFilter');
    const currentValue = select.value;
    const locations = [...new Set(allParts.map(p => p.location).filter(Boolean))];

    select.innerHTML = '<option value="">All Locations</option>';
    locations.sort().forEach(loc => {
        select.innerHTML += `<option value="${escapeHtml(loc)}" ${loc === currentValue ? 'selected' : ''}>${escapeHtml(loc)}</option>`;
    });
}

// ═══════════════════════════════════════════════════════════════
//  UTILITIES
// ═══════════════════════════════════════════════════════════════

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function formatTimeAgo(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };

    toast.innerHTML = `
        <span class="toast-icon">${icons[type]}</span>
        <span class="toast-message">${message}</span>
        <button class="toast-close" onclick="this.parentElement.remove()">✕</button>
    `;

    container.appendChild(toast);

    // Auto-remove after 5 seconds
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

// ═══════════════════════════════════════════════════════════════
//  MATERIAL REQUEST MATCHING
// ═══════════════════════════════════════════════════════════════

function handleMatchFileSelect(event) {
    const file = event.target.files[0];
    if (file) previewMatchImage(file);
}

function handleMatchDrop(event) {
    event.preventDefault();
    event.target.closest('.upload-zone').classList.remove('dragover');
    const file = event.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        document.getElementById('matchFileInput').files = dataTransfer.files;
        previewMatchImage(file);
    }
}

function previewMatchImage(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const zone = document.getElementById('matchUploadZone');
        zone.classList.add('has-image');
        zone.innerHTML = `
            <img src="${e.target.result}" class="upload-preview" alt="Form Preview">
            <button type="button" class="upload-remove" onclick="event.stopPropagation(); resetMatchForm()">✕</button>
        `;
        document.getElementById('matchAnalyzeContainer').style.display = 'block';
    };
    reader.readAsDataURL(file);
}

function resetMatchForm() {
    document.getElementById('matchFileInput').value = '';
    const zone = document.getElementById('matchUploadZone');
    zone.classList.remove('has-image');
    if (isMobile) {
        zone.innerHTML = `
            <div class="upload-icon">📄</div>
            <div class="upload-text" id="matchUploadText">
                <strong>Tap to photograph form</strong><br>
                Take a photo of your material request form
            </div>
        `;
    } else {
        zone.innerHTML = `
            <div class="upload-icon">📄</div>
            <div class="upload-text" id="matchUploadText">
                <strong>Upload material request form</strong><br>
                Take a photo or upload an image of the form
            </div>
        `;
    }
    document.getElementById('matchAnalyzeContainer').style.display = 'none';
    document.getElementById('matchResults').classList.add('hidden');
}

async function analyzeRequest() {
    const fileInput = document.getElementById('matchFileInput');
    if (!fileInput.files[0]) {
        showToast('Upload a form image first', 'error');
        return;
    }

    const btn = document.getElementById('matchAnalyzeBtn');
    const loading = document.getElementById('matchLoading');

    btn.disabled = true;
    btn.textContent = '🔍 Analyzing...';
    loading.classList.remove('hidden');

    try {
        const formData = new FormData();
        formData.append('image', fileInput.files[0]);

        const res = await fetch(`${API}/api/match`, {
            method: 'POST',
            body: formData
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.error || 'Analysis failed');
        }

        renderMatchResults(data);
        showToast(`📄 ${data.message}`, 'success');
    } catch (err) {
        showToast(`❌ ${err.message}`, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = '🔍 Analyze & Match Parts';
        loading.classList.add('hidden');
    }
}

function renderMatchResults(data) {
    const resultsContainer = document.getElementById('matchResults');
    resultsContainer.classList.remove('hidden');

    // Summary
    const summary = document.getElementById('matchSummary');
    const matchPct = data.summary.total_requested > 0
        ? Math.round((data.summary.matched_count / data.summary.total_requested) * 100)
        : 0;

    summary.innerHTML = `
        <div class="match-summary-cards">
            <div class="match-stat">
                <div class="match-stat-value">${data.summary.total_requested}</div>
                <div class="match-stat-label">Parts on Form</div>
            </div>
            <div class="match-stat success">
                <div class="match-stat-value">${data.summary.matched_count}</div>
                <div class="match-stat-label">In Warehouse</div>
            </div>
            <div class="match-stat danger">
                <div class="match-stat-value">${data.summary.unmatched_count}</div>
                <div class="match-stat-label">Need to Order</div>
            </div>
            <div class="match-stat ${matchPct >= 50 ? 'success' : 'danger'}">
                <div class="match-stat-value">${matchPct}%</div>
                <div class="match-stat-label">Match Rate</div>
            </div>
        </div>
    `;

    // Matched (in-stock)
    document.getElementById('matchedCount').textContent = data.matched.length;
    const matchedBody = document.getElementById('matchedPartsBody');

    if (data.matched.length === 0) {
        matchedBody.innerHTML = `
            <div class="empty-state" style="padding:2rem;">
                <div class="empty-icon">📦</div>
                <h3>No matching parts found</h3>
                <p>None of the requested parts are currently in the warehouse</p>
            </div>
        `;
    } else {
        matchedBody.innerHTML = data.matched.map(part => `
            <div class="match-item match-item-success">
                <div class="match-item-header">
                    <span class="match-part-number">${escapeHtml(part.requested_part)}</span>
                    ${part.requested_part !== part.warehouse_part_number
                ? `<span class="match-alias">→ matched: ${escapeHtml(part.warehouse_part_number)}</span>`
                : ''}
                </div>
                <div class="match-item-details">
                    <div class="match-detail">
                        <span class="match-detail-label">Available</span>
                        <span class="match-detail-value qty-badge ${part.qty_available > 5 ? 'healthy' : part.qty_available > 0 ? 'low' : 'out'}">
                            ${part.qty_available}
                        </span>
                    </div>
                    ${part.qty_requested ? `
                        <div class="match-detail">
                            <span class="match-detail-label">Requested</span>
                            <span class="match-detail-value">${part.qty_requested}</span>
                        </div>
                    ` : ''}
                    <div class="match-detail">
                        <span class="match-detail-label">Location</span>
                        <span class="match-detail-value location-badge">📍 ${escapeHtml(part.location || 'N/A')}</span>
                    </div>
                </div>
                ${part.warehouse_description ? `
                    <div class="match-item-desc">${escapeHtml(part.warehouse_description)}</div>
                ` : ''}
            </div>
        `).join('');
    }

    // Unmatched (need to order)
    document.getElementById('unmatchedCount').textContent = data.unmatched.length;
    const unmatchedBody = document.getElementById('unmatchedPartsBody');

    if (data.unmatched.length === 0) {
        unmatchedBody.innerHTML = `
            <div class="empty-state" style="padding:2rem;">
                <div class="empty-icon">🎉</div>
                <h3>Everything is in stock!</h3>
                <p>All requested parts are available in the warehouse</p>
            </div>
        `;
    } else {
        unmatchedBody.innerHTML = data.unmatched.map(part => `
            <div class="match-item match-item-danger">
                <div class="match-item-header">
                    <span class="match-part-number">${escapeHtml(part.part_number)}</span>
                    ${part.qty_requested ? `<span class="match-qty-req">Qty: ${part.qty_requested}</span>` : ''}
                </div>
                ${part.description ? `
                    <div class="match-item-desc">${escapeHtml(part.description)}</div>
                ` : ''}
            </div>
        `).join('');
    }
}

// Close modals with Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeModal();
        closeEditModal();
    }
});

// Close modals by clicking overlay
document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            closeModal();
            closeEditModal();
        }
    });
});
