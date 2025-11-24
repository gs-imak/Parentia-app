import { ParsedOutputSchema, type ParsedOutput } from './validation.js';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
// Function to call the AI API works automatically in mock mode if no API key is set
async function callAI(text: string): Promise<string> {
  // Mock mode if no API key
  if (!OPENAI_API_KEY) {
    return JSON.stringify({
      summary: `Mock summary of: ${text.substring(0, 30)}...`,
      items: ['item1', 'item2', 'item3'],
      category: 'general',
    });
  }

  // Real AI call
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content:
            'Extract information from the text and return a JSON object with: summary (string), items (array of strings), category (string).',
        },
        { role: 'user', content: text },
      ],
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    throw new Error(`AI API error: ${response.status}`);
  }

  const data = await response.json();
  
  if (!data.choices || !data.choices[0] || !data.choices[0].message) {
    throw new Error('AI returned unexpected response structure');
  }
  
  return data.choices[0].message.content;
}

export async function processPipeline(text: string): Promise<ParsedOutput> {
  // Step 1: Call AI
  const aiResponse = await callAI(text);

  // Step 2: Parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(aiResponse);
  } catch (error) {
    throw new Error('AI returned invalid JSON');
  }

  // Step 3: Validate with Zod
  const result = ParsedOutputSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Validation failed: ${result.error.message}`);
  }

  return result.data;
}
