import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
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
  Search,
  Rotate3D,
  Gauge,
  CircleAlert,
  X,
  Camera,
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
import type { Exercise, Library } from '@/features/exercises/types';
import { loadLibrary } from '@/features/exercises/three/library';
import { calorieLabel, caloriesForSuggestedSet } from '@/features/exercises/calorieEstimates';
import { AvatarSelect, previewBase, type AvatarId } from '@/features/exercises/avatars';
import ExerciseViewer from '@/features/exercises/three/ExerciseViewer';

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

const EXERCISES: Record<string, ExerciseMeta> = {
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
      'कोहनियां लगभग 45 डिग्री पर मोड़ते हुए नीचे जाएँ',
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
      'कूलहों को हल्का पीछे ले जाते हुए नियंत्रित नीचे जाएँ',
      'ऊपर आते समय सांस बाहर छोड़ें',
    ],
  },
  jumping_jack: {
    id: 'jumping_jack',
    label: 'Jumping Jacks',
    targetReps: 25,
    kcalPerRep: 0.28,
    muscles: 'Full Body Aerobic · Calves · Deltoids',
    cuesEn: [
      'Start feet together with arms resting at your sides',
      'Jump feet outward while sweeping hands overhead until they meet',
      'Land lightly on midfoot, spring smoothly back to center',
    ],
    cuesHinglish: [
      'Paon saath mein aur haath sides par rakhein',
      'Kood kar paon kholein aur haath upar taali bajayein',
      'Pano par soft land karein aur flow maintain rakhein',
    ],
    cuesHi: [
      'पैर पास और हाथ शरीर के पास रखकर शुरुआत करें',
      'कूदकर पैर फैलाएँ और हाथ सिर के ऊपर मिलाएँ',
      'पंजों पर हल्का उतरें और गति निरंतर बनाए रखें',
    ],
  },
  lunge: {
    id: 'lunge',
    label: 'Forward / Reverse Lunge',
    targetReps: 12,
    kcalPerRep: 0.50,
    muscles: 'Quadriceps · Hamstrings · Gluteus Medius',
    cuesEn: [
      'Take a generous step forward, keeping torso tall and proud',
      'Drop back knee straight down toward floor to 90° bend',
      'Press through front heel to return cleanly to standing',
    ],
    cuesHinglish: [
      'Lamba kadam aage badhayein, torso bilkul seedha rakhein',
      'Peeche ka ghutna floor ke paas 90 degree par drop karein',
      'Front heel se press karke wapas standing position mein aayein',
    ],
    cuesHi: [
      'लंबा कदम आगे बढ़ाएँ और धड़ को सीधा रखें',
      'पीछे का घुटना जमीन के पास 90 डिग्री पर लाएँ',
      'आगे की एड़ी से दबाव देकर वापस खड़े हों',
    ],
  },
  bicep_curl: {
    id: 'bicep_curl',
    label: 'Bicep Curl (Bands / Dumbbells)',
    targetReps: 12,
    kcalPerRep: 0.32,
    muscles: 'Biceps Brachii · Brachialis · Forearms',
    cuesEn: [
      'Elbows pinned firmly to ribcage, palms facing forward',
      'Curl upward smoothly without swinging elbows or arching back',
      'Squeeze biceps cleanly at top, lower for 2 seconds with control',
    ],
    cuesHinglish: [
      'Elbows ko kamar ke paas lock rakhein, aage peeche na hilayein',
      'Biceps ko contract karke weight upar laayein',
      'Control ke saath 2 second mein neeche le jayein',
    ],
    cuesHi: [
      'कोहनियों को पसलियों के पास स्थिर रखें',
      'बिना झटका दिए हाथों को कंधे की ओर मोड़ें',
      'ऊपर बाइसेप्स सिकोड़ें और धीरे-धीरे नीचे लाएँ',
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
};

const CAMERA_SUPPORTED_EXERCISES = new Set([
  'pushup',
  'push-up',
  'squat',
  'squats',
  'jumping_jack',
  'jumping-jacks',
  'lunge',
  'lunges',
  'bicep_curl',
  'bicep-curls',
  'high_knees',
  'high-knees',
  'wall_sit',
  'wall-sit',
]);

const SPEEDS = [1, 1.5, 2, 0.5];

export const MoveStudioPage: React.FC<MoveStudioPageProps> = ({ onNavigate = () => {} }) => {
  const { state, workoutsToday, adjustHydration, logWorkout } = useApp();

  // Active view tab: 'catalog' (443+ 3D Library) or 'pose-studio' (Guided Live Pose Counter)
  const [activeTab, setActiveTab] = useState<'catalog' | 'pose-studio'>('catalog');

  // 443+ Library State
  const [library, setLibrary] = useState<Library | null>(null);
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedExercise3D, setSelectedExercise3D] = useState<Exercise | null>(null);
  const [avatar, setAvatar] = useState<AvatarId>('man-athletic');
  const [speedIndex, setSpeedIndex] = useState(0);
  const [isPlaying3D, setIsPlaying3D] = useState(true);
  const [logSetCount, setLogSetCount] = useState(1);

  // Guided Pose Studio State
  const [selectedExercise, setSelectedExercise] = useState<string>('pushup');
  const [isRunning, setIsRunning] = useState(false);
  const [reps, setReps] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [showDetailsDrawer, setShowDetailsDrawer] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  // Formwise Quick Sync State
  const [syncExercise, setSyncExercise] = useState<string>('pushup');
  const [syncReps, setSyncReps] = useState(15);
  const [syncDurationSecs, setSyncDurationSecs] = useState(60);

  const repsRef = useRef<number>(0);
  const meta = EXERCISES[selectedExercise] || EXERCISES.pushup;
  const preferredLang = state.profile?.lifestyle.preferredLanguage ?? 'auto';
  const activeLang =
    preferredLang === 'auto' ? state.conversationMemory.detectedLanguage : preferredLang;

  const activeCues =
    activeLang === 'hi'
      ? meta.cuesHi
      : activeLang === 'hinglish'
        ? meta.cuesHinglish
        : meta.cuesEn;

  // Load 443+ Desk Break Library
  useEffect(() => {
    let mounted = true;
    loadLibrary()
      .then((data) => {
        if (mounted) {
          setLibrary(data);
          setLibraryLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to load 443 exercise library:', err);
        if (mounted) setLibraryLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const speakCue = useCallback(
    (text: string) => {
      if (!voiceEnabled || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = activeLang === 'en' ? 'en-IN' : 'hi-IN';
        utterance.rate = 0.98;
        window.speechSynthesis.speak(utterance);
      } catch {}
    },
    [voiceEnabled, activeLang]
  );

  // Handle message from Ayush's Formwise standalone window
  useEffect(() => {
    const handleFormwiseMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'FORMWISE_WORKOUT_COMPLETED') {
        const { exerciseId, exerciseName, repsCompleted, durationSeconds, caloriesBurned } = event.data;
        const fallbackMeta = EXERCISES[exerciseId] || EXERCISES.pushup;

        logWorkout({
          exerciseType: exerciseId || 'pushup',
          exerciseLabel: exerciseName || fallbackMeta.label,
          repsCompleted: Number(repsCompleted) || 10,
          targetReps: fallbackMeta.targetReps,
          durationSeconds: Number(durationSeconds) || 60,
          estimatedKcal: Number(caloriesBurned) || Math.round(Number(repsCompleted) * fallbackMeta.kcalPerRep),
          mode: 'camera_preview',
          formNotes: ['Captured via Formwise MediaPipe Tracker'],
        });

        adjustHydration(0.25);
        setSavedNotice(
          `🎉 Synced ${repsCompleted} reps of ${exerciseName || fallbackMeta.label} (~${caloriesBurned} kcal burned) from Formwise Pose Tracker!`
        );
        setTimeout(() => setSavedNotice(null), 7000);
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
      const fallbackMeta = EXERCISES[syncedEx] || EXERCISES.pushup;
      const r = parseInt(syncedReps, 10) || 12;
      const d = parseInt(syncedDuration || '60', 10) || 60;
      const k = parseInt(syncedKcal || '10', 10) || Math.round(r * fallbackMeta.kcalPerRep);

      logWorkout({
        exerciseType: syncedEx,
        exerciseLabel: fallbackMeta.label,
        repsCompleted: r,
        targetReps: fallbackMeta.targetReps,
        durationSeconds: d,
        estimatedKcal: k,
        mode: 'camera_preview',
        formNotes: ['Logged via Formwise Camera Redirect'],
      });

      adjustHydration(0.25);
      setSavedNotice(
        `🎉 Synced ${r} reps of ${fallbackMeta.label} (~${k} kcal) from Formwise Pose Tracker! Added to Today & Progress.`
      );

      // Clean up URL parameters cleanly
      window.history.replaceState({}, document.title, window.location.pathname);
      setTimeout(() => setSavedNotice(null), 7000);
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
    setSavedNotice(`Saved ${finalReps} ${meta.label} (~${kcal} kcal est.) to Today & Progress!`);
    repsRef.current = 0;
    setReps(0);
    setSeconds(0);
    setTimeout(() => setSavedNotice(null), 4000);
  };

  // Launch Formwise in a dedicated clean window with optional pre-selected exercise
  const launchFormwiseWindow = (targetExerciseId?: string) => {
    const w = 1180;
    const h = 780;
    const left = Math.max(0, (window.screen.width - w) / 2);
    const top = Math.max(0, (window.screen.height - h) / 2);
    const url = targetExerciseId
      ? `/formwise.html?exercise=${encodeURIComponent(targetExerciseId)}`
      : '/formwise.html';
    window.open(
      url,
      'FormwisePoseCoach',
      `width=${w},height=${h},top=${top},left=${left},resizable=yes,scrollbars=yes,status=no`
    );
  };

  // Manual Quick Sync Form Handler
  const handleSaveFormwiseSync = () => {
    const exMeta = EXERCISES[syncExercise] || EXERCISES.pushup;
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
    setSavedNotice(`Logged ${syncReps} ${exMeta.label} (~${kcal} kcal) to Today & Progress!`);
    setTimeout(() => setSavedNotice(null), 5000);
  };

  // Log 3D Exercise Set to Daily Rings
  const handleLog3DExerciseSet = (exercise: Exercise, sets: number = 1) => {
    const singleKcal = Math.max(1, Math.round(caloriesForSuggestedSet(exercise)));
    const totalKcal = singleKcal * sets;
    const duration = sets * 90; // approx 90 sec per set

    logWorkout({
      exerciseType: exercise.id,
      exerciseLabel: exercise.en || 'Movement Practice',
      repsCompleted: sets * 10,
      targetReps: 12,
      durationSeconds: duration,
      estimatedKcal: totalKcal,
      mode: 'guided_demo',
      formNotes: exercise.steps_en?.slice(0, 2) || ['Completed 3D guided movement practice'],
    });

    adjustHydration(0.25);
    setSavedNotice(
      `🎉 Recorded ${sets} set${sets > 1 ? 's' : ''} of ${exercise.en} (~${totalKcal} kcal) to your Daily Rings!`
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

  // Filter exercises in the 443+ library
  const filteredExercises = useMemo(() => {
    if (!library) return [];
    let list = library.exercises;
    if (selectedCategory !== 'all') {
      list = list.filter((ex) => ex.category === selectedCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (ex) =>
          ex.en?.toLowerCase().includes(q) ||
          ex.id.toLowerCase().includes(q) ||
          ex.steps_en?.some((s) => s.toLowerCase().includes(q))
      );
    }
    return list;
  }, [library, selectedCategory, searchQuery]);

  return (
    <div className="space-y-6 pb-24 text-left animate-fadeIn max-w-6xl mx-auto px-2 sm:px-4">
      {/* Header Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="emerald" size="sm">
              Kinetic Studio &amp; AI Pose Tracker
            </Badge>
            <span className="text-xs text-forest/70 dark:text-ivory/70">
              Logged today: <strong>{totalRepsToday} reps</strong> ({totalCaloriesToday} kcal)
            </span>
          </div>
          <h1 className="font-heading font-black text-2xl sm:text-3xl text-forest dark:text-white mt-1">
            Move Studio
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {/* Tab Selector */}
          <div className="flex bg-forest/8 dark:bg-white/10 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab('catalog')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'catalog'
                  ? 'bg-forest text-white dark:bg-emerald shadow-sm'
                  : 'text-forest/70 dark:text-ivory/70 hover:text-forest dark:hover:text-white'
              }`}
            >
              <Rotate3D className="w-3.5 h-3.5" />
              <span>443+ 3D Library</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('pose-studio')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'pose-studio'
                  ? 'bg-forest text-white dark:bg-emerald shadow-sm'
                  : 'text-forest/70 dark:text-ivory/70 hover:text-forest dark:hover:text-white'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Pose Studio</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setVoiceEnabled((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-forest/15 dark:border-white/15 bg-white/80 dark:bg-white/5 text-xs font-semibold text-forest dark:text-ivory cursor-pointer"
          >
            {voiceEnabled ? (
              <Volume2 className="w-3.5 h-3.5 text-emerald" />
            ) : (
              <VolumeX className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">{voiceEnabled ? 'Voice Coach On' : 'Muted'}</span>
          </button>
        </div>
      </div>

      {/* HERO FORMWISE INTEGRATION BANNER */}
      <Card
        variant="elevated"
        className="p-5 sm:p-6 bg-gradient-to-r from-emerald-950 via-forest to-emerald-900 text-white border-0 shadow-xl overflow-hidden relative"
      >
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
              Launch Formwise AI Camera Tracker
            </h2>
            <p className="text-xs sm:text-sm text-emerald-100/80 leading-relaxed">
              Open the dedicated computer-vision window for real-time 33-landmark pose tracking,
              audio cues (&quot;Wrong form. Please correct your posture&quot;), and instant repetition
              telemetry automatically synced with your Health Plus Daily Rings.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch md:items-center gap-2.5 shrink-0 w-full md:w-auto">
            <Button
              variant="gold"
              size="lg"
              onClick={() => launchFormwiseWindow()}
              className="bg-[#c6f06e] text-[#102022] hover:bg-[#b5e05a] font-black border-0 shadow-lg text-sm px-5 py-3 cursor-pointer"
              leftIcon={<ExternalLink className="w-4 h-4" />}
            >
              Open Formwise Tracker
            </Button>
          </div>
        </div>

        {/* Desktop OpenCV & Telemetry Info */}
        <div className="mt-4 pt-3.5 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-emerald-200/70">
          <div className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-[#c6f06e]" />
            <span>Completed workouts sync back to Health Plus automatically!</span>
          </div>
          <div className="font-mono bg-black/30 px-2.5 py-1 rounded text-[10px] text-emerald-300">
            Native Desktop: python scripts/repetition_counter/main.py
          </div>
        </div>
      </Card>

      {/* SAVED WORKOUT NOTICE */}
      {savedNotice && (
        <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/35 text-xs sm:text-sm font-semibold text-forest dark:text-emerald-200 flex items-center gap-2.5 animate-fadeIn shadow-sm">
          <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
          <span>{savedNotice}</span>
        </div>
      )}

      {/* TAB 1: 443+ 3D EXERCISE LIBRARY */}
      {activeTab === 'catalog' && (
        <div className="space-y-6">
          {/* Controls Bar: Search, Category Filters, Avatar Switch */}
          <div className="bg-white/80 dark:bg-white/5 border border-forest/10 dark:border-white/10 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-wider font-bold text-emerald dark:text-emerald-400">
                  Interactive 3D Movement Library
                </p>
                <h3 className="font-heading font-extrabold text-lg text-forest dark:text-white">
                  Explore 443 3D Animated Exercises
                </h3>
              </div>

              <div className="flex items-center gap-3">
                <AvatarSelect value={avatar} onChange={setAvatar} />
              </div>
            </div>

            {/* Search Bar */}
            <div className="relative">
              <Search className="w-4 h-4 text-forest/40 dark:text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search across 443 exercises (e.g. squat, push-up, yoga, spine, hips)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-forest/15 dark:border-white/15 bg-white dark:bg-black/20 text-xs sm:text-sm text-forest dark:text-white placeholder:text-forest/40 dark:placeholder:text-white/40 focus:border-emerald-500 focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-forest/40 dark:text-white/40 hover:text-forest dark:hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Category Filter Pills */}
            {library && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                <button
                  type="button"
                  onClick={() => setSelectedCategory('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                    selectedCategory === 'all'
                      ? 'bg-forest text-white dark:bg-emerald shadow-sm'
                      : 'bg-forest/5 dark:bg-white/5 text-forest/70 dark:text-ivory/70 hover:bg-forest/10'
                  }`}
                >
                  All Exercises ({library.exercises.length})
                </button>
                {library.categories.map((c) => {
                  const count = library.exercises.filter((e) => e.category === c.id).length;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedCategory(c.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                        selectedCategory === c.id
                          ? 'bg-forest text-white dark:bg-emerald shadow-sm'
                          : 'bg-forest/5 dark:bg-white/5 text-forest/70 dark:text-ivory/70 hover:bg-forest/10'
                      }`}
                    >
                      {c.en} ({count})
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 443 Exercises Grid */}
          {libraryLoading ? (
            <div className="p-12 text-center text-forest/60 dark:text-ivory/60 space-y-2">
              <Rotate3D className="w-8 h-8 animate-spin mx-auto text-emerald" />
              <p className="text-sm font-semibold">Loading 443+ 3D exercises &amp; kinematic avatars...</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
              {filteredExercises.slice(0, 80).map((ex) => {
                const isCameraSupported = CAMERA_SUPPORTED_EXERCISES.has(ex.id);
                return (
                  <div
                    key={ex.id}
                    onClick={() => {
                      setSelectedExercise3D(ex);
                      setIsPlaying3D(true);
                    }}
                    className="group relative rounded-xl bg-white dark:bg-white/5 border border-forest/10 dark:border-white/10 hover:border-emerald-500/50 hover:shadow-lg transition-all cursor-pointer overflow-hidden flex flex-col justify-between"
                  >
                    {/* Animated GIF Preview */}
                    <div className="relative aspect-[4/3] bg-slate-900/10 dark:bg-black/30 overflow-hidden flex items-center justify-center">
                      <img
                        src={`${previewBase(avatar)}/${ex.id}.gif`}
                        alt={ex.en || 'Exercise'}
                        loading="lazy"
                        className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          // Fallback to base previews if avatar specific gif missing
                          (e.target as HTMLImageElement).src = `/previews/${ex.id}.gif`;
                        }}
                      />
                      {isCameraSupported && (
                        <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-emerald-500/90 text-white text-[9px] font-bold tracking-tight shadow">
                          📹 Camera Ready
                        </span>
                      )}
                    </div>

                    {/* Metadata */}
                    <div className="p-2.5 space-y-1">
                      <h4 className="font-heading font-bold text-xs text-forest dark:text-white line-clamp-1 group-hover:text-emerald-500 transition-colors">
                        {ex.en || ex.id}
                      </h4>
                      <div className="flex items-center justify-between text-[10px] text-forest/60 dark:text-ivory/60">
                        <span className="truncate max-w-[80px]">
                          {ex.amount_en || '10-12 reps'}
                        </span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                          {calorieLabel(ex)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {filteredExercises.length > 80 && (
            <p className="text-center text-xs text-forest/60 dark:text-ivory/60 pt-2">
              Showing top 80 of {filteredExercises.length} matching exercises. Use the category filters or search above to find specific movements.
            </p>
          )}

          {/* INTERACTIVE 3D MODAL VIEWER */}
          {selectedExercise3D && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-fadeIn">
              <div className="relative w-full max-w-4xl max-h-[92vh] overflow-y-auto bg-slate-900 border border-emerald-500/30 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-5 text-white">
                {/* Modal Header */}
                <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="emerald" size="sm">
                        {library?.categories.find((c) => c.id === selectedExercise3D.category)?.en ||
                          selectedExercise3D.category}
                      </Badge>
                      {CAMERA_SUPPORTED_EXERCISES.has(selectedExercise3D.id) && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                          📹 Formwise Pose Counter Supported
                        </span>
                      )}
                    </div>
                    <h2 className="font-heading font-extrabold text-xl sm:text-2xl text-white mt-1">
                      {selectedExercise3D.en || selectedExercise3D.id}
                    </h2>
                    <p className="text-xs text-emerald-200/80 mt-0.5">
                      Recommended Dose: <strong>{selectedExercise3D.amount_en || '10-12 reps'}</strong> ·{' '}
                      Estimated Burn: <strong>{calorieLabel(selectedExercise3D)}</strong>
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedExercise3D(null)}
                    className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* 3D Motion Canvas */}
                <div className="relative">
                  <ExerciseViewer
                    exercise={selectedExercise3D}
                    playing={isPlaying3D}
                    speed={SPEEDS[speedIndex]}
                    avatar={avatar}
                  />

                  {/* Playback Controls Toolbar */}
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-slate-800/80 border border-white/10">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsPlaying3D((p) => !p)}
                        className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow"
                      >
                        {isPlaying3D ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                        <span>{isPlaying3D ? 'Pause' : 'Play'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSpeedIndex((i) => (i + 1) % SPEEDS.length)}
                        className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs flex items-center gap-1 cursor-pointer"
                      >
                        <Gauge className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{SPEEDS[speedIndex]}x Speed</span>
                      </button>
                    </div>

                    <AvatarSelect value={avatar} onChange={setAvatar} />
                  </div>
                </div>

                {/* Performance Instructions */}
                {selectedExercise3D.steps_en && selectedExercise3D.steps_en.length > 0 && (
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                      Step-by-Step Biomechanical Guidance
                    </h4>
                    <ol className="list-decimal list-inside space-y-1.5 text-xs text-slate-300">
                      {selectedExercise3D.steps_en.map((step, idx) => {
                        const isCaution = step.startsWith('!');
                        return isCaution ? (
                          <li key={idx} className="text-amber-300 font-semibold list-none flex items-center gap-1.5">
                            <CircleAlert className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span>{step.slice(1)}</span>
                          </li>
                        ) : (
                          <li key={idx} className="leading-relaxed">
                            {step}
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                )}

                {/* Action Buttons: Formwise Camera Counter & Log Set */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <span className="text-xs text-slate-300 font-semibold">Sets:</span>
                    {[1, 2, 3].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setLogSetCount(s)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                          logSetCount === s
                            ? 'bg-emerald-500 text-slate-950'
                            : 'bg-white/10 text-white hover:bg-white/20'
                        }`}
                      >
                        {s} set{s > 1 ? 's' : ''}
                      </button>
                    ))}

                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleLog3DExerciseSet(selectedExercise3D, logSetCount)}
                      className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black cursor-pointer ml-1"
                    >
                      ⚡ Record to Daily Rings
                    </Button>
                  </div>

                  <Button
                    variant="gold"
                    size="sm"
                    onClick={() => launchFormwiseWindow(selectedExercise3D.id)}
                    className="w-full sm:w-auto bg-[#c6f06e] text-[#102022] hover:bg-[#b5e05a] font-black cursor-pointer shadow"
                    leftIcon={<Camera className="w-3.5 h-3.5" />}
                  >
                    Start Formwise Camera Counter
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: GUIDED POSE STUDIO (Biomechanical 3D Model & Realtime Rep Counter) */}
      {activeTab === 'pose-studio' && (
        <div className="space-y-6">
          {/* Exercise Picker (Core Repetition Presets) */}
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
                    onClick={() => launchFormwiseWindow(selectedExercise)}
                    className="text-[11px] font-bold text-emerald dark:text-emerald-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    Launch Live Camera <ExternalLink className="w-3 h-3" />
                  </button>
                </div>

                <AnatomicalAthleteVisual exerciseType={selectedExercise} isActive={isRunning} />
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
                    <div className="text-3xl font-heading font-black text-forest dark:text-white tabular-nums">
                      {meta.usesTimer ? formatTimer(seconds) : reps}{' '}
                      <span className="text-sm font-semibold text-forest/60 dark:text-ivory/60">
                        {meta.usesTimer ? 'sec' : `/ ${meta.targetReps}`}
                      </span>
                    </div>
                    <p className="text-[11px] text-forest/60 dark:text-ivory/60 mt-0.5">
                      ~
                      {meta.usesTimer
                        ? Math.round(seconds * meta.kcalPerRep)
                        : Math.round(reps * meta.kcalPerRep)}{' '}
                      kcal burned
                    </p>
                  </div>
                </div>

                {/* Form Cues */}
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-forest/70 dark:text-ivory/70">
                    Form Alignment Cues
                  </p>
                  <ul className="space-y-1.5 text-xs text-forest/85 dark:text-ivory/85">
                    {activeCues.map((cue, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald shrink-0 mt-1.5" />
                        <span>{cue}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Workout Controls */}
                <div className="space-y-2.5 pt-2">
                  <div className="flex items-center gap-2">
                    <Button
                      variant={isRunning ? 'secondary' : 'primary'}
                      size="md"
                      onClick={handleToggleRun}
                      className="flex-1 cursor-pointer"
                      leftIcon={isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    >
                      {isRunning ? 'Pause Workout' : reps > 0 ? 'Resume Workout' : 'Start Workout'}
                    </Button>

                    {!meta.usesTimer && (
                      <Button
                        variant="secondary"
                        size="md"
                        onClick={() => handleAddRep(1)}
                        className="cursor-pointer"
                        leftIcon={<Plus className="w-4 h-4" />}
                      >
                        Count Rep
                      </Button>
                    )}

                    {(reps > 0 || seconds > 0) && (
                      <Button
                        variant="gold"
                        size="md"
                        onClick={handleStopAndSave}
                        className="cursor-pointer"
                        leftIcon={<Square className="w-4 h-4" />}
                      >
                        Finish &amp; Save
                      </Button>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-forest/60 dark:text-ivory/60 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowDetailsDrawer((d) => !d)}
                      className="hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span>Biomechanical details</span>
                      {showDetailsDrawer ? (
                        <ChevronUp className="w-3 h-3" />
                      ) : (
                        <ChevronDown className="w-3 h-3" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => onNavigate?.('/coach')}
                      className="hover:underline text-emerald dark:text-emerald-400 font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3" />
                      Ask Coach for modifications
                    </button>
                  </div>
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
                      Module Isolation
                    </p>
                    <p className="text-[11px] leading-relaxed text-forest/70 dark:text-ivory/70">
                      Ayush Pathak&apos;s Formwise camera detector runs in its own window or desktop Python app. Video frames stay 100% on-device.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-forest/4 dark:bg-white/5 border border-forest/10 dark:border-white/10 space-y-1.5">
                    <p className="font-bold text-forest dark:text-white flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-emerald" />
                      Automatic Telemetry Sync
                    </p>
                    <p className="text-[11px] leading-relaxed text-forest/70 dark:text-ivory/70">
                      When you finish reps in Formwise, it sends structured workout data (exercise, reps, calories burned) straight to Health Plus daily rings.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* QUICK SYNC / LOG WORKOUT CARD */}
          <Card
            variant="elevated"
            className="p-5 sm:p-6 bg-forest/3 dark:bg-white/3 border border-forest/10 dark:border-white/10"
          >
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
                  onChange={(e) => setSyncExercise(e.target.value)}
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
                  {EXERCISES[syncExercise]?.usesTimer ? 'Hold Time (seconds)' : 'Reps Completed'}
                </label>
                <input
                  type="number"
                  min={1}
                  max={300}
                  value={EXERCISES[syncExercise]?.usesTimer ? syncDurationSecs : syncReps}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    if (EXERCISES[syncExercise]?.usesTimer) {
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
                    {EXERCISES[syncExercise]?.usesTimer
                      ? Math.round(syncDurationSecs * (EXERCISES[syncExercise]?.kcalPerRep || 0.15))
                      : Math.round(syncReps * (EXERCISES[syncExercise]?.kcalPerRep || 0.45))}{' '}
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
      )}
    </div>
  );
};
