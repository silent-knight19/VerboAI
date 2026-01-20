/*
================================================================================
TTS SERVICE (The Mouth)
================================================================================
ROLE: The Speaker 🗣️

WHY:
  - We convert the AI's text response into audio.
  - BUT Audio generation is EXPENSIVE (cost per character).
  - AND we need to ensure the audio format is always playable by the frontend.

HOW:
  - We receive text from the LLM.
  - We "Sanitize" it:
    1. Truncate if too long (Safety Valve).
    2. Remove markdown/emojis (optional, but good for cleanliness).
  - We send to OpenAI TTS API.
  - We return a standard MP3 buffer.

SAFEGUARDS IMPLEMENTED:
  1. MAX CHARACTER LIMIT (Money Guard).
  2. FORMAT STANDARDIZATION (Compatibility Guard).
================================================================================
*/

const OpenAI = require('openai');
const AI_CONFIG = require('../../config/ai.config');

class TTSService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || 'mock-key',
    });
  }

  // ===========================================================================
  // GENERATE AUDIO
  // ===========================================================================
  /*
    generateAudio(text)
    
    PARAMS:
      - text: String (The raw text from LLM)
    
    RETURNS: Buffer (MP3 audio data)
  */
  async generateAudio(text) {
    console.log(`🗣️ TTS: Request received. Text length: ${text.length}`);

    // -------------------------------------------------------------------------
    // SAFEGUARD 1: INPUT SANITIZATION & TRUNCATION
    // -------------------------------------------------------------------------
    let cleanText = text || '';
    
    // Check Hard Limit
    if (cleanText.length > AI_CONFIG.TTS.MAX_CHARACTERS) {
      console.warn(`✂️ TTS: Text too long (${cleanText.length} chars). Truncating.`);
      
      // Cut it off at the limit
      cleanText = cleanText.substring(0, AI_CONFIG.TTS.MAX_CHARACTERS);
      
      // Try to end on a full sentence if possible (simple heuristic)
      const lastDot = cleanText.lastIndexOf('.');
      if (lastDot > 0) {
        cleanText = cleanText.substring(0, lastDot + 1);
      } else {
        // If no dot, just append ...
        cleanText += '...';
      }
    }

    try {
      // -----------------------------------------------------------------------
      // SAFEGUARD 2: STANDARDIZED API CALL
      // -----------------------------------------------------------------------
      // We force specific format rules here, regardless of what input was requested.
      const mp3 = await this.openai.audio.speech.create({
        model: 'tts-1', // Standard model (cheaper/faster than tts-1-hd)
        voice: AI_CONFIG.TTS.VOICE_ID,
        input: cleanText,
        speed: AI_CONFIG.TTS.SPEED,
        response_format: 'mp3', // ALways MP3
      });

      console.log('🗣️ TTS: Audio generated successfully.');
      
      // Convert standard response to Buffer
      const buffer = Buffer.from(await mp3.arrayBuffer());
      return buffer;

    } catch (error) {
      console.error('❌ TTS: Generation failed:', error.message);
      
      // FAIL SAFE
      // If output fails, we might return null or a specific error code
      // The socket handler will see this and skip playing audio.
      throw new Error('TTS Service Failed');
    }
  }
}

module.exports = new TTSService();
