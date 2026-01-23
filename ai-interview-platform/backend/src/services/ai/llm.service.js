/*
================================================================================
LLM SERVICE (The Brain)
================================================================================
ROLE: The Thinker 🧠

WHY:
  - We need to send user text to the AI and get a response.
  - BUT we must assume the user is trying to trick the AI ("Prompt Injection").
  - AND we must prevent the AI from rambling (Cost Control).

HOW:
  - We use the "Sandwich Method" for every request:
      Layer 1: Immutable System Prompt (Top Bun)
      Layer 2: Conversation History (Meat)
      Layer 3: User Input (Bottom Bun)
  - We pass `max_tokens` to OpenAI to strictly limit output length.

SAFEGUARDS IMPLEMENTED:
  1. IMMUTABLE PROMPT (prevents identity theft).
  2. TOKEN LIMITS (prevents huge bills).
  3. TIMEOUTS (prevents UI hanging).
================================================================================
*/

const OpenAI = require('openai');
const AI_CONFIG = require('../../config/ai.config');
const SYSTEM_PROMPT = require('../../config/prompts/interviewer.prompt');

class LLMService {
  constructor() {
    // secure initialization using env vars
    this.openai = new OpenAI({
      baseURL: AI_CONFIG.LLM.BASE_URL,
      apiKey: process.env.CEREBRAS_API_KEY || 'mock-key', // Look for CEREBRAS key
    });
  }

  // ===========================================================================
  // GENERATE RESPONSE
  // ===========================================================================
  /*
    generateResponse(history, userMessage)

    PARAMS:
      - history: Array of previous messages [{role: 'user', content: '...'}, ...]
      - userMessage: The new text from the user.

    RETURNS: String (The AI's spoken response)
  */
  // ===========================================================================
  // GENERATE RESPONSE (STREAMING)
  // ===========================================================================
  /*
    generateResponseStream(history, userMessage)

    RETURNS: Async Generator (Yields chunks of text)
  */
  async *generateResponseStream(history, userMessage) {
    if (!userMessage) return;

    console.log(`🧠 LLM: Thinking (Stream)... Input length: ${userMessage.length}`);

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history,
      { role: 'user', content: userMessage }
    ];

    try {
      const stream = await this.openai.chat.completions.create({
        model: AI_CONFIG.LLM.MODEL_NAME,
        messages: messages,
        max_tokens: AI_CONFIG.LLM.MAX_TOKENS_PER_RESPONSE,
        temperature: AI_CONFIG.LLM.TEMPERATURE,
        stream: true, // ENABLE STREAMING
      }, {
        timeout: AI_CONFIG.LLM.TIMEOUT_MS 
      });

      for await (const chunk of stream) {
        const token = chunk.choices[0]?.delta?.content || "";
        if (token) {
           yield token;
        }
      }
      
      console.log(`🧠 LLM: Stream finished.`);

    } catch (error) {
      console.error('❌ LLM: Streaming failed:', error.message);
      yield "I'm having trouble thinking right now.";
    }
  }
}

module.exports = new LLMService();
