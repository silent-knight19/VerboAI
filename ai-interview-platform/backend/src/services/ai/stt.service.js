/*
================================================================================
STT SERVICE (Speech-to-Text) with SAFEGUARDS
================================================================================
ROLE: The Ear 👂

WHY:
  - We listen to audio streams from the user.
  - BUT we must protect the system from:
    1. Silence: User walks away (AFK).
    2. Filibustering: User talks for 10 minutes straight.
    3. Noise: Background noise wasting our processing time.

HOW:
  - We process audio in "chunks".
  - We track:
    - `lastVoiceTime`: When did we last hear a human?
    - `continuousSpeechStart`: When did they START talking non-stop?
  - If safeguards trigger, we force a "Turn End" event.

SAFEGUARDS IMPLEMENTED:
  1. SILENCE TIMEOUT (from AI_CONFIG)
  2. MAX DURATION (from AI_CONFIG)
================================================================================
*/

const AI_CONFIG = require('../../config/ai.config');

class STTService {
  constructor() {
    // Track conversation state per user
    // Key: userId, Value: { lastVoiceTime, continuousSpeechStart, isSpeaking }
    this.streams = new Map();
  }

  // ===========================================================================
  // 1. INITIALIZE STREAM
  // ===========================================================================
  startStream(userId) {
    console.log(`👂 STT: Starting stream for ${userId}`);
    this.streams.set(userId, {
      lastVoiceTime: Date.now(),
      continuousSpeechStart: null,
      isSpeaking: false,
      buffer: [] // To store audio chunks if we were doing real processing
    });
  }

  // ===========================================================================
  // 2. PROCESS AUDIO CHUNK
  // ===========================================================================
  /*
    processAudio(userId, audioChunk)
    
    ROLE: Analyze incoming audio.
    RETURNS: 
      - 'CONTINUE': Keep listening.
      - 'SILENCE_TIMEOUT': User has been silent too long.
      - 'MAX_DURATION_EXCEEDED': User talked too long.
  */
  processAudio(userId, audioChunk) {
    const stream = this.streams.get(userId);
    if (!stream) return 'ERROR_NO_STREAM';

    const now = Date.now();
    
    // -------------------------------------------------------------------------
    // A. DETECT VOICE ACTIVITY (VAD)
    // -------------------------------------------------------------------------
    // In a real implementation, we'd use a VAD library (like rtc-vad or silero).
    // For this mock, we assume ALL incoming audio is "voice" for safety,
    // unless the chunk size is tiny (silence mostly).
    const isVoice = audioChunk.length > 100; // Simplified VAD
    
    if (isVoice) {
      stream.lastVoiceTime = now;
      
      if (!stream.isSpeaking) {
        // They just started talking
        stream.isSpeaking = true;
        stream.continuousSpeechStart = now;
      }
    } else {
      // Silence
      stream.isSpeaking = false;
      stream.continuousSpeechStart = null;
    }

    // -------------------------------------------------------------------------
    // B. SAFEGUARD: MAX CONTINUOUS SPEECH (Filibuster Protection)
    // -------------------------------------------------------------------------
    if (stream.isSpeaking && stream.continuousSpeechStart) {
      const duration = now - stream.continuousSpeechStart;
      
      if (duration > AI_CONFIG.STT.MAX_CONTINUOUS_SPEECH_MS) {
        console.warn(`🛑 STT: User ${userId} exceeded max speech duration.`);
        return 'MAX_DURATION_EXCEEDED';
      }
    }

    // -------------------------------------------------------------------------
    // C. SAFEGUARD: SILENCE DETECTION (AFK Check)
    // -------------------------------------------------------------------------
    // If they haven't spoken in X seconds, are they still there?
    const timeSinceVoice = now - stream.lastVoiceTime;
    
    if (timeSinceVoice > AI_CONFIG.STT.SILENCE_TIMEOUT_MS) {
      console.warn(`💤 STT: Silence timeout for ${userId}`);
      return 'SILENCE_TIMEOUT';
    }

    return 'CONTINUE';
  }

  // ===========================================================================
  // 3. CLEANUP
  // ===========================================================================
  endStream(userId) {
    this.streams.delete(userId);
    console.log(`👂 STT: Ended stream for ${userId}`);
  }
}

module.exports = new STTService();
