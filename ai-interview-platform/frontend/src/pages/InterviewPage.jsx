/*
================================================================================
INTERVIEW PAGE (Frontend) - Dark Mode & Chat Layout
================================================================================
ROLE: The Modern Interview Room 🎤
*/

import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/auth.store';
import SocketService from '../services/socket.service';
import useAudioRecorder from '../hooks/useAudioRecorder';

const InterviewPage = () => {

  // ---------------------------------------------------------------------------
  // HOOKS & STATE
  // ---------------------------------------------------------------------------
  const navigate = useNavigate();
  const { user, loading } = useAuthStore();
  const messagesEndRef = useRef(null); // For auto-scrolling chat

  const { 
    isRecording, 
    permissionError, 
    aiState, 
    aiMessage, // Current/Status message
    startRecording, 
    stopRecording,
    chatHistory, // Full history for chat UI
    isTerminated // NEW: Track termination
  } = useAudioRecorder();

  const [status, setStatus] = useState('disconnected');
  const [sessionId, setSessionId] = useState(null);
  const [error, setError] = useState(null);
  const [timeElapsed, setTimeElapsed] = useState(0);

  const heartbeatIntervalRef = useRef(null);
  const timerIntervalRef = useRef(null);

  // ---------------------------------------------------------------------------
  // EFFECTS
  // ---------------------------------------------------------------------------

  // 1. Auth & Connection
  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate('/login');
      return;
    }

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

    return () => {
      handleEndSession();
    };
  }, [user, loading, navigate]);

  // 2. Auto-scroll chat to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, aiMessage]);
  
  // 3. Force stop timer if terminated
  useEffect(() => {
    if (isTerminated) {
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
  }, [isTerminated]);

  // ---------------------------------------------------------------------------
  // HANDLERS
  // ---------------------------------------------------------------------------

  const handleStartSession = async () => {
    try {
      setStatus('starting');
      setError(null);
      
      const sid = await SocketService.startSession();
      setSessionId(sid);
      
      SocketService.emit('interview:start');
      await startRecording();
      
      setStatus('running');

      heartbeatIntervalRef.current = setInterval(() => {
        SocketService.sendHeartbeat();
      }, 15000);

      timerIntervalRef.current = setInterval(() => {
        setTimeElapsed(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error('Error starting session:', err);
      setError(typeof err === 'string' ? err : err.message || 'Failed to start');
      setStatus('ready');
    }
  };

  const handleEndSession = async () => {
    stopRecording();
    if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

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

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------

  if (loading) return <div className="min-h-screen bg-slate-950 text-slate-400 flex items-center justify-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-blue-500 selection:text-white overflow-hidden relative">
      
       {/* ======================= OVERLAY: TERMINATION LOCKDOWN ======================= */}
      {isTerminated && (
        <div className="absolute inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center text-center p-8 animate-fade-in">
          <div className="w-24 h-24 bg-red-500/20 rounded-full flex items-center justify-center mb-6 animate-pulse">
            <span className="text-6xl">⛔</span>
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">INTERVIEW TERMINATED</h1>
          <p className="text-xl text-red-400 max-w-lg mb-8">
            This session has been permanently locked due to security violations (Tab Switching).
          </p>
          <div className="p-4 bg-red-900/20 border border-red-500/50 rounded-lg text-red-300 font-mono text-sm">
            Violation Code: INTEGRITY_CHECK_FAILED
          </div>
          <button 
             onClick={() => navigate('/dashboard')}
             className="mt-8 px-8 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold transition-all"
          >
            Return to Dashboard
          </button>
        </div>
      )}

      <div className="flex flex-col md:flex-row h-screen max-w-7xl mx-auto shadow-2xl overflow-hidden md:rounded-xl md:my-4 md:h-[calc(100vh-2rem)] border border-slate-800 bg-slate-900">

        {/* ======================= LEFT PANEL: AVATAR & CONTROLS ======================= */}
        <div className="md:w-1/3 p-6 flex flex-col items-center justify-between border-b md:border-b-0 md:border-r border-slate-800 bg-gradient-to-b from-slate-900 to-slate-950 relative overflow-hidden">
          
          {/* Subtle Background Glow */}
          <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-20">
             <div className="absolute -top-[20%] -left-[20%] w-[150%] h-[150%] bg-blue-900 rounded-full blur-[100px] animate-pulse"></div>
          </div>

          {/* Header */}
          <div className="z-10 w-full flex justify-between items-center">
            <h1 className="text-lg font-bold tracking-wider text-slate-300">VERBO<span className="text-blue-500">AI</span></h1>
            <div className={`text-xs px-2 py-1 rounded-full border ${status === 'running' ? 'border-green-500/30 bg-green-500/10 text-green-400' : 'border-slate-700 bg-slate-800 text-slate-400'}`}>
              {status.toUpperCase()}
            </div>
          </div>

          {/* Avatar Interaction Area */}
          <div className="z-10 flex-1 flex flex-col items-center justify-center space-y-8 py-10">
            
            {/* The Orb / Avatar */}
            <div className="relative">
              {/* Outer Glow Rings (Only when Active) */}
              {status === 'running' && aiState === 'SPEAKING' && (
                <>
                  <div className="absolute inset-0 rounded-full bg-blue-500 opacity-20 animate-ping"></div>
                  <div className="absolute -inset-4 rounded-full border border-blue-500/30 animate-pulse"></div>
                </>
              )}
              {status === 'running' && aiState === 'LISTENING' && (
                <div className="absolute -inset-2 rounded-full border border-green-500/30 animate-pulse"></div>
              )}

              {/* Main Avatar Circle */}
              <div className={`w-40 h-40 rounded-full flex items-center justify-center text-6xl shadow-2xl border-4 transition-all duration-500
                ${aiState === 'SPEAKING' ? 'bg-blue-600/20 border-blue-500 scale-110 shadow-blue-500/50' : 
                  aiState === 'LISTENING' ? 'bg-green-600/20 border-green-500' : 
                  aiState === 'THINKING' ? 'bg-yellow-600/20 border-yellow-500 animate-bounce' : 
                  'bg-slate-800 border-slate-700'}`}>
                
                {aiState === 'SPEAKING' ? '🤖' : 
                 aiState === 'LISTENING' ? '👂' : 
                 aiState === 'THINKING' ? '🧠' : '😴'}
              </div>
            </div>

            {/* Status Text & Timer */}
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-light text-white">
                {status === 'running' ? formatTime(timeElapsed) : '--:--'}
              </h2>
              <p className={`text-sm tracking-widest font-medium uppercase
                ${aiState === 'SPEAKING' ? 'text-blue-400 animate-pulse' : 
                  aiState === 'LISTENING' ? 'text-green-400' : 
                  aiState === 'THINKING' ? 'text-yellow-400' : 'text-slate-500'}`}>
                {aiState === 'IDLE' ? 'Ready to Start' : aiState}
              </p>
            </div>
          </div>

          {/* Controls */}
          <div className="z-10 w-full space-y-3">
            {(error || permissionError) && (
              <div className="p-3 bg-red-900/20 border border-red-500/50 rounded-lg text-red-400 text-xs mb-4">
                {error || permissionError}
              </div>
            )}

            {status === 'ready' && !isTerminated && (
              <button 
                onClick={handleStartSession}
                className="w-full py-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold tracking-wide shadow-lg shadow-blue-900/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                START INTERVIEW
              </button>
            )}

            {status === 'running' && !isTerminated && (
              <button 
                onClick={handleEndSession}
                className="w-full py-4 rounded-xl bg-red-600/10 hover:bg-red-600/20 border border-red-600/50 text-red-500 font-bold tracking-wide transition-all"
              >
                END SESSION
              </button>
            )}
             {/* Disabled State for Termination */}
            {isTerminated && (
               <button 
                disabled
                className="w-full py-4 rounded-xl bg-slate-800 text-slate-500 font-bold tracking-wide cursor-not-allowed border border-slate-700"
              >
                SESSION LOCKED
              </button>
            )}

            {(status === 'disconnected' || status === 'error' || status === 'ending') && !isTerminated && (
               <button 
                onClick={() => window.location.reload()}
                className="w-full py-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition-all"
              >
                RECONNECT
              </button>
            )}
            
            <p className="text-center text-slate-600 text-[10px] mt-2">
              Microphone access required • AI-Powered
            </p>
          </div>
        </div>

        {/* ======================= RIGHT PANEL: CHAT / TRANSCRIPT ======================= */}
        <div className="md:w-2/3 bg-slate-900 flex flex-col relative">
          
          {/* Chat Header */}
          <div className="h-16 border-b border-slate-800 flex items-center px-6 bg-slate-900/90 backdrop-blur sticky top-0 z-10">
            <div className="w-2 h-2 rounded-full bg-green-500 mr-3 animate-pulse"></div>
            <h3 className="font-semibold text-slate-200">Live Transcript</h3>
            {sessionId && <span className="ml-auto text-xs text-slate-600 font-mono">ID: {sessionId.substring(0,8)}...</span>}
          </div>

          {/* Chat History Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth">
            {chatHistory.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-slate-600 space-y-4 opacity-50">
                <span className="text-4xl text-slate-700">💬</span>
                <p>Conversation will appear here...</p>
              </div>
            )}

            {chatHistory.map((msg, index) => (
              <div key={index} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`max-w-[85%] md:max-w-[70%] rounded-2xl px-5 py-3 shadow-sm text-sm leading-relaxed
                  ${msg.role === 'user' 
                    ? 'bg-blue-600 text-white rounded-br-none' 
                    : 'bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700'}`}>
                  {msg.text}
                </div>
                <span className="text-[10px] text-slate-600 mt-1 px-1">
                  {msg.role === 'user' ? 'You' : 'AI Interviewer'} • {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </span>
              </div>
            ))}

            {/* "Thinking" Bubble */}
            {status === 'running' && aiState === 'THINKING' && (
              <div className="flex flex-col items-start animate-fade-in">
                 <div className="bg-slate-800 border border-slate-700 rounded-2xl rounded-bl-none px-4 py-3 flex space-x-1 items-center">
                    <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce delay-75"></div>
                    <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce delay-150"></div>
                    <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce delay-300"></div>
                 </div>
                 <span className="text-[10px] text-slate-600 mt-1 px-1">AI is thinking...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area Placeholder (Since it's voice-first, we just show status) */}
          <div className="p-4 border-t border-slate-800 bg-slate-900/50 text-center">
            <p className="text-xs text-slate-500">
              {aiState === 'LISTENING' ? '🎤 Listening clearly... speak now.' : '🔒 Voice channel active'}
            </p>
          </div>

        </div>

      </div>
    </div>
  );
};

export default InterviewPage;
