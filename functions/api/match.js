import * as XLSX from 'xlsx';

// POST /api/match — Analyze a material request form and match parts against warehouse inventory
// Supports: Images, PDFs, Excel (.xlsx/.xls/.csv), Word (.docx)
export async function onRequestPost(context) {
    try {
        const formData = await context.request.formData();
        const file = formData.get('image');

        if (!file || file.size === 0) {
            return Response.json({ error: 'No file provided' }, { status: 400 });
        }

        const fileName = (file.name || '').toLowerCase();
        const mimeType = file.type || '';
        const arrayBuffer = await file.arrayBuffer();

        let geminiParts = [];

        // ─── Determine file type and prepare for Gemini ─────────
        if (mimeType.startsWith('image/')) {
            // IMAGES — send directly to Gemini vision
            const imageBase64 = arrayBufferToBase64(arrayBuffer);
            geminiParts = [
                { inlineData: { mimeType: mimeType, data: imageBase64 } },
                { text: buildExtractionPrompt('image') }
            ];
        } else if (mimeType === 'application/pdf' || fileName.endsWith('.pdf')) {
            // PDFs — Gemini supports PDF directly
            const pdfBase64 = arrayBufferToBase64(arrayBuffer);
            geminiParts = [
                { inlineData: { mimeType: 'application/pdf', data: pdfBase64 } },
                { text: buildExtractionPrompt('PDF document') }
            ];
        } else if (
            fileName.endsWith('.xlsx') || fileName.endsWith('.xls') ||
            fileName.endsWith('.csv') ||
            mimeType.includes('spreadsheet') || mimeType.includes('excel') ||
            mimeType === 'text/csv'
        ) {
            // EXCEL / CSV — parse to text using xlsx library
            const textContent = parseSpreadsheet(arrayBuffer, fileName);
            geminiParts = [
                { text: buildExtractionPrompt('spreadsheet') + '\n\nHere is the spreadsheet content:\n\n' + textContent }
            ];
        } else if (
            fileName.endsWith('.docx') ||
            mimeType.includes('wordprocessingml') ||
            mimeType.includes('msword')
        ) {
            // WORD (.docx) — extract text from XML inside the zip
            const textContent = await extractDocxText(arrayBuffer);
            geminiParts = [
                { text: buildExtractionPrompt('Word document') + '\n\nHere is the document content:\n\n' + textContent }
            ];
        } else {
            return Response.json({
                error: `Unsupported file type: ${mimeType || fileName}. Please upload an image, PDF, Excel, CSV, or Word file.`
            }, { status: 400 });
        }

        // ─── Step 1: Send to Gemini to extract part numbers ─────
        const geminiResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview:generateContent?key=${context.env.GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: geminiParts }]
                })
            }
        );

        const geminiData = await geminiResponse.json();

        if (geminiData.error) {
            return Response.json({
                error: 'AI analysis failed: ' + geminiData.error.message
            }, { status: 500 });
        }

        const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

        // Parse extracted parts from Gemini
        let extracted = { parts: [] };
        try {
            const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            extracted = JSON.parse(cleaned);
        } catch {
            return Response.json({
                error: 'Could not parse form data. Please try a different file or clearer photo.',
                raw: rawText
            }, { status: 422 });
        }

        if (!extracted.parts || extracted.parts.length === 0) {
            return Response.json({
                matched: [],
                unmatched: [],
                summary: { total_requested: 0, matched_count: 0, unmatched_count: 0 },
                message: 'No part numbers detected in the file. Try a different format or clearer content.'
            });
        }

        // ─── Step 2: Cross-reference against warehouse inventory ─
        const db = context.env.DB;
        const matched = [];
        const unmatched = [];

        for (const item of extracted.parts) {
            const partNum = (item.part_number || '').trim();
            if (!partNum) continue;

            // Try exact match first, then fuzzy
            let result = await db.prepare(
                'SELECT id, part_number, description, quantity, location FROM parts WHERE part_number = ?'
            ).bind(partNum).first();

            if (!result) {
                result = await db.prepare(
                    'SELECT id, part_number, description, quantity, location FROM parts WHERE part_number LIKE ?'
                ).bind(`%${partNum}%`).first();
            }

            if (!result) {
                result = await db.prepare(
                    'SELECT id, part_number, description, quantity, location FROM parts WHERE model LIKE ? OR description LIKE ?'
                ).bind(`%${partNum}%`, `%${partNum}%`).first();
            }

            if (result) {
                matched.push({
                    requested_part: partNum,
                    requested_description: item.description || '',
                    qty_requested: item.qty_requested || 0,
                    warehouse_part_number: result.part_number,
                    warehouse_description: result.description,
                    qty_available: result.quantity,
                    location: result.location,
                    in_stock: result.quantity > 0
                });
            } else {
                unmatched.push({
                    part_number: partNum,
                    description: item.description || '',
                    qty_requested: item.qty_requested || 0
                });
            }
        }

        return Response.json({
            matched,
            unmatched,
            summary: {
                total_requested: extracted.parts.length,
                matched_count: matched.length,
                unmatched_count: unmatched.length
            },
            message: `Found ${matched.length} of ${extracted.parts.length} parts in warehouse inventory.`
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
}

// ─── Helper: ArrayBuffer to Base64 ──────────────────────────
function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

// ─── Helper: Parse Excel/CSV to text ────────────────────────
function parseSpreadsheet(arrayBuffer, fileName) {
    try {
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        let allText = '';

        for (const sheetName of workbook.SheetNames) {
            const sheet = workbook.Sheets[sheetName];
            const csv = XLSX.utils.sheet_to_csv(sheet);
            allText += `--- Sheet: ${sheetName} ---\n${csv}\n\n`;
        }

        return allText || 'No content found in spreadsheet.';
    } catch (err) {
        return `Error parsing spreadsheet: ${err.message}`;
    }
}

// ─── Helper: Extract text from .docx ────────────────────────
async function extractDocxText(arrayBuffer) {
    try {
        // .docx is a zip file — look for word/document.xml
        // Use a simple approach: find XML text content
        const uint8 = new Uint8Array(arrayBuffer);
        const text = new TextDecoder('utf-8', { fatal: false }).decode(uint8);

        // Try to find readable text between XML tags
        const xmlContent = text.match(/<w:t[^>]*>([^<]+)<\/w:t>/g);
        if (xmlContent && xmlContent.length > 0) {
            return xmlContent
                .map(tag => tag.replace(/<[^>]+>/g, ''))
                .join(' ');
        }

        // Fallback: extract any readable strings
        const readable = text.replace(/[^\x20-\x7E\n\r\t]/g, ' ')
            .replace(/\s{3,}/g, ' ')
            .trim();

        return readable.substring(0, 10000) || 'Could not extract text from Word document.';
    } catch (err) {
        return `Error reading Word document: ${err.message}`;
    }
}

// ─── Helper: Build the Gemini extraction prompt ─────────────
function buildExtractionPrompt(sourceType) {
    return `You are a warehouse inventory expert analyzing a material request form from a ${sourceType} (also known as a bill of materials, parts list, purchase order, or material takeoff).

Your task: Extract EVERY part number, model number, or item identifier from this document.

Look for:
- Part numbers (e.g., "WS-C3850-24T-S", "CAT6-BLU-100", "J-BOX-4x4")
- Model numbers
- Catalog numbers
- SKUs
- Item codes
- Cable types and specifications (e.g., "CAT6", "RG6", "14/2")
- Hardware items with identifiers

Also extract the quantity requested for each item if visible.

Respond in EXACTLY this JSON format with no other text:
{"parts": [{"part_number": "EXACT_VALUE", "description": "brief description if visible", "qty_requested": NUMBER_OR_0}]}

Rules:
- Extract ALL items, even if partially visible
- Use the exact text as shown for part numbers
- If quantity is not visible, use 0
- Include a brief description only if one is provided
- Do NOT fabricate part numbers — only extract what is actually present
- Return ONLY the JSON, no markdown, no code blocks, no explanation
- If no parts are found, return {"parts": []}`;
}
