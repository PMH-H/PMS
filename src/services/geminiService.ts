// services/gemini.ts
import { supabase } from './supabase';
import {
  Medication,
  InteractionLevel,
  InventoryItem,
  MarketTrend,
  Prediction,
  InteractionAlert,
} from '../types';
import { generateUUID } from '../utils/uuid';
import { logAIMetric } from './metricsService';

type GeminiInvokeResult = {
  response?: any;
  error?: any;
  notImplemented?: boolean;
};

const invokeGemini = async (action: string, payload: any): Promise<GeminiInvokeResult> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

  try {
    const { data, error } = await supabase.functions.invoke('gemini-proxy', {
      body: { action, payload },
      headers: {
        'Content-Type': 'application/json',
      },
      // @ts-ignore - Supabase JS v2 supports passing fetch options but types might be strict
      options: {
        signal: controller.signal,
      },
    });

    clearTimeout(timeoutId);

    if (error) {
      console.error(`[gemini-proxy] invoke error for action=${action}:`, error);
      return { error };
    }

    if (!data) {
      console.warn(`[gemini-proxy] empty response for action=${action}`);
      return { response: null };
    }

    if (data.notImplemented) {
      console.warn(`[gemini-proxy] action not implemented remotely: ${action}`);
      return { notImplemented: true, response: data.response ?? null };
    }

    return { response: data.response };
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      console.error(`[gemini-proxy] timeout for action=${action}`);
      return { error: 'Request timed out. Please try again.' };
    }
    console.error(`[gemini-proxy] unexpected error for action=${action}:`, err);
    return { error: err };
  }
};

/** --- Public API --- */

export const analyzePrescriptionImage = async (base64Image: string): Promise<Medication[]> => {
  const startTime = performance.now();
  let success = false;
  let result: Medication[] = [];

  try {
    const { response, error, notImplemented } = await invokeGemini('analyzePrescriptionImage', { base64Image });

    // If Edge Function fails or doesn't exist, try direct API call as fallback
    if (error || notImplemented) {
      console.warn('Edge Function failed, trying direct Gemini API...', error);
      try {
        result = await analyzePrescriptionImageDirect(base64Image);
        success = result.length > 0;
      } catch (directError) {
        console.error('Direct API also failed:', directError);
        result = [];
        success = false;
      }
    } else if (response) {
      // Map returned items to Medication and add local id for UI usage
      result = (response as any[]).map((item: any) => ({ ...item, id: generateUUID() } as Medication));
      success = result.length > 0;
    }

    return result;
  } finally {
    // Log AI metrics
    const responseTimeMs = Math.round(performance.now() - startTime);
    logAIMetric({
      action: 'prescription_parse',
      success,
      responseTimeMs,
      metadata: { medicationsFound: result.length }
    }).catch(() => { }); // Don't block on metric logging
  }
};

// Direct Gemini API fallback (when Edge Function unavailable)
const analyzePrescriptionImageDirect = async (base64Image: string): Promise<Medication[]> => {
  const apiKey = (import.meta as any).env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    console.error('VITE_GEMINI_API_KEY not found in environment');
    return [];
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: 'Extract all medications from this prescription image. Return a JSON array with objects containing: name (medication name), dosage (e.g., "500mg"), frequency (e.g., "twice daily"). Only return the JSON array, no other text.' },
            { inline_data: { mime_type: 'image/jpeg', data: base64Image.split(',')[1] } }
          ]
        }]
      })
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Gemini API response:', errorText);
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]';

  // Extract JSON from response
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  const medications = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

  return medications.map((item: any) => ({ ...item, id: generateUUID() }));
};

export const chatWithAssistant = async (message: string, role: string): Promise<string> => {
  const { response, error } = await invokeGemini('chat', { message, role });
  if (error) {
    console.error('chatWithAssistant - Chat Error:', error);
    return 'I am having trouble connecting right now. Please try again later.';
  }
  return typeof response === 'string' ? response : response?.text ?? 'No response from assistant.';
};

export const extractDrugDetails = async (base64Image: string): Promise<any | null> => {
  const { response, notImplemented, error } = await invokeGemini('extractDrugDetails', { base64Image });
  if (error) {
    console.error('extractDrugDetails - Drug Info Extraction Error:', error);
    return null;
  }
  if (notImplemented) {
    // Migration/fallback behavior: log and return null so UI can show "not available"
    return null;
  }
  return response ?? null;
};

export const checkDrugInteractions = async (medications: Medication[]): Promise<InteractionAlert[]> => {
  const { response, notImplemented, error } = await invokeGemini('checkDrugInteractions', { medications });
  if (error) {
    console.error('checkDrugInteractions - Interaction Check Error:', error);
    return [];
  }
  if (notImplemented) return [];
  return (response as InteractionAlert[]) || [];
};

export const analyzeSymptomInput = async (symptomDescription: string): Promise<any> => {
  const { response, notImplemented, error } = await invokeGemini('analyzeSymptomInput', { symptomDescription });
  if (error) {
    console.error('analyzeSymptomInput - Symptom Check Error:', error);
    return {
      summary: 'Error processing symptoms.',
      redFlags: [],
      suggestedQuestions: ['Please consult a doctor directly.'],
      disclaimer: 'System error. Seek professional help.',
    };
  }
  if (notImplemented) {
    return {
      summary: 'Function not available.',
      redFlags: [],
      suggestedQuestions: [],
      disclaimer: 'This feature is temporarily unavailable.',
    };
  }
  return response;
};

export const optimizeInventoryLevels = async (inventory: InventoryItem[]): Promise<Partial<InventoryItem>[]> => {
  const { response, notImplemented, error } = await invokeGemini('optimizeInventoryLevels', { inventory });
  if (error) {
    console.error('optimizeInventoryLevels error:', error);
    return [];
  }
  if (notImplemented) return [];
  return (response as Partial<InventoryItem>[]) || [];
};

export const generateMarketReport = async (
  trends: MarketTrend[],
  predictions: Prediction[]
): Promise<string> => {
  const { response, notImplemented, error } = await invokeGemini('generateMarketReport', { trends, predictions });
  if (error) {
    console.error('generateMarketReport error:', error);
    return 'Market analysis unavailable.';
  }
  if (notImplemented) return 'Market analysis unavailable.';
  return typeof response === 'string' ? response : JSON.stringify(response);
};

export const generateMarketPredictions = async (): Promise<Prediction[]> => {
  const { response, notImplemented, error } = await invokeGemini('generateMarketPredictions', {});
  if (error || notImplemented) {
    console.error('generateMarketPredictions failed or not implemented');
    return [];
  }
  return (response as Prediction[]) || [];
};

export const runABCOptimization = async (facilityId: string) => {
  const { error } = await supabase.rpc('recalculate_abc_item_level', { p_facility_id: facilityId });
  if (error) throw error;
};
