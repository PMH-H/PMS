
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// 1. Configure these or load from .env
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";

// Initialize Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testGemini3() {
    console.log("Testing Gemini 3 Integration (Edge Function)...");

    // Payload mimicking the user's initial request pattern
    const payload = {
        action: "universal-generate",
        payload: {
            // "contents" follows the Gemini API structure
            contents: [
                {
                    role: "user",
                    parts: [
                        { text: "Why is the sky blue? Answer with high thinking level." }
                    ]
                }
            ],
            // "thinkingConfig" as requested
            thinkingConfig: {
                thinkingLevel: "HIGH"
            },
            // "tools" for Google Search
            tools: [
                { googleSearch: {} }
            ]
        }
    };

    const { data, error } = await supabase.functions.invoke('gemini-proxy', {
        body: payload,
    });

    if (error) {
        console.error("Error invoking function:", error);
    } else {
        console.log("Success! Response from Gemini 3:");
        console.log(JSON.stringify(data, null, 2));
    }
}

if (import.meta.main) {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        console.error("Please set SUPABASE_URL and SUPABASE_ANON_KEY env vars to run this script.");
    } else {
        await testGemini3();
    }
}
