/**
 * Formwise Kinematics Engine (MediaPipe Repetition Counter & Biomechanical Evaluator)
 * Ported from Ayush Pathak's Python engine for HEALTH PLUS.
 *
 * Implements real-time joint angle trigonometry, state machine transitions,
 * hysteresis filtering, sustained bad form guard, and repetition counting.
 */

export interface Point2D {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

export interface ExerciseInfo {
  id: string;
  name: string;
  cameraHint: string;
  instruction: string;
}

export interface Evaluation {
  label: string;
  sustainedBad: boolean;
  primary?: number | null;
  secondary?: number | null;
  primaryName?: string;
  secondaryName?: string;
}

export interface PoseSide {
  shoulder: Point2D;
  elbow: Point2D;
  wrist: Point2D;
  hip: Point2D;
  knee: Point2D;
  ankle: Point2D;
}

export const POSE_CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 7], [0, 4], [4, 5], [5, 6], [6, 8], [9, 10],
  [11, 12], [11, 13], [13, 15], [15, 17], [15, 19], [15, 21], [17, 19],
  [12, 14], [14, 16], [16, 18], [16, 20], [16, 22], [18, 20],
  [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [27, 29], [29, 31], [31, 27],
  [24, 26], [26, 28], [28, 30], [30, 32], [32, 28]
];

export function angle(a: Point2D, b: Point2D, c: Point2D): number {
  const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let degrees = Math.abs((radians * 180) / Math.PI);
  if (degrees > 180) {
    degrees = 360 - degrees;
  }
  return degrees;
}

export function distance(a: Point2D, b: Point2D): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

export abstract class Analyzer {
  abstract info: ExerciseInfo;
  usesTimer = false;
  phase = 'ready';
  totalReps = 0;
  goodReps = 0;
  badReps = 0;
  repWasBad = false;
  badFrames = 0;

  reset(): void {
    this.phase = 'ready';
    this.totalReps = 0;
    this.goodReps = 0;
    this.badReps = 0;
    this.repWasBad = false;
    this.badFrames = 0;
  }

  badState(bad: boolean): boolean {
    this.badFrames = bad ? this.badFrames + 1 : 0;
    return this.badFrames >= 8;
  }

  finishRep(bad: boolean): void {
    this.totalReps += 1;
    if (this.repWasBad || bad) {
      this.badReps += 1;
    } else {
      this.goodReps += 1;
    }
    this.repWasBad = false;
  }

  counterText(): string {
    return `REPS ${this.totalReps}`;
  }

  static visibleSide(points: Point2D[]): PoseSide | null {
    const leftIndices = [11, 13, 15, 23, 25, 27];
    const rightIndices = [12, 14, 16, 24, 26, 28];
    for (const ids of [leftIndices, rightIndices]) {
      const selected = ids.map((idx) => points[idx]);
      if (selected.every((p) => p && (p.visibility ?? 1.0) >= 0.55)) {
        return {
          shoulder: selected[0],
          elbow: selected[1],
          wrist: selected[2],
          hip: selected[3],
          knee: selected[4],
          ankle: selected[5],
        };
      }
    }
    return null;
  }

  static fullBody(points: Point2D[], ids: number[]): boolean {
    if (!points || points.length < 33) return false;
    return ids.every((index) => points[index] && (points[index].visibility ?? 1.0) >= 0.55);
  }

  abstract evaluate(points: Point2D[] | null): Evaluation;
}

export class PushUpAnalyzer extends Analyzer {
  info: ExerciseInfo = {
    id: 'pushup',
    name: 'Push-up',
    cameraHint: 'Side view · camera low',
    instruction: 'Keep your body straight. Lower your chest, then press back up.',
  };

  private armValues: number[] = [];
  private bodyValues: number[] = [];

  constructor() {
    super();
    this.reset();
  }

  override reset(): void {
    super.reset();
    this.armValues = [];
    this.bodyValues = [];
    this.phase = 'up';
  }

  evaluate(points: Point2D[] | null): Evaluation {
    if (!points || points.length === 0) {
      this.badFrames = 0;
      return { label: 'NO PERSON', sustainedBad: false };
    }
    const side = Analyzer.visibleSide(points);
    if (!side) {
      this.badFrames = 0;
      return { label: 'MOVE FULL BODY INTO FRAME', sustainedBad: false };
    }

    const rawArm = angle(side.shoulder, side.elbow, side.wrist);
    const rawBody = angle(side.shoulder, side.hip, side.knee);
    this.armValues.push(rawArm);
    if (this.armValues.length > 5) this.armValues.shift();
    this.bodyValues.push(rawBody);
    if (this.bodyValues.length > 5) this.bodyValues.shift();

    const arm = mean(this.armValues);
    const body = mean(this.bodyValues);

    const inPosition =
      Math.abs(side.shoulder.y - side.ankle.y) < 0.5 &&
      side.wrist.y > side.shoulder.y - 0.04 &&
      body > 118;

    if (!inPosition) {
      this.badFrames = 0;
      return {
        label: 'GET INTO PUSH-UP POSITION',
        sustainedBad: false,
        primary: arm,
        secondary: body,
        primaryName: 'Arm',
        secondaryName: 'Body',
      };
    }

    const bad = body < 150;
    if (this.phase === 'up' && arm <= 105) {
      this.phase = 'down';
      this.repWasBad = bad;
    } else if (this.phase === 'down') {
      this.repWasBad = this.repWasBad || bad;
      if (arm >= 155) {
        this.phase = 'up';
        this.finishRep(bad);
      }
    }

    const sustained = this.badState(bad);
    return {
      label: bad ? 'BAD FORM: KEEP BODY STRAIGHT' : 'GOOD FORM',
      sustainedBad: sustained,
      primary: arm,
      secondary: body,
      primaryName: 'Arm',
      secondaryName: 'Body',
    };
  }
}

export class SquatAnalyzer extends Analyzer {
  info: ExerciseInfo = {
    id: 'squat',
    name: 'Bodyweight squat',
    cameraHint: 'Front or side view · feet visible',
    instruction: 'Stand tall, lower under control, then return to standing.',
  };

  private kneeValues: number[] = [];

  constructor() {
    super();
    this.reset();
  }

  override reset(): void {
    super.reset();
    this.kneeValues = [];
    this.phase = 'up';
  }

  evaluate(points: Point2D[] | null): Evaluation {
    const ids = [11, 12, 23, 24, 25, 26, 27, 28];
    if (!points || points.length === 0) {
      this.badFrames = 0;
      return { label: 'NO PERSON', sustainedBad: false };
    }
    if (!Analyzer.fullBody(points, ids)) {
      this.badFrames = 0;
      return { label: 'MOVE FULL BODY INTO FRAME', sustainedBad: false };
    }

    const left = angle(points[23], points[25], points[27]);
    const right = angle(points[24], points[26], points[28]);
    const rawKnee = (left + right) / 2;
    this.kneeValues.push(rawKnee);
    if (this.kneeValues.length > 5) this.kneeValues.shift();
    const knee = mean(this.kneeValues);

    const hipWidth = distance(points[23], points[24]);
    const ankleWidth = distance(points[27], points[28]);
    const kneeWidth = distance(points[25], points[26]);

    const standing = knee > 145 && Math.abs(points[23].y - points[24].y) < 0.16;
    if (ankleWidth < Math.max(0.06, hipWidth * 0.55)) {
      this.badFrames = 0;
      return {
        label: 'STEP BACK: SHOW BOTH FEET',
        sustainedBad: false,
        primary: knee,
        primaryName: 'Knee',
      };
    }

    const kneeCave = ankleWidth > hipWidth * 0.9 && kneeWidth < ankleWidth * 0.6;
    const bad = kneeCave;

    if (this.phase === 'up' && knee <= 105) {
      this.phase = 'down';
      this.repWasBad = bad;
    } else if (this.phase === 'down') {
      this.repWasBad = this.repWasBad || bad;
      if (knee >= 160) {
        this.phase = 'up';
        this.finishRep(bad);
      }
    }

    const label = bad
      ? 'BAD FORM: KEEP KNEES OUT'
      : standing || this.phase === 'down'
        ? 'GOOD FORM'
        : 'GET READY';

    return {
      label,
      sustainedBad: this.badState(bad),
      primary: knee,
      primaryName: 'Knee',
    };
  }
}

export class JumpingJackAnalyzer extends Analyzer {
  info: ExerciseInfo = {
    id: 'jumping_jack',
    name: 'Jumping jack',
    cameraHint: 'Front view · full body visible',
    instruction: 'Open arms and feet together, then return to the closed position.',
  };

  constructor() {
    super();
    this.reset();
  }

  override reset(): void {
    super.reset();
    this.phase = 'closed';
  }

  evaluate(points: Point2D[] | null): Evaluation {
    const ids = [11, 12, 15, 16, 23, 24, 27, 28];
    if (!points || points.length === 0) {
      this.badFrames = 0;
      return { label: 'NO PERSON', sustainedBad: false };
    }
    if (!Analyzer.fullBody(points, ids)) {
      this.badFrames = 0;
      return { label: 'MOVE FULL BODY INTO FRAME', sustainedBad: false };
    }

    const shoulderWidth = Math.max(distance(points[11], points[12]), 0.06);
    const footWidth = distance(points[27], points[28]) / shoulderWidth;
    const wristHigh =
      Math.min(points[15].y, points[16].y) < Math.min(points[11].y, points[12].y) - 0.13;
    const feetWide = footWidth > 1.65;
    const closed =
      footWidth < 1.05 &&
      Math.max(points[15].y, points[16].y) > Math.max(points[23].y, points[24].y) - 0.05;

    if (this.phase === 'closed' && wristHigh && feetWide) {
      this.phase = 'open';
    } else if (this.phase === 'open') {
      if (closed) {
        this.phase = 'closed';
        this.finishRep(false);
      }
    }

    const label = this.phase === 'open' ? 'OPEN POSITION' : 'CLOSED POSITION';
    return {
      label,
      sustainedBad: false,
      primary: footWidth,
      primaryName: 'Foot width',
    };
  }
}

export class ForwardLungeAnalyzer extends Analyzer {
  info: ExerciseInfo = {
    id: 'lunge',
    name: 'Lunge',
    cameraHint: 'Side view · show both feet',
    instruction: 'Step forward, bend both knees, then return to standing.',
  };

  private kneeValues: number[] = [];

  constructor() {
    super();
    this.reset();
  }

  override reset(): void {
    super.reset();
    this.kneeValues = [];
    this.phase = 'up';
  }

  evaluate(points: Point2D[] | null): Evaluation {
    const ids = [11, 12, 23, 24, 25, 26, 27, 28];
    if (!points || points.length === 0) {
      this.badFrames = 0;
      return { label: 'NO PERSON', sustainedBad: false };
    }
    if (!Analyzer.fullBody(points, ids)) {
      this.badFrames = 0;
      return { label: 'MOVE FULL BODY INTO FRAME', sustainedBad: false };
    }

    const leftKnee = angle(points[23], points[25], points[27]);
    const rightKnee = angle(points[24], points[26], points[28]);
    const bentKnee = Math.min(leftKnee, rightKnee);
    this.kneeValues.push(bentKnee);
    if (this.kneeValues.length > 5) this.kneeValues.shift();
    const smoothedKnee = mean(this.kneeValues);

    const stance = Math.abs(points[27].x - points[28].x);
    const inLunge = stance >= 0.12;

    if (!inLunge) {
      this.badFrames = 0;
      return {
        label: 'STEP FORWARD INTO A LUNGE',
        sustainedBad: false,
        primary: smoothedKnee,
        primaryName: 'Knee',
      };
    }

    const down = leftKnee <= 130 && rightKnee <= 130;
    const up = leftKnee >= 150 && rightKnee >= 150;

    if (this.phase === 'up' && down) {
      this.phase = 'down';
    } else if (this.phase === 'down') {
      if (up) {
        this.phase = 'up';
        this.finishRep(false);
      }
    }

    return {
      label: this.phase === 'down' ? 'LUNGE POSITION' : 'READY: STEP FORWARD',
      sustainedBad: false,
      primary: smoothedKnee,
      primaryName: 'Knee',
    };
  }
}

export class BicepCurlAnalyzer extends Analyzer {
  info: ExerciseInfo = {
    id: 'bicep_curl',
    name: 'Bicep curl',
    cameraHint: 'Front or slight-angle view · show both arms',
    instruction: 'Keep an elbow by your side. Curl either hand toward your shoulder, then lower it.',
  };

  private leftValues: number[] = [];
  private rightValues: number[] = [];
  activeArm: 'left' | 'right' | null = null;

  constructor() {
    super();
    this.reset();
  }

  override reset(): void {
    super.reset();
    this.leftValues = [];
    this.rightValues = [];
    this.activeArm = null;
    this.phase = 'ready';
  }

  evaluate(points: Point2D[] | null): Evaluation {
    const ids = [11, 12, 13, 14, 15, 16];
    if (!points || points.length === 0) {
      this.badFrames = 0;
      return { label: 'NO PERSON', sustainedBad: false };
    }
    if (!Analyzer.fullBody(points, ids)) {
      this.badFrames = 0;
      return { label: 'SHOW BOTH ARMS', sustainedBad: false };
    }

    const left = angle(points[11], points[13], points[15]);
    const right = angle(points[12], points[14], points[16]);
    this.leftValues.push(left);
    if (this.leftValues.length > 5) this.leftValues.shift();
    this.rightValues.push(right);
    if (this.rightValues.length > 5) this.rightValues.shift();

    const smoothedLeft = mean(this.leftValues);
    const smoothedRight = mean(this.rightValues);

    if (this.activeArm === null) {
      if (smoothedLeft <= 85) {
        this.activeArm = 'left';
        this.phase = 'curled';
      } else if (smoothedRight <= 85) {
        this.activeArm = 'right';
        this.phase = 'curled';
      }
    }

    const activeAngle = this.activeArm === 'left' ? smoothedLeft : smoothedRight;
    const shoulder = this.activeArm === 'left' ? points[11] : points[12];
    const elbow = this.activeArm === 'left' ? points[13] : points[14];

    const bad =
      this.activeArm !== null &&
      (Math.abs(elbow.x - shoulder.x) > 0.18 || elbow.y < shoulder.y + 0.04);

    if (this.activeArm !== null && this.phase === 'curled' && activeAngle >= 155) {
      this.finishRep(bad);
      this.activeArm = null;
      this.phase = 'ready';
    }

    if (this.activeArm === null) {
      return {
        label: 'READY: CURL EITHER ARM',
        sustainedBad: false,
        primary: Math.min(smoothedLeft, smoothedRight),
        primaryName: 'Elbow',
      };
    }

    const armName = this.activeArm === 'left' ? 'LEFT' : 'RIGHT';
    const label = bad ? 'BAD FORM: KEEP ELBOW BY YOUR SIDE' : `GOOD FORM: CURL ${armName} ARM`;

    return {
      label,
      sustainedBad: this.badState(bad),
      primary: activeAngle,
      primaryName: `${armName} elbow`,
    };
  }
}

export class HighKneesAnalyzer extends Analyzer {
  info: ExerciseInfo = {
    id: 'high_knees',
    name: 'High knees',
    cameraHint: 'Front view · show your full body and both feet',
    instruction: 'Face the camera. Lift either knee to about a 90° bend, lower it, then lift again.',
  };

  private leftValues: number[] = [];
  private rightValues: number[] = [];
  leftArmed = false;
  rightArmed = false;

  constructor() {
    super();
    this.reset();
  }

  override reset(): void {
    super.reset();
    this.leftValues = [];
    this.rightValues = [];
    this.leftArmed = false;
    this.rightArmed = false;
  }

  evaluate(points: Point2D[] | null): Evaluation {
    const ids = [11, 12, 23, 24, 25, 26, 27, 28];
    if (!points || points.length === 0) {
      this.badFrames = 0;
      return { label: 'NO PERSON', sustainedBad: false };
    }
    if (!Analyzer.fullBody(points, ids)) {
      this.badFrames = 0;
      return { label: 'MOVE FULL BODY AND FEET INTO FRAME', sustainedBad: false };
    }

    const left = angle(points[23], points[25], points[27]);
    const right = angle(points[24], points[26], points[28]);
    this.leftValues.push(left);
    if (this.leftValues.length > 5) this.leftValues.shift();
    this.rightValues.push(right);
    if (this.rightValues.length > 5) this.rightValues.shift();

    const smoothedLeft = mean(this.leftValues);
    const smoothedRight = mean(this.rightValues);

    if (smoothedLeft >= 155) this.leftArmed = true;
    if (smoothedRight >= 155) this.rightArmed = true;

    const raised: string[] = [];
    if (this.leftArmed && smoothedLeft <= 115) {
      this.leftArmed = false;
      this.finishRep(false);
      raised.push('LEFT');
    }
    if (this.rightArmed && smoothedRight <= 115) {
      this.rightArmed = false;
      this.finishRep(false);
      raised.push('RIGHT');
    }

    const current = [
      ...(smoothedLeft <= 115 ? ['LEFT'] : []),
      ...(smoothedRight <= 115 ? ['RIGHT'] : []),
    ];

    const activeList = raised.length > 0 ? raised : current;
    const label =
      activeList.length > 0
        ? `GOOD FORM: ${activeList.join(', ')} KNEE UP`
        : 'READY: LIFT A KNEE TO 90°';

    return {
      label,
      sustainedBad: false,
      primary: Math.min(smoothedLeft, smoothedRight),
      primaryName: 'Knee',
    };
  }
}

export class WallSitAnalyzer extends Analyzer {
  override usesTimer = true;
  info: ExerciseInfo = {
    id: 'wall_sit',
    name: 'Wall sit',
    cameraHint: 'Side view · wall, full body, and feet visible',
    instruction:
      'Keep your back against the wall, thighs level, and knees near 90°. The timer runs only while this position is held.',
  };

  elapsedSeconds = 0.0;
  holdStarted: number | null = null;

  constructor() {
    super();
    this.reset();
  }

  override reset(): void {
    super.reset();
    this.elapsedSeconds = 0.0;
    this.holdStarted = null;
  }

  private pauseTimer(): void {
    if (this.holdStarted !== null) {
      this.elapsedSeconds += (performance.now() - this.holdStarted) / 1000;
      this.holdStarted = null;
    }
  }

  override counterText(): string {
    let seconds = this.elapsedSeconds;
    if (this.holdStarted !== null) {
      seconds += (performance.now() - this.holdStarted) / 1000;
    }
    const whole = Math.floor(seconds);
    const m = Math.floor(whole / 60);
    const s = whole % 60;
    return `TIME ${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  evaluate(points: Point2D[] | null): Evaluation {
    if (!points || points.length === 0) {
      this.pauseTimer();
      this.badFrames = 0;
      return { label: 'NO PERSON: TIMER PAUSED', sustainedBad: false };
    }

    let side: Point2D[] | null = null;
    for (const indices of [
      [11, 23, 25, 27],
      [12, 24, 26, 28],
    ]) {
      const candidate = indices.map((idx) => points[idx]);
      if (candidate.every((p) => p && (p.visibility ?? 1.0) >= 0.55)) {
        side = candidate;
        break;
      }
    }

    if (!side) {
      this.pauseTimer();
      this.badFrames = 0;
      return { label: 'TURN SIDEWAYS: SHOW ONE FULL LEG', sustainedBad: false };
    }

    const [shoulder, hip, kneePoint, ankle] = side;
    const knee = angle(hip, kneePoint, ankle);
    const hipAngle = angle(shoulder, hip, kneePoint);
    const torsoLength = Math.max(distance(shoulder, hip), 0.05);
    const torsoIsVertical = Math.abs(shoulder.x - hip.x) / torsoLength <= 0.35;

    const holding = knee >= 72 && knee <= 118 && hipAngle >= 68 && hipAngle <= 122 && torsoIsVertical;

    if (holding) {
      if (this.holdStarted === null) {
        this.holdStarted = performance.now();
      }
    } else {
      this.pauseTimer();
    }

    const label = holding ? 'GOOD FORM: WALL SIT' : 'GET INTO WALL-SIT POSITION';

    return {
      label,
      sustainedBad: false,
      primary: knee,
      secondary: hipAngle,
      primaryName: 'Knee',
      secondaryName: 'Hip',
    };
  }
}

export const EXERCISES_REGISTRY: Record<string, () => Analyzer> = {
  pushup: () => new PushUpAnalyzer(),
  squat: () => new SquatAnalyzer(),
  jumping_jack: () => new JumpingJackAnalyzer(),
  lunge: () => new ForwardLungeAnalyzer(),
  bicep_curl: () => new BicepCurlAnalyzer(),
  high_knees: () => new HighKneesAnalyzer(),
  wall_sit: () => new WallSitAnalyzer(),
};

export function createAnalyzer(exerciseId: string): Analyzer {
  const factory = EXERCISES_REGISTRY[exerciseId];
  return factory ? factory() : new PushUpAnalyzer();
}
