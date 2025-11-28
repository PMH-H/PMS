import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const ai = new GoogleGenerativeAI(GEMINI_API_KEY);

serve(async (req) => {
  const { action, payload } = await req.json();

  try {
    const model = ai.getGenerativeModel({ model: 'gemini-1.5-flash' });
    let result;

    switch (action) {
      case 'chat':
        const { message, role } = payload;
        const systemInstruction = role === 'PHARMACIST'
          ? "You are a helpful assistant for a pharmacist. You help with drug info, stock logic, and detailed medical interaction explanations. Be professional and concise."
          : "You are a helpful health assistant for a patient. You explain medications simply. Always advise consulting a real doctor or pharmacist for medical advice. Do not diagnose. Keep answers short and easy to read on mobile.";

        result = await model.generateContent({
          contents: [{ role: "user", parts: [{ text: message }] }],
          systemInstruction,
        });
        return new Response(JSON.stringify({ response: result.response.text() }), {
          headers: { 'Content-Type': 'application/json' },
        });

      case 'analyzePrescriptionImage':
        const { base64Image } = payload;
        result = await model.generateContent({
          contents: [
            { role: "user", parts: [
              { inlineData: { mimeType: "image/jpeg", data: base64Image } },
              { text: "Analyze this prescription image. Extract the medication name, dosage, and frequency. Return a JSON array." }
            ]}
          ],
        });
        return new Response(JSON.stringify({ response: JSON.parse(result.response.text()) }), {
          headers: { 'Content-Type': 'application/json' },
        });

      case 'extractDrugDetails':
        const { base64Image: drugImage } = payload;
        result = await model.generateContent({
            contents: [
                { role: "user", parts: [
                    { inlineData: { mimeType: "image/jpeg", data: drugImage } },
                    { text: "Analyze this image of a medicine package/bottle. Extract the drug name, batch number (Batch/Lot), Expiry Date (Exp), and Manufacturing Date (Mfg/Mfd). Format dates as YYYY-MM-DD. It is critical to find the Manufacturing Date." }
                ]}
            ],
        });
        return new Response(JSON.stringify({ response: JSON.parse(result.response.text()) }), {
            headers: { 'Content-Type': 'application/json' },
        });

      case 'checkDrugInteractions':
        const { medications } = payload;
        const medNames = medications.map((m: any) => `${m.name} (${m.dosage})`).join(", ");
        result = await model.generateContent(`Analyze the following list of medications for potential drug interactions: ${medNames}. Return a JSON array of alerts. If no interactions, return an empty array.`);
        return new Response(JSON.stringify({ response: JSON.parse(result.response.text()) }), {
            headers: { 'Content-Type': 'application/json' },
        });

      case 'analyzeSymptomInput':
        const { symptomDescription } = payload;
        result = await model.generateContent(`You are a medical triage assistant. Analyze these symptoms: "${symptomDescription}".
            1. Create a concise technical summary for a pharmacist (using SBAR format if possible).
            2. Identify any RED FLAGS that require immediate doctor attention.
            3. List 3 questions the patient should ask the pharmacist.
            4. Provide a standard disclaimer.
            Do NOT provide a diagnosis.`);
        return new Response(JSON.stringify({ response: JSON.parse(result.response.text()) }), {
            headers: { 'Content-Type': 'application/json' },
        });

      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
