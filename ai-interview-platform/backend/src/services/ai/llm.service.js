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
  async generateResponse(history, userMessage) {
    if (!userMessage) return "I didn't catch that.";

    console.log(`🧠 LLM: Thinking... Input length: ${userMessage.length}`);

    // -------------------------------------------------------------------------
    // SAFEGUARD 1: THE SANDWICH CONSTRUCTION
    // -------------------------------------------------------------------------
    // We ALWAYS put the System Prompt first.
    // We treat user input purely as 'content'.
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history,
      { role: 'user', content: userMessage }
    ];

    try {
      // -----------------------------------------------------------------------
      // SAFEGUARD 2: COST & TIMEOUT CONTROLS
      // -----------------------------------------------------------------------
      const completion = await this.openai.chat.completions.create({
        model: AI_CONFIG.LLM.MODEL_NAME,
        messages: messages,
        // STRICT Output Limit (Money Saver)
        max_tokens: AI_CONFIG.LLM.MAX_TOKENS_PER_RESPONSE,
        temperature: AI_CONFIG.LLM.TEMPERATURE,
      }, {
        // STRICT Time Limit (UI Saver)
        timeout: AI_CONFIG.LLM.TIMEOUT_MS 
      });

      const answer = completion.choices[0].message.content;
      console.log(`🧠 LLM: Answer generated. Tokens: ${completion.usage.total_tokens}`);
      
      return answer;

    } catch (error) {
      console.error('❌ LLM: Generation failed:', error.message);
      
      // FALLBACK RESPONSE (Graceful degradation)
      // If OpenAI is down or user has no credits, don't crash the app.
      return "I'm having some trouble connecting to my brain right now. Can we try that again?";
    }
  }
}

module.exports = new LLMService();
