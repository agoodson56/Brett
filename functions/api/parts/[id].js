// ─── Gemini AI Description Generator ─────────────────────────
async function generateDescription(apiKey, partNumber, imageBase64, imageMimeType) {
    try {
        const parts = [];
        if (imageBase64 && imageMimeType) {
            parts.push({ inlineData: { mimeType: imageMimeType, data: imageBase64 } });
        }
        parts.push({
            text: `You are a warehouse parts identification expert. Analyze this part with part number: "${partNumber}".
Provide a concise, professional technical description (2-3 sentences max). Include what the part is, its typical use, and any notable specs. If you can identify the manufacturer from the part number format, mention it. Respond with ONLY the description text.`
        });

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro-preview-05-06:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts }] })
            }
        );
        const data = await response.json();
        if (data.error) return `Part ${partNumber} — description pending (AI temporarily unavailable)`;
        return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || `Part ${partNumber} — description pending`;
    } catch {
        return `Part ${partNumber} — description pending (AI temporarily unavailable)`;
    }
}

// ─── GET /api/parts/:id — Single part detail ─────────────────
export async function onRequestGet(context) {
    const db = context.env.DB;
    const id = parseInt(context.params.id);

    try {
        const part = await db.prepare('SELECT * FROM parts WHERE id = ?').bind(id).first();
        if (!part) return Response.json({ error: 'Part not found' }, { status: 404 });

        const { results: transactions } = await db.prepare(
            'SELECT * FROM transactions WHERE part_id = ? ORDER BY created_at DESC LIMIT 50'
        ).bind(id).all();

        return Response.json({ ...part, transactions: transactions || [] });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
}

// ─── PUT /api/parts/:id — Update a part ──────────────────────
export async function onRequestPut(context) {
    const db = context.env.DB;
    const bucket = context.env.BUCKET;
    const id = parseInt(context.params.id);

    try {
        const part = await db.prepare('SELECT * FROM parts WHERE id = ?').bind(id).first();
        if (!part) return Response.json({ error: 'Part not found' }, { status: 404 });

        const formData = await context.request.formData();
        const part_number = formData.get('part_number') || part.part_number;
        const description = formData.get('description');
        const quantity = formData.get('quantity');
        const location = formData.get('location');
        const regenerate = formData.get('regenerate_description');
        const imageFile = formData.get('image');

        let newDescription = description !== null ? description : part.description;
        let newImageKey = part.image_key;

        // Handle new image upload
        if (imageFile && imageFile.size > 0) {
            // Delete old image from R2
            if (part.image_key) {
                try { await bucket.delete(part.image_key); } catch { }
            }
            const ext = imageFile.name.split('.').pop().toLowerCase();
            newImageKey = `parts/${Date.now()}-${Math.round(Math.random() * 1E9)}.${ext}`;
            await bucket.put(newImageKey, await imageFile.arrayBuffer(), {
                httpMetadata: { contentType: imageFile.type }
            });
        }

        // Regenerate description if requested
        if (regenerate === 'true') {
            let imageBase64 = '';
            let imageMimeType = '';

            if (imageFile && imageFile.size > 0) {
                const bytes = new Uint8Array(await imageFile.arrayBuffer());
                let binary = '';
                for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
                imageBase64 = btoa(binary);
                imageMimeType = imageFile.type;
            } else if (newImageKey) {
                const obj = await bucket.get(newImageKey);
                if (obj) {
                    const bytes = new Uint8Array(await obj.arrayBuffer());
                    let binary = '';
                    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
                    imageBase64 = btoa(binary);
                    imageMimeType = obj.httpMetadata?.contentType || 'image/jpeg';
                }
            }
            newDescription = await generateDescription(context.env.GEMINI_API_KEY, part_number, imageBase64, imageMimeType);
        }

        const newQty = quantity !== null ? parseInt(quantity) : part.quantity;

        // Log quantity change
        if (newQty !== part.quantity) {
            await db.prepare(
                `INSERT INTO transactions (part_id, action, quantity_change, quantity_before, quantity_after, notes) VALUES (?, 'ADJUSTMENT', ?, ?, ?, 'Manual quantity update')`
            ).bind(id, newQty - part.quantity, part.quantity, newQty).run();
        }

        await db.prepare(
            `UPDATE parts SET part_number=?, description=?, quantity=?, location=?, image_key=?, updated_at=datetime('now') WHERE id=?`
        ).bind(part_number.trim(), newDescription, newQty, (location !== null ? location : part.location).trim(), newImageKey, id).run();

        const updated = await db.prepare('SELECT * FROM parts WHERE id = ?').bind(id).first();
        return Response.json(updated);
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
}

// ─── DELETE /api/parts/:id — Remove a part ───────────────────
export async function onRequestDelete(context) {
    const db = context.env.DB;
    const bucket = context.env.BUCKET;
    const id = parseInt(context.params.id);

    try {
        const part = await db.prepare('SELECT * FROM parts WHERE id = ?').bind(id).first();
        if (!part) return Response.json({ error: 'Part not found' }, { status: 404 });

        // Delete image from R2
        if (part.image_key) {
            try { await bucket.delete(part.image_key); } catch { }
        }

        await db.prepare('DELETE FROM transactions WHERE part_id = ?').bind(id).run();
        await db.prepare('DELETE FROM parts WHERE id = ?').bind(id).run();

        return Response.json({ message: `Part ${part.part_number} deleted.` });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
}
