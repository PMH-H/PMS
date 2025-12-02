import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { filePath, patientId } = await req.json()

        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // Download image from storage
        const { data: fileData, error: downloadError } = await supabaseClient.storage
            .from('prescriptions')
            .download(filePath)

        if (downloadError) throw downloadError

        // Convert to base64 for Gemini API
        const arrayBuffer = await fileData.arrayBuffer()
        const base64Image = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))

        // Call Gemini API for OCR and analysis
        const geminiResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${Deno.env.get('GEMINI_API_KEY')}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            {
                                text: `Analyze this prescription image and extract structured data in JSON format with the following fields:
                {
                  "medications": [
                    {
                      "name": "drug name",
                      "dosage": "strength and form",
                      "frequency": "how often",
                      "duration": "how long",
                      "quantity": "number of units"
                    }
                  ],
                  "patientName": "patient name if visible",
                  "doctorName": "doctor name if visible",
                  "date": "prescription date if visible",
                  "notes": "any special instructions"
                }
                Only return valid JSON, no markdown or explanation.`
                            },
                            {
                                inlineData: {
                                    mimeType: 'image/jpeg',
                                    data: base64Image
                                }
                            }
                        ]
                    }]
                })
            }
        )

        const geminiData = await geminiResponse.json()

        if (!geminiData.candidates || geminiData.candidates.length === 0) {
            throw new Error('No response from Gemini API')
        }

        const responseText = geminiData.candidates[0].content.parts[0].text

        // Extract JSON from response (remove markdown if present)
        const jsonMatch = responseText.match(/\{[\s\S]*\}/)
        const parsedData = jsonMatch ? JSON.parse(jsonMatch[0]) : { medications: [] }

        // Update prescription record with AI-processed data
        const { error: updateError } = await supabaseClient
            .from('prescriptions')
            .update({
                parsed_payload: parsedData,
                status: 'pending'
            })
            .eq('storage_path', filePath)
            .eq('patient_id', patientId)

        if (updateError) throw updateError

        return new Response(
            JSON.stringify({ success: true, data: parsedData }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('Error:', error)
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        )
    }
})
