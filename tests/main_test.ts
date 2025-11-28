import { assert } from 'https://deno.land/std@0.177.0/testing/asserts.ts';
import { supabase } from '../services/supabase.ts';

Deno.test('Metric Events and AI Edge Function', async (t) => {
  const testUserId = 'a1b2c3d4-e5f6-7890-1234-567890abcdef';

  await t.step('it should create a metric event', async () => {
    const { data, error } = await supabase
      .from('metric_events')
      .insert({ name: 'test_event', user_id: testUserId, payload: { test: true } });

    assert(!error, `Error creating metric event: ${error?.message}`);
  });

  await t.step('it should return a valid AI response for chat', async () => {
    const { data, error } = await supabase.functions.invoke('gemini-proxy', {
      body: { action: 'chat', payload: { message: 'Hello', role: 'PATIENT' } },
    });

    assert(!error, `Error invoking Edge Function for chat: ${error?.message}`);
    assert(data.response, 'AI response for chat should not be empty');
  });

  await t.step('it should return a valid AI response for prescription analysis', async () => {
    // This is a base64 encoded image of a prescription.
    const base64Image = "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAgACADAREAAhEBAxEB/8QAGQABAAMBAQAAAAAAAAAAAAAAAAUGBwID/8QAJRAAAgEDAwQCAwAAAAAAAAAAAAECAwQRBQYSIQcxQRNRcSIy/8QAFgEBAQEAAAAAAAAAAAAAAAAAAAEC/8QAFxEBAQEBAAAAAAAAAAAAAAAAAAERAf/aAAwDAQACEQMRAD8A3EAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADfpt/bJ9gY/RVt8I3T9U+E/D+2L3c299n2B5vV1n7tPuA5AAAAAAAAAAAAAAAAAAAAAAAAP//Z";
    const { data, error } = await supabase.functions.invoke('gemini-proxy', {
        body: { action: 'analyzePrescriptionImage', payload: { base64Image } },
    });

    assert(!error, `Error invoking Edge Function for prescription analysis: ${error?.message}`);
    assert(data.response, 'AI response for prescription analysis should not be empty');
    });
});
