/*
================================================================================
TTS SERVICE (The Mouth - Python Edge TTS Edition)
================================================================================
ROLE: The Speaker 🗣️

WHY:
  - We need to convert the AI's text response into audio.
  - The Node.js libraries (even custom ones) are getting blocked (403).
  - The Python `edge-tts` library is actively maintained and works reliably.

HOW:
  - We spawn a child process to run `edge-tts`.
  - We capture the output to a temporary file or stdout.
  - We read the buffer and return it.

SAFEGUARDS:
  1. MAX CHARACTER LIMIT.
  2. ERROR HANDLING on spawn.
================================================================================
*/

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const util = require('util');
const execPromise = util.promisify(exec);
const readFilePromise = util.promisify(fs.readFile);
const unlinkPromise = util.promisify(fs.unlink);

const AI_CONFIG = require('../../config/ai.config');

// ===========================================================================
// CONFIGURATION (Read from centralized ai.config.js)
// ===========================================================================
const VOICE_NAME = AI_CONFIG.TTS.VOICE_NAME; // e.g. "en-US-AriaNeural"
const MAX_CHARACTERS = AI_CONFIG.TTS.MAX_CHARACTERS;

class TTSService {
  constructor() {
    console.log(`🗣️ EdgeTTS (Python): Service initialized with voice: ${VOICE_NAME}`);
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
  async generateAudio(text = '') {
    console.log(`🗣️ EdgeTTS: Request received. Text length: ${(text || '').length}`);

    // -------------------------------------------------------------------------
    // SAFEGUARD 1: INPUT SANITIZATION & TRUNCATION
    // -------------------------------------------------------------------------
    let cleanText = text || '';
    
    // Remove/replace special characters that might break the CLI shell command
    // - Double quotes -> single quotes (for shell safety)
    // - Newlines -> spaces (for single-line command)
    // - Backticks -> removed (shell command substitution chars)
    // - Asterisks -> removed (markdown bold that TTS can't pronounce anyway)
    // - Dollar signs -> removed (shell variable chars)
    // - Backslashes -> removed (escape chars)
    cleanText = cleanText
      .replace(/"/g, "'")           // Double quotes to single
      .replace(/\n/g, " ")          // Newlines to spaces
      .replace(/`/g, "")            // Remove backticks (shell danger!)
      .replace(/\*/g, "")           // Remove asterisks (markdown formatting)
      .replace(/\$/g, "")           // Remove dollar signs (shell variables)
      .replace(/\\/g, "")           // Remove backslashes
      .replace(/[{}[\]]/g, "")      // Remove braces and brackets
      .trim();

    if (cleanText.length > MAX_CHARACTERS) {
      console.warn(`✂️ EdgeTTS: Text too long (${cleanText.length} chars). Truncating.`);
      cleanText = cleanText.substring(0, MAX_CHARACTERS) + '...';
    }

    const tempFile = path.resolve(__dirname, `../../temp-${uuidv4()}.mp3`);
    
    try {
      // -----------------------------------------------------------------------
      // EXECUTE PYTHON CLI
      // -----------------------------------------------------------------------
      // Command: edge-tts --voice "en-US-AriaNeural" --text "Hello world" --write-media "/path/to/temp.mp3"
      console.log('🗣️ EdgeTTS: Spawning python process...');
      
      // Use 'python3 -m edge_tts' to avoid PATH issues
      const command = `python3 -m edge_tts --voice "${VOICE_NAME}" --text "${cleanText}" --write-media "${tempFile}"`;
      console.log(`🗣️ EdgeTTS: Executing command: ${command}`);
      await execPromise(command);

      // Read the file back into buffer
      console.log('🗣️ EdgeTTS: Reading generated file...');
      const audioBuffer = await readFilePromise(tempFile);
      
      console.log(`🗣️ EdgeTTS: Audio generated successfully. Size: ${audioBuffer.length} bytes.`);
      
      // Cleanup
      await unlinkPromise(tempFile);
      
      return audioBuffer;

    } catch (error) {
      console.error('❌ EdgeTTS: Generation failed:', error.message);
      // Try to cleanup even on error
      if (fs.existsSync(tempFile)) await unlinkPromise(tempFile).catch(() => {});
      throw new Error('TTS Service Failed');
    }
  }
}

module.exports = new TTSService();
