import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Play,
  Pause,
  Square,
  Volume2,
  VolumeX,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Plus,
  Sparkles,
  Shield,
  Activity,
  Flame,
  Award,
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

export type { ExerciseLiveEvent, ExerciseSessionSummary, ExerciseStudioProps };

export interface MoveStudioPageProps {
  onNavigate?: (path: string) => void;
}

interface ExerciseMeta {
  id: ExerciseTypeId;
  label: string;
  targetReps: number;
  kcalPerRep: number;
  cuesEn: string[];
  cuesHinglish: string[];
  cuesHi: string[];
  muscles: string;
  usesTimer?: boolean;
}

const EXERCISES: Record<ExerciseTypeId, ExerciseMeta> = {
  pushup: {
    id: 'pushup',
    label: 'Push-Up (Wall / Knee / Full)',
    targetReps: 10,
    kcalPerRep: 0.55,
    muscles: 'Chest · Triceps · Anterior Core',
    cuesEn: [
      'Hands directly under shoulders, body in one neutral plank line',
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
      'कोहनियाँ लगभग 45 डिग्री पर मोड़ते हुए नीचे जाएँ',
      'छाती नीचे लाएँ और कोहनी पूरी तरह सीधी होने तक ऊपर आएँ',
    ],
  },
  squat: {
    id: 'squat',
    label: 'Bodyweight Squat',
    targetReps: 12,
    kcalPerRep: 0.45,
    muscles: 'Quadriceps · Glutes · Core',
    cuesEn: [
      'Feet shoulder-width apart, toes gently turned out',
      'Hips move back first, knees track cleanly over toes',
      'Control 2 seconds down, drive smoothly up through mid-foot',
    ],
    cuesHinglish: [
      'Paon shoulder-width rakhein aur chest up rakhein',
      'Pehle hips peeche le jayein, knees ko andar girne na dein',
      '2 second slow neeche jayein aur saans chhodte hue upar aayein',
    ],
    cuesHi: [
      'दोनों पैर कंधों की चौड़ाई के बराबर रखें और छाती सीधी रखें',
      'कूल्हों को हल्का पीछे ले जाते हुए नियंत्रित नीचे जाएँ',
      'ऊपर आते समय साँस बाहर छोड़ें',
    ],
  },
  jumping_jack: {
    id: 'jumping_jack',
    label: 'Jumping Jack',
    targetReps: 25,
    kcalPerRep: 0.25,
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
      'कूदते हुए पैरों को फैलाएँ और हाथों को सिर के ऊपर ले जाएँ',
      'हल्के पंजों पर लैंड करते हुए वापस प्रारंभिक स्थिति में आएँ',
    ],
  },
  lunge: {
    id: 'lunge',
    label: 'Forward Lunge',
    targetReps: 16,
    kcalPerRep: 0.50,
    muscles: 'Quadriceps · Hamstrings · Glutes',
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
      'एक कदम आगे बढ़ाएँ और रीढ़ की हड्डी सीधी रखें',
      'दोनों घुटने 90 डिग्री मोड़ते हुए नीचे जाएँ',
      'आगे की एड़ी से दबाव देकर वापस खड़े हों',
    ],
  },
  bicep_curl: {
    id: 'bicep_curl',
    label: 'Bicep Curl',
    targetReps: 15,
    kcalPerRep: 0.35,
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
      'कोहनियों को शरीर के पास स्थिर रखें, शरीर न हिलाएँ',
      'हाथ को कंधे की ओर मोड़ते हुए बाइसेप्स सिकोड़ें',
      'नियंत्रण के साथ धीरे-धीरे नीचे लाएँ',
    ],
  },
  high_knees: {
    id: 'high_knees',
    label: 'High Knees',
    targetReps: 20,
    kcalPerRep: 0.30,
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
      'सीधे खड़े होकर एक घुटने को 90 डिग्री कूल्हे तक उठाएँ',
      'पैर को नीचे रखकर दूसरे घुटने को ऊपर लाएँ',
      'पीठ सीधी रखें और पंजों पर हल्का दबाव रखें',
    ],
  },
  wall_sit: {
    id: 'wall_sit',
    label: 'Wall Sit (Timed Hold)',
    targetReps: 45,
    kcalPerRep: 0.15,
    muscles: 'Quadriceps Isometric · Glutes · Spine Stabilizers',
    usesTimer: true,
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
    muscles: 'Glutes · Hamstrings · Lower Back Support',
    cuesEn: [
      'Heels planted comfortably close to hips, lower ribs relaxed',
      'Press through heels to lift hips without arching lower back',
      'Pause 1 second cleanly at top before lowering slowly',
    ],
    cuesHinglish: [
      'Heels ko mat par jamayein aur pet gently brace karein',
      'Hips upar uthate waqt lower back par jhatka na dein',
      'Top par 1 second ruk kar aaram se wapas neeche laayein',
    ],
    cuesHi: [
      'एड़ियों को मैट पर स्थिर रखें और कोर को हल्का सख्त रखें',
      'एड़ियों से दबाव देते हुए कूल्हों को धीरे ऊपर उठाएँ',
      'ऊपर एक सेकंड रुकें और नियंत्रण से नीचे लाएँ',
    ],
  },
};

export const MoveStudioPage: React.FC<MoveStudioPageProps> = ({ onNavigate = () => {} }) => {
  const { state, workoutsToday, adjustHydration, logWorkout } = useApp();

  const [selectedExercise, setSelectedExercise] = useState<ExerciseTypeId>('pushup');
  const [isRunning, setIsRunning] = useState(false);
  const [reps, setReps] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [showDetailsDrawer, setShowDetailsDrawer] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  // Formwise Quick Sync State
  const [syncExercise, setSyncExercise] = useState<ExerciseTypeId>('pushup');
  const [syncReps, setSyncReps] = useState(15);
  const [syncDurationSecs, setSyncDurationSecs] = useState(60);

  const repsRef = useRef<number>(0);
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

  const speakCue = useCallback((text: string) => {
    if (!voiceEnabled || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = activeLang === 'en' ? 'en-IN' : 'hi-IN';
      utterance.rate = 0.98;
      window.speechSynthesis.speak(utterance);
    } catch {}
  }, [voiceEnabled, activeLang]);

  // Handle message from Ayush's Formwise standalone window
  useEffect(() => {
    const handleFormwiseMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'FORMWISE_WORKOUT_COMPLETED') {
        const { exerciseId, exerciseName, repsCompleted, durationSeconds, caloriesBurned } = event.data;
        const validId: ExerciseTypeId = EXERCISES[exerciseId as ExerciseTypeId] ? (exerciseId as ExerciseTypeId) : 'pushup';

        logWorkout({
          exerciseType: validId,
          exerciseLabel: exerciseName || EXERCISES[validId].label,
          repsCompleted: Number(repsCompleted) || 10,
          targetReps: EXERCISES[validId].targetReps,
          durationSeconds: Number(durationSeconds) || 60,
          estimatedKcal: Number(caloriesBurned) || Math.round(Number(repsCompleted) * EXERCISES[validId].kcalPerRep),
          mode: 'camera_preview',
          formNotes: ['Captured via Formwise MediaPipe Tracker'],
        });

        adjustHydration(0.25);
        setSavedNotice(
          `Synced ${repsCompleted} ${exerciseName || EXERCISES[validId].label} (~${caloriesBurned} kcal burned) from Formwise Pose Coach!`
        );
        setTimeout(() => setSavedNotice(null), 6000);
      }
    };

    window.addEventListener('message', handleFormwiseMessage);
    return () => window.removeEventListener('message', handleFormwiseMessage);
  }, [logWorkout, adjustHydration]);

  // Handle URL query parameters if redirected back from Formwise window
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const urlParams = new URLSearchParams(window.location.search);
    const syncedEx = urlParams.get('syncedExercise');
    const syncedReps = urlParams.get('reps');
    const syncedDuration = urlParams.get('duration');
    const syncedKcal = urlParams.get('kcal');

    if (syncedEx && syncedReps) {
      const validId: ExerciseTypeId = EXERCISES[syncedEx as ExerciseTypeId] ? (syncedEx as ExerciseTypeId) : 'pushup';
      const r = parseInt(syncedReps, 10) || 12;
      const d = parseInt(syncedDuration || '60', 10) || 60;
      const k = parseInt(syncedKcal || '10', 10) || Math.round(r * EXERCISES[validId].kcalPerRep);

      logWorkout({
        exerciseType: validId,
        exerciseLabel: EXERCISES[validId].label,
        repsCompleted: r,
        targetReps: EXERCISES[validId].targetReps,
        durationSeconds: d,
        estimatedKcal: k,
        mode: 'camera_preview',
        formNotes: ['Logged via Formwise Camera Redirect'],
      });

      adjustHydration(0.25);
      setSavedNotice(`Synced ${r} ${EXERCISES[validId].label} (~${k} kcal) from Formwise Pose Tracker! Added to Today & Progress.`);

      // Clean up URL parameters cleanly
      window.history.replaceState({}, document.title, window.location.pathname);
      setTimeout(() => setSavedNotice(null), 6000);
    }
  }, [logWorkout, adjustHydration]);

  // Active workout timer
  useEffect(() => {
    if (!isRunning) return;
    const timer = window.setInterval(() => {
      setSeconds((s) => s + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isRunning]);

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

  const handleStopAndSave = () => {
    setIsRunning(false);
    const finalReps = Math.max(repsRef.current, reps, 1);
    const duration = Math.max(seconds, 15);
    const kcal = meta.usesTimer
      ? Math.round(duration * meta.kcalPerRep)
      : Math.round(finalReps * meta.kcalPerRep);

    logWorkout({
      exerciseType: selectedExercise,
      exerciseLabel: meta.label,
      repsCompleted: finalReps,
      targetReps: meta.targetReps,
      durationSeconds: duration,
      estimatedKcal: kcal,
      mode: 'guided_demo',
      formNotes: [activeCues[0]],
    });

    adjustHydration(0.25);
    setSavedNotice(
      `Saved ${finalReps} ${meta.label} (~${kcal} kcal est.) to Today & Progress!`
    );
    repsRef.current = 0;
    setReps(0);
    setSeconds(0);
    setTimeout(() => setSavedNotice(null), 4000);
  };

  // Launch Formwise in a dedicated clean window
  const launchFormwiseWindow = () => {
    const w = 1140;
    const h = 760;
    const left = Math.max(0, (window.screen.width - w) / 2);
    const top = Math.max(0, (window.screen.height - h) / 2);
    window.open(
      '/formwise.html',
      'FormwisePoseCoach',
      `width=${w},height=${h},top=${top},left=${left},resizable=yes,scrollbars=yes,status=no`
    );
  };

  // Manual Quick Sync Form Handler
  const handleSaveFormwiseSync = () => {
    const exMeta = EXERCISES[syncExercise];
    const kcal = exMeta.usesTimer
      ? Math.round(syncDurationSecs * exMeta.kcalPerRep)
      : Math.round(syncReps * exMeta.kcalPerRep);

    logWorkout({
      exerciseType: syncExercise,
      exerciseLabel: exMeta.label,
      repsCompleted: syncReps,
      targetReps: exMeta.targetReps,
      durationSeconds: syncDurationSecs,
      estimatedKcal: kcal,
      mode: 'camera_preview',
      formNotes: ['Logged from Formwise Pose Tracker session'],
    });

    adjustHydration(0.25);
    setSavedNotice(
      `Logged ${syncReps} ${exMeta.label} (~${kcal} kcal) to Today & Progress!`
    );
    setTimeout(() => setSavedNotice(null), 5000);
  };

  const formatTimer = (totalSec: number) => {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const totalRepsToday = workoutsToday.reduce((sum, w) => sum + w.repsCompleted, 0);
  const totalCaloriesToday = workoutsToday.reduce((sum, w) => sum + w.estimatedKcal, 0);

  return (
    <div className="space-y-6 pb-20 text-left animate-fadeIn max-w-5xl mx-auto">
      {/* Header Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="emerald" size="sm">
              3D Kinetic Studio &amp; Pose Tracker
            </Badge>
            <span className="text-xs text-forest/65 dark:text-ivory/65">
              Logged today: <strong>{totalRepsToday} reps</strong> ({totalCaloriesToday} kcal)
            </span>
          </div>
          <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-forest dark:text-white mt-1">
            Move Studio
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setVoiceEnabled((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-forest/15 dark:border-white/15 bg-white/80 dark:bg-white/5 text-xs font-semibold text-forest dark:text-ivory cursor-pointer"
          >
            {voiceEnabled ? <Volume2 className="w-3.5 h-3.5 text-emerald" /> : <VolumeX className="w-3.5 h-3.5" />}
            <span>{voiceEnabled ? 'Voice Coach On' : 'Muted'}</span>
          </button>
        </div>
      </div>

      {/* HERO FORMWISE INTEGRATION CARD (Opens Ayush's project in separate link) */}
      <Card variant="elevated" className="p-5 sm:p-6 bg-gradient-to-r from-emerald-950 via-forest to-emerald-900 text-white border-0 shadow-xl overflow-hidden relative">
        <div className="absolute right-0 top-0 bottom-0 opacity-10 pointer-events-none flex items-center pr-6">
          <Activity className="w-64 h-64 text-white" />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-bold tracking-wide uppercase">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Ayush Pathak&apos;s Formwise MediaPipe Rep Counter</span>
            </div>
            <h2 className="font-heading font-black text-xl sm:text-2xl text-white">
              Launch Formwise Camera Coach
            </h2>
            <p className="text-xs sm:text-sm text-emerald-100/80 leading-relaxed">
              Open the dedicated computer-vision window with on-device MediaPipe pose skeleton tracking, voice posture corrections (&quot;Wrong form. Please correct your posture&quot;), and instant repetition counting for all 7 exercises.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch md:items-center gap-2.5 shrink-0 w-full md:w-auto">
            <Button
              variant="gold"
              size="lg"
              onClick={launchFormwiseWindow}
              className="bg-[#c6f06e] text-[#102022] hover:bg-[#b5e05a] font-black border-0 shadow-lg text-sm px-5 py-3 cursor-pointer"
              leftIcon={<ExternalLink className="w-4 h-4" />}
            >
              Open Formwise Tracker
            </Button>
          </div>
        </div>

        {/* Desktop OpenCV Helper & Data Telemetry Note */}
        <div className="mt-4 pt-3.5 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-emerald-200/70">
          <div className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-[#c6f06e]" />
            <span>Completed workout data sends back to Health Plus automatically!</span>
          </div>
          <div className="font-mono bg-black/30 px-2 py-0.5 rounded text-[10px] text-emerald-300">
            Native Desktop: python scripts/repetition_counter/main.py
          </div>
        </div>
      </Card>

      {savedNotice && (
        <div className="p-3.5 rounded-xl bg-emerald/15 border border-emerald/35 text-xs font-semibold text-forest dark:text-emerald-200 flex items-center gap-2 animate-fadeIn shadow-sm">
          <CheckCircle2 className="w-4 h-4 text-emerald shrink-0" />
          <span>{savedNotice}</span>
        </div>
      )}

      {/* Exercise Picker (All exercises supported) */}
      <div className="flex flex-wrap gap-2">
        {(Object.values(EXERCISES) as ExerciseMeta[]).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setSelectedExercise(item.id);
              setIsRunning(false);
            }}
            className={`px-3.5 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
              selectedExercise === item.id
                ? 'bg-forest text-white dark:bg-emerald border-forest dark:border-emerald shadow-sm scale-102'
                : 'bg-white/75 dark:bg-white/5 border-forest/10 dark:border-white/10 text-forest/80 dark:text-ivory/80 hover:bg-forest/5'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Main Focal Area: 3D Anatomical Human Visual Guide & Direct Controls */}
      <Card variant="elevated" className="p-5 sm:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] gap-6 items-center">
          {/* Left: 3D Kinematic Human Visualizer */}
          <div className="relative rounded-3xl bg-gradient-to-br from-emerald-50/90 via-ivory to-sage/40 dark:from-[#092019] dark:via-[#061812] dark:to-[#0A251C] border border-forest/10 dark:border-white/10 p-3.5 sm:p-4 flex flex-col justify-between min-h-[320px]">
            <div className="flex items-center justify-between pb-1.5 z-10">
              <Badge variant="sage" size="sm">
                3D Biomechanical Anatomical Demo
              </Badge>
              <button
                type="button"
                onClick={launchFormwiseWindow}
                className="text-[11px] font-bold text-emerald dark:text-emerald-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                Launch Live Camera <ExternalLink className="w-3 h-3" />
              </button>
            </div>

            <AnatomicalAthleteVisual exerciseType={selectedExercise} isActive={isRunning} />
          </div>

          {/* Right: Uncluttered Rep Counter, Form Cues & Controls */}
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
                <div className="text-3xl font-heading font-black text-forest dark:text-white tabular-nums">
                  {meta.usesTimer ? formatTimer(seconds) : reps}{' '}
                  <span className="text-xs font-semibold opacity-60">
                    / {meta.usesTimer ? `${meta.targetReps}s` : `${meta.targetReps} reps`}
                  </span>
                </div>
                <div className="text-xs font-semibold text-forest/60 dark:text-ivory/60 tabular-nums">
                  {meta.usesTimer ? 'Hold duration' : formatTimer(seconds)}
                </div>
              </div>
            </div>

            {/* 3 Clear Form Cues */}
            <div className="space-y-2">
              <p className="text-xs font-bold text-forest dark:text-white">Biomechanical Form Focus:</p>
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

            {/* Action Controls */}
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <Button
                variant="primary"
                size="md"
                onClick={handleToggleRun}
                leftIcon={isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              >
                {isRunning ? 'Pause' : 'Start Demo'}
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
                Stop &amp; Save
              </Button>
            </div>

            <div className="pt-2 flex items-center justify-between text-[11px]">
              <button
                type="button"
                onClick={() => setShowDetailsDrawer((d) => !d)}
                className="inline-flex items-center gap-1 font-semibold text-forest/70 dark:text-ivory/70 hover:text-forest dark:hover:text-white cursor-pointer"
              >
                {showDetailsDrawer ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                <span>{showDetailsDrawer ? 'Hide details' : 'Exercise telemetry & sync details'}</span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('/coach')}
                className="inline-flex items-center gap-1 font-semibold text-emerald dark:text-emerald-400 hover:underline cursor-pointer"
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
                  Independent Module Isolation
                </p>
                <p className="text-[11px] leading-relaxed text-forest/70 dark:text-ivory/70">
                  Ayush Pathak&apos;s Formwise camera pose detector runs in its own window or native Python desktop app. Video frames stay 100% private on your machine.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-forest/4 dark:bg-white/5 border border-forest/10 dark:border-white/10 space-y-1.5">
                <p className="font-bold text-forest dark:text-white flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-emerald" />
                  Structured Telemetry Contract
                </p>
                <p className="text-[11px] leading-relaxed text-forest/70 dark:text-ivory/70">
                  When you complete reps in Formwise, it sends structured workout data (exercise, reps, calories burned) straight to Health Plus daily rings.
                </p>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* QUICK SYNC / LOG WORKOUT CARD */}
      <Card variant="elevated" className="p-5 sm:p-6 bg-forest/3 dark:bg-white/3 border border-forest/10 dark:border-white/10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="font-heading font-bold text-base text-forest dark:text-white flex items-center gap-2">
              <Award className="w-4 h-4 text-emerald" />
              Quick Sync / Log Workout from Formwise Coach
            </h3>
            <p className="text-xs text-forest/65 dark:text-ivory/65 mt-0.5">
              Completed an exercise set in Formwise? Record your reps here to update your daily calorie burn &amp; streaks.
            </p>
          </div>
          <Badge variant="emerald" size="sm">
            ACSM MET Formula
          </Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <div>
            <label className="block text-xs font-semibold text-forest dark:text-ivory mb-1">
              Exercise
            </label>
            <select
              value={syncExercise}
              onChange={(e) => setSyncExercise(e.target.value as ExerciseTypeId)}
              className="w-full px-3 py-2 rounded-xl border border-forest/15 dark:border-white/15 bg-white dark:bg-forest/20 text-xs font-semibold text-forest dark:text-white cursor-pointer"
            >
              {(Object.values(EXERCISES) as ExerciseMeta[]).map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-forest dark:text-ivory mb-1">
              {EXERCISES[syncExercise].usesTimer ? 'Hold Time (seconds)' : 'Reps Completed'}
            </label>
            <input
              type="number"
              min={1}
              max={300}
              value={EXERCISES[syncExercise].usesTimer ? syncDurationSecs : syncReps}
              onChange={(e) => {
                const val = Number(e.target.value);
                if (EXERCISES[syncExercise].usesTimer) {
                  setSyncDurationSecs(val);
                } else {
                  setSyncReps(val);
                }
              }}
              className="w-full px-3 py-2 rounded-xl border border-forest/15 dark:border-white/15 bg-white dark:bg-forest/20 text-xs font-semibold text-forest dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-forest dark:text-ivory mb-1">
              Estimated Burn
            </label>
            <div className="px-3 py-2 rounded-xl bg-forest/5 dark:bg-white/5 border border-forest/10 dark:border-white/10 text-xs font-bold text-emerald flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 fill-current" />
              <span>
                ~
                {EXERCISES[syncExercise].usesTimer
                  ? Math.round(syncDurationSecs * EXERCISES[syncExercise].kcalPerRep)
                  : Math.round(syncReps * EXERCISES[syncExercise].kcalPerRep)}{' '}
                kcal
              </span>
            </div>
          </div>

          <div>
            <Button
              variant="primary"
              size="md"
              className="w-full"
              onClick={handleSaveFormwiseSync}
            >
              Save to Today &amp; Progress
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};
