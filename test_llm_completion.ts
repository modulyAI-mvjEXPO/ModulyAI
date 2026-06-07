import 'dotenv/config';
import { chatCompletion } from './src/lib/ai/llm.ts';

async function run() {
  try {
    const res = await chatCompletion({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: 'hi' }] });
    console.log('LLM Success! Response:', res);
  } catch (e) {
    console.error('LLM Crash:', e);
  }
}

run();
