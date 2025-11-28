import { supabase } from './supabase';
import { Medication, InteractionLevel, InventoryItem, MarketTrend, Prediction, InteractionAlert } from '../types';
import { generateUUID } from '../utils/uuid';

export const analyzePrescriptionImage = async (base64Image: string): Promise<Medication[]> => {
  try {
    const { data, error } = await supabase.functions.invoke('gemini-proxy', {
      body: { action: 'analyzePrescriptionImage', payload: { base64Image } },
    });
    if (error) throw error;
    return data.response.map((item: any) => ({ ...item, id: generateUUID() }));
  } catch (error) {
    console.error("OCR Error:", error);
    return [];
  }
};

export const chatWithAssistant = async (message: string, role: string): Promise<string> => {
  try {
    const { data, error } = await supabase.functions.invoke('gemini-proxy', {
      body: { action: 'chat', payload: { message, role } },
    });
    if (error) throw error;
    return data.response;
  } catch (error) {
    console.error("Chat Error:", error);
    return "I am having trouble connecting right now. Please try again later.";
  }
};

// The following functions are not yet migrated to the Edge Function.
// They will need to be added to the proxy and updated here.

export const extractDrugDetails = async (base64Image: string): Promise<any> => {
  console.warn("extractDrugDetails is not yet migrated to the Edge Function.");
  return null;
};

export const checkDrugInteractions = async (medications: Medication[]): Promise<InteractionAlert[]> => {
  console.warn("checkDrugInteractions is not yet migrated to the Edge Function.");
  return [];
};

export const analyzeSymptomInput = async (symptomDescription: string): Promise<any> => {
  console.warn("analyzeSymptomInput is not yet migrated to the Edge Function.");
  return {
    summary: "Function not available.",
    redFlags: [],
    suggestedQuestions: [],
    disclaimer: "This feature is temporarily unavailable.",
  };
};

export const optimizeInventoryLevels = async (inventory: InventoryItem[]): Promise<Partial<InventoryItem>[]> => {
  console.warn("optimizeInventoryLevels is not yet migrated to the Edge Function.");
  return [];
};

export const generateMarketReport = async (trends: MarketTrend[], predictions: Prediction[]): Promise<string> => {
  console.warn("generateMarketReport is not yet migrated to the Edge Function.");
  return "Market analysis unavailable.";
};
