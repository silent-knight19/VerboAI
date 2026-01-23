/*
================================================================================
HOOK: useAudioRecorder (Production Rewrite v3)
================================================================================
ROLE: The Ears & Mouth of the Frontend

CRITICAL FIX: Socket listeners are now registered AFTER socket is connected.
The hook checks for socket availability and re-registers when ready.

UPDATES:
- Added isPlayingRef to track actual audio playback.
- Prevents UI from switching to 'LISTENING' while audio is still playing.
- Improved error logging for audio playback.

This hook handles:
1. Capturing user audio (Ears) via MediaRecorder
2. Streaming chunks to backend via Socket.io (Nerves)
3. Playing AI audio responses (Mouth) via HTML5 Audio
================================================================================
*/

import { useState, useRef, useEffect, useCallback } from 'react';
import SocketService from '../services/socket.service';

const useAudioRecorder = () => {
  // ===========================================================================
  // STATE
  // ===========================================================================
  const [isRecording, setIsRecording] = useState(false);
  const [permissionError, setPermissionError] = useState(null);
  
  // AI State (matches backend: 'IDLE' | 'LISTENING' | 'THINKING' | 'SPEAKING')
  const [aiState, setAiState] = useState('IDLE'); 
  const [aiMessage, setAiMessage] = useState('Ready to start...');
  const [chatHistory, setChatHistory] = useState([]); // Array of { role: 'user'|'ai', text }
  const [isTerminated, setIsTerminated] = useState(false); // NEW: Track termination state
  const [warning, setWarning] = useState(null); // NEW: Track warning state

  // ===========================================================================
  // REFS (Mutable state that doesn't trigger re-renders)
  // ===========================================================================
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const audioElementRef = useRef(null);  // For HTML5 Audio playback
  const listenersRegisteredRef = useRef(false);  // Track if listeners are set up
  const isPlayingRef = useRef(false); // Track if audio is currently playing
  const audioQueueRef = useRef([]);
  const isProcessingQueueRef = useRef(false);

  // ===========================================================================
  // HELPER: Convert Base64 string to Blob
  // ===========================================================================
  const base64ToBlob = (base64String, mimeType = 'audio/mpeg') => {
    try {
      const binaryString = atob(base64String);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return new Blob([bytes], { type: mimeType });
    } catch (error) {
      console.error('❌ Base64 to Blob conversion failed:', error);
      return null;
    }
  };

  // ===========================================================================
  // PLAY AUDIO RESPONSE (The Mouth) - Updated for Queue
  // ===========================================================================
  const playAudioResponse = useCallback((audioBlob, onComplete, onError) => {
    if (!audioBlob) {
      if (onError) onError(new Error("No audio blob"));
      return;
    }

    console.log('🔊 Playing audio chunk. Blob size:', audioBlob.size, 'bytes');

    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    audioElementRef.current = audio;

    audio.onplay = () => {
      console.log('🔊 Audio chunk started playing');
      isPlayingRef.current = true;
      setAiState('SPEAKING'); 
    };

    audio.onended = () => {
      console.log('🔊 Audio chunk finished');
      isPlayingRef.current = false;
      URL.revokeObjectURL(audioUrl);
      if (onComplete) onComplete();
    };

    audio.onerror = (e) => {
      console.error('❌ Audio chunk error:', e);
      isPlayingRef.current = false;
      URL.revokeObjectURL(audioUrl);
      if (onError) onError(e);
    };

    audio.play().catch(err => {
       console.error("❌ Audio play() failed immediately:", err);
       if (onError) onError(err);
    });
  }, []);

  // ===========================================================================
  // AUDIO QUEUE MANAGEMENT
  // ===========================================================================
  const processAudioQueue = useCallback(async () => {
    if (isProcessingQueueRef.current || audioQueueRef.current.length === 0) {
      return;
    }

    isProcessingQueueRef.current = true;
    const nextAudioBlob = audioQueueRef.current.shift();

    try {
      await new Promise((resolve, reject) => {
        playAudioResponse(nextAudioBlob, resolve, reject);
      });
    } catch (err) {
      console.error("Audio queue processing error:", err);
    } finally {
      isProcessingQueueRef.current = false;
      // Process next item recursively
      // We use a timeout to let the stack clear and Allow other events
      setTimeout(() => {
         // Re-trigger processing if queue has items
         if (audioQueueRef.current.length > 0) {
             processAudioQueue(); 
         } else {
             // If queue empty and done playing, back to LISTENING
             // But we have to be careful about race conditions with new chunks arriving
             // Usually the last chunk finishes, queue is empty -> LISTENING
             setAiState('LISTENING');
         }
      }, 10);
    }
  }, [playAudioResponse]);

  // ===========================================================================
  // SETUP FUNCTION: Register all socket listeners
  // ===========================================================================
  const setupSocketListeners = useCallback(() => {
    if (!SocketService.socket) {
      console.log('⏳ Socket not ready yet, will retry...');
      return false;
    }

    if (listenersRegisteredRef.current) {
      console.log('✅ Socket listeners already registered');
      return true;
    }

    console.log('🔌 Registering socket listeners...');

    // -------------------------------------------------------------------------
    // LISTENER 1: AI Status Updates
    // -------------------------------------------------------------------------
    SocketService.socket.on('interview:status', (data) => {
      console.log('🤖 AI Status:', data.state, data.message || '');
      
      const hasQueue = audioQueueRef.current.length > 0;
      // If we are playing or have queue, ignore "LISTENING" from backend
      // (Backend might send "LISTENING" after streaming chunks, but we might still be playing)
      if ((isPlayingRef.current || hasQueue) && data.state === 'LISTENING') {
        console.log('⏳ Audio playing/queued. Ignoring LISTENING status.');
        return;
      }

      setAiState(data.state);
      if (data.message) setAiMessage(data.message);
    });

    // -------------------------------------------------------------------------
    // LISTENER X: User Transcript
    // -------------------------------------------------------------------------
    SocketService.socket.on('user:transcript', (data) => {
      console.log('🗣️ User Transcript:', data.text);
      setChatHistory(prev => [...prev, { role: 'user', text: data.text, timestamp: new Date() }]);
    });

    // -------------------------------------------------------------------------
    // LISTENER 2: Audio Responses (CHUNKS)
    // -------------------------------------------------------------------------
    const handleAudioEvent = (data) => {
       console.log('🗣️ Audio Event (Chunk/Response)');

       // 1. Text Append Logic
       if (data.text) {
         setAiMessage(data.text);
         
         setChatHistory(prev => {
           const lastMsg = prev[prev.length - 1];
           // Heuristic: If last msg is AI and < 10 seconds old, append.
           const isRecent = lastMsg && (new Date() - new Date(lastMsg.timestamp) < 10000);
           
           if (lastMsg && lastMsg.role === 'ai' && isRecent) {
             // Only append if it doesn't already contain the text (dedupe legacy full responses)
             if (!lastMsg.text.includes(data.text)) {
                 return [
                   ...prev.slice(0, -1),
                   { ...lastMsg, text: lastMsg.text + " " + data.text } 
                 ];
             }
             return prev;
           } else {
             return [...prev, { role: 'ai', text: data.text, timestamp: new Date() }];
           }
         });
       }

       // 2. Audio Queue Logic
       if (data.audio) {
          let audioBlob = null;
          if (typeof data.audio === 'string') {
            audioBlob = base64ToBlob(data.audio, 'audio/mpeg');
          } else if (data.audio.type === 'Buffer') {
             const bytes = new Uint8Array(data.audio.data);
             audioBlob = new Blob([bytes], { type: 'audio/mpeg' });
          }

          if (audioBlob) {
            audioQueueRef.current.push(audioBlob);
            processAudioQueue();
          }
       }
    };

    SocketService.socket.on('audio:response', handleAudioEvent);
    SocketService.socket.on('audio:chunk', handleAudioEvent);


    // -------------------------------------------------------------------------
    // LISTENER 3: Security & Anti-Cheating
    // -------------------------------------------------------------------------
    SocketService.socket.on('session:warning', (data) => {
      console.warn('⚠️ Security Warning:', data.message);
      setWarning(data.message);
      setChatHistory(prev => [...prev, { role: 'system', text: data.message, timestamp: new Date() }]);
    });

    SocketService.socket.on('session:end', (data) => {
      console.error('🛑 Session Terminated:', data.message);
      setIsRecording(false);
      setIsTerminated(true);
      if (mediaRecorderRef.current) mediaRecorderRef.current.stop();
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      
      setChatHistory(prev => [...prev, { role: 'system', text: `🚫 TERMINATED: ${data.message}`, timestamp: new Date() }]);
      setAiMessage("SESSION TERMINATED.");
      setAiState("IDLE");
    });

    // -------------------------------------------------------------------------
    // LISTENER 4: Error events
    // -------------------------------------------------------------------------
    SocketService.socket.on('error', (err) => {
      console.error('❌ Socket error:', err.message);
      setAiMessage(`Error: ${err.message}`);
      setAiState('IDLE');
    });

    listenersRegisteredRef.current = true;
    console.log('✅ All socket listeners registered successfully!');
    return true;
  }, [playAudioResponse, processAudioQueue]);

  // ===========================================================================
  // EFFECT: Anti-Cheating (Tab Switch, Blur, Resize/Fullscreen Detection)
  // Only active when interview is actually running (isRecording)
  // ===========================================================================
  useEffect(() => {
    if (!isRecording) return;
    
    console.log(`👁️ Anti-Cheating: Monitor initialized (Recording: ${isRecording})`);

    const reportViolation = (reason) => {
      if (isTerminated) return; // Don't kick a dead horse
      console.warn(`🚨 Anti-Cheat Violation detected: ${reason}`);
      SocketService.emit('session:violation');
    };

    // 1. Tab Switching (Visibility API)
    const handleVisibilityChange = () => {
      if (document.hidden) {
         reportViolation("Tab Switch / Minimized");
      }
    };

    // 2. Window Focus (Blur = clicked outside or Alt-Tabbed)
    const handleBlur = () => {
      // Small grace period could be added here, but let's be strict for now
      reportViolation("Window Lost Focus");
    };

    // 3. Fullscreen Enforcement (Optional but recommended)
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        reportViolation("Exited Fullscreen");
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, [isRecording, isTerminated]);


  // ===========================================================================
  // EFFECT: Try to set up listeners when component mounts
  // Also poll for socket availability since it's connected async
  // ===========================================================================
  useEffect(() => {
    console.log('🎬 useAudioRecorder mounted, checking socket...');

    // Try immediately
    const success = setupSocketListeners();

    // If socket isn't ready, poll every 500ms
    let intervalId = null;
    if (!success) {
      intervalId = setInterval(() => {
        if (setupSocketListeners()) {
          clearInterval(intervalId);
        }
      }, 500);
    }

    // Cleanup on unmount
    return () => {
      console.log('🔌 Cleaning up socket listeners...');
      if (intervalId) clearInterval(intervalId);
      
      // Remove listeners if socket exists
      if (SocketService.socket) {
        SocketService.socket.off('interview:status');
        SocketService.socket.off('user:transcript');
        SocketService.socket.off('audio:response');
        SocketService.socket.off('error');
        SocketService.socket.off('session:warning'); // New
        SocketService.socket.off('session:end');     // New
      }
      
      listenersRegisteredRef.current = false;
      isPlayingRef.current = false;
      
      // Stop any playing audio
      if (audioElementRef.current) {
        audioElementRef.current.pause();
        audioElementRef.current.src = '';
      }
    };
  }, [setupSocketListeners]);

  // ===========================================================================
  // START RECORDING (The Ear)
  // ===========================================================================
  const startRecording = useCallback(async () => {
    console.log('🎙️ Starting recording...');
    setPermissionError(null);

    // Make sure listeners are registered when we start recording
    setupSocketListeners();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      console.log('✅ Microphone access granted');

      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = async (event) => {
        if (event.data.size > 0 && recorder.state === 'recording') {
          const arrayBuffer = await event.data.arrayBuffer();
          SocketService.emit('audio:chunk', arrayBuffer);
        }
      };

      recorder.start(250); 
      setIsRecording(true);
      console.log('🎙️ Recording started');

    } catch (error) {
      console.error('❌ Microphone error:', error);
      setPermissionError('Could not access microphone. Please allow permissions.');
    }
  }, [setupSocketListeners]);

  // ===========================================================================
  // STOP RECORDING
  // ===========================================================================
  const stopRecording = useCallback(() => {
    console.log('🛑 Stopping recording...');
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    setIsRecording(false);
    console.log('🛑 Recording stopped');
  }, []);

  // ===========================================================================
  // TOGGLE HELPER
  // ===========================================================================
  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  // ===========================================================================
  // RETURN PUBLIC API
  // ===========================================================================
  return {
    isRecording,
    isTerminated, 
    permissionError,
    aiState,
    aiMessage,
    startRecording,
    stopRecording,
    toggleRecording,
    chatHistory,
    warning,        // NEW: Export warning state
    setWarning      // NEW: Export setter for manual dismissal
  };
};

export default useAudioRecorder;
