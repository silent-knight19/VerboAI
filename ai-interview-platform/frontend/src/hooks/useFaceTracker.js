/*
================================================================================
FACE TRACKER HOOK - IMPROVED ANTI-CHEAT DETECTION
================================================================================
ROLE: 
  - Monitors the user's camera feed to detect cheating behavior.
  - Uses MediaPipe FaceMesh with IMPROVED detection algorithms.
  
DETECTION METHODS:
  1. Face Position: Is the face centered in the camera view?
  2. Face Size: Is the user moving away from the screen?
  3. Face Visibility: Is the full face visible (not turned away)?
  4. Face Lost: Has the face disappeared for too long?
================================================================================
*/

import { useEffect, useRef, useState, useCallback } from 'react';

// ================================================================================
// MODULE-LEVEL SINGLETON STATE (Survives React re-renders)
// ================================================================================
let globalFaceMesh = null;
let globalStream = null;
let globalIsInitializing = false;
let globalIsInitialized = false;
let globalFrameId = null;
let globalVideoElement = null;
let globalResultsCallback = null;
let activeHookCount = 0;
let cleanupTimeoutId = null;

// ================================================================================
// THE HOOK
// ================================================================================
const useFaceTracker = (onViolation, externalVideoRef) => {
  const localVideoRef = useRef(null);
  const violationCooldownRef = useRef(0);
  const isFaceTrackedRef = useRef(false);
  const faceLastSeenRef = useRef(Date.now());
  const baselineFaceRef = useRef(null); // Store initial face position for comparison
  
  // Duration tracking - only flag if behavior persists
  const gazeSuspiciousStartRef = useRef(null);  // When gaze started looking away
  const eyesClosedStartRef = useRef(null);       // When eyes appeared closed
  const headTurnedStartRef = useRef(null);       // When head turned away
  
  const videoRef = externalVideoRef || localVideoRef;

  const [isFaceTracked, setIsFaceTracked] = useState(false);
  const [trackerError, setTrackerError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // ============================================================================
  // CONFIGURATION - Adjust these for sensitivity
  // ============================================================================
  const CONFIG = {
    // How far the face center can move from baseline (0 = center, 0.5 = edge)
    FACE_POSITION_THRESHOLD: 0.25,
    
    // How much smaller the face can get (0.5 = half the original size = moved away)
    FACE_SIZE_THRESHOLD: 0.6,
    
    // How asymmetric the face can be (detects head rotation via landmark positions)
    FACE_ASYMMETRY_THRESHOLD: 0.35, // Relaxed - allows more head tilt
    
    // How long face can be missing before violation (milliseconds)
    FACE_MISSING_THRESHOLD: 1500,
    
    // Cooldown between violations (milliseconds)
    VIOLATION_COOLDOWN: 5000,
    
    // How many frames to wait before setting baseline (let user settle)
    BASELINE_DELAY_FRAMES: 30,
    
    // How long suspicious behavior must persist before flagging (milliseconds)
    // This prevents false positives from blinking or quick glances
    SUSPICIOUS_DURATION_THRESHOLD: 1500  // 1.5 seconds
  };
  
  const frameCountRef = useRef(0);

  // ============================================================================
  // TRIGGER VIOLATION (with debounce)
  // ============================================================================
  const triggerViolation = useCallback((reason) => {
    const now = Date.now();
    
    if (now - violationCooldownRef.current > CONFIG.VIOLATION_COOLDOWN) {
        console.log(`🚨 ANTI-CHEAT VIOLATION: ${reason}`);
        violationCooldownRef.current = now;
        if (onViolation) {
          onViolation(reason);
        }
    }
  }, [onViolation, CONFIG.VIOLATION_COOLDOWN]);

  // ============================================================================
  // ANALYZE FACE LANDMARKS
  // ============================================================================
  const handleResults = useCallback((results) => {
    const now = Date.now();
    frameCountRef.current++;
    
    // ----- NO FACE DETECTED -----
    if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
      if (isFaceTrackedRef.current) {
        isFaceTrackedRef.current = false;
        setIsFaceTracked(false);
        console.log("👤 Face LOST");
      }
      
      // Trigger violation if face missing for too long
      if (now - faceLastSeenRef.current > CONFIG.FACE_MISSING_THRESHOLD) {
        triggerViolation('face_not_visible');
      }
      return;
    }
    
    // Face is visible
    faceLastSeenRef.current = now;
    
    if (!isFaceTrackedRef.current) {
      isFaceTrackedRef.current = true;
      setIsFaceTracked(true);
      console.log("👤 Face DETECTED");
    }

    const landmarks = results.multiFaceLandmarks[0];
    
    // ----- CALCULATE FACE METRICS -----
    
    // Key landmark indices
    const NOSE_TIP = 4;
    const LEFT_EYE_OUTER = 33;
    const RIGHT_EYE_OUTER = 263;
    const LEFT_EAR = 234;  // Left side of face
    const RIGHT_EAR = 454; // Right side of face
    const CHIN = 152;
    const FOREHEAD = 10;
    
    // EYE & IRIS LANDMARKS (available with refineLandmarks: true)
    // Left eye corners
    const LEFT_EYE_INNER = 133;
    const LEFT_EYE_OUTER_CORNER = 33;
    // Right eye corners  
    const RIGHT_EYE_INNER = 362;
    const RIGHT_EYE_OUTER_CORNER = 263;
    // Iris centers (only available with refineLandmarks)
    const LEFT_IRIS_CENTER = 468;
    const RIGHT_IRIS_CENTER = 473;
    
    const nose = landmarks[NOSE_TIP];
    const leftEye = landmarks[LEFT_EYE_OUTER];
    const rightEye = landmarks[RIGHT_EYE_OUTER];
    const leftSide = landmarks[LEFT_EAR];
    const rightSide = landmarks[RIGHT_EAR];
    const chin = landmarks[CHIN];
    const forehead = landmarks[FOREHEAD];
    
    // Get eye corners and iris positions
    const leftEyeInner = landmarks[LEFT_EYE_INNER];
    const leftEyeOuter = landmarks[LEFT_EYE_OUTER_CORNER];
    const rightEyeInner = landmarks[RIGHT_EYE_INNER];
    const rightEyeOuter = landmarks[RIGHT_EYE_OUTER_CORNER];
    
    // Additional eye landmarks for vertical gaze
    const LEFT_EYE_TOP = 159;
    const LEFT_EYE_BOTTOM = 145;
    const RIGHT_EYE_TOP = 386;
    const RIGHT_EYE_BOTTOM = 374;
    
    const leftEyeTop = landmarks[LEFT_EYE_TOP];
    const leftEyeBottom = landmarks[LEFT_EYE_BOTTOM];
    const rightEyeTop = landmarks[RIGHT_EYE_TOP];
    const rightEyeBottom = landmarks[RIGHT_EYE_BOTTOM];
    
    // Iris centers (indices 468-477 are iris landmarks when refineLandmarks is true)
    const leftIris = landmarks[LEFT_IRIS_CENTER];
    const rightIris = landmarks[RIGHT_IRIS_CENTER];
    
    // Calculate face center (average of nose and eye positions)
    const faceCenter = {
      x: (nose.x + leftEye.x + rightEye.x) / 3,
      y: (nose.y + leftEye.y + rightEye.y) / 3
    };
    
    // Calculate face width (distance between left and right sides)
    const faceWidth = Math.abs(rightSide.x - leftSide.x);
    
    // Calculate face height
    const faceHeight = Math.abs(chin.y - forehead.y);
    
    // ===== HORIZONTAL ASYMMETRY (left/right head turn) =====
    const leftSideToNose = Math.abs(nose.x - leftSide.x);
    const rightSideToNose = Math.abs(rightSide.x - nose.x);
    const horizontalAsymmetry = Math.abs(leftSideToNose - rightSideToNose) / (leftSideToNose + rightSideToNose);
    
    // ===== VERTICAL ASYMMETRY (up/down head tilt) =====
    // Compare nose-to-forehead vs nose-to-chin distance
    const noseToForehead = Math.abs(nose.y - forehead.y);
    const noseToChin = Math.abs(chin.y - nose.y);
    const verticalAsymmetry = Math.abs(noseToForehead - noseToChin) / (noseToForehead + noseToChin);
    
    // ===== EYE GAZE CALCULATION =====
    // Calculate where the iris is positioned within the eye socket
    let gazeX = 0.5; // 0 = looking left, 0.5 = center, 1 = looking right
    let gazeY = 0.5; // 0 = looking up, 0.5 = center, 1 = looking down
    let gazeValid = false;
    
    // Debug: Check if iris landmarks exist
    // MediaPipe provides 478 landmarks with refineLandmarks=true (468-477 are iris)
    const hasIrisLandmarks = landmarks.length > 468;
    
    if (hasIrisLandmarks && leftIris && rightIris) {
      gazeValid = true;
      
      // ----- HORIZONTAL GAZE (left/right) -----
      // Left eye: where is iris between outer (left) and inner (right) corner?
      const leftEyeWidth = Math.abs(leftEyeInner.x - leftEyeOuter.x);
      const leftIrisPosX = (leftIris.x - leftEyeOuter.x) / leftEyeWidth;
      
      // Right eye: where is iris between inner (left) and outer (right) corner?
      const rightEyeWidth = Math.abs(rightEyeOuter.x - rightEyeInner.x);
      const rightIrisPosX = (rightIris.x - rightEyeInner.x) / rightEyeWidth;
      
      // Average both eyes (clamp to reasonable range)
      gazeX = Math.max(0, Math.min(1, (leftIrisPosX + rightIrisPosX) / 2));
      
      // ----- VERTICAL GAZE (up/down) -----
      // Left eye: where is iris between top and bottom?
      const leftEyeHeight = Math.abs(leftEyeBottom.y - leftEyeTop.y);
      const leftIrisPosY = (leftIris.y - leftEyeTop.y) / leftEyeHeight;
      
      // Right eye
      const rightEyeHeight = Math.abs(rightEyeBottom.y - rightEyeTop.y);
      const rightIrisPosY = (rightIris.y - rightEyeTop.y) / rightEyeHeight;
      
      // Average both eyes (clamp to reasonable range)
      gazeY = Math.max(0, Math.min(1, (leftIrisPosY + rightIrisPosY) / 2));
    } else {
      // Log once if iris not available
      if (frameCountRef.current === 60) {
        console.warn(`⚠️ Iris landmarks not available. Total landmarks: ${landmarks.length}. Need 478 for iris tracking.`);
      }
    }
    
    // ----- SET BASELINE (first few frames) -----
    if (frameCountRef.current <= CONFIG.BASELINE_DELAY_FRAMES) {
      // Still calibrating
      if (frameCountRef.current === CONFIG.BASELINE_DELAY_FRAMES) {
        baselineFaceRef.current = {
          center: { ...faceCenter },
          width: faceWidth,
          height: faceHeight,
          gazeX: gazeX,
          gazeY: gazeY,
          gazeValid: gazeValid
        };
        console.log("📐 Baseline set:", { 
          faceCenter: baselineFaceRef.current.center, 
          gazeX: gazeX.toFixed(2), 
          gazeY: gazeY.toFixed(2),
          gazeTracking: gazeValid ? "ENABLED" : "DISABLED"
        });
      }
      return;
    }
    
    // No baseline yet? Can't compare
    if (!baselineFaceRef.current) return;
    
    const baseline = baselineFaceRef.current;
    
    // ----- CHECK 1: Face Position (moved away from center) -----
    const positionDrift = Math.sqrt(
      Math.pow(faceCenter.x - baseline.center.x, 2) +
      Math.pow(faceCenter.y - baseline.center.y, 2)
    );
    
    // ----- CHECK 2: Face Size (user moved away from screen) -----
    const sizeRatio = faceWidth / baseline.width;
    
    // ----- CHECK 3: Eye Gaze (looking away from screen) -----
    // Make sure baseline gaze values exist (they might not if baseline was set earlier)
    const baseGazeX = baseline.gazeX !== undefined ? baseline.gazeX : 0.5;
    const baseGazeY = baseline.gazeY !== undefined ? baseline.gazeY : 0.5;
    const gazeDriftX = gazeValid ? Math.abs(gazeX - baseGazeX) : 0;
    const gazeDriftY = gazeValid ? Math.abs(gazeY - baseGazeY) : 0;
    const totalGazeDrift = Math.sqrt(gazeDriftX * gazeDriftX + gazeDriftY * gazeDriftY);
    
    // ----- DEBUG LOG (every 2 seconds) -----
    if (frameCountRef.current % 60 === 0) {
      console.log(`📊 Face: Pos=${positionDrift.toFixed(3)} | Size=${sizeRatio.toFixed(2)} | HAsym=${horizontalAsymmetry.toFixed(2)} | VAsym=${verticalAsymmetry.toFixed(2)}`);
      if (gazeValid) {
        console.log(`👁️ Gaze: X=${gazeX.toFixed(2)} Y=${gazeY.toFixed(2)} | Drift=${totalGazeDrift.toFixed(2)}`);
      }
    }
    
    // ----- DURATION-BASED VIOLATION CHECKS -----
    // Only trigger if suspicious behavior persists for 1.5+ seconds
    // (reusing 'now' from top of function)
    const DURATION = CONFIG.SUSPICIOUS_DURATION_THRESHOLD;
    
    // --- Head Position Check ---
    const isHeadSuspicious = (
      positionDrift > CONFIG.FACE_POSITION_THRESHOLD ||
      horizontalAsymmetry > CONFIG.FACE_ASYMMETRY_THRESHOLD ||
      verticalAsymmetry > CONFIG.FACE_ASYMMETRY_THRESHOLD
    );
    
    if (isHeadSuspicious) {
      // Start tracking if not already
      if (!headTurnedStartRef.current) {
        headTurnedStartRef.current = now;
      } else if (now - headTurnedStartRef.current > DURATION) {
        // Suspicious for too long!
        console.log(`⚠️ Head position suspicious for ${DURATION/1000}s+`);
        triggerViolation('looking_away');
        headTurnedStartRef.current = null; // Reset after violation
      }
    } else {
      // Behavior stopped - reset timer
      headTurnedStartRef.current = null;
    }
    
    // --- Face Size Check (moved away from screen) ---
    if (sizeRatio < CONFIG.FACE_SIZE_THRESHOLD) {
      console.log(`⚠️ Face too small: ${sizeRatio.toFixed(2)} < ${CONFIG.FACE_SIZE_THRESHOLD}`);
      triggerViolation('moved_away');
    }
    
    // --- Eye Gaze Check ---
    // Lower threshold is OK because we require 1.5s duration for sustained looking away
    const GAZE_THRESHOLD = 0.18; // 18% drift from baseline
    const isGazeSuspicious = gazeValid && totalGazeDrift > GAZE_THRESHOLD;
    
    if (isGazeSuspicious) {
      // Start tracking if not already
      if (!gazeSuspiciousStartRef.current) {
        gazeSuspiciousStartRef.current = now;
      } else if (now - gazeSuspiciousStartRef.current > DURATION) {
        // Eyes looking away for too long!
        console.log(`👁️ Eyes looking away for ${DURATION/1000}s+: drift=${totalGazeDrift.toFixed(2)}`);
        triggerViolation('eyes_wandering');
        gazeSuspiciousStartRef.current = null; // Reset after violation
      }
    } else {
      // Gaze is normal - reset timer
      gazeSuspiciousStartRef.current = null;
    }
    
  }, [triggerViolation, CONFIG]);

  // ============================================================================
  // MAIN EFFECT - Initialize FaceMesh
  // ============================================================================
  useEffect(() => {
    let isMounted = true;
    
    if (cleanupTimeoutId) {
      clearTimeout(cleanupTimeoutId);
      cleanupTimeoutId = null;
    }
    
    activeHookCount++;
    console.log(`🔐 FaceTracker: Hook mounted (${activeHookCount} active)`);
    globalResultsCallback = handleResults;

    // Helper: Inject script
    const injectScript = (src) => {
      return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) return resolve();
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.onload = resolve;
        script.onerror = () => reject(new Error(`Failed to load: ${src}`));
        document.head.appendChild(script);
      });
    };

    // Helper: Wait for FaceMesh class
    const waitForFaceMesh = (maxAttempts = 50) => {
      return new Promise((resolve, reject) => {
        let attempts = 0;
        const check = () => {
          if (typeof window.FaceMesh === 'function') return resolve();
          if (++attempts >= maxAttempts) return reject(new Error('FaceMesh timeout'));
          setTimeout(check, 100);
        };
        check();
      });
    };

    // Helper: Check if video is ready
    const isVideoReady = (video) => {
      return video && video.readyState >= 2 && video.videoWidth > 0;
    };

    // Initialize
    const initializeGlobalTracker = async () => {
      if (globalIsInitialized && globalFaceMesh) {
        console.log("🔐 FaceTracker: Reusing existing instance");
        if (videoRef.current && globalStream) {
          globalVideoElement = videoRef.current;
          if (!globalVideoElement.srcObject) {
            globalVideoElement.srcObject = globalStream;
            await globalVideoElement.play().catch(() => {});
          }
        }
        setIsLoading(false);
        return;
      }

      if (globalIsInitializing) {
        console.log("🔐 FaceTracker: Waiting for initialization...");
        while (!globalIsInitialized && globalIsInitializing) {
          await new Promise(r => setTimeout(r, 100));
        }
        if (globalIsInitialized) setIsLoading(false);
        return;
      }

      globalIsInitializing = true;

      try {
        console.log("🔐 FaceTracker: Initializing...");
        await injectScript('https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js');
        if (!isMounted) { globalIsInitializing = false; return; }

        await waitForFaceMesh();
        if (!isMounted) { globalIsInitializing = false; return; }

        globalFaceMesh = new window.FaceMesh({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
        });

        globalFaceMesh.setOptions({
          maxNumFaces: 1,
          refineLandmarks: true,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        globalFaceMesh.onResults((results) => {
          if (globalResultsCallback) globalResultsCallback(results);
        });

        globalStream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, frameRate: 15 },
          audio: false
        });

        if (!isMounted) {
          globalStream.getTracks().forEach(t => t.stop());
          globalStream = null;
          globalIsInitializing = false;
          return;
        }

        if (videoRef.current) {
          globalVideoElement = videoRef.current;
          globalVideoElement.srcObject = globalStream;
          await globalVideoElement.play();
        }

        globalIsInitialized = true;
        globalIsInitializing = false;
        setIsLoading(false);
        console.log("✅ FaceTracker: Ready");

        // Processing loop
        const process = async () => {
          if (!globalIsInitialized) return;
          if (globalFaceMesh && globalVideoElement && isVideoReady(globalVideoElement)) {
            try {
              await globalFaceMesh.send({ image: globalVideoElement });
            } catch (e) {}
          }
          globalFrameId = requestAnimationFrame(process);
        };
        process();

      } catch (err) {
        console.error("❌ FaceTracker Error:", err);
        globalIsInitializing = false;
        if (isMounted) {
          setTrackerError("Camera access denied or MediaPipe failed.");
          setIsLoading(false);
        }
      }
    };

    initializeGlobalTracker();

    // Cleanup with delay
    return () => {
      isMounted = false;
      activeHookCount--;
      
      if (activeHookCount <= 0) {
        cleanupTimeoutId = setTimeout(() => {
          if (activeHookCount <= 0) {
            console.log("🔐 FaceTracker: Cleanup executing...");
            if (globalFrameId) cancelAnimationFrame(globalFrameId);
            if (globalStream) globalStream.getTracks().forEach(t => t.stop());
            if (globalFaceMesh?.close) try { globalFaceMesh.close(); } catch(e) {}
            globalFaceMesh = null;
            globalStream = null;
            globalVideoElement = null;
            globalResultsCallback = null;
            globalIsInitialized = false;
            globalIsInitializing = false;
            globalFrameId = null;
          }
        }, 1000);
      }
    };
  }, [handleResults, videoRef]);

  return { isFaceTracked, trackerError, isLoading };
};

export default useFaceTracker;
