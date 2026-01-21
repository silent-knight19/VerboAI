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
  // PLAY AUDIO RESPONSE (The Mouth)
  // ===========================================================================
  const playAudioResponse = useCallback((audioBlob) => {
    if (!audioBlob) {
      console.error('❌ No audio blob to play');
      return;
    }

    console.log('🔊 Playing audio. Blob size:', audioBlob.size, 'bytes');

    // Stop any currently playing audio
    if (audioElementRef.current) {
      const oldAudio = audioElementRef.current;
      // Prevent "phantom" event logs from the old element
      oldAudio.onended = null;
      oldAudio.onerror = null;
      oldAudio.onplay = null;
      oldAudio.onloadeddata = null;
      
      oldAudio.pause();
      oldAudio.src = ''; // This can trigger an abort error, so we nullify handler first
    }

    const audioUrl = URL.createObjectURL(audioBlob);
    console.log('🔊 Created blob URL:', audioUrl);

    const audio = new Audio(audioUrl);
    audioElementRef.current = audio;

    audio.onloadeddata = () => {
      console.log('🔊 Audio loaded. Duration:', audio.duration, 'seconds');
    };

    audio.onplay = () => {
      console.log('🔊 Audio started playing');
      isPlayingRef.current = true;
      setAiState('SPEAKING'); // Force UI to SPEAKING
    };

    audio.onended = () => {
      console.log('🔊 Audio finished playing');
      isPlayingRef.current = false;
      URL.revokeObjectURL(audioUrl);
      
      // When audio finishes, we can safely go to LISTENING (assuming backend is ready)
      // We optimistically set it to LISTENING here because usually the backend 
      // has already sent the "LISTENING" status which we ignored during playback.
      setAiState('LISTENING');
    };

    audio.onerror = (e) => {
      const error = e.target.error;
      console.error('❌ Audio playback error:', error);
      console.error('Error Code:', error ? error.code : 'Unknown');
      console.error('Error Message:', error ? error.message : 'Unknown');
      
      isPlayingRef.current = false;
      URL.revokeObjectURL(audioUrl);
      setAiMessage('Audio playback failed. Check console for details.');
    };

    audio.play()
      .then(() => {
        console.log('✅ Audio play() promise resolved');
      })
      .catch((error) => {
        console.error('❌ Audio play() failed:', error);
        setAiMessage(`Cannot play audio: ${error.message}`);
        isPlayingRef.current = false;
      });
  }, []);

  // ===========================================================================
  // SETUP FUNCTION: Register all socket listeners
  // ===========================================================================
  const setupSocketListeners = useCallback(() => {
    // Check if socket exists (it's created in SocketService.connect())
    if (!SocketService.socket) {
      console.log('⏳ Socket not ready yet, will retry...');
      return false;
    }

    // Don't register twice
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
      
      // CRITICAL: If audio is playing, IGNORE "LISTENING" status from backend.
      // We want to keep the "SPEAKING" UI state until the audio actually finishes.
      if (isPlayingRef.current && data.state === 'LISTENING') {
        console.log('⏳ Audio is still playing. Ignoring "LISTENING" status until playback ends.');
        return;
      }

      setAiState(data.state);
      if (data.message) setAiMessage(data.message);
    });

    // -------------------------------------------------------------------------
    // LISTENER X: User Transcript (for Chat UI)
    // -------------------------------------------------------------------------
    SocketService.socket.on('user:transcript', (data) => {
      console.log('🗣️ User Transcript:', data.text);
      setChatHistory(prev => [...prev, { role: 'user', text: data.text, timestamp: new Date() }]);
    });

    // -------------------------------------------------------------------------
    // LISTENER 2: Audio Responses from AI (THE CRITICAL ONE)
    // -------------------------------------------------------------------------
    SocketService.socket.on('audio:response', (data) => {
      console.log('🗣️ Received audio:response event');
      console.log('🗣️ Text:', data.text);
      console.log('🗣️ Audio type:', typeof data.audio);
      console.log('🗣️ Audio data present:', !!data.audio);
      
      if (data.text) {
        setAiMessage(data.text);
        setChatHistory(prev => [...prev, { role: 'ai', text: data.text, timestamp: new Date() }]);
      }
      
      if (data.audio) {
        let audioBlob = null;

        // Case 1: Base64 string (what we're sending from backend)
        if (typeof data.audio === 'string') {
          console.log('🔈 Audio is Base64 string. Length:', data.audio.length);
          audioBlob = base64ToBlob(data.audio, 'audio/mpeg');
        }
        // Case 2: Node.js Buffer format
        else if (data.audio.type === 'Buffer' && Array.isArray(data.audio.data)) {
          console.log('🔈 Audio is Node Buffer. Converting...');
          const bytes = new Uint8Array(data.audio.data);
          audioBlob = new Blob([bytes], { type: 'audio/mpeg' });
        }
        // Case 3: ArrayBuffer
        else if (data.audio instanceof ArrayBuffer) {
          console.log('🔈 Audio is ArrayBuffer');
          audioBlob = new Blob([data.audio], { type: 'audio/mpeg' });
        }
        else {
          console.error('❌ Unknown audio format:', data.audio);
        }

        if (audioBlob) {
          console.log('✅ Audio blob created. Size:', audioBlob.size, 'bytes');
          playAudioResponse(audioBlob);
        } else {
          console.error('❌ Failed to create audio blob');
        }
      } else {
        console.warn('⚠️ No audio data in response');
      }
    });

    // -------------------------------------------------------------------------
    // LISTENER 3: Security & Anti-Cheating (Backend Authority)
    // -------------------------------------------------------------------------
    SocketService.socket.on('session:warning', (data) => {
      console.warn('⚠️ Security Warning:', data.message);
      
      // EXPOSE TO UI (For Modal)
      setWarning(data.message);
      
      // Inject System Message into Chat (Red Alert)
      setChatHistory(prev => [...prev, { 
        role: 'system', 
        text: data.message, 
        timestamp: new Date() 
      }]);
    });

    SocketService.socket.on('session:end', (data) => {
      console.error('🛑 Session Terminated:', data.message);
      
      // Stop everything
      setIsRecording(false);
      setIsTerminated(true); // NEW: Lock the UI
      if (mediaRecorderRef.current) mediaRecorderRef.current.stop();
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      
      // Show Termination Message
      setChatHistory(prev => [...prev, { 
        role: 'system', 
        text: `🚫 TERMINATED: ${data.message}`, 
        timestamp: new Date() 
      }]);
      
      setAiMessage("SESSION TERMINATED. PLEASE CONTACT SUPPORT.");
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
  }, [playAudioResponse]);

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
