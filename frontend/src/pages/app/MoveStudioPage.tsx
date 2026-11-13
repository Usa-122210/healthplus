import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Camera,
  RotateCcw,
  Volume2,
  VolumeX,
  Play,
  Square,
  CheckCircle2,
  Plus,
  Zap,
  Box,
  Video,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { AnatomicalAthleteVisual } from '@/components/3d/AnatomicalAthleteVisual';
import { useApp } from '@/context/AppContext';
import type { ExerciseTypeId } from '@/types/wellness';
import type {
  ExerciseLiveEvent,
  ExerciseSessionSummary,
  ExerciseStudioProps,
} from '@/types/exerciseIntegration';
import {
  createAnalyzer,
  POSE_CONNECTIONS,
  type Analyzer,
  type Evaluation,
  type Point2D,
} from '@/engine/exerciseKinematicsEngine';

export type { ExerciseLiveEvent, ExerciseSessionSummary, ExerciseStudioProps };

export interface MoveStudioPageProps {
  onNavigate?: (path: string) => void;
}

interface ExerciseMeta {
  id: ExerciseTypeId;
  name: string;
  cameraHint: string;
  instruction: string;
  targetReps: number;
  kcalPerRep: number;
  muscles: string;
  usesTimer?: boolean;
}

// Exactly the 7 exercises from Ayush Pathak's Repetition-Counter repository
const EXERCISES: Record<ExerciseTypeId, ExerciseMeta> = {
  pushup: {
    id: 'pushup',
    name: 'Push-up',
    cameraHint: 'Side view · camera low',
    instruction: 'Keep your body straight. Lower your chest, then press back up.',
    targetReps: 10,
    kcalPerRep: 0.55,
    muscles: 'Chest · Triceps · Core',
  },
  squat: {
    id: 'squat',
    name: 'Bodyweight squat',
    cameraHint: 'Front or side view · feet visible',
    instruction: 'Stand tall, lower under control, then return to standing.',
    targetReps: 12,
    kcalPerRep: 0.45,
    muscles: 'Quadriceps · Glutes · Core',
  },
  jumping_jack: {
    id: 'jumping_jack',
    name: 'Jumping jack',
    cameraHint: 'Front view · full body visible',
    instruction: 'Open arms and feet together, then return to the closed position.',
    targetReps: 25,
    kcalPerRep: 0.25,
    muscles: 'Calves · Deltoids · Core',
  },
  lunge: {
    id: 'lunge',
    name: 'Lunge',
    cameraHint: 'Side view · show both feet',
    instruction: 'Step forward, bend both knees, then return to standing.',
    targetReps: 16,
    kcalPerRep: 0.50,
    muscles: 'Quadriceps · Hamstrings · Glutes',
  },
  bicep_curl: {
    id: 'bicep_curl',
    name: 'Bicep curl',
    cameraHint: 'Front or slight-angle view · show both arms',
    instruction: 'Keep an elbow by your side. Curl either hand toward your shoulder, then lower it.',
    targetReps: 15,
    kcalPerRep: 0.35,
    muscles: 'Biceps · Forearms',
  },
  high_knees: {
    id: 'high_knees',
    name: 'High knees',
    cameraHint: 'Front view · show your full body and both feet',
    instruction: 'Face the camera. Lift either knee to about a 90° bend, lower it, then lift again. Arms are ignored.',
    targetReps: 20,
    kcalPerRep: 0.30,
    muscles: 'Hip Flexors · Quads · Core',
  },
  wall_sit: {
    id: 'wall_sit',
    name: 'Wall sit',
    cameraHint: 'Side view · wall, full body, and feet visible',
    instruction: 'Keep your back against the wall, thighs level, and knees near 90°. The timer runs only while this position is held.',
    targetReps: 45,
    kcalPerRep: 0.15,
    muscles: 'Quadriceps Isometric · Glutes',
    usesTimer: true,
  },
};

const BAD_FORM_MESSAGE = 'Wrong form. Please correct your posture.';

export const MoveStudioPage: React.FC<MoveStudioPageProps> = () => {
  const { workoutsToday, adjustHydration, logWorkout } = useApp();

  // Active exercise matching Ayush Pathak's default ('pushup')
  const [selectedExercise, setSelectedExercise] = useState<ExerciseTypeId>('pushup');
  const [viewMode, setViewMode] = useState<'camera' | '3d'>('camera');
  const [isCameraRunning, setIsCameraRunning] = useState(false);
  const [isPoseLoading, setIsPoseLoading] = useState(false);
  const [voiceMuted, setVoiceMuted] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Live Reps / Timer & Evaluation
  const [counterDisplay, setCounterDisplay] = useState('REPS  0');
  const [currentRepsNum, setCurrentRepsNum] = useState(0);
  const [elapsedDuration, setElapsedDuration] = useState(0);
  const [fps, setFps] = useState<number | null>(null);
  const [evalResult, setEvalResult] = useState<Evaluation>({
    label: 'READY TO START',
    sustainedBad: false,
  });
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analyzerRef = useRef<Analyzer>(createAnalyzer('pushup'));
  const animFrameRef = useRef<number>(0);
  const lastSpokenWarningRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const fpsTimerRef = useRef<number>(performance.now());
  const timerIntervalRef = useRef<number | null>(null);

  const currentMeta = EXERCISES[selectedExercise];

  // Speech feedback helper
  const speakVoice = useCallback((text: string) => {
    if (voiceMuted || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch {}
  }, [voiceMuted]);

  // Exercise change handler
  const handleSelectExercise = (id: ExerciseTypeId) => {
    setSelectedExercise(id);
    const newAnalyzer = createAnalyzer(id);
    analyzerRef.current = newAnalyzer;
    setCounterDisplay(newAnalyzer.counterText());
    setCurrentRepsNum(0);
    setElapsedDuration(0);
    setEvalResult({ label: 'READY TO START', sustainedBad: false });
  };

  // Reset reps / timer
  const handleReset = () => {
    analyzerRef.current.reset();
    setCounterDisplay(analyzerRef.current.counterText());
    setCurrentRepsNum(0);
    setElapsedDuration(0);
    setEvalResult({ label: 'REPS RESET', sustainedBad: false });
  };

  // Manual rep increment for testing
  const handleManualAddRep = () => {
    analyzerRef.current.totalReps += 1;
    analyzerRef.current.goodReps += 1;
    setCounterDisplay(analyzerRef.current.counterText());
    setCurrentRepsNum(analyzerRef.current.totalReps);
    speakVoice(`Rep ${analyzerRef.current.totalReps}`);
  };

  // Stop & Save to Health Plus daily log
  const handleStopAndSave = () => {
    const finalReps = Math.max(analyzerRef.current.totalReps, currentRepsNum, 1);
    const duration = Math.max(elapsedDuration, 15);
    const kcal = currentMeta.usesTimer
      ? Math.round(duration * currentMeta.kcalPerRep)
      : Math.round(finalReps * currentMeta.kcalPerRep);

    logWorkout({
      exerciseType: selectedExercise,
      exerciseLabel: currentMeta.name,
      repsCompleted: finalReps,
      targetReps: currentMeta.targetReps,
      durationSeconds: duration,
      estimatedKcal: kcal,
      mode: isCameraRunning ? 'camera_preview' : 'guided_demo',
      formNotes: [currentMeta.instruction],
    });

    adjustHydration(0.25);
    setSavedNotice(
      `Saved ${finalReps} ${currentMeta.name} (${kcal} kcal burned) to Today & Progress!`
    );
    handleReset();
    setTimeout(() => setSavedNotice(null), 4500);
  };

  // Session duration timer
  useEffect(() => {
    if (!isCameraRunning) {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      return;
    }
    timerIntervalRef.current = window.setInterval(() => {
      setElapsedDuration((d) => d + 1);
    }, 1000);
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [isCameraRunning]);

  // Start Camera & Pose Tracking Loop
  const startCamera = async () => {
    setCameraError(null);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Webcam access not supported in this browser environment.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current) videoRef.current.play();
        };
      }

      setIsCameraRunning(true);
      setIsPoseLoading(true);

      // Load MediaPipe PoseLandmarker
      try {
        const { FilesetResolver, PoseLandmarker } = await import('@mediapipe/tasks-vision');
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );

        const landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numPoses: 1,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        setIsPoseLoading(false);

        // Frame inference loop
        let lastVideoTime = -1;
        const processFrame = () => {
          if (!streamRef.current) return;

          const video = videoRef.current;
          const canvas = canvasRef.current;

          // FPS calculation
          frameCountRef.current += 1;
          const now = performance.now();
          if (now - fpsTimerRef.current >= 1000) {
            setFps(Math.round((frameCountRef.current * 1000) / (now - fpsTimerRef.current)));
            frameCountRef.current = 0;
            fpsTimerRef.current = now;
          }

          if (video && canvas && video.readyState >= 2 && video.currentTime !== lastVideoTime) {
            lastVideoTime = video.currentTime;
            canvas.width = video.videoWidth || 640;
            canvas.height = video.videoHeight || 480;
            const ctx = canvas.getContext('2d');

            try {
              const results = landmarker.detectForVideo(video, now);
              if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
              }

              if (results.landmarks && results.landmarks.length > 0) {
                const rawPoints = results.landmarks[0];
                const points: Point2D[] = rawPoints.map((p) => ({
                  x: p.x,
                  y: p.y,
                  z: p.z,
                  visibility: p.visibility ?? 1.0,
                }));

                const evaluation = analyzerRef.current.evaluate(points);
                setEvalResult(evaluation);
                setCounterDisplay(analyzerRef.current.counterText());
                setCurrentRepsNum(analyzerRef.current.totalReps);

                // Voice warning on sustained bad form (throttled to 2.6s)
                if (evaluation.sustainedBad) {
                  if (now - lastSpokenWarningRef.current >= 2600) {
                    speakVoice(BAD_FORM_MESSAGE);
                    lastSpokenWarningRef.current = now;
                  }
                }

                // Draw live skeleton onto canvas overlay
                if (ctx) {
                  const skeletonColor = evaluation.sustainedBad
                    ? '#ff8175' // Red
                    : evaluation.label.includes('GOOD') ||
                        evaluation.label.includes('OPEN') ||
                        evaluation.label.includes('WALL SIT')
                      ? '#c6f06e' // Lime
                      : '#f1ba5b'; // Amber

                  ctx.strokeStyle = skeletonColor;
                  ctx.lineWidth = 3.5;
                  ctx.lineCap = 'round';

                  // Bones
                  for (const [start, end] of POSE_CONNECTIONS) {
                    const p1 = points[start];
                    const p2 = points[end];
                    if (
                      p1 &&
                      p2 &&
                      (p1.visibility ?? 1.0) > 0.4 &&
                      (p2.visibility ?? 1.0) > 0.4
                    ) {
                      ctx.beginPath();
                      ctx.moveTo(p1.x * canvas.width, p1.y * canvas.height);
                      ctx.lineTo(p2.x * canvas.width, p2.y * canvas.height);
                      ctx.stroke();
                    }
                  }

                  // Joints
                  for (const pt of points) {
                    if (pt && (pt.visibility ?? 1.0) > 0.4) {
                      ctx.beginPath();
                      ctx.arc(pt.x * canvas.width, pt.y * canvas.height, 4, 0, 2 * Math.PI);
                      ctx.fillStyle = '#ffffff';
                      ctx.fill();
                      ctx.strokeStyle = skeletonColor;
                      ctx.lineWidth = 2;
                      ctx.stroke();
                    }
                  }
                }
              } else {
                setEvalResult({ label: 'NO PERSON IN FRAME', sustainedBad: false });
                if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
              }
            } catch {}
          }

          animFrameRef.current = requestAnimationFrame(processFrame);
        };

        animFrameRef.current = requestAnimationFrame(processFrame);
      } catch (err) {
        console.warn('WASM MediaPipe pose note:', err);
        setIsPoseLoading(false);
      }
    } catch {
      setCameraError('Could not open camera. Please grant camera permission or use Guided 3D mode.');
      setIsCameraRunning(false);
    }
  };

  const stopCamera = () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setIsCameraRunning(false);
    setIsPoseLoading(false);
    setFps(null);
    setEvalResult({ label: 'READY TO START', sustainedBad: false });
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const totalRepsToday = workoutsToday.reduce((sum, w) => sum + w.repsCompleted, 0);

  // Status color helpers matching Ayush's Formwise design
  const getStatusColor = () => {
    if (!isCameraRunning) return 'text-[#f1ba5b]'; // Amber
    if (evalResult.sustainedBad) return 'text-[#ff8175]'; // Red
    if (
      evalResult.label.includes('GOOD') ||
      evalResult.label.includes('OPEN') ||
      evalResult.label.includes('WALL SIT')
    ) {
      return 'text-[#c6f06e]'; // Lime
    }
    return 'text-[#f1ba5b]'; // Amber
  };

  return (
    <div className="space-y-4 pb-20 text-left animate-fadeIn max-w-6xl mx-auto">
      {/* Formwise Master Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0c181a] border border-[#284144] p-4 sm:p-5 rounded-2xl shadow-xl">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-heading font-black text-2xl sm:text-3xl tracking-wider text-[#edf5f2]">
              FORMWISE
            </h1>
            <Badge variant="emerald" size="sm" className="bg-[#152d30] text-[#c6f06e] border-[#284144]">
              MediaPipe Pose Tracking
            </Badge>
          </div>
          <p className="text-xs text-[#9fb1ac] mt-1">
            Health Plus exercise coach · pose-based repetition counter & biomechanical form evaluator
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Toggle: Camera vs 3D */}
          <div className="inline-flex rounded-xl bg-[#102326] p-1 border border-[#284144]">
            <button
              type="button"
              onClick={() => setViewMode('camera')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                viewMode === 'camera'
                  ? 'bg-[#c6f06e] text-[#102022] shadow-sm'
                  : 'text-[#9fb1ac] hover:text-[#edf5f2]'
              }`}
            >
              <Video className="w-3.5 h-3.5" />
              <span>Camera Coach</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('3d')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                viewMode === '3d'
                  ? 'bg-[#c6f06e] text-[#102022] shadow-sm'
                  : 'text-[#9fb1ac] hover:text-[#edf5f2]'
              }`}
            >
              <Box className="w-3.5 h-3.5" />
              <span>3D Anatomy</span>
            </button>
          </div>

          <span className="text-xs text-[#9fb1ac] pl-2 hidden md:inline">
            Logged today: <strong className="text-[#edf5f2]">{totalRepsToday} reps</strong>
          </span>
        </div>
      </div>

      {savedNotice && (
        <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-xs font-semibold text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{savedNotice}</span>
        </div>
      )}

      {/* Main 2-Column Coach Shell Matching Ayush's Formwise Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_310px] gap-4 items-start">
        {/* LEFT COLUMN: Camera Feed / Skeleton Overlay Stage */}
        <div className="bg-[#102326] border border-[#284144] rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-xl min-h-[460px]">
          {/* Camera Stage Header */}
          <div className="flex items-center justify-between pb-3 border-b border-[#284144] gap-2">
            <div className="flex items-center gap-3">
              <span className={`text-sm sm:text-base font-bold tracking-wide uppercase ${getStatusColor()}`}>
                {evalResult.label}
              </span>
              {isCameraRunning ? (
                <button
                  type="button"
                  onClick={stopCamera}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-[#ff8175] text-[#2a0e0b] hover:opacity-90 transition-all shadow-sm cursor-pointer"
                >
                  Stop camera
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startCamera}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-[#c6f06e] text-[#102022] hover:opacity-90 transition-all shadow-sm cursor-pointer flex items-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Start camera</span>
                </button>
              )}
            </div>

            {/* Rep Counter / Timer (Large Consolas Typography) */}
            <div className="font-mono text-xl sm:text-2xl font-black text-[#edf5f2] tracking-wider tabular-nums">
              {counterDisplay}
            </div>
          </div>

          {/* Main Visual Window: Live Video or 3D Athlete */}
          <div className="relative my-3 rounded-xl overflow-hidden bg-[#081113] border border-[#284144] min-h-[320px] sm:min-h-[360px] flex items-center justify-center">
            {viewMode === 'camera' ? (
              cameraError ? (
                <div className="text-center p-6 space-y-3">
                  <p className="text-sm font-semibold text-[#ff8175]">{cameraError}</p>
                  <Button size="sm" variant="outline" onClick={startCamera}>
                    Retry Camera
                  </Button>
                </div>
              ) : isCameraRunning ? (
                <div className="relative w-full h-full flex items-center justify-center">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full max-h-[360px] object-cover scale-x-[-1]"
                  />
                  <canvas
                    ref={canvasRef}
                    className="absolute inset-0 w-full h-full max-h-[360px] pointer-events-none scale-x-[-1]"
                  />

                  {isPoseLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-xs">
                      <div className="text-center space-y-2 text-[#edf5f2]">
                        <Zap className="w-6 h-6 animate-spin mx-auto text-[#c6f06e]" />
                        <p className="text-xs font-semibold">Loading MediaPipe Pose Model...</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center p-8 space-y-3">
                  <Camera className="w-12 h-12 text-[#9fb1ac]/50 mx-auto" />
                  <p className="text-sm font-medium text-[#edf5f2]">
                    Select an exercise on the right, then press <strong>Start camera</strong>
                  </p>
                  <p className="text-xs text-[#9fb1ac] max-w-sm mx-auto">
                    Video stays 100% on-device in browser WebAssembly. Frames are never uploaded.
                  </p>
                </div>
              )
            ) : (
              <div className="w-full p-2">
                <AnatomicalAthleteVisual exerciseType={selectedExercise} isActive={isCameraRunning} />
              </div>
            )}
          </div>

          {/* Camera Stage Footer: Feedback & FPS */}
          <div className="flex items-center justify-between pt-2 text-xs text-[#9fb1ac]">
            <div>
              {isCameraRunning ? (
                evalResult.primary != null ? (
                  <span>
                    <strong>{evalResult.primaryName}:</strong> {Math.round(evalResult.primary)}°
                    {evalResult.secondary != null && (
                      <> · <strong>{evalResult.secondaryName}:</strong> {Math.round(evalResult.secondary)}°</>
                    )}
                  </span>
                ) : (
                  <span>Camera tracking active · Keep full body in frame</span>
                )
              ) : (
                <span>Camera is off</span>
              )}
            </div>

            <div className="font-mono text-[11px] text-[#9fb1ac]/80">
              {fps != null && `${fps} FPS`}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Choose Exercise Menu & Formwise Controls */}
        <div className="bg-[#102326] border border-[#284144] rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl">
          <div>
            <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-[#c6f06e]">
              CHOOSE EXERCISE
            </h2>

            {/* Exactly the 7 exercises from Ayush Pathak's repository */}
            <div className="mt-2.5 space-y-1.5">
              {(Object.values(EXERCISES) as ExerciseMeta[]).map((ex) => {
                const isSelected = selectedExercise === ex.id;
                return (
                  <button
                    key={ex.id}
                    type="button"
                    onClick={() => handleSelectExercise(ex.id)}
                    className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? 'bg-[#c6f06e] text-[#102022] shadow-md font-extrabold'
                        : 'bg-[#152d30] text-[#edf5f2] hover:bg-[#1c3a3e] border border-[#284144]'
                    }`}
                  >
                    <span>{ex.name}</span>
                    {isSelected && (
                      <span className="w-2 h-2 rounded-full bg-[#102022] animate-pulse" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border-t border-[#284144] pt-4 space-y-2">
            <h3 className="font-heading font-extrabold text-lg text-[#edf5f2]">
              {currentMeta.name}
            </h3>
            <p className="text-xs font-bold text-[#c6f06e] leading-snug">
              {currentMeta.cameraHint}
            </p>
            <p className="text-xs text-[#9fb1ac] leading-relaxed">
              {currentMeta.instruction}
            </p>
          </div>

          {/* Formwise Action Controls: Reset reps, Voice on/off */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={handleReset}
              className="px-3 py-2 rounded-xl bg-[#152d30] hover:bg-[#1c3a3e] border border-[#284144] text-[#edf5f2] text-xs font-semibold cursor-pointer transition-colors flex items-center justify-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{currentMeta.usesTimer ? 'Reset timer' : 'Reset reps'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const nextMuted = !voiceMuted;
                setVoiceMuted(nextMuted);
                if (!nextMuted) speakVoice('Voice feedback enabled');
              }}
              className={`px-3 py-2 rounded-xl border text-xs font-semibold cursor-pointer transition-colors flex items-center justify-center gap-1.5 ${
                voiceMuted
                  ? 'bg-[#152d30] text-[#9fb1ac] border-[#284144]'
                  : 'bg-[#152d30] text-[#c6f06e] border-[#284144] font-bold'
              }`}
            >
              {voiceMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              <span>{voiceMuted ? 'Voice off' : 'Voice on'}</span>
            </button>
          </div>

          {/* Save Workout to Health Plus */}
          <div className="pt-2 space-y-2">
            <Button
              variant="primary"
              size="md"
              className="w-full bg-[#c6f06e] text-[#102022] hover:bg-[#b5e05a] font-bold border-0"
              onClick={handleStopAndSave}
              leftIcon={<Square className="w-3.5 h-3.5 fill-current" />}
            >
              Finish &amp; Save Workout
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs text-[#edf5f2] border-[#284144] hover:bg-[#152d30]"
              onClick={handleManualAddRep}
              leftIcon={<Plus className="w-3.5 h-3.5" />}
            >
              +1 Manual Rep
            </Button>
          </div>

          {/* Formwise Rule Notice */}
          <p className="text-[11px] text-[#718782] leading-tight pt-1">
            Voice correction only plays during sustained bad form. It stops immediately when form becomes correct.
          </p>

          {/* Desktop OpenCV Runner Pill */}
          <div className="p-2.5 rounded-xl bg-[#0c181a] border border-[#284144] text-[11px] text-[#9fb1ac] space-y-1">
            <span className="font-semibold text-[#edf5f2]">Native Python Desktop App:</span>
            <div className="font-mono text-[10px] text-[#c6f06e] bg-[#152d30] p-1.5 rounded-lg select-all">
              python scripts/repetition_counter/main.py
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
