/*
================================================================================
INTERVIEW PAGE (Frontend) - Professional Rebranding
================================================================================
ROLE: This is the main interview room where the candidate interacts with the AI.
The design has been updated to be professional, premium, and emoji-free.

HOW IT WORKS:
1. It connects to the backend via WebSockets (SocketService).
2. It uses 'useAudioRecorder' to handle voice input and AI state tracking.
3. The UI is split into a control panel (left) and a live transcript (right).
================================================================================
*/

import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/auth.store';
import SocketService from '../services/socket.service';
import useAudioRecorder from '../hooks/useAudioRecorder';

// --- PROFESSIONAL SVG ICONS (Replacing Emojis) ---

// Warning Icon for Security Alerts
const WarningIcon = () => (
  <svg className="w-12 h-12 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

// Termination/Lock Icon
const LockIcon = () => (
  <svg className="w-16 h-16 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
  </svg>
);

// Chat Bubble Icon for empty states
const ChatIcon = () => (
  <svg className="w-12 h-12 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
  </svg>
);

// --- ANIMATED AI ORB COMPONENT ---
// This replaces the old emoji-based avatar.
// It changes color and animation style based on what the AI is currently doing.
const AiOrb = ({ state }) => {
  // Determine styles based on state
  let orbClass = "w-40 h-40 rounded-full relative flex items-center justify-center transition-all duration-700 ";
  let glowClass = "absolute inset-0 rounded-full opacity-50 blur-xl transition-all duration-700 ";
  
  if (state === 'SPEAKING') {
    orbClass += "bg-blue-500/30 border-2 border-blue-400 shadow-[0_0_50px_rgba(59,130,246,0.5)] scale-110";
    glowClass += "bg-blue-400 animate-pulse";
  } else if (state === 'LISTENING') {
    orbClass += "bg-emerald-500/30 border-2 border-emerald-400 shadow-[0_0_50px_rgba(52,211,153,0.5)] scale-105";
    glowClass += "bg-emerald-400 animate-ping";
  } else if (state === 'THINKING') {
    orbClass += "bg-amber-500/30 border-2 border-amber-400 shadow-[0_0_50px_rgba(251,191,36,0.5)]";
    glowClass += "bg-amber-400 animate-spin-slow"; // Note: spin-slow needs to be in tailwind or custom
  } else {
    orbClass += "bg-slate-800 border-2 border-slate-700";
    glowClass += "bg-slate-600 opacity-20";
  }

  return (
    <div className="relative group">
      {/* Outer Glow */}
      <div className={glowClass}></div>
      
      {/* Main Orb Body */}
      <div className={orbClass}>
        {/* Subtle Inner Ripple for Speaking */}
        {state === 'SPEAKING' && (
          <div className="absolute inset-0 rounded-full border border-blue-300/50 animate-ping"></div>
        )}
        
        {/* Central Core */}
        <div className={`w-16 h-16 rounded-full transition-colors duration-500 ${
          state === 'SPEAKING' ? 'bg-blue-400 shadow-[0_0_20px_white]' : 
          state === 'LISTENING' ? 'bg-emerald-400 shadow-[0_0_20px_white]' : 
          state === 'THINKING' ? 'bg-amber-400 shadow-[0_0_20px_white]' : 
          'bg-slate-600'
        }`}></div>
      </div>
    </div>
  );
};

const InterviewPage = () => {

  // 1. Hooks & State Management
  const navigate = useNavigate();
  const { user, loading } = useAuthStore();
  const messagesEndRef = useRef(null); // Used to keep the chat scrolled to the bottom

  // Extracting logic from our custom audio hook
  const { 
    isRecording, 
    permissionError, 
    aiState, 
    aiMessage, // Status message (e.g., "AI is thinking...")
    startRecording, 
    stopRecording,
    chatHistory, // List of messages for the UI
    isTerminated, // Security: session locked flag
    warning,      // Security: violation message
    setWarning    // Setter to clear the warning modal
  } = useAudioRecorder();

  const [status, setStatus] = useState('disconnected'); // local socket status
  const [sessionId, setSessionId] = useState(null);
  const [error, setError] = useState(null);
  const [timeElapsed, setTimeElapsed] = useState(0);

  // Refs for intervals so we can clean them up properly
  const heartbeatIntervalRef = useRef(null);
  const timerIntervalRef = useRef(null);

  // 2. Authentication & Socket Initialization
  useEffect(() => {
    // If auth is still loading, wait
    if (loading) return;

    // If no user found, redirect to login
    if (!user) {
      navigate('/login');
      return;
    }

    // Connect to the real-time server
    const initSocket = async () => {
      try {
        setStatus('connecting');
        const token = await user.getIdToken();
        SocketService.connect(token);
        setStatus('ready');
      } catch (err) {
        setError(err.message);
        setStatus('error');
      }
    };

    initSocket();

    // Cleanup when component unmounts
    return () => {
      handleEndSession();
    };
  }, [user, loading, navigate]);

  // 3. Auto-scroll: Keeps the transcript visible as messages come in
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, aiMessage]);
  
  // 4. Security: Stop the timer if the session is terminated
  useEffect(() => {
    if (isTerminated) {
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
  }, [isTerminated]);

  // --- BUSINESS LOGIC HANDLERS ---

  // Starts the interview session
  const handleStartSession = async () => {
    try {
      // Step A: Attempt to enter Fullscreen (Anti-Cheat Requirement)
      try {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        }
      } catch (fsErr) {
        console.warn("Could not enter fullscreen mode.", fsErr);
      }

      setStatus('starting');
      setError(null);
      
      // Step B: Tell the backend to prepare a session
      const sid = await SocketService.startSession();
      setSessionId(sid);
      
      // Step C: Initialize voice and signaling
      SocketService.emit('interview:start');
      await startRecording();
      
      setStatus('running');

      // Step D: Start background heartbeat (ping server)
      heartbeatIntervalRef.current = setInterval(() => {
        SocketService.sendHeartbeat();
      }, 15000);

      // Step E: Start the visual clock
      timerIntervalRef.current = setInterval(() => {
        setTimeElapsed(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error('Error starting session:', err);
      setError(typeof err === 'string' ? err : err.message || 'Failed to start');
      setStatus('ready');
    }
  };

  // Ends the interview session gracefully
  const handleEndSession = async () => {
    stopRecording();
    if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    // Exit Fullscreen
    try {
      if (document.exitFullscreen && document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch(e) { /* ignore cleanup errors */ }

    if (status === 'running' || status === 'starting') {
      setStatus('ending');
      try {
        await SocketService.endSession();
      } catch (err) {}
    } else {
      SocketService.disconnect();
    }
    
    setStatus('disconnected');
    setSessionId(null);
    setTimeElapsed(0);
  };

  // Helper to turn seconds into a MM:SS string
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // --- VIEW RENDERING ---

  // Loading screen
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-400 flex flex-col items-center justify-center space-y-4">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="font-outfit tracking-widest uppercase text-xs">Initializing Environment</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-blue-500 selection:text-white overflow-hidden relative">
      
      {/* -----------------------------------------------------------
          OVERLAY 1: SECURITY WARNING (Tab Switching Detection)
          ----------------------------------------------------------- */}
      {warning && !isTerminated && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center text-center p-8 animate-in fade-in duration-300">
          <div className="bg-slate-900 border border-yellow-500/30 rounded-3xl p-10 max-w-lg shadow-[0_0_100px_rgba(234,179,8,0.1)]">
            <div className="flex justify-center mb-6">
              <WarningIcon />
            </div>
            <h2 className="text-3xl font-outfit font-bold text-white mb-4">SECURITY ALERT</h2>
            <div className="h-1 w-20 bg-yellow-500 mx-auto mb-6 rounded-full"></div>
            <p className="text-yellow-100/80 mb-8 font-medium text-lg leading-relaxed">
              {warning}
            </p>
            <p className="text-slate-400 text-sm mb-10 italic">
              Attention: Our system detected an integrity violation. Repeated actions will permanently terminate this interview.
            </p>
            <button 
              onClick={() => {
                 setWarning(null);
                 // Re-attempt fullscreen to ensure focus
                 try { document.documentElement.requestFullscreen().catch(() => {}) } catch(e){}
              }}
              className="w-full py-4 bg-yellow-500 hover:bg-yellow-400 text-slate-950 font-bold rounded-xl transition-all shadow-lg active:scale-95"
            >
              Resume Interview
            </button>
          </div>
        </div>
      )}

      {/* -----------------------------------------------------------
          OVERLAY 2: PERMANENT TERMINATION (Lockdown Mode)
          ----------------------------------------------------------- */}
      {isTerminated && (
        <div className="absolute inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center text-center p-8">
          <div className="flex justify-center mb-10">
            <LockIcon />
          </div>
          <h1 className="text-5xl font-outfit font-bold text-white mb-4 tracking-tight">SESSION LOCKED</h1>
          <p className="text-xl text-red-400/80 max-w-xl mb-12 leading-relaxed">
            This session has been terminated due to multiple security violations. Access to this interview is permanently revoked.
          </p>
          <div className="px-6 py-3 bg-red-950/40 border border-red-500/20 rounded-full text-red-400 font-mono text-xs tracking-widest mb-10 uppercase">
            Code: INTEGRITY_HARD_SHUTDOWN
          </div>
          <button 
             onClick={() => navigate('/dashboard')}
             className="px-12 py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-all hover:shadow-xl hover:shadow-black"
          >
            Exit to Dashboard
          </button>
        </div>
      )}

      {/* -----------------------------------------------------------
          MAIN CONTENT AREA
          ----------------------------------------------------------- */}
      <div className="flex flex-col md:flex-row h-screen max-w-full mx-auto overflow-hidden bg-slate-950">

        {/* --- LEFT PANEL: AI AVATAR & STATS --- */}
        <div className="md:w-1/3 xl:w-1/4 p-10 flex flex-col items-center justify-between border-r border-slate-900 bg-slate-950 relative">
          
          {/* Brand Logo */}
          <div className="z-10 w-full flex flex-col items-center">
            <h1 className="text-2xl font-outfit font-bold tracking-[0.2em] text-white">
              VERBO<span className="text-blue-500">AI</span>
            </h1>
            <div className="mt-4 flex items-center space-x-2">
              <span className={`w-2 h-2 rounded-full ${status === 'running' ? 'bg-blue-500 animate-pulse' : 'bg-slate-700'}`}></span>
              <span className="text-[10px] tracking-widest uppercase text-slate-500 font-semibold">{status}</span>
            </div>
          </div>

          {/* AI Avatar Interaction Area */}
          <div className="z-10 flex flex-col items-center justify-center py-10">
            <AiOrb state={status === 'running' ? aiState : 'IDLE'} />

            {/* Status Information */}
            <div className="mt-12 text-center space-y-4">
              <div className="space-y-1">
                <p className="text-[10px] tracking-[0.3em] uppercase text-slate-500 font-bold">Session Duration</p>
                <h2 className="text-5xl font-outfit font-light text-white tracking-tighter">
                  {status === 'running' ? formatTime(timeElapsed) : '00:00'}
                </h2>
              </div>
              
              <div className="pt-4">
                <p className={`text-xs tracking-[0.2em] font-bold uppercase transition-colors duration-500
                  ${aiState === 'SPEAKING' ? 'text-blue-400' : 
                    aiState === 'LISTENING' ? 'text-emerald-400' : 
                    aiState === 'THINKING' ? 'text-amber-400' : 'text-slate-600'}`}>
                  {aiState === 'IDLE' ? 'System Standby' : aiState}
                </p>
              </div>
            </div>
          </div>

          {/* Main Action Buttons */}
          <div className="z-10 w-full space-y-4">
            {/* Error Message if any */}
            {(error || permissionError) && (
              <div className="p-4 bg-red-950/30 border border-red-500/20 rounded-xl text-red-400 text-xs text-center">
                {error || permissionError}
              </div>
            )}

            {/* Start Session Button */}
            {status === 'ready' && !isTerminated && (
              <button 
                onClick={handleStartSession}
                className="w-full py-5 rounded-2xl bg-white text-slate-950 font-bold font-outfit text-sm tracking-widest shadow-[0_20px_40px_rgba(255,255,255,0.05)] hover:bg-slate-100 hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                BEGIN INTERVIEW
              </button>
            )}

            {/* End Session Button */}
            {status === 'running' && !isTerminated && (
              <button 
                onClick={handleEndSession}
                className="w-full py-4 rounded-2xl bg-slate-900 border border-slate-800 text-slate-400 font-bold text-xs tracking-widest hover:bg-red-950/20 hover:text-red-400 hover:border-red-900/50 transition-all uppercase"
              >
                End Session Gracefully
              </button>
            )}

            {/* Reconnect Button */}
            {(status === 'disconnected' || status === 'error' || status === 'ending') && !isTerminated && (
              <button 
                onClick={() => window.location.reload()}
                className="w-full py-5 rounded-2xl bg-blue-600 text-white font-bold text-sm tracking-widest transition-all hover:bg-blue-500"
              >
                REESTABLISH CONNECTION
              </button>
            )}
            
            <p className="text-center text-slate-700 text-[9px] uppercase tracking-widest font-bold">
              Secure Voice Channel • End-to-End Encryption
            </p>
          </div>

          {/* Subtle Background Accent */}
          <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-blue-500/5 to-transparent pointer-events-none"></div>
        </div>

        {/* --- RIGHT PANEL: LIVE TRANSCRIPT --- */}
        <div className="flex-1 flex flex-col bg-slate-900/40 backdrop-blur-3xl relative">
          
          {/* Search/Header Bar */}
          <div className="h-24 border-b border-slate-900/50 flex items-center justify-between px-10">
            <div className="flex items-center space-x-4">
              <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
              <h3 className="text-sm font-outfit font-semibold text-slate-300 tracking-widest uppercase">Live Interview Transcript</h3>
            </div>
            {sessionId && (
              <div className="px-3 py-1 bg-slate-900 border border-slate-800 rounded-md">
                <span className="text-[10px] text-slate-500 font-mono">STATION: {sessionId.substring(0,8)}</span>
              </div>
            )}
          </div>

          {/* Transcript Scroll Area */}
          <div className="flex-1 overflow-y-auto px-10 py-8 space-y-8 scroll-smooth custom-scrollbar">
            
            {/* Empty State */}
            {chatHistory.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-slate-700 space-y-6 opacity-40">
                <ChatIcon />
                <p className="text-xs uppercase tracking-[0.3em] font-bold">Waiting for initiation...</p>
              </div>
            )}

            {/* Message List */}
            {chatHistory.map((msg, index) => (
              <div 
                key={index} 
                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-in slide-in-from-bottom-2 duration-500`}
              >
                <div className={`max-w-[75%] px-7 py-5 rounded-3xl text-[14px] leading-relaxed transition-all
                  ${msg.role === 'user' 
                    ? 'bg-blue-600 text-white rounded-br-none shadow-lg shadow-blue-900/20' 
                    : 'bg-slate-800/80 border border-slate-700/50 text-slate-200 rounded-bl-none shadow-xl shadow-black/20 backdrop-blur-sm'}`}>
                  {msg.text}
                </div>
                <div className={`mt-3 flex items-center space-x-2 text-[Home] ${msg.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                  <span className="text-[9px] font-bold uppercase tracking-widest text-slate-600">
                    {msg.role === 'user' ? 'Candidate' : 'Verbo AI'}
                  </span>
                  <span className="text-slate-800">•</span>
                  <span className="text-[9px] text-slate-700 font-mono">
                    {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second: '2-digit'})}
                  </span>
                </div>
              </div>
            ))}

            {/* Thinking Interaction */}
            {status === 'running' && aiState === 'THINKING' && (
              <div className="flex flex-col items-start animate-in fade-in slide-in-from-left-2 duration-500">
                 <div className="bg-slate-800/40 border border-slate-700/30 rounded-full px-6 py-4 flex space-x-2 items-center">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce"></div>
                 </div>
              </div>
            )}

            {/* Scroll Anchor */}
            <div ref={messagesEndRef} />
          </div>

          {/* Footer Status Bar */}
          <div className="p-6 border-t border-slate-900/50 bg-slate-950/20 flex justify-center">
            <div className={`px-6 py-2 rounded-full border transition-all duration-500 ${
              aiState === 'LISTENING' ? 'border-emerald-500/50 bg-emerald-500/5 text-emerald-400' : 'border-slate-800 bg-slate-900/50 text-slate-500'
            }`}>
              <p className="text-[10px] uppercase tracking-[0.2em] font-bold">
                {aiState === 'LISTENING' ? 'Environment Capture Active • Speak clearly' : 'Secure voice feedback loops active'}
              </p>
            </div>
          </div>

        </div>

      </div>
      
      {/* Global CSS for custom animations and scrollbars */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 8s linear infinite;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #1e293b;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #334155;
        }
      `}} />
    </div>
  );
};

export default InterviewPage;
