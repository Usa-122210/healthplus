import React, { useEffect, useRef, useState } from 'react';
import {
  Play,
  Pause,
  Square,
  Volume2,
  VolumeX,
  Camera,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Plus,
  Sparkles,
  Shield,
  Activity,
  RotateCcw,
  Zap,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
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
  label: string;
  targetReps: number;
  kcalPerRep: number;
  cameraHint: string;
  muscles: string;
  cuesEn: string[];
  cuesHinglish: string[];
  cuesHi: string[];
}

const EXERCISES: Record<ExerciseTypeId, ExerciseMeta> = {
  squat: {
    id: 'squat',
    label: 'Bodyweight Squat',
    targetReps: 12,
    kcalPerRep: 0.45,
    cameraHint: 'Front or side view · show both feet',
    muscles: 'Quadriceps · Glutes · Core',
    cuesEn: [
      'Feet shoulder-width apart, toes gently turned out',
      'Hips move back first, knees track cleanly over toes',
      'Control 2 seconds down, drive smoothly up through mid-foot',
    ],
    cuesHinglish: [
      'Paon shoulder-width rakhein aur chest up rakhein',
      'Pehle hips peeche le jayein, knees ko andar na girne dein',
      '2 second slow neeche jayein aur saans chhodte hue upar aayein',
    ],
    cuesHi: [
      'दोनों पैर कंधों की चौड़ाई के बराबर रखें और छाती सीधी रखें',
      'कूल्हों को हल्का पीछे ले जाते हुए नियंत्रित नीचे जाएं',
      'ऊपर आते समय सांस बाहर छोड़ें',
    ],
  },
  pushup: {
    id: 'pushup',
    label: 'Push-Up (Floor / Knee / Wall)',
    targetReps: 10,
    kcalPerRep: 0.55,
    cameraHint: 'Side view · camera low',
    muscles: 'Chest · Triceps · Anterior Core',
    cuesEn: [
      'Hands directly under shoulders, body in one straight plank line',
      'Tuck elbows gently (~45° angle) instead of flaring wide',
      'Lower chest down to 90°, press back up to full lockout',
    ],
    cuesHinglish: [
      'Haath shoulders ke neeche rakhein aur kamar bilkul seedhi rakhein',
      'Elbows ko ~45 degree par rakh kar neeche jayein',
      'Zaroorat ho toh knee push-up karein — form sabse zaroori hai',
    ],
    cuesHi: [
      'हाथ कंधों के ठीक नीचे रखें और शरीर एक सीधी रेखा में रखें',
      'कोहनियां लगभग 45 डिग्री पर मोड़ते हुए नीचे जाएं',
      'छाती नीचे लाएं और कोहनी पूरी तरह सीधी होने तक ऊपर आएं',
    ],
  },
  jumping_jack: {
    id: 'jumping_jack',
    label: 'Jumping Jack',
    targetReps: 25,
    kcalPerRep: 0.25,
    cameraHint: 'Front view · full body and feet visible',
    muscles: 'Calves · Deltoids · Cardiovascular Core',
    cuesEn: [
      'Start with feet together and hands by your side',
      'Jump feet wide while bringing hands together overhead',
      'Land softly on balls of feet and return to closed position',
    ],
    cuesHinglish: [
      'Pehle paon aur haath ek saath paas rakhein',
      'Jump karke paon spread karein aur haath sir ke upar le jayein',
      'Pano par soft land karein aur wapas closed stance me aayein',
    ],
    cuesHi: [
      'पैर पास और हाथ शरीर के बगल में रखें',
      'कूदते हुए पैरों को फैलाएं और हाथों को सिर के ऊपर ले जाएं',
      'हल्के पंजों पर लैंड करते हुए वापस प्रारंभिक स्थिति में आएं',
    ],
  },
  lunge: {
    id: 'lunge',
    label: 'Forward Lunge',
    targetReps: 16,
    kcalPerRep: 0.50,
    cameraHint: 'Side view · show both feet clearly',
    muscles: 'Quadriceps · Hamstrings · Gluteal Complex',
    cuesEn: [
      'Step forward smoothly, keeping torso tall and proud',
      'Bend both knees until front thigh is nearly parallel to floor',
      'Drive cleanly through front heel to return to standing',
    ],
    cuesHinglish: [
      'Ek kadam aage badhayein aur chest seedhi rakhein',
      'Dono ghutne 90 degree bend karein, aage ka ghutna toe se aage na jaye',
      'Front heel se press karke wapas standing position me aayein',
    ],
    cuesHi: [
      'एक कदम आगे बढ़ाएं और रीढ़ की हड्डी सीधी रखें',
      'दोनों घुटने 90 डिग्री मोड़ते हुए नीचे जाएं',
      'आगे की एड़ी से दबाव देकर वापस खड़े हों',
    ],
  },
  bicep_curl: {
    id: 'bicep_curl',
    label: 'Bicep Curl',
    targetReps: 15,
    kcalPerRep: 0.35,
    cameraHint: 'Front or slight angle · show arms clearly',
    muscles: 'Biceps Brachii · Forearm Flexors',
    cuesEn: [
      'Keep your elbows pinned snugly to your sides',
      'Curl hand smoothly toward shoulder without swinging torso',
      'Lower fully with control back to extension',
    ],
    cuesHinglish: [
      'Elbows ko side me chipka kar rakhein, body swing na karein',
      'Forearm ko shoulder tak squeeze karte hue upar laayein',
      'Control ke sath poora neeche slow stretch karein',
    ],
    cuesHi: [
      'कोहनियों को शरीर के पास स्थिर रखें, शरीर न हिलाएं',
      'हाथ को कंधे की ओर मोड़ते हुए बाइसेप्स सिकोड़ें',
      'नियंत्रण के साथ धीरे-धीरे नीचे लाएं',
    ],
  },
  high_knees: {
    id: 'high_knees',
    label: 'High Knees',
    targetReps: 20,
    kcalPerRep: 0.30,
    cameraHint: 'Front view · show full body and feet',
    muscles: 'Hip Flexors · Quadriceps · Core',
    cuesEn: [
      'Face camera and stand tall with athletic posture',
      'Drive one knee up to hip height (~90° bend)',
      'Alternate briskly while landing softly on forefeet',
    ],
    cuesHinglish: [
      'Seedhe khade ho kar ek ghutna 90 degree tak upar uthayein',
      'Paon ko soft land karke turant doosra ghutna drive karein',
      'Core tight rakhein aur back seedhi rakhein',
    ],
    cuesHi: [
      'सीधे खड़े होकर एक घुटने को 90 डिग्री कूल्हे तक उठाएं',
      'पैर को नीचे रखकर दूसरे घुटने को ऊपर लाएं',
      'पीठ सीधी रखें और पंजों पर हल्का दबाव रखें',
    ],
  },
  wall_sit: {
    id: 'wall_sit',
    label: 'Wall Sit (Timed Hold)',
    targetReps: 45,
    kcalPerRep: 0.15,
    cameraHint: 'Side view · wall, hips and feet visible',
    muscles: 'Quadriceps Isometric · Glutes · Spine Stabilizers',
    cuesEn: [
      'Back completely flush against flat wall, feet shoulder-width',
      'Slide down until thighs are parallel to ground (90° knee angle)',
      'Hold position steadily while breathing evenly into diaphragm',
    ],
    cuesHinglish: [
      'Deewar se back chipka kar baithein, thighs floor ke parallel rakhein',
      'Knees aur hips exact 90 degree par hold karein',
      'Normal saans lete rahein — timer hold ke dauran hi chalega',
    ],
    cuesHi: [
      'दीवार से पीठ सटाकर बैठें, जांघें जमीन के समानांतर हों',
      'घुटने और कूल्हे 90 डिग्री कोण पर बनाए रखें',
      'गहरी सांस लें — टाइमर सही स्थिति बनाए रखने पर ही चलेगा',
    ],
  },
  glute_bridge: {
    id: 'glute_bridge',
    label: 'Floor Glute Bridge',
    targetReps: 15,
    kcalPerRep: 0.35,
    cameraHint: 'Side view · floor mat visible',
    muscles: 'Glutes · Hamstrings · Lumbar Support',
    cuesEn: [
      'Heels planted close to hips, lower ribs relaxed on mat',
      'Press through heels to lift hips without hyperextending lower back',
      'Pause 1 second cleanly at top before lowering slowly',
    ],
    cuesHinglish: [
      'Heels ko mat par jamayein aur pet gently brace karein',
      'Hips upar uthate waqt lower back par jhatka na dein',
      'Top par 1 second ruk kar aaram se wapas neeche laayein',
    ],
    cuesHi: [
      'एड़ियों को मैट पर स्थिर रखें और कोर को हल्का सख्त रखें',
      'एड़ियों से दबाव देते हुए कूल्हों को धीरे ऊपर उठाएं',
      'ऊपर एक सेकंड रुकें और नियंत्रण से नीचे लाएं',
    ],
  },
};

export const MoveStudioPage: React.FC<MoveStudioPageProps> = ({ onNavigate = () => {} }) => {
  const { state, workoutsToday, adjustHydration, logWorkout } = useApp();

  const [selectedExercise, setSelectedExercise] = useState<ExerciseTypeId>('squat');
  const [isRunning, setIsRunning] = useState(false);
  const [reps, setReps] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [cameraMode, setCameraMode] = useState<'guided' | 'camera'>('guided');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [showDetailsDrawer, setShowDetailsDrawer] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  // Formwise live pose & evaluation state
  const [evalResult, setEvalResult] = useState<Evaluation>({
    label: 'READY: START CAMERA OR DEMO',
    sustainedBad: false,
  });
  const [isPoseModelLoading, setIsPoseModelLoading] = useState(false);
  const [poseTrackerActive, setPoseTrackerActive] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const repsRef = useRef<number>(0);
  const analyzerRef = useRef<Analyzer>(createAnalyzer('squat'));
  const animFrameRef = useRef<number>(0);
  const lastSpokenWarningRef = useRef<number>(0);

  const meta = EXERCISES[selectedExercise];
  const preferredLang = state.profile?.lifestyle.preferredLanguage ?? 'auto';
  const activeLang =
    preferredLang === 'auto' ? state.conversationMemory.detectedLanguage : preferredLang;

  const activeCues =
    activeLang === 'hi'
      ? meta.cuesHi
      : activeLang === 'hinglish'
        ? meta.cuesHinglish
        : meta.cuesEn;

  // Recreate analyzer when selected exercise changes
  useEffect(() => {
    const analyzer = createAnalyzer(selectedExercise);
    analyzerRef.current = analyzer;
    repsRef.current = 0;
    setReps(0);
    setSeconds(0);
    setEvalResult({ label: 'READY: START SESSION', sustainedBad: false });
  }, [selectedExercise]);

  const speakCue = (text: string) => {
    if (!voiceEnabled || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = activeLang === 'hi' ? 'hi-IN' : activeLang === 'hinglish' ? 'hi-IN' : 'en-US';
      utterance.rate = 0.98;
      window.speechSynthesis.speak(utterance);
    } catch {
      // Speech fallback silently
    }
  };

  // Stopwatch timer
  useEffect(() => {
    if (!isRunning) return;
    const timer = window.setInterval(() => {
      setSeconds((s) => s + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isRunning]);

  // Clean up and initialize camera stream and MediaPipe Pose Landmarker
  useEffect(() => {
    if (cameraMode !== 'camera') {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      setPoseTrackerActive(false);
      return;
    }

    let cancelled = false;

    const startCameraAndTracker = async () => {
      setCameraError(null);
      if (
        typeof navigator === 'undefined' ||
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
      ) {
        setCameraError('Browser camera access is not available on this environment.');
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            if (videoRef.current) videoRef.current.play();
          };
        }

        // Initialize MediaPipe PoseLandmarker
        setIsPoseModelLoading(true);
        try {
          const { FilesetResolver, PoseLandmarker } = await import('@mediapipe/tasks-vision');
          const vision = await FilesetResolver.forVisionTasks(
            'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
          );

          if (cancelled) return;

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

          if (cancelled) return;

          setIsPoseModelLoading(false);
          setPoseTrackerActive(true);

          // Video inference loop
          let lastVideoTime = -1;
          const processFrame = () => {
            if (cancelled) return;

            const video = videoRef.current;
            const canvas = canvasRef.current;

            if (video && canvas && video.readyState >= 2 && video.currentTime !== lastVideoTime) {
              lastVideoTime = video.currentTime;
              canvas.width = video.videoWidth || 640;
              canvas.height = video.videoHeight || 480;
              const ctx = canvas.getContext('2d');

              try {
                const results = landmarker.detectForVideo(video, performance.now());
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

                  // Update rep count
                  const currentReps = analyzerRef.current.totalReps;
                  if (currentReps > repsRef.current) {
                    const prev = repsRef.current;
                    repsRef.current = currentReps;
                    setReps(currentReps);

                    // Voice announcement on completed rep
                    if (currentReps % 3 === 0 || currentReps === prev + 1) {
                      speakCue(
                        activeLang === 'hinglish'
                          ? `Badhiya! ${currentReps} reps complete.`
                          : activeLang === 'hi'
                            ? `शाबाश! ${currentReps} रेप्स पूरे हुए।`
                            : `Rep ${currentReps} complete!`
                      );
                    }
                  }

                  // Voice warning on sustained bad posture (throttle to once every 3s)
                  if (evaluation.sustainedBad) {
                    const now = performance.now();
                    if (now - lastSpokenWarningRef.current > 3200) {
                      lastSpokenWarningRef.current = now;
                      speakCue('Wrong form. Please correct your posture.');
                    }
                  }

                  // Draw live skeleton onto canvas
                  if (ctx) {
                    const skeletonColor = evaluation.sustainedBad
                      ? '#ef4444' // Red
                      : evaluation.label.includes('GOOD') || evaluation.label.includes('OPEN') || evaluation.label.includes('WALL SIT')
                        ? '#10b981' // Green
                        : '#f59e0b'; // Amber

                    // Draw bones
                    ctx.strokeStyle = skeletonColor;
                    ctx.lineWidth = 3.5;
                    ctx.lineCap = 'round';
                    for (const [start, end] of POSE_CONNECTIONS) {
                      const p1 = points[start];
                      const p2 = points[end];
                      if (
                        p1 &&
                        p2 &&
                        (p1.visibility ?? 1.0) > 0.45 &&
                        (p2.visibility ?? 1.0) > 0.45
                      ) {
                        ctx.beginPath();
                        ctx.moveTo(p1.x * canvas.width, p1.y * canvas.height);
                        ctx.lineTo(p2.x * canvas.width, p2.y * canvas.height);
                        ctx.stroke();
                      }
                    }

                    // Draw joint circles
                    for (const pt of points) {
                      if (pt && (pt.visibility ?? 1.0) > 0.45) {
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
                }
              } catch {
                // Ignore transient frame errors
              }
            }

            animFrameRef.current = requestAnimationFrame(processFrame);
          };

          animFrameRef.current = requestAnimationFrame(processFrame);
        } catch (cvErr) {
          console.warn('WASM MediaPipe pose landmarker loading note:', cvErr);
          setIsPoseModelLoading(false);
          // Graceful fallback to video preview with guided cadence
        }
      } catch {
        if (!cancelled) {
          setCameraError(
            'Camera permission declined or no webcam detected. 3D Guided Anatomical Studio works fully without a camera!'
          );
        }
      }
    };

    startCameraAndTracker();

    return () => {
      cancelled = true;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [cameraMode, selectedExercise]);

  const handleToggleRun = () => {
    if (!isRunning) {
      setIsRunning(true);
      speakCue(activeCues[0]);
    } else {
      setIsRunning(false);
    }
  };

  const handleAddRep = (delta: number = 1) => {
    const next = repsRef.current + delta;
    repsRef.current = next;
    setReps(next);
    if (next % 5 === 0) {
      speakCue(
        activeLang === 'hinglish'
          ? `Badhiya pace, ${next} reps complete!`
          : activeLang === 'hi'
            ? `बहुत बढ़िया, ${next} रेप्स पूरे हुए!`
            : `Steady control — ${next} reps completed!`
      );
    }
  };

  const handleReset = () => {
    analyzerRef.current.reset();
    repsRef.current = 0;
    setReps(0);
    setSeconds(0);
    setEvalResult({ label: 'READY: START SESSION', sustainedBad: false });
  };

  const handleStopAndSave = () => {
    setIsRunning(false);
    const finalReps = Math.max(repsRef.current, reps, 1);
    const duration = Math.max(seconds, 15);
    const kcal = Math.round(finalReps * meta.kcalPerRep);
    logWorkout({
      exerciseType: selectedExercise,
      exerciseLabel: meta.label,
      repsCompleted: finalReps,
      targetReps: meta.targetReps,
      durationSeconds: duration,
      estimatedKcal: kcal,
      mode: cameraMode === 'camera' && !cameraError ? 'camera_preview' : 'guided_demo',
      formNotes: [activeCues[0]],
    });
    adjustHydration(0.25);
    setSavedNotice(
      `Saved ${finalReps} ${meta.label} reps (~${kcal} kcal est.) to Today & Progress!`
    );
    handleReset();
    setTimeout(() => setSavedNotice(null), 4000);
  };

  const formatTimer = (totalSec: number) => {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const totalRepsToday = workoutsToday.reduce((sum, w) => sum + w.repsCompleted, 0);

  return (
    <div className="space-y-5 pb-20 text-left animate-fadeIn max-w-5xl mx-auto">
      {/* Header Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="emerald" size="sm">
              Formwise MediaPipe Pose Engine
            </Badge>
            <span className="text-xs text-forest/65 dark:text-ivory/65">
              Logged today: <strong>{totalRepsToday} reps</strong>
            </span>
          </div>
          <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-forest dark:text-white mt-1">
            Move Studio
          </h1>
        </div>

        {/* Simple Mode & Audio Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setCameraMode(cameraMode === 'guided' ? 'camera' : 'guided')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors ${
              cameraMode === 'camera'
                ? 'bg-emerald text-white border-emerald shadow-sm'
                : 'bg-white/80 dark:bg-white/5 border-forest/15 dark:border-white/15 text-forest dark:text-ivory'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>{cameraMode === 'camera' ? 'MediaPipe Camera Active' : 'Start Camera Pose Tracker'}</span>
          </button>

          <button
            type="button"
            onClick={() => setVoiceEnabled((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-forest/15 dark:border-white/15 bg-white/80 dark:bg-white/5 text-xs font-semibold text-forest dark:text-ivory"
          >
            {voiceEnabled ? <Volume2 className="w-3.5 h-3.5 text-emerald" /> : <VolumeX className="w-3.5 h-3.5" />}
            <span>{voiceEnabled ? 'Voice Coach On' : 'Muted'}</span>
          </button>

          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-forest/15 dark:border-white/15 bg-white/80 dark:bg-white/5 text-xs font-semibold text-forest dark:text-ivory"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Formwise Native Desktop Notice */}
      <div className="p-3.5 rounded-2xl bg-emerald/10 dark:bg-emerald/15 border border-emerald/25 text-xs text-forest/85 dark:text-ivory/85 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald shrink-0" />
          <span>
            <strong>Dual Engine:</strong> Real-time browser MediaPipe Pose tracking + Desktop OpenCV Formwise coach available!
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-mono bg-white/70 dark:bg-white/10 px-2.5 py-1 rounded-lg">
          <span>python scripts/repetition_counter/main.py</span>
        </div>
      </div>

      {/* Exercise Picker (All 7 Formwise exercises + Glute Bridge) */}
      <div className="flex flex-wrap gap-2">
        {(Object.values(EXERCISES) as ExerciseMeta[]).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setSelectedExercise(item.id);
              setIsRunning(false);
            }}
            className={`px-3.5 py-2 rounded-xl border text-xs font-bold transition-all ${
              selectedExercise === item.id
                ? 'bg-forest text-white dark:bg-emerald border-forest dark:border-emerald shadow-sm scale-102'
                : 'bg-white/75 dark:bg-white/5 border-forest/10 dark:border-white/10 text-forest/80 dark:text-ivory/80 hover:bg-forest/5'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {savedNotice && (
        <div className="p-3 rounded-xl bg-emerald/15 border border-emerald/35 text-xs font-semibold text-forest dark:text-emerald-200 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald shrink-0" />
          <span>{savedNotice}</span>
        </div>
      )}

      {/* Main Focal Area: Visual Guide / Camera Pose Tracker + Controls */}
      <Card variant="elevated" className="p-5 sm:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] gap-6 items-center">
          {/* Left: Solid Anatomical Human Visual OR Local Camera with Pose Skeleton */}
          <div className="relative rounded-3xl bg-gradient-to-br from-emerald-50/90 via-ivory to-sage/40 dark:from-[#092019] dark:via-[#061812] dark:to-[#0A251C] border border-forest/10 dark:border-white/10 p-3.5 sm:p-4 flex flex-col justify-between min-h-[340px] overflow-hidden">
            <div className="flex items-center justify-between pb-1.5 z-10">
              <Badge variant={cameraMode === 'camera' && !cameraError ? 'emerald' : 'sage'} size="sm">
                {cameraMode === 'camera' && !cameraError
                  ? poseTrackerActive
                    ? 'MediaPipe Pose: Real-Time Skeleton Tracking'
                    : 'Camera Mirror (On-Device)'
                  : '3D Biomechanical Athlete (Three.js)'}
              </Badge>
              <span className="text-[11px] font-medium text-forest/60 dark:text-ivory/60">
                {meta.cameraHint}
              </span>
            </div>

            {cameraMode === 'camera' ? (
              cameraError ? (
                <div className="text-center space-y-3 p-4">
                  <p className="text-xs font-semibold text-amber-700 dark:text-gold max-w-xs mx-auto">
                    {cameraError}
                  </p>
                  <AnatomicalAthleteVisual exerciseType={selectedExercise} isActive={isRunning} />
                </div>
              ) : (
                <div className="relative w-full flex flex-col items-center justify-center my-2">
                  {/* Video Element */}
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full max-h-[280px] rounded-2xl object-cover scale-x-[-1] border border-white/20 bg-black/40"
                  />
                  {/* Skeleton Overlay Canvas */}
                  <canvas
                    ref={canvasRef}
                    className="absolute inset-0 w-full h-full max-h-[280px] pointer-events-none scale-x-[-1]"
                  />

                  {/* Loading indicator for MediaPipe WASM */}
                  {isPoseModelLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-2xl backdrop-blur-xs">
                      <div className="text-center space-y-2 text-white">
                        <Zap className="w-6 h-6 animate-spin mx-auto text-emerald" />
                        <p className="text-xs font-semibold">Initializing MediaPipe Pose Engine...</p>
                      </div>
                    </div>
                  )}

                  {/* Live Feedback Pill on Camera */}
                  <div
                    className={`mt-2.5 px-3 py-1 rounded-full text-xs font-bold border transition-colors ${
                      evalResult.sustainedBad
                        ? 'bg-red-500/20 border-red-500 text-red-600 dark:text-red-400'
                        : evalResult.label.includes('GOOD') || evalResult.label.includes('OPEN') || evalResult.label.includes('WALL SIT')
                          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-700 dark:text-emerald-300'
                          : 'bg-amber-500/20 border-amber-500 text-amber-700 dark:text-amber-300'
                    }`}
                  >
                    {evalResult.label}
                  </div>
                </div>
              )
            ) : (
              <AnatomicalAthleteVisual exerciseType={selectedExercise} isActive={isRunning} />
            )}
          </div>

          {/* Right: Rep Counter, Form Cues & Controls */}
          <div className="space-y-5">
            <div className="flex items-baseline justify-between border-b border-forest/10 dark:border-white/10 pb-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-emerald dark:text-emerald-400">
                  {meta.muscles}
                </p>
                <h2 className="font-heading font-extrabold text-xl text-forest dark:text-white mt-0.5">
                  {meta.label}
                </h2>
              </div>
              <div className="text-right">
                <div className="text-3xl font-heading font-black text-forest dark:text-white tabular-nums flex items-baseline justify-end gap-1.5">
                  <span>{selectedExercise === 'wall_sit' ? formatTimer(seconds) : reps}</span>
                  <span className="text-xs font-semibold opacity-60">
                    / {selectedExercise === 'wall_sit' ? `${meta.targetReps}s` : `${meta.targetReps} reps`}
                  </span>
                </div>
                <div className="text-xs font-semibold text-forest/60 dark:text-ivory/60 tabular-nums">
                  {selectedExercise === 'wall_sit' ? 'Hold duration' : formatTimer(seconds)}
                </div>
              </div>
            </div>

            {/* Live Angles Readout (if available from MediaPipe) */}
            {cameraMode === 'camera' && evalResult.primary != null && (
              <div className="p-3 rounded-xl bg-forest/5 dark:bg-white/5 border border-forest/10 dark:border-white/10 flex items-center justify-between text-xs">
                <span className="font-medium text-forest/70 dark:text-ivory/70">
                  Joint Kinematics:
                </span>
                <span className="font-mono font-bold text-forest dark:text-white">
                  {evalResult.primaryName}: {Math.round(evalResult.primary)}°
                  {evalResult.secondary != null && (
                    <> · {evalResult.secondaryName}: {Math.round(evalResult.secondary)}°</>
                  )}
                </span>
              </div>
            )}

            {/* 3 Clear Form Cues */}
            <div className="space-y-2">
              <p className="text-xs font-bold text-forest dark:text-white">Movement Guidance:</p>
              <ul className="space-y-1.5 text-xs text-forest/80 dark:text-ivory/80">
                {activeCues.map((cue, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald/15 text-emerald dark:text-emerald-400 flex items-center justify-center text-[10px] font-bold shrink-0">
                      {idx + 1}
                    </span>
                    <span>{cue}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Clean Action Controls */}
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <Button
                variant="primary"
                size="md"
                onClick={handleToggleRun}
                leftIcon={isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              >
                {isRunning ? 'Pause' : 'Start Session'}
              </Button>

              <Button
                variant="outline"
                size="md"
                onClick={() => handleAddRep(1)}
                leftIcon={<Plus className="w-4 h-4" />}
              >
                +1 Rep
              </Button>

              <Button
                variant="gold"
                size="md"
                onClick={handleStopAndSave}
                leftIcon={<Square className="w-3.5 h-3.5" />}
              >
                Finish &amp; Save
              </Button>
            </div>

            <div className="pt-2 flex items-center justify-between text-[11px]">
              <button
                type="button"
                onClick={() => setShowDetailsDrawer((d) => !d)}
                className="inline-flex items-center gap-1 font-semibold text-forest/70 dark:text-ivory/70 hover:text-forest dark:hover:text-white"
              >
                {showDetailsDrawer ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                <span>{showDetailsDrawer ? 'Hide details' : 'Formwise MediaPipe & privacy details'}</span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('/coach')}
                className="inline-flex items-center gap-1 font-semibold text-emerald dark:text-emerald-400 hover:underline"
              >
                <Sparkles className="w-3 h-3" />
                Ask Coach for modifications
              </button>
            </div>
          </div>
        </div>

        {/* Details Drawer */}
        {showDetailsDrawer && (
          <div className="mt-6 pt-5 border-t border-forest/10 dark:border-white/10 space-y-4 animate-fadeIn text-xs text-forest/80 dark:text-ivory/80">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3.5 rounded-2xl bg-forest/4 dark:bg-white/5 border border-forest/10 dark:border-white/10 space-y-1.5">
                <p className="font-bold text-forest dark:text-white flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-emerald" />
                  Local On-Device Privacy
                </p>
                <p className="text-[11px] leading-relaxed text-forest/70 dark:text-ivory/70">
                  MediaPipe Pose runs entirely within your browser WebAssembly and local GPU. Video frames never leave your computer or network.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-forest/4 dark:bg-white/5 border border-forest/10 dark:border-white/10 space-y-1.5">
                <p className="font-bold text-forest dark:text-white flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-emerald" />
                  Biomechanical State Machine
                </p>
                <p className="text-[11px] leading-relaxed text-forest/70 dark:text-ivory/70">
                  Joint angles use hysteresis thresholds and sustained-bad-state guards (8 frames) to prevent partial repetitions and camera jitter.
                </p>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};
