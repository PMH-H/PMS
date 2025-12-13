// gemini-proxy.ts (Deno Edge Function)
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');

if (!GEMINI_API_KEY) {
  console.error('Missing GEMINI_API_KEY environment variable.');
}

// Initialize client (note: the library may require a different init; adjust if needed)
const ai = new GoogleGenerativeAI(GEMINI_API_KEY);

const safeParseJson = (text: string) => {
  try {
    return JSON.parse(text);
  } catch (e) {
    // If the model returned non-JSON text, return the raw text for debugging
    return { _raw: text };
  }
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (!GEMINI_API_KEY) {
    return new Response(JSON.stringify({ error: 'Server misconfiguration: missing GEMINI_API_KEY' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let body: any;
  try {
    body = await req.json();
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { action, payload } = body ?? {};

  if (!action) {
    return new Response(JSON.stringify({ error: 'Missing action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const model = ai.getGenerativeModel({ model: 'gemini-1.5-flash' });

    let result: any;
    let textResult: string | undefined;

    switch (action) {
      case 'chat': {
        const { message, role } = payload ?? {};
        const systemInstruction =
          role === 'pharmacist'
            ? 'You are a helpful assistant for a pharmacist. You help with drug info, stock logic, and detailed medical interaction explanations. Be professional and concise.'
            : 'You are a helpful health assistant for a patient. You explain medications simply. Always advise consulting a real doctor or pharmacist for medical advice. Do not diagnose. Keep answers short and easy to read on mobile.';

        result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: message || '' }] }],
          systemInstruction,
        });

        textResult = result?.response?.text?.() ?? String(result?.response ?? '');
        // Return simple string for chat
        return new Response(JSON.stringify({ response: textResult }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'analyzePrescriptionImage': {
        const { base64Image } = payload ?? {};
        if (!base64Image) {
          return new Response(JSON.stringify({ error: 'Missing base64Image payload' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        result = await model.generateContent({
          contents: [
            {
              role: 'user',
              parts: [
                { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
                { text: 'Analyze this prescription image. Extract the medication name, dosage, and frequency. Return a JSON array.' },
              ],
            },
          ],
        });

        textResult = result?.response?.text?.();
        const parsed = textResult ? safeParseJson(textResult) : null;
        return new Response(JSON.stringify({ response: parsed }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'extractDrugDetails': {
        const { base64Image: drugImage } = payload ?? {};
        if (!drugImage) {
          return new Response(JSON.stringify({ error: 'Missing base64Image payload' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        result = await model.generateContent({
          contents: [
            {
              role: 'user',
              parts: [
                { inlineData: { mimeType: 'image/jpeg', data: drugImage } },
                {
                  text:
                    'Analyze this image of a medicine package/bottle. Extract the drug name, batch number (Batch/Lot), Expiry Date (Exp), and Manufacturing Date (Mfg/Mfd). Format dates as YYYY-MM-DD. It is critical to find the Manufacturing Date. Return a JSON object.',
                },
              ],
            },
          ],
        });

        textResult = result?.response?.text?.();
        const parsed = textResult ? safeParseJson(textResult) : null;
        return new Response(JSON.stringify({ response: parsed }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'checkDrugInteractions': {
        const { medications } = payload ?? {};
        if (!Array.isArray(medications)) {
          return new Response(JSON.stringify({ error: 'Missing medications array' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const medNames = medications.map((m: any) => `${m.name || ''} (${m.dosage || ''})`).join(', ');

        result = await model.generateContent({
          contents: [
            {
              role: 'user',
              parts: [
                { text: `Analyze the following list of medications for potential drug interactions: ${medNames}. Return a JSON array of alerts. If no interactions, return an empty array.` },
              ],
            },
          ],
        });

        textResult = result?.response?.text?.();
        const parsed = textResult ? safeParseJson(textResult) : null;
        return new Response(JSON.stringify({ response: parsed }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'analyzeSymptomInput': {
        const { symptomDescription } = payload ?? {};
        if (!symptomDescription) {
          return new Response(JSON.stringify({ error: 'Missing symptomDescription' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        result = await model.generateContent({
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text:
                    `You are a medical triage assistant. Analyze these symptoms: "${symptomDescription}".\n\n1. Create a concise technical summary for a pharmacist (using SBAR format if possible).\n2. Identify any RED FLAGS that require immediate doctor attention.\n3. List 3 questions the patient should ask the pharmacist.\n4. Provide a standard disclaimer.\nDo NOT provide a diagnosis.\nReturn a JSON object with keys: summary, redFlags (array), suggestedQuestions (array), disclaimer.`,
                },
              ],
            },
          ],
        });

        textResult = result?.response?.text?.();
        const parsed = textResult ? safeParseJson(textResult) : null;
        return new Response(JSON.stringify({ response: parsed }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default: {
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }
  } catch (error: any) {
    console.error('gemini-proxy error:', error);
    return new Response(JSON.stringify({ error: error?.message ?? String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
