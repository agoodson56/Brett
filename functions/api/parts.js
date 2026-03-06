// ─── Gemini AI Description Generator ─────────────────────────
async function generateDescription(apiKey, partNumber, imageBase64, imageMimeType) {
    try {
        const parts = [];

        if (imageBase64 && imageMimeType) {
            parts.push({
                inlineData: { mimeType: imageMimeType, data: imageBase64 }
            });
        }

        parts.push({
            text: `You are a warehouse parts identification expert. Analyze this part with part number: "${partNumber}".

Provide a concise, professional technical description of this part (2-3 sentences max). Include:
- What the part is (common name and type)
- Its typical use or application
- Any notable specifications you can determine

If you can identify the manufacturer or brand from the part number format, mention it. Be specific and practical — this description will be used by warehouse workers to identify parts.

Respond with ONLY the description text, no labels or formatting.`
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

        if (data.error) {
            console.error('Gemini API error:', data.error.message);
            return `Part ${partNumber} — description pending (AI temporarily unavailable)`;
        }

        return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
            || `Part ${partNumber} — description pending`;
    } catch (error) {
        console.error('Gemini fetch error:', error.message);
        return `Part ${partNumber} — description pending (AI temporarily unavailable)`;
    }
}

// ─── GET /api/parts — List all parts (with search/filter) ───
export async function onRequestGet(context) {
    const db = context.env.DB;
    const url = new URL(context.request.url);

    const search = url.searchParams.get('search') || '';
    const location = url.searchParams.get('location') || '';
    const sort = url.searchParams.get('sort') || 'created_at';
    const order = url.searchParams.get('order') || 'DESC';

    try {
        // Whitelist sort columns
        const validSorts = ['part_number', 'quantity', 'location', 'created_at', 'updated_at'];
        const sortCol = validSorts.includes(sort) ? sort : 'created_at';
        const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

        let query = 'SELECT * FROM parts WHERE 1=1';
        const bindings = [];

        if (search) {
            query += " AND (part_number LIKE ?1 OR description LIKE ?2)";
            bindings.push(`%${search}%`, `%${search}%`);
        }
        if (location) {
            query += ` AND location LIKE ?${bindings.length + 1}`;
            bindings.push(`%${location}%`);
        }

        query += ` ORDER BY ${sortCol} ${sortOrder}`;

        const stmt = db.prepare(query);
        const { results } = bindings.length > 0 ? await stmt.bind(...bindings).all() : await stmt.all();

        return Response.json(results || []);
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
}

// ─── POST /api/parts — Add a new part ───────────────────────
export async function onRequestPost(context) {
    const db = context.env.DB;
    const bucket = context.env.BUCKET;

    try {
        const formData = await context.request.formData();
        const part_number = formData.get('part_number');
        const quantity = parseInt(formData.get('quantity')) || 0;
        const location = formData.get('location') || '';
        const imageFile = formData.get('image');

        if (!part_number) {
            return Response.json({ error: 'Part number is required' }, { status: 400 });
        }

        // Check for duplicates
        const existing = await db.prepare('SELECT id FROM parts WHERE part_number = ?').bind(part_number).first();
        if (existing) {
            return Response.json({ error: `Part ${part_number} already exists`, existingId: existing.id }, { status: 409 });
        }

        // Handle image upload to R2
        let imageKey = '';
        let imageBase64 = '';
        let imageMimeType = '';

        if (imageFile && imageFile.size > 0) {
            const ext = imageFile.name.split('.').pop().toLowerCase();
            imageKey = `parts/${Date.now()}-${Math.round(Math.random() * 1E9)}.${ext}`;

            const arrayBuffer = await imageFile.arrayBuffer();

            // Store in R2
            await bucket.put(imageKey, arrayBuffer, {
                httpMetadata: { contentType: imageFile.type }
            });

            // Convert to base64 for Gemini
            const bytes = new Uint8Array(arrayBuffer);
            let binary = '';
            for (let i = 0; i < bytes.length; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            imageBase64 = btoa(binary);
            imageMimeType = imageFile.type;
        }

        // Generate AI description via Gemini
        const description = await generateDescription(
            context.env.GEMINI_API_KEY,
            part_number,
            imageBase64,
            imageMimeType
        );

        // Insert into D1
        const result = await db.prepare(
            `INSERT INTO parts (part_number, description, quantity, location, image_key) VALUES (?, ?, ?, ?, ?)`
        ).bind(part_number.trim(), description, quantity, location.trim(), imageKey).run();

        const newId = result.meta?.last_row_id;

        // Log initial stock
        if (quantity > 0 && newId) {
            await db.prepare(
                `INSERT INTO transactions (part_id, action, quantity_change, quantity_before, quantity_after, notes) VALUES (?, 'INITIAL STOCK', ?, 0, ?, 'Part added to inventory')`
            ).bind(newId, quantity, quantity).run();
        }

        // Fetch the new part
        const newPart = await db.prepare('SELECT * FROM parts WHERE id = ?').bind(newId).first();

        return Response.json(newPart, { status: 201 });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
}
