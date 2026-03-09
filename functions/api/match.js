// POST /api/match — Analyze a material request form and match parts against warehouse inventory
export async function onRequestPost(context) {
    try {
        const formData = await context.request.formData();
        const imageFile = formData.get('image');

        if (!imageFile || imageFile.size === 0) {
            return Response.json({ error: 'No form image provided' }, { status: 400 });
        }

        // Convert image to base64 for Gemini
        const arrayBuffer = await imageFile.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        const imageBase64 = btoa(binary);

        // ─── Step 1: Send to Gemini to extract part numbers ─────
        const geminiResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview:generateContent?key=${context.env.GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            {
                                inlineData: {
                                    mimeType: imageFile.type,
                                    data: imageBase64
                                }
                            },
                            {
                                text: `You are a warehouse inventory expert analyzing a material request form (also known as a bill of materials, parts list, purchase order, or material takeoff).

Your task: Extract EVERY part number, model number, or item identifier from this document.

Look for:
- Part numbers (e.g., "WS-C3850-24T-S", "CAT6-BLU-100", "J-BOX-4x4")
- Model numbers
- Catalog numbers
- SKUs
- Item codes
- Cable types and specifications (e.g., "CAT6", "RG6", "14/2")
- Hardware items with identifiers

Also extract the quantity requested for each item if visible on the form.

Respond in EXACTLY this JSON format with no other text:
{"parts": [{"part_number": "EXACT_VALUE", "description": "brief description if visible", "qty_requested": NUMBER_OR_0}]}

Rules:
- Extract ALL items, even if partially visible
- Use the exact text as shown on the form for part numbers
- If quantity is not visible, use 0
- Include a brief description only if one is written on the form
- Do NOT fabricate part numbers — only extract what is actually written
- Return ONLY the JSON, no markdown, no code blocks, no explanation
- If no parts are found, return {"parts": []}`
                            }
                        ]
                    }]
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
                error: 'Could not parse form data. Please try a clearer photo.',
                raw: rawText
            }, { status: 422 });
        }

        if (!extracted.parts || extracted.parts.length === 0) {
            return Response.json({
                matched: [],
                unmatched: [],
                summary: { total_requested: 0, matched_count: 0, unmatched_count: 0 },
                message: 'No part numbers detected in the form. Try a clearer photo.'
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

            // If no exact match, try LIKE match (case-insensitive)
            if (!result) {
                result = await db.prepare(
                    'SELECT id, part_number, description, quantity, location FROM parts WHERE part_number LIKE ?'
                ).bind(`%${partNum}%`).first();
            }

            // Also try searching description and model
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
