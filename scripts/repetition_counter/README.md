# Formwise — MediaPipe Repetition Counter

A simple, local desktop exercise coach built for **Health Plus**. Choose an exercise, start the camera, and Formwise draws a live pose skeleton, counts full repetitions, and gives immediate form feedback.

Everything runs locally on your computer. Camera frames are not uploaded.

## Included exercises

| Exercise | Best camera position | What counts as one rep |
| --- | --- | --- |
| Push-up | Side view; camera low enough to show the whole body | Elbows bend down, then fully extend |
| Bodyweight squat | Front or side view; both feet visible | Knees lower, then return to standing |
| Jumping jack | Front view; full body visible | Closed → open → closed |
| Lunge | Side view; both feet visible | Both knees bend into a lunge, then return to standing |
| Bicep curl | Front or slight-angle view; both arms visible | Either elbow bends, then fully extends |
| High knees | Front view; full body and both feet visible | Each knee that rises to roughly a 90° bend counts once |
| Wall sit | Side view; wall, full body, and feet visible | Timer runs while knees and hips hold roughly 90° |

## Quick start

### 1. Clone the project

```powershell
git clone https://github.com/ayushpathak-957/Repetition-Counter-.git
cd Repetition-Counter-
```

### 2. Create and activate a virtual environment

```powershell
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
```

If PowerShell blocks activation, run this once for the current terminal session:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

### 3. Install dependencies and launch

```powershell
python -m pip install -r requirements.txt
python main.py
```

No browser is required. A desktop window opens with the camera on the left and the exercise selector on the right.

## How to use it

1. Select an exercise in the right-side menu. The highlighted item is the analyser used by the backend.
2. Read the camera-position hint below the selected exercise.
3. Click **Start camera**.
4. Keep your full body in frame, follow the skeleton, and complete a full movement cycle.
5. Use **Reset reps** to start a fresh set; use **Voice on/off** to control spoken feedback.

The colour of the skeleton matches the live status:

- Green: good form or recognised exercise position
- Red: sustained bad form
- Amber: set-up / positioning guidance

## Form and repetition rules

The app uses [MediaPipe Pose Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker) to obtain body landmarks, then applies a small state machine to stable, smoothed landmark angles or distances. A movement must cross both endpoints of its range before the counter increases, which rejects partial repetitions and ordinary camera jitter.

Push-ups and squats include basic form guards. Jumping jacks and lunges intentionally use a pure two-position count with no bad-form voice warning.

High knees ignore hand and arm movement entirely. Stand facing the camera, with the camera far enough back to keep both feet visible. A leg is re-armed only after it returns close to straight, then it counts when that knee bends to approximately 90° (up to 115° to allow for normal pose-estimation variation).

For wall sits, shoot from the side at about hip height and make sure the wall, head, hips, knees, and feet are visible. Keep your back against the wall, thighs parallel to the floor, shins nearly vertical, and knees above your ankles. This is a timed hold: the display changes to `TIME mm:ss`, runs only while the pose is recognised, and pauses when you stand up or leave the position.

## Camera troubleshooting

- Close Zoom, Teams, browser tabs, OBS virtual camera, and Windows Camera before starting.
- If the camera is not index `0`, run `python main.py --camera 1` (then try `2`).
- Use steady lighting and wear clothing that contrasts with the background.
- For floor exercises, place the camera low and far enough back to show wrists, hips, knees, and ankles.
- For standing exercises, place the camera far enough back to show both feet throughout the movement.

## Add an exercise

The extension point is deliberately small: [exercise_engine.py](exercise_engine.py) contains one self-contained analyser per exercise, while [main.py](main.py) owns the camera, skeleton drawing, desktop UI, voice, and selector.

To add an exercise:

1. Create a class that extends `Analyzer`.
2. Define `ExerciseInfo` with the visible name, camera hint, and user instruction.
3. Implement `evaluate(points)`, returning an `Evaluation` with a label, form state, and metrics.
4. Use `self.phase` to represent the movement phases and call `self.finish_rep(...)` only after a complete cycle.
5. Register the class in `EXERCISES` at the bottom of `exercise_engine.py`.

Example skeleton:

```python
class NewExerciseAnalyzer(Analyzer):
    info = ExerciseInfo("new_exercise", "New exercise", "Side view", "Short instruction")

    def evaluate(self, points):
        # 1. Validate required landmarks / starting position.
        # 2. Calculate a joint angle or normalized distance.
        # 3. Switch self.phase at the first endpoint.
        # 4. Call self.finish_rep(False) after the return endpoint.
        return Evaluation("GOOD FORM", False)

EXERCISES["new_exercise"] = NewExerciseAnalyzer
```

The selector updates automatically from that registry—no UI changes are necessary.

## Project structure

```text
main.py                    Desktop UI, camera loop, skeleton overlay, Windows speech
exercise_engine.py          One analyser class per exercise and the shared registry
pose_landmarker_lite.task   Local lightweight MediaPipe pose model
requirements.txt            Python dependencies
```

## Notes

This is a pose-based training aid, not medical advice. If an exercise causes pain, stop and consult a qualified professional.

## License

Add a license before distributing modified versions publicly.
