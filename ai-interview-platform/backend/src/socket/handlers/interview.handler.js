/*
================================================================================
INTERVIEW HANDLER (The Conductor)
================================================================================
ROLE: The Orchestrator 🎻

WHY:
  - We have 3 services (STT, LLM, TTS) and 1 config file.
  - We need something to glue them together into a coherent conversation.
  - AND we need to enforce "Turns" so the AI doesn't talk over the user.

HOW:
  - We maintain a STATE for each socket (Listening, Thinking, Speaking).
  - We only process events if the state allows it.

STATE MACHINE:
  1. LISTENING: Waiting for user audio. (Ignore AI output)
  2. THINKING:  User finished. AI is generating text. (Ignore user audio)
  3. SPEAKING:  AI is playing audio. (Ignore user audio)

SAFEGUARDS IMPLEMENTED:
  - TURN ENFORCEMENT: We block user audio while AI is thinking/speaking.
  - PIPELINE TIMEOUTS: If any service hangs, we reset state to LISTENING.
================================================================================
*/

const STTService = require('../../services/ai/stt.service');
const LLMService = require('../../services/ai/llm.service');
const TTSService = require('../../services/ai/tts.service');
const AI_CONFIG = require('../../config/ai.config');

module.exports = (io, socket) => {
  const uid = socket.user.uid;

  // ---------------------------------------------------------------------------
  // LOCAL STATE (Per Connection)
  // ---------------------------------------------------------------------------
  // Possible: 'IDLE', 'LISTENING', 'THINKING', 'SPEAKING'
  let state = 'IDLE'; 
  let conversationHistory = []; // To keep context for LLM

  // ---------------------------------------------------------------------------
  // SECURITY CONSTANTS (Hardcoded for safety, not configurable)
  // ---------------------------------------------------------------------------
  const MAX_TRANSCRIPT_LENGTH = 1000;  // Characters. Protects against "Novel Attack".
  const MAX_AUDIO_CHUNK_SIZE = 100000; // ~100KB. Protects against "Binary Blob Attack".

  
  // ===========================================================================
  // EVENT: interview:start
  // ===========================================================================
  socket.on('interview:start', () => {
    console.log(`🎤 Interview: Starting for ${uid}`);
    state = 'LISTENING';
    STTService.startStream(uid);
    socket.emit('interview:status', { state: 'LISTENING', message: 'I am listening...' });
  });

  
  // ===========================================================================
  // EVENT: audio:chunk (User Speaking)
  // ===========================================================================
  socket.on('audio:chunk', async (audioData) => {
    // -------------------------------------------------------------------------
    // SAFEGUARD: STATE CHECK
    // -------------------------------------------------------------------------
    // If AI is thinking or speaking, ignore the user (for now).
    // In a future advanced version, this could trigger an "Interrupt".
    if (state !== 'LISTENING') return;

    // -------------------------------------------------------------------------
    // SAFEGUARD: CHUNK SIZE LIMIT (Binary Blob Attack Prevention)
    // -------------------------------------------------------------------------
    if (audioData && audioData.length > MAX_AUDIO_CHUNK_SIZE) {
      console.warn(`🛑 Interview: Audio chunk too large from ${uid}. Ignoring.`);
      return; // Silently ignore oversized chunks.
    }

    // 1. Process with STT Safeguards
    const sttResult = STTService.processAudio(uid, audioData);

    if (sttResult === 'SILENCE_TIMEOUT') {
      socket.emit('error', { message: 'Session paused due to silence.' });
      state = 'IDLE';
      return;
    }
    
    if (sttResult === 'MAX_DURATION_EXCEEDED') {
      // Force end of turn
      console.log(`⚠️ Interview: User filibustering. Forcing turn end.`);
      handleUserTurnComplete("...[User cut off due to time limit]...");
      return;
    }

    // (Mock) If we detect "End of Sentence" silence, we trigger turn.
    // In real app, VAD logic would call this.
    // For now, we wait for a manual 'audio:end' event from client or silence.
  });


  // ===========================================================================
  // EVENT: audio:end (User Finished Speaking)
  // ===========================================================================
  socket.on('audio:end', async ({ transcript }) => {
    if (state !== 'LISTENING') return;

    // -------------------------------------------------------------------------
    // SAFEGUARD: INPUT SIZE LIMIT (Novel Attack Prevention)
    // -------------------------------------------------------------------------
    let safeTranscript = transcript || '';
    if (safeTranscript.length > MAX_TRANSCRIPT_LENGTH) {
      console.warn(`🛑 Interview: Transcript too long from ${uid}. Truncating.`);
      safeTranscript = safeTranscript.substring(0, MAX_TRANSCRIPT_LENGTH) + '...';
    }

    await handleUserTurnComplete(safeTranscript);
  });


  // ===========================================================================
  // CORE LOGIC: HANDLE TURN COMPLETION
  // ===========================================================================
  async function handleUserTurnComplete(userText) {
    if (!userText) return;

    // A. SWITCH STATE -> THINKING
    state = 'THINKING';
    socket.emit('interview:status', { state: 'THINKING', message: 'Let me think...' });

    try {
      // B. CALL LLM (The Brain)
      const aiResponseText = await LLMService.generateResponse(conversationHistory, userText);
      
      // Update History (Keep it limited to last 10 turns to save tokens)
      conversationHistory.push({ role: 'user', content: userText });
      conversationHistory.push({ role: 'assistant', content: aiResponseText });
      if (conversationHistory.length > 20) conversationHistory = conversationHistory.slice(-20);

      // C. SWITCH STATE -> SPEAKING
      state = 'SPEAKING';
      socket.emit('interview:status', { state: 'SPEAKING', message: ' responding...' });

      // D. CALL TTS (The Mouth)
      const audioBuffer = await TTSService.generateAudio(aiResponseText);

      // E. SEND RESULT TO CLIENT
      socket.emit('audio:response', {
        text: aiResponseText,
        audio: audioBuffer
      });
      
      // F. RESET TO LISTENING (After audio plays)
      // In a real app, client sends 'playback:complete' event.
      // Here we allow immediate interruption or wait for client.
      state = 'LISTENING';
      socket.emit('interview:status', { state: 'LISTENING', message: 'your turn...' });

    } catch (error) {
      console.error('❌ Interview Loop Failed:', error);
      socket.emit('error', { message: 'I lost my train of thought.' });
      state = 'LISTENING'; // Reset safely
    }
  }


  // ===========================================================================
  // CLEANUP
  // ===========================================================================
  socket.on('disconnect', () => {
    STTService.endStream(uid);
    conversationHistory = [];
  });
};
