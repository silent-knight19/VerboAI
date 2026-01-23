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
  // ===========================================================================
  // EVENT: interview:start
  // ===========================================================================
  socket.on('interview:start', async () => {
    console.log(`🎤 Interview: Starting for ${uid}`);
    
    // STARTING GREETING (VerboAI Persona)
    const GREETING_TEXT = "Hello, I am Verbo-AI, your technical interviewer for today's session. What topics have you prepared?";
    
    // Add to History so LLM knows it already said this
    conversationHistory.push({ role: 'assistant', content: GREETING_TEXT });
    
    // Set initial state to SPEAKING
    state = 'SPEAKING';
    socket.emit('interview:status', { state: 'SPEAKING', message: 'Initializing...' });
    
    // Send Greeting Audio (Async - don't block listening)
    sendAudioChunk(GREETING_TEXT);
    
    // Immediately start listening so we don't miss user input while TTS generates
    state = 'LISTENING';
    
    // Start Deepgram stream with a callback for when transcripts arrive
    // Transcript Buffer to handle split utterances
    let transcriptBuffer = '';
    let transcriptTimer = null;
    const TRANSCRIPT_DEBOUNCE_MS = 800; // 0.8s silence after speech ends

    STTService.startStream(uid, async (data) => {
      // Only process if we are listening
      if (state !== 'LISTENING') return;

      // Handle both legacy string and new object format
      const { text, isFinal } = (typeof data === 'string') 
        ? { text: data, isFinal: true } 
        : data;

      if (!text || !text.trim()) return;

      // 1. ALWAYS reset timer on ANY activity (Interim or Final)
      // This ensures we never cut the user off while they are actively speaking
      if (transcriptTimer) clearTimeout(transcriptTimer);

      // 2. If Final, create/append to the buffer
      if (isFinal) {
        console.log(`📝 Buffering Final: "${text}"`);
        transcriptBuffer += (transcriptBuffer ? ' ' : '') + text.trim();
      }

      // 3. Set the timer with DYNAMIC logic based on punctuation
      // If the user finished a sentence (., ?, !), they are likely done -> Wait Short (1s)
      // If they trailed off without punctuation, they might be thinking -> Wait Long (2.5s)
      
      const lastChar = transcriptBuffer.trim().slice(-1);
      const isCompleteSentence = ['.', '?', '!'].includes(lastChar);
      
      // Dynamic Wait Time
      const waitTime = isCompleteSentence ? 1000 : 2500;

      transcriptTimer = setTimeout(async () => {
        if (!transcriptBuffer.trim()) return; // Don't send empty thoughts

        console.log(`🚀 Processing Turn (Waited ${waitTime}ms): "${transcriptBuffer}"`);
        
        let safeTranscript = transcriptBuffer;
        transcriptBuffer = ''; // Clear immediately
        
        // Truncate if too long
        if (safeTranscript.length > MAX_TRANSCRIPT_LENGTH) {
          console.warn(`🛑 Interview: Transcript too long. Truncating.`);
          safeTranscript = safeTranscript.substring(0, MAX_TRANSCRIPT_LENGTH) + '...';
        }
        
        await handleUserTurnComplete(safeTranscript);
      }, waitTime);
    });
    
    socket.emit('interview:status', { state: 'LISTENING', message: 'I am listening...' });
  });

  
  // ===========================================================================
  // EVENT: audio:chunk (User Speaking)
  // ===========================================================================
  socket.on('audio:chunk', async (audioData) => {
    // DEBUG: Log when audio chunk is received
    console.log(`🎤 Interview: Received audio chunk from ${uid} (${audioData?.length || 0} bytes)`);
    
    // -------------------------------------------------------------------------
    // SAFEGUARD: STATE CHECK
    // -------------------------------------------------------------------------
    if (state !== 'LISTENING') {
      console.log(`🚫 Interview: Ignoring chunk - state is ${state}, not LISTENING`);
      return;
    }

    // -------------------------------------------------------------------------
    // SAFEGUARD: CHUNK SIZE LIMIT (Binary Blob Attack Prevention)
    // -------------------------------------------------------------------------
    if (audioData && audioData.length > MAX_AUDIO_CHUNK_SIZE) {
      console.warn(`🛑 Interview: Audio chunk too large from ${uid}. Ignoring.`);
      return;
    }

    // Send audio to Deepgram for processing
    const sttResult = STTService.processAudio(uid, audioData);

    // -------------------------------------------------------------------------
    // SILENCE TIMEOUT: Just notify, DON'T stop listening
    // We want the interview to continue even after brief silences
    // -------------------------------------------------------------------------
    if (sttResult === 'SILENCE_TIMEOUT') {
      console.log(`⏸️ Interview: Silence detected for ${uid}, but still listening...`);
      // Just notify the user, don't change state - keep listening!
      socket.emit('interview:status', { 
        state: 'LISTENING', 
        message: 'I am still listening... Take your time.' 
      });
      // Do NOT set state = 'IDLE' - that breaks the interview!
      return;
    }
    
    // -------------------------------------------------------------------------
    // MAX DURATION: User talked too long - just truncate, don't stop
    // -------------------------------------------------------------------------
    if (sttResult === 'MAX_DURATION_EXCEEDED') {
      console.log(`⚠️ Interview: User filibustering. Will process what we have.`);
      // Notify user but don't break the interview
      socket.emit('interview:status', { 
        state: 'LISTENING', 
        message: 'That was a long response! Let me process what you said...' 
      });
      // Do NOT set state = 'IDLE' - that breaks the interview!
      return;
    }
    
    // Deepgram handles transcription and calls the callback we passed in interview:start
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
  // ===========================================================================
  // CORE LOGIC: HANDLE TURN COMPLETION (STREAMING)
  // ===========================================================================
  
  async function sendAudioChunk(text) {
    if (!text || !text.trim()) return;
    try {
      console.log(`🗣️ TTS: Generating chunk: "${text}"`);
      const audioBuffer = await TTSService.generateAudio(text);
      const audioBase64 = audioBuffer.toString('base64');
      
      socket.emit('audio:chunk', {
        text: text,
        audio: audioBase64 
      });
    } catch (error) {
       console.error('❌ TTS Chunk Failed:', error.message);
    }
  }

  async function handleUserTurnComplete(userText) {
    if (!userText) return;

    // A. SWITCH STATE -> THINKING
    state = 'THINKING';
    socket.emit('interview:status', { state: 'THINKING', message: 'Let me think...' });
    socket.emit('user:transcript', { text: userText });

    // Update History immediately with user input
    conversationHistory.push({ role: 'user', content: userText });

    try {
      // B. CALL LLM (Stream)
      const stream = LLMService.generateResponseStream(conversationHistory, userText);
      
      let fullAiResponse = "";
      let sentenceBuffer = "";
      let isFirstChunk = true;

      for await (const chunk of stream) {
        fullAiResponse += chunk;
        sentenceBuffer += chunk;
        
        // Sentence Detection Logic
        // We look for sentence terminators (. ? !) followed by space or end of string
        // We also want to avoid splitting "Mr." or "Dr." etc (basic heuristic)
        // For simplicity, we split on [.?!] + space.
        
        const sentenceMatch = sentenceBuffer.match(/([.?!]+)(\s+|$)/);
        
        if (sentenceMatch) {
             const index = sentenceMatch.index + sentenceMatch[0].length;
             const sentence = sentenceBuffer.substring(0, index);
             const remaining = sentenceBuffer.substring(index);
             
             // Process the sentence
             if (sentence.trim()) {
                 if (isFirstChunk) {
                     state = 'SPEAKING';
                     socket.emit('interview:status', { state: 'SPEAKING', message: 'Responding...' });
                     isFirstChunk = false;
                 }
                 
                 // Generate Audio for this sentence
                 await sendAudioChunk(sentence.trim());
             }
             
             sentenceBuffer = remaining;
        }
      }

      // Handle any remaining text in buffer (e.g. no punctuation at absolute end)
      if (sentenceBuffer.trim()) {
         if (isFirstChunk) {
             state = 'SPEAKING';
             socket.emit('interview:status', { state: 'SPEAKING', message: 'Responding...' });
         }
         await sendAudioChunk(sentenceBuffer.trim());
      }
      
      // Update History with full AI response
      conversationHistory.push({ role: 'assistant', content: fullAiResponse });
      if (conversationHistory.length > 20) conversationHistory = conversationHistory.slice(-20);

      // F. RESET TO LISTENING
      // Ideally client finishes audio then we go to listening.
      // But we set it here to allow interruptions or next turn readiness.
      state = 'LISTENING';
      socket.emit('interview:status', { state: 'LISTENING', message: 'Your turn...' });

    } catch (error) {
      console.error('❌ Interview Loop Failed:', error);
      socket.emit('error', { message: 'I lost my train of thought.' });
      state = 'LISTENING'; // Reset safely
    }
  }

  // ===========================================================================
  // EVENT: session:violation (Anti-Cheating)
  // ===========================================================================
  let violationCount = 0;
  
  socket.on('session:violation', () => {
    violationCount++;
    console.warn(`🚨 Security: Violation detected for ${uid} (Count: ${violationCount})`);

    if (violationCount === 1) {
      // Strike 1: Stern Warning
      socket.emit('session:warning', { 
        message: '⚠️ Warning: Tab switching is PROHIBITED. One more violation will terminate the interview.' 
      });
      // Interrupt AI if speaking
      if (state === 'SPEAKING') {
         // Logic to stop audio could go here, but for now we just warn
      }
    } 
    else if (violationCount >= 2) {
      // Strike 2: Termination
      console.error(`🛑 Security: Terminating session for ${uid} due to repeated violations.`);
      state = 'IDLE'; // Kill the loop
      socket.emit('session:end', { 
        reason: 'violation',
        message: '🚫 Interview Terminated. Integrity violation detected.' 
      });
      // Ideally, we would also flag the user in the database here
    }
  });


  // ===========================================================================
  // CLEANUP
  // ===========================================================================
  socket.on('disconnect', () => {
    STTService.endStream(uid);
    conversationHistory = [];
  });
};
