/*
================================================================================
AI CONFIGURATION ("The Rule Book")
================================================================================
ROLE: The Supreme Court of Limits ⚖️

WHY:
  - We need ONE place to define all the safety rules for our AI.
  - If we hardcode numbers (like "100 tokens") inside function files, we'll lose track.
  - This file protects our wallet (cost limits) and our app (abuse limits).

HOW:
  - We export a JavaScript object containing constants.
  - Every AI service (STT, LLM, TTS) must import this file to know the rules.

RULES COVERED:
  1. TIMEOUTS: How long do we wait before giving up?
  2. LIMITS: How much can a user talk? How much can the AI write?
  3. COSTS: Strict token caps to prevent expensive bills.
  4. SAFETY: Abuse detection thresholds.
================================================================================
*/

const AI_CONFIG = {
  
  // ===========================================================================
  // 1. SPEECH-TO-TEXT (STT) CONFIGURATION - DEEPGRAM
  // ===========================================================================
  STT: {
    /*
      DEEPGRAM_MODEL:
      The transcription model to use.
      'nova-2' is Deepgram's fastest, most accurate model.
    */
    DEEPGRAM_MODEL: 'nova-2',
    
    /*
      DEEPGRAM_LANGUAGE:
      Primary language for transcription.
    */
    DEEPGRAM_LANGUAGE: 'en-IN',

    /*
      SILENCE_TIMEOUT_MS: 
      If the user connects but says NOTHING for this long, we verify they are there.
      Prevents "dead air" sessions from running forever.
    */
    SILENCE_TIMEOUT_MS: 10 * 1000, // 10 Seconds

    /*
      MAX_CONTINUOUS_SPEECH_MS:
      If a user talks non-stop for this long without pausing, we cut them off.
      Prevents "filibustering" (talking forever to waste AI processing time).
    */
    MAX_CONTINUOUS_SPEECH_MS: 60 * 1000, // 1 Minute
  },

  // ===========================================================================
  // 2. LARGE LANGUAGE MODEL (LLM) SAFEGUARDS
  // ===========================================================================
  LLM: {
    /*
      MODEL_NAME: 
      Cerebras Cloud API Model.
      'llama-3.1-8b' is blazing fast (Instant).
    */
    MODEL_NAME: 'llama-3.1-8b', 
    
    /*
      BASE_URL:
      The endpoint for Cerebras Cloud API.
    */
    BASE_URL: 'https://api.cerebras.ai/v1',

    /*
      MAX_TOKENS_PER_RESPONSE:
      Rigid limit to force concise answers.
      300 tokens is enough for ~2 paragraphs.
    */
    MAX_TOKENS_PER_RESPONSE: 300,

    /*
      TEMPERATURE:
      Controls creativity. 0.0 = Robot, 1.0 = Wild Poet.
      0.7 is a good balance for professional interviews.
    */
    TEMPERATURE: 0.7,

    /*
      TIMEOUT_MS:
      If Cerebras doesn't respond in this time, we abort.
      Better to fail fast than hang the UI.
    */
    TIMEOUT_MS: 15 * 1000, // 15 Seconds
  },

  // ===========================================================================
  // 3. TEXT-TO-SPEECH (TTS) CONFIGURATION
  // ===========================================================================
  TTS: {
    /*
      VOICE_NAME:
      Microsoft Edge Neural voice to use.
      'en-IN-NeerjaNeural' is a professional Indian English female voice.
      
      Other options:
        - 'en-US-AriaNeural' (Female, US)
        - 'en-US-AndrewNeural' (Male, US)
        - 'en-US-JennyNeural' (Female, friendly)
    */
    VOICE_NAME: 'en-US-AvaNeural',
    
    /*
      MAX_CHARACTERS:
      Fail-safe truncation for TTS input.
      Even though LLM is limited to ~150 tokens, this catches edge cases.
    */
    MAX_CHARACTERS: 500,
  },

  // ===========================================================================
  // 4. SESSION SAFEGUARDS
  // ===========================================================================
  SESSION: {
    /*
      MAX_TURNS:
      Maximum number of Q&A exchanges allowed per session.
      Prevents a session from going on indefinitely.
    */
    MAX_TURNS: 20,
    
    /*
      PROFANITY_FILTER:
      Whether to aggressively block bad language.
    */
    PROFANITY_FILTER: true,
  }
};

/*
  Prevent modification of these rules at runtime.
  This ensures no buggy code can accidentally change a limit to Infinity.
*/
Object.freeze(AI_CONFIG);

module.exports = AI_CONFIG;
