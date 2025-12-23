// gemini-proxy.ts (Deno Edge Function)
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');

if (!GEMINI_API_KEY) {
  console.error('Missing GEMINI_API_KEY environment variable.');
}

// Initialize client
const ai = new GoogleGenerativeAI(GEMINI_API_KEY || '');

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

// Default model and requested model constants
// We default to the user's requested model for generic queries if available
const REQUESTED_MODEL = 'gemini-3-pro-preview';

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
    // Determine model based on action or payload override
    let modelName = payload?.model || REQUESTED_MODEL;
    let model = ai.getGenerativeModel({ model: modelName });

    let result: any;
    let textResult: string | undefined;

    switch (action) {
      case 'universal-generate': {
        // payload: { contents: [], tools: [], thinkingConfig: {}, systemInstruction: string }
        const { contents, tools, thinkingConfig, systemInstruction } = payload ?? {};

        if (!contents || !Array.isArray(contents)) {
          return new Response(JSON.stringify({ error: "Missing 'contents' in payload for universal-generate" }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const generateConfig: any = {};

        if (tools) {
          generateConfig.tools = tools;
        }

        if (thinkingConfig) {
          generateConfig.thinkingConfig = thinkingConfig;
        }

        // Re-initialize model with config if needed
        model = ai.getGenerativeModel({
          model: modelName,
          systemInstruction,
          tools: tools,
        });

        result = await model.generateContent({
          contents,
          generationConfig: thinkingConfig ? { ...generateConfig, thinkingConfig } : undefined
        });

        textResult = result?.response?.text?.() ?? String(result?.response ?? '');

        return new Response(JSON.stringify({ response: textResult, raw: result }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'chat': {
        const { message, role } = payload ?? {};
        const systemInstruction =
          role === 'pharmacist'
            ? 'You are a helpful assistant for a pharmacist. You help with drug info, stock logic, and detailed medical interaction explanations. Be professional and concise.'
            : 'You are a helpful health assistant for a patient. You explain medications simply. Always advise consulting a real doctor or pharmacist for medical advice. Do not diagnose. Keep answers short and easy to read on mobile.';

        model = ai.getGenerativeModel({ model: modelName, systemInstruction });

        result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: message || '' }] }],
        });

        textResult = result?.response?.text?.() ?? String(result?.response ?? '');
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

        // Use the powerful model for image analysis
        model = ai.getGenerativeModel({ model: modelName });

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

        model = ai.getGenerativeModel({ model: modelName });

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

      case 'generateMarketReport': {
        const { trends, predictions } = payload ?? {};
        // Concise summary generation
        const prompt = `
          Analyze the following pharmaceutical market trends and disease predictions for Zambia.
          Trends: ${JSON.stringify(trends)}
          Predictions: ${JSON.stringify(predictions)}
          
          Provide a professional HTML-formatted Executive Summary (no markdown, just <b>, <p>, <ul> tags) suitable for a dashboard.
          Focus on:
          1. Supply Chain Risks
          2. Top performing categories
          3. Recommended Actions
          
          Keep it under 200 words.
        `;

        result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
        });

        textResult = result?.response?.text?.();
        // Return raw text (HTML) as response
        return new Response(JSON.stringify({ response: textResult }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'generateMarketPredictions': {
        // This would ideally take historical data. For now, we ask Gemini to hypothesize based on seasonality.
        // In a real system, we'd pass CSV data.
        const prompt = `
            Act as a pharmaceutical supply chain analyst for Southern Africa.
            Generate 3 plausible supply chain predictions for the upcoming month based on typical seasonality (current month: ${new Date().toLocaleString('default', { month: 'long' })}).
            Return a JSON array of objects with keys: id (string), type (string: DISEASE|DRUG_DEMAND|PRICE_SPIKE), title, probability (number 0-100), description, impactLevel (HIGH|MEDIUM|LOW), targetDate.
         `;

        result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
        });

        textResult = result?.response?.text?.();
        const parsed = textResult ? safeParseJson(textResult) : [];
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
