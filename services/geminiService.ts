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

type GeminiInvokeResult = {
  response?: any;
  error?: any;
  notImplemented?: boolean;
};

const invokeGemini = async (action: string, payload: any): Promise<GeminiInvokeResult> => {
  try {
    const { data, error } = await supabase.functions.invoke('gemini-proxy', {
      body: { action, payload },
    });
    if (error) {
      // remote function returned an error object (invoke-level)
      console.error(`[gemini-proxy] invoke error for action=${action}:`, error);
      return { error };
    }

    // Expect the edge function to return a structured object e.g. { response: ..., notImplemented: boolean }
    if (!data) {
      console.warn(`[gemini-proxy] empty response for action=${action}`);
      return { response: null };
    }

    // Normalized return
    if (data.notImplemented) {
      console.warn(`[gemini-proxy] action not implemented remotely: ${action}`);
      return { notImplemented: true, response: data.response ?? null };
    }

    return { response: data.response };
  } catch (err) {
    console.error(`[gemini-proxy] unexpected error for action=${action}:`, err);
    return { error: err };
  }
};

/** --- Public API --- */

export const analyzePrescriptionImage = async (base64Image: string): Promise<Medication[]> => {
  const { response, error } = await invokeGemini('analyzePrescriptionImage', { base64Image });
  if (error) {
    console.error('analyzePrescriptionImage - OCR Error:', error);
    return [];
  }
  if (!response) return [];

  // Map returned items to Medication and add local id for UI usage
  return (response as any[]).map((item: any) => ({ ...item, id: generateUUID() } as Medication));
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
