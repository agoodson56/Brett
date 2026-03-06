// POST /api/scan — Extract part number from uploaded photo using Gemini AI
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

        // Call Gemini to extract part number
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
                                text: `You are a warehouse parts identification expert. Analyze this image carefully and extract the part number.

Look for:
- Printed or stamped part numbers on the component
- Labels, stickers, or tags showing a part/model number
- Embossed or engraved identification numbers
- Barcodes with visible numbers underneath
- Any manufacturer part number, SKU, or catalog number visible

If you find a part number, respond with ONLY the part number text (no labels, no explanation, no quotes). 
If you find multiple part numbers, return the most prominent/primary one.
If no part number is visible, respond with exactly: NO_PART_NUMBER_FOUND`
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

        const extractedText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

        if (!extractedText || extractedText === 'NO_PART_NUMBER_FOUND') {
            return Response.json({
                found: false,
                message: 'No part number detected in image. Please enter it manually.'
            });
        }

        return Response.json({
            found: true,
            part_number: extractedText,
            message: `Detected part number: ${extractedText}`
        });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
}
