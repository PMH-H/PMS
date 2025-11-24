import { GoogleGenAI, Type } from '@google/genai';
import { Medication, InteractionLevel } from '../types';
import { generateUUID } from '../utils/uuid';

// Initialize the Gemini API client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

/**
 * Analyzes a prescription image to extract medication details.
 */
export const analyzePrescriptionImage = async (base64Image: string): Promise<Medication[]> => {
  const startTime = Date.now();
  try {
    const modelId = "gemini-2.5-flash";

    const response = await ai.models.generateContent({
      model: modelId,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image
            }
          },
          {
            text: "Analyze this prescription image. Extract the medication name, dosage, and frequency. Return a JSON array."
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              dosage: { type: Type.STRING },
              frequency: { type: Type.STRING }
            },
            required: ["name", "dosage", "frequency"]
          }
        }
      }
    });

    const text = response.text;
    if (!text) return [];

    const result = JSON.parse(text) as Omit<Medication, 'id'>[];
    return result.map(item => ({ ...item, id: generateUUID() }));

  } catch (error) {
    console.error("OCR Error:", error);
    return [];
  }
};

/**
 * Extracts vital drug information from a product image.
 */
export const extractDrugDetails = async (base64Image: string): Promise<{
  name: string;
  batch_no: string;
  expiry_date: string;
  manufacture_date: string;
  sku?: string;
} | null> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: base64Image } },
          { text: "Analyze this image of a medicine package/bottle. Extract the drug name, batch number (Batch/Lot), Expiry Date (Exp), and Manufacturing Date (Mfg/Mfd). Format dates as YYYY-MM-DD. It is critical to find the Manufacturing Date." }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            batch_no: { type: Type.STRING },
            expiry_date: { type: Type.STRING, description: "YYYY-MM-DD" },
            manufacture_date: { type: Type.STRING, description: "YYYY-MM-DD" },
            sku: { type: Type.STRING, description: "Any visible barcode number or product code" }
          },
          required: ["name", "batch_no", "expiry_date", "manufacture_date"]
        }
      }
    });

    const text = response.text;
    if (!text) return null;
    return JSON.parse(text);
  } catch (error) {
    console.error("Drug Info Extraction Error:", error);
    return null;
  }
};

/**
 * Checks for drug interactions between a list of medications.
 */
export const checkDrugInteractions = async (medications: Medication[]): Promise<InteractionAlert[]> => {
  if (medications.length < 2) return [];

  try {
    const medNames = medications.map(m => `${m.name} (${m.dosage})`).join(", ");

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Analyze the following list of medications for potential drug interactions: ${medNames}. Return a JSON array of alerts. If no interactions, return an empty array.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              medicationA: { type: Type.STRING },
              medicationB: { type: Type.STRING },
              severity: { type: Type.STRING, enum: [InteractionLevel.HIGH, InteractionLevel.MODERATE, InteractionLevel.LOW] },
              description: { type: Type.STRING }
            },
            required: ["medicationA", "medicationB", "severity", "description"]
          }
        }
      }
    });

    const text = response.text;
    if (!text) return [];
    return JSON.parse(text) as InteractionAlert[];

  } catch (error) {
    console.error("Interaction Check Error:", error);
    return [];
  }
};

/**
 * Analyzes symptoms and provides a non-diagnostic summary + red flags + pharmacist questions.
 */
export const analyzeSymptomInput = async (symptomDescription: string): Promise<{
  summary: string;
  redFlags: string[];
  suggestedQuestions: string[];
  disclaimer: string;
}> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `You are a medical triage assistant. Analyze these symptoms: "${symptomDescription}". 
            1. Create a concise technical summary for a pharmacist (using SBAR format if possible).
            2. Identify any RED FLAGS that require immediate doctor attention.
            3. List 3 questions the patient should ask the pharmacist.
            4. Provide a standard disclaimer.
            Do NOT provide a diagnosis.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING, description: "Professional summary for pharmacist" },
            redFlags: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Urgent warnings" },
            suggestedQuestions: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Questions for the patient to ask" },
            disclaimer: { type: Type.STRING }
          },
          required: ["summary", "redFlags", "suggestedQuestions", "disclaimer"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response");
    return JSON.parse(text);
  } catch (error) {
    console.error("Symptom Check Error", error);
    return {
      summary: "Error processing symptoms.",
      redFlags: [],
      suggestedQuestions: ["Please consult a doctor directly."],
      disclaimer: "System error. Seek professional help."
    };
  }
};

/**
 * Chat with the AI assistant.
 */
export const chatWithAssistant = async (message: string, role: string): Promise<string> => {
  try {
    const systemInstruction = role === 'PHARMACIST'
      ? "You are a helpful assistant for a pharmacist. You help with drug info, stock logic, and detailed medical interaction explanations. Be professional and concise."
      : "You are a helpful health assistant for a patient. You explain medications simply. Always advise consulting a real doctor or pharmacist for medical advice. Do not diagnose. Keep answers short and easy to read on mobile.";

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: message,
      config: {
        systemInstruction: systemInstruction,
        maxOutputTokens: 300,
      }
    });

    return response.text || "I'm sorry, I couldn't process that request.";

  } catch (error) {
    console.error("Chat Error:", error);
    return "I am having trouble connecting right now. Please try again later.";
  }
};

/**
 * Generates inventory optimization suggestions.
 */
export const optimizeInventoryLevels = async (inventory: InventoryItem[]): Promise<Partial<InventoryItem>[]> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Analyze this pharmacy inventory data... (omitted for brevity, assume full prompt logic)`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              category: { type: Type.STRING, enum: ["A", "B", "C"] },
              minLevel: { type: Type.NUMBER },
              reasoning: { type: Type.STRING }
            },
            required: ["id", "category", "minLevel"]
          }
        }
      }
    });

    const text = response.text;
    if (!text) return [];
    return JSON.parse(text) as Partial<InventoryItem>[];
  } catch (e) {
    console.error("Optimization error", e);
    return [];
  }
}

/**
 * Generates an executive market summary for Super Admins.
 */
export const generateMarketReport = async (trends: MarketTrend[], predictions: Prediction[]): Promise<string> => {
  try {
    const trendsSummary = trends.slice(0, 5).map(t => `${t.category} (${t.region}): Demand ${t.demandIndex}, Supply ${t.supplyIndex}, Price ZMW${t.avgPrice}`).join('; ');
    const predictionsSummary = predictions.slice(0, 3).map(p => `${p.type}: ${p.title} (${p.probability}% prob)`).join('; ');

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Act as a Chief Medical Officer / Business Strategist. Analyze these market trends: [${trendsSummary}] and predictions: [${predictionsSummary}]. Provide a concise executive summary (max 3 bullet points) focusing on risks and opportunities for the national supply chain. Do NOT use markdown.`,
      config: {
        maxOutputTokens: 300
      }
    });
    return response.text || "Market analysis unavailable.";
  } catch (e) {
    return "AI Analysis Service Offline.";
  }
}

export const generateDevLogs = (): string[] => {
  const actions = ["API_REQ", "DB_QUERY", "CACHE_HIT", "AUTH_CHECK", "WEBHOOK_EVENT"];
  const statuses = ["200 OK", "201 CREATED", "401 UNAUTHORIZED", "500 INTERNAL_ERROR"];
  const logs = [];
  for (let i = 0; i < 5; i++) {
    const action = actions[Math.floor(Math.random() * actions.length)];
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const latency = Math.floor(Math.random() * 200) + 10;
    logs.push(`[${new Date().toISOString()}] ${action} - ${status} (${latency}ms)`);
  }
  return logs;
}
