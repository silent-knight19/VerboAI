/*
================================================================================
TTS SERVICE (The Mouth - Edge TTS Edition)
================================================================================
ROLE: The Speaker 🗣️

WHY:
  - We need to convert the AI's text response into audio.
  - We chose Microsoft Edge TTS because it sounds like a real human (Neural).
  - AND it's completely FREE (no API key required).

HOW:
  - We use the `edge-tts-universal` npm package.
  - This package connects to Microsoft's edge read-aloud service.
  - We request a specific voice (e.g., "en-US-AriaNeural").
  - We get back an MP3 buffer.

SAFEGUARDS:
  1. MAX CHARACTER LIMIT (to prevent giant audio files).
  2. STANDARDIZED VOICE (to ensure consistent accent).
================================================================================
*/

const { EdgeTTSClient, OUTPUT_FORMAT } = require('edge-tts-universal');
const AI_CONFIG = require('../../config/ai.config');

// ===========================================================================
// CONFIGURATION (Read from centralized ai.config.js)
// ===========================================================================
const VOICE_NAME = AI_CONFIG.TTS.VOICE_NAME;
const MAX_CHARACTERS = AI_CONFIG.TTS.MAX_CHARACTERS;

class TTSService {
  constructor() {
    console.log(`🗣️ EdgeTTS: Service initialized with voice: ${VOICE_NAME}`);
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
    console.log(`🗣️ EdgeTTS: Request received. Text length: ${text.length}`);

    // -------------------------------------------------------------------------
    // SAFEGUARD 1: INPUT SANITIZATION & TRUNCATION
    // -------------------------------------------------------------------------
    let cleanText = text || '';
    
    if (cleanText.length > MAX_CHARACTERS) {
      console.warn(`✂️ EdgeTTS: Text too long (${cleanText.length} chars). Truncating.`);
      
      // Cut it off at the limit
      cleanText = cleanText.substring(0, MAX_CHARACTERS);
      
      // Try to end on a full sentence if possible
      const lastDot = cleanText.lastIndexOf('.');
      if (lastDot > 0) {
        cleanText = cleanText.substring(0, lastDot + 1);
      } else {
        cleanText += '...';
      }
    }

    try {
      // -----------------------------------------------------------------------
      // EDGE TTS GENERATION
      // -----------------------------------------------------------------------
      const tts = new EdgeTTSClient();
      
      // Connect to the Edge TTS service
      await tts.setMetadata(VOICE_NAME, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

      // Collect all audio chunks into a buffer
      const audioChunks = [];
      
      const stream = tts.toStream(cleanText);
      
      for await (const chunk of stream) {
        // Each chunk has { type: 'audio' | 'metadata', data: Buffer }
        if (chunk.type === 'audio') {
          audioChunks.push(chunk.data);
        }
      }

      // Combine all chunks into a single Buffer
      const audioBuffer = Buffer.concat(audioChunks);
      
      console.log(`🗣️ EdgeTTS: Audio generated successfully. Size: ${audioBuffer.length} bytes.`);
      return audioBuffer;

    } catch (error) {
      console.error('❌ EdgeTTS: Generation failed:', error.message);
      throw new Error('TTS Service Failed');
    }
  }
}

module.exports = new TTSService();
