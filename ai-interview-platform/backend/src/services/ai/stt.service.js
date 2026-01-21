/*
================================================================================
STT SERVICE (Speech-to-Text) - DEEPGRAM EDITION
================================================================================
ROLE: The Ear 👂

WHY:
  - We need to convert real-time audio into text.
  - Deepgram is the industry leader for fast, accurate STT.
  - Their 'nova-2' model is blazing fast and works great with accents.

HOW:
  - We use the @deepgram/sdk npm package.
  - For each user, we maintain a persistent WebSocket connection.
  - Audio chunks are streamed to Deepgram, and transcripts stream back.

SAFEGUARDS:
  1. SILENCE TIMEOUT (user went AFK).
  2. MAX DURATION (user filibustering).
================================================================================
*/

const { createClient, LiveTranscriptionEvents } = require('@deepgram/sdk');
const AI_CONFIG = require('../../config/ai.config');

class STTService {
  constructor() {
    // Initialize Deepgram client with API key from environment
    this.deepgram = createClient(process.env.DEEPGRAM_API_KEY);
    
    // Track active streams per user
    // Key: userId, Value: { connection, lastVoiceTime, continuousSpeechStart, onTranscript }
    this.streams = new Map();
    
    console.log('👂 Deepgram STT: Service initialized.');
  }

  // ===========================================================================
  // 1. START STREAM
  // ===========================================================================
  /*
    startStream(userId, onTranscript)
    
    PARAMS:
      - userId: String (unique identifier for the user)
      - onTranscript: Function (callback when transcript is ready)
    
    Creates a live WebSocket connection to Deepgram for this user.
  */
  startStream(userId, onTranscript) {
    console.log(`👂 Deepgram STT: Starting stream for ${userId}`);
    
    // Create live transcription connection
    // NOTE: WebM is a container format, so Deepgram auto-detects encoding.
    // Do NOT specify 'encoding' or 'sample_rate' for containerized audio.
    const connection = this.deepgram.listen.live({
      model: AI_CONFIG.STT.DEEPGRAM_MODEL,
      language: AI_CONFIG.STT.DEEPGRAM_LANGUAGE,
      smart_format: true,      // Auto-punctuation
      interim_results: true,   // Get results as user speaks
      endpointing: 900,        // 500ms silence. We buffer this in the handler now.
      punctuate: true,         // Add punctuation
    });

    // Store stream state
    const streamState = {
      connection,
      lastVoiceTime: Date.now(),
      continuousSpeechStart: null,
      isSpeaking: false,
      isReady: false,              // Track if connection is open
      pendingChunks: [],           // Buffer for chunks sent before connection opens
      onTranscript: onTranscript || (() => {}),
    };
    this.streams.set(userId, streamState);

    // -------------------------------------------------------------------------
    // EVENT: Transcript Received
    // -------------------------------------------------------------------------
    connection.on(LiveTranscriptionEvents.Transcript, (data) => {
      const transcript = data.channel.alternatives[0]?.transcript || '';
      const isFinal = data.is_final;
      
      if (transcript.trim()) {
        console.log(`👂 STT [${userId}]: ${isFinal ? '✅' : '⏳'} "${transcript}"`);
        
        // Update voice activity time
        streamState.lastVoiceTime = Date.now();
        streamState.isSpeaking = true;
        if (!streamState.continuousSpeechStart) {
          streamState.continuousSpeechStart = Date.now();
        }
        
        // Send BOTH Interim and Final results to the handler.
        // The handler needs Interim results to know "User is still speaking" (to reset buffer timer).
        streamState.onTranscript({ text: transcript, isFinal });
      }
    });

    // -------------------------------------------------------------------------
    // EVENT: Connection Opened
    // -------------------------------------------------------------------------
    connection.on(LiveTranscriptionEvents.Open, () => {
      console.log(`👂 Deepgram STT: Connection opened for ${userId}`);
      streamState.isReady = true;
      
      // Send any buffered chunks now that connection is open
      if (streamState.pendingChunks.length > 0) {
        console.log(`👂 Deepgram STT: Sending ${streamState.pendingChunks.length} buffered chunks`);
        for (const chunk of streamState.pendingChunks) {
          connection.send(chunk);
        }
        streamState.pendingChunks = [];
      }
    });

    // -------------------------------------------------------------------------
    // EVENT: Connection Closed
    // -------------------------------------------------------------------------
    connection.on(LiveTranscriptionEvents.Close, () => {
      console.log(`👂 Deepgram STT: Connection closed for ${userId}`);
      this.streams.delete(userId);
    });

    // -------------------------------------------------------------------------
    // EVENT: Error
    // -------------------------------------------------------------------------
    connection.on(LiveTranscriptionEvents.Error, (error) => {
      console.error(`❌ Deepgram STT [${userId}]: Error -`, error.message);
    });
  }

  // ===========================================================================
  // 2. PROCESS AUDIO CHUNK
  // ===========================================================================
  /*
    processAudio(userId, audioChunk)
    
    ROLE: Send audio data to Deepgram and check safeguards.
    RETURNS: 
      - 'CONTINUE': Keep listening.
      - 'SILENCE_TIMEOUT': User has been silent too long.
      - 'MAX_DURATION_EXCEEDED': User talked too long.
  */
  processAudio(userId, audioChunk) {
    const stream = this.streams.get(userId);
    if (!stream) return 'ERROR_NO_STREAM';

    const now = Date.now();

    // Send audio to Deepgram (or buffer if not ready yet)
    if (stream.connection && audioChunk) {
      if (stream.isReady) {
        // Connection is open, send directly
        stream.connection.send(audioChunk);
      } else {
        // Connection not ready, buffer the chunk
        stream.pendingChunks.push(audioChunk);
      }
    }

     // -------------------------------------------------------------------------
    // SAFEGUARD A: MAX CONTINUOUS SPEECH (Filibuster Protection)
    // -------------------------------------------------------------------------
    
    // 1. Reset timer if there's been a significant pause (e.g. 3 seconds)
    // This ensures we don't count meaningful pauses as "continuous speech"
    const gapDuration = now - stream.lastVoiceTime;
    if (stream.continuousSpeechStart && gapDuration > 3000) {
       //console.log(`⏸️ STT: Resetting continuous speech timer after ${gapDuration}ms silence`);
       stream.continuousSpeechStart = null;
    }

    if (stream.isSpeaking && stream.continuousSpeechStart) {
      const duration = now - stream.continuousSpeechStart;
      
      if (duration > AI_CONFIG.STT.MAX_CONTINUOUS_SPEECH_MS) {
        console.warn(`🛑 STT: User ${userId} exceeded max speech duration (${(duration/1000).toFixed(1)}s)`);
        
        // CRITICAL FIX: Reset the timer so we don't spam this error for every single subsequent chunk
        // This allows the interview handler to decide whether to stop or continue, 
        // without getting flooded with 4-errors-per-second.
        stream.continuousSpeechStart = null; 
        
        return 'MAX_DURATION_EXCEEDED';
      }
    }

    // -------------------------------------------------------------------------
    // SAFEGUARD B: SILENCE DETECTION (AFK Check)
    // -------------------------------------------------------------------------
    const timeSinceVoice = now - stream.lastVoiceTime;
    
    if (timeSinceVoice > AI_CONFIG.STT.SILENCE_TIMEOUT_MS) {
      console.warn(`💤 STT: Silence timeout for ${userId}`);
      return 'SILENCE_TIMEOUT';
    }

    return 'CONTINUE';
  }

  // ===========================================================================
  // 3. END STREAM
  // ===========================================================================
  endStream(userId) {
    const stream = this.streams.get(userId);
    if (stream && stream.connection) {
      stream.connection.finish();
    }
    this.streams.delete(userId);
    console.log(`👂 Deepgram STT: Ended stream for ${userId}`);
  }
}

module.exports = new STTService();
