// POST /api/scan — Extract part number, model, and manufacturer from photo using Gemini AI
export async function onRequestPost(context) {
    try {
        const formData = await context.request.formData();
        const imageFile = formData.get('image');

        if (!imageFile || imageFile.size === 0) {
            return Response.json({ error: 'No image provided' }, { status: 400 });
        }

        // Convert image to base64
        const arrayBuffer = await imageFile.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        const imageBase64 = btoa(binary);

        // Call Gemini to extract part info
        const response = await fetch(
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
                                text: `You are a warehouse parts identification expert. Analyze this image carefully and extract ALL identifying information.

Look for:
- Part numbers (printed, stamped, engraved, on labels/stickers/barcodes)
- Model numbers (often preceded by "MODEL", "MOD", "M/N", or "MDL")
- Manufacturer/brand name (logos, company names, brand labels)

Respond in EXACTLY this JSON format with no other text:
{"part_number": "EXTRACTED_VALUE_OR_EMPTY", "model": "EXTRACTED_VALUE_OR_EMPTY", "manufacturer": "EXTRACTED_VALUE_OR_EMPTY"}

Rules:
- If a value is clearly visible, include it exactly as shown
- If a value is not visible, use an empty string ""
- Do NOT guess or fabricate values
- Return ONLY the JSON, no markdown, no code blocks, no explanation`
                            }
                        ]
                    }]
                })
            }
        );

        const data = await response.json();

        if (data.error) {
            return Response.json({ error: 'AI analysis failed: ' + data.error.message }, { status: 500 });
        }

        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

        // Parse JSON response from Gemini
        let extracted = { part_number: '', model: '', manufacturer: '' };
        try {
            // Strip markdown code fences if present
            const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            extracted = JSON.parse(cleaned);
        } catch {
            // Fallback: treat entire response as part number
            if (rawText && rawText !== 'NO_PART_NUMBER_FOUND') {
                extracted.part_number = rawText;
            }
        }

        const found = !!(extracted.part_number || extracted.model || extracted.manufacturer);

        if (!found) {
            return Response.json({
                found: false,
                message: 'No identifying information detected in image. Please enter details manually.'
            });
        }

        const detectedParts = [];
        if (extracted.part_number) detectedParts.push(`Part#: ${extracted.part_number}`);
        if (extracted.model) detectedParts.push(`Model: ${extracted.model}`);
        if (extracted.manufacturer) detectedParts.push(`Mfr: ${extracted.manufacturer}`);

        return Response.json({
            found: true,
            part_number: extracted.part_number || '',
            model: extracted.model || '',
            manufacturer: extracted.manufacturer || '',
            message: `Detected: ${detectedParts.join(' | ')}`
        });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
}
