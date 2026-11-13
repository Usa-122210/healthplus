"""Desktop exercise coach. Select Push-up, Squat, or Jumping Jack, then start the camera."""
from __future__ import annotations

import argparse
import time
import tkinter as tk
from pathlib import Path
from tkinter import messagebox

import cv2
import mediapipe as mp
from PIL import Image, ImageTk
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

from exercise_engine import EXERCISES, Analyzer, Evaluation


TASK_MODEL = Path(__file__).with_name("pose_landmarker_lite.task")
BAD_FORM_MESSAGE = "Wrong form. Please correct your posture."
CONNECTIONS = ((0,1),(1,2),(2,3),(3,7),(0,4),(4,5),(5,6),(6,8),(9,10),(11,12),(11,13),(13,15),(15,17),(15,19),(15,21),(17,19),(12,14),(14,16),(16,18),(16,20),(16,22),(18,20),(11,23),(12,24),(23,24),(23,25),(25,27),(27,29),(29,31),(31,27),(24,26),(26,28),(28,30),(30,32),(32,28))


class Speech:
    ASYNC, PURGE = 1, 2
    def __init__(self) -> None:
        self.enabled, self.was_bad, self.last_spoken, self.voice = True, False, 0.0, None
        try:
            import win32com.client
            self.voice = win32com.client.Dispatch("SAPI.SpVoice")
        except Exception as error:
            print(f"Voice feedback unavailable: {error}"); self.enabled = False

    def update(self, bad: bool, muted: bool) -> None:
        if not self.enabled or self.voice is None: return
        if not bad or muted:
            if self.was_bad:
                try: self.voice.Speak("", self.ASYNC | self.PURGE)
                except Exception: pass
            self.was_bad = False; return
        now = time.monotonic()
        if not self.was_bad or now - self.last_spoken >= 2.6:
            try: self.voice.Speak(BAD_FORM_MESSAGE, self.ASYNC | self.PURGE); self.last_spoken = now
            except Exception as error: print(f"Voice feedback error: {error}"); self.enabled = False
        self.was_bad = True

    def stop(self) -> None:
        if self.voice is not None and self.was_bad:
            try: self.voice.Speak("", self.ASYNC | self.PURGE)
            except Exception: pass
        self.was_bad = False


def draw_skeleton(frame: object, points: list[object], color: tuple[int, int, int]) -> None:
    height, width = frame.shape[:2]
    def px(point: object) -> tuple[int, int]: return int(point.x * width), int(point.y * height)
    for start, end in CONNECTIONS:
        if getattr(points[start], "visibility", 1.0) > .40 and getattr(points[end], "visibility", 1.0) > .40:
            cv2.line(frame, px(points[start]), px(points[end]), color, 2, cv2.LINE_AA)
    for point in points:
        if getattr(point, "visibility", 1.0) > .40: cv2.circle(frame, px(point), 3, color, -1, cv2.LINE_AA)


def open_camera(index: int) -> cv2.VideoCapture:
    capture = cv2.VideoCapture(index, cv2.CAP_DSHOW)
    if not capture.isOpened(): capture.release(); capture = cv2.VideoCapture(index)
    for key, value in ((cv2.CAP_PROP_FRAME_WIDTH,640),(cv2.CAP_PROP_FRAME_HEIGHT,480),(cv2.CAP_PROP_FPS,30),(cv2.CAP_PROP_BUFFERSIZE,1)): capture.set(key,value)
    return capture


class CoachApp:
    BG, PANEL, CARD, TEXT, MUTED, LIME, RED, AMBER = "#0c181a", "#102326", "#152d30", "#edf5f2", "#9fb1ac", "#c6f06e", "#ff8175", "#f1ba5b"
    def __init__(self, root: tk.Tk, camera_index: int) -> None:
        self.root, self.camera_index = root, camera_index
        self.capture: cv2.VideoCapture | None = None
        self.landmarker: vision.PoseLandmarker | None = None
        self.active_id, self.analyzer = "pushup", EXERCISES["pushup"]()
        self.speech, self.muted, self.running, self.last_time, self.fps = Speech(), False, False, time.perf_counter(), 0.0
        self.root.title("Health Plus · Exercise Coach")
        self.root.configure(bg=self.BG); self.root.minsize(1040, 650); self.root.protocol("WM_DELETE_WINDOW", self.close)
        self.build_ui(); self.select_exercise("pushup")

    def build_ui(self) -> None:
        shell = tk.Frame(self.root, bg=self.BG); shell.pack(fill="both", expand=True, padx=20, pady=20)
        header = tk.Frame(shell, bg=self.BG); header.pack(fill="x", pady=(0,15))
        tk.Label(header, text="FORMWISE", bg=self.BG, fg=self.TEXT, font=("Segoe UI",18,"bold")).pack(side="left")
        tk.Label(header, text="Health Plus prototype · pose-based rep tracking", bg=self.BG, fg=self.MUTED, font=("Segoe UI",10)).pack(side="left", padx=14)
        body = tk.Frame(shell, bg=self.BG); body.pack(fill="both", expand=True)
        left = tk.Frame(body, bg=self.PANEL, highlightbackground="#284144", highlightthickness=1); left.pack(side="left", fill="both", expand=True)
        camera_header = tk.Frame(left, bg=self.PANEL); camera_header.pack(fill="x", padx=18, pady=15)
        self.status = tk.Label(camera_header, text="READY TO START", bg=self.PANEL, fg=self.AMBER, font=("Segoe UI",12,"bold")); self.status.pack(side="left")
        self.start_button = tk.Button(camera_header, text="Start camera", command=self.start_camera, relief="flat", bd=0, bg=self.LIME, fg="#102022", font=("Segoe UI",10,"bold"), padx=12, pady=5, cursor="hand2"); self.start_button.pack(side="left", padx=(14, 0))
        self.rep_label = tk.Label(camera_header, text="REPS  0", bg=self.PANEL, fg=self.TEXT, font=("Consolas",19,"bold")); self.rep_label.pack(side="right")
        self.video = tk.Label(left, text="Select an exercise on the right, then press Start camera", bg="#081113", fg=self.MUTED, font=("Segoe UI",14), compound="center"); self.video.pack(fill="both", expand=True, padx=14, pady=(0,10))
        footer = tk.Frame(left, bg=self.PANEL); footer.pack(fill="x", padx=18, pady=(0,14))
        self.feedback = tk.Label(footer, text="Camera is off", bg=self.PANEL, fg=self.MUTED, font=("Segoe UI",10)); self.feedback.pack(side="left")
        self.fps_label = tk.Label(footer, text="", bg=self.PANEL, fg=self.MUTED, font=("Consolas",9)); self.fps_label.pack(side="right")
        right_shell = tk.Frame(body, bg=self.PANEL, width=280, highlightbackground="#284144", highlightthickness=1); right_shell.pack(side="right", fill="y", padx=(15,0)); right_shell.pack_propagate(False)
        scrollbar = tk.Scrollbar(right_shell, orient="vertical")
        scrollbar.pack(side="right", fill="y")
        self.exercise_canvas = tk.Canvas(right_shell, bg=self.PANEL, highlightthickness=0, bd=0, yscrollcommand=scrollbar.set)
        self.exercise_canvas.pack(side="left", fill="both", expand=True)
        scrollbar.config(command=self.exercise_canvas.yview)
        right = tk.Frame(self.exercise_canvas, bg=self.PANEL)
        panel_window = self.exercise_canvas.create_window((0, 0), window=right, anchor="nw")
        right.bind("<Configure>", lambda _event: self.exercise_canvas.configure(scrollregion=self.exercise_canvas.bbox("all")))
        self.exercise_canvas.bind("<Configure>", lambda event: self.exercise_canvas.itemconfigure(panel_window, width=event.width))
        self.root.bind_all("<MouseWheel>", self.scroll_exercise_panel, add="+")
        tk.Label(right, text="CHOOSE EXERCISE", bg=self.PANEL, fg=self.LIME, font=("Consolas",10,"bold")).pack(anchor="w", padx=20, pady=(21,8))
        self.exercise_buttons: dict[str, tk.Button] = {}
        for identifier, cls in EXERCISES.items():
            button = tk.Button(right, text=cls.info.name, anchor="w", command=lambda item=identifier: self.select_exercise(item), relief="flat", bd=0, padx=14, pady=11, font=("Segoe UI",11,"bold"), cursor="hand2")
            button.pack(fill="x", padx=15, pady=3); self.exercise_buttons[identifier] = button
        tk.Frame(right, bg="#284144", height=1).pack(fill="x", padx=20, pady=18)
        self.exercise_name = tk.Label(right, text="", bg=self.PANEL, fg=self.TEXT, font=("Segoe UI",16,"bold"), wraplength=235, justify="left"); self.exercise_name.pack(anchor="w", padx=20)
        self.hint = tk.Label(right, text="", bg=self.PANEL, fg=self.LIME, font=("Segoe UI",10,"bold"), wraplength=235, justify="left"); self.hint.pack(anchor="w", padx=20, pady=(6,10))
        self.instruction = tk.Label(right, text="", bg=self.PANEL, fg=self.MUTED, font=("Segoe UI",10), wraplength=235, justify="left"); self.instruction.pack(anchor="w", padx=20)
        controls = tk.Frame(right, bg=self.PANEL); controls.pack(fill="x", padx=20, pady=(26, 0))
        self.reset_button = tk.Button(controls, text="Reset reps", command=self.reset_reps, relief="flat", bg=self.CARD, fg=self.TEXT, padx=8, pady=8, font=("Segoe UI",9), cursor="hand2"); self.reset_button.pack(side="left", fill="x", expand=True, padx=(0,4))
        self.mute_button = tk.Button(controls, text="Voice on", command=self.toggle_mute, relief="flat", bg=self.CARD, fg=self.LIME, padx=8, pady=8, font=("Segoe UI",9), cursor="hand2"); self.mute_button.pack(side="right", fill="x", expand=True, padx=(4,0))
        tk.Label(right, text="Voice correction only plays during sustained bad form. It stops immediately when form becomes correct.", bg=self.PANEL, fg="#718782", wraplength=235, justify="left", font=("Segoe UI",8)).pack(anchor="w", padx=20, pady=16)

    def scroll_exercise_panel(self, event: tk.Event) -> None:
        """Keep the full exercise selector reachable on smaller displays."""
        if event.delta:
            self.exercise_canvas.yview_scroll(-1 if event.delta > 0 else 1, "units")

    def select_exercise(self, identifier: str) -> None:
        self.active_id, self.analyzer = identifier, EXERCISES[identifier]()
        info = self.analyzer.info
        self.exercise_name.config(text=info.name); self.hint.config(text=info.camera_hint); self.instruction.config(text=info.instruction)
        for item, button in self.exercise_buttons.items():
            selected = item == identifier
            button.config(bg=self.LIME if selected else self.CARD, fg="#102022" if selected else self.TEXT)
        self.reset_button.config(text="Reset timer" if self.analyzer.uses_timer else "Reset reps")
        self.speech.stop(); self.refresh_text(Evaluation("READY TO START", False))

    def reset_reps(self) -> None:
        self.analyzer.reset(); self.refresh_text(Evaluation("REPS RESET", False))

    def toggle_mute(self) -> None:
        self.muted = not self.muted
        if self.muted: self.speech.stop()
        self.mute_button.config(text="Voice off" if self.muted else "Voice on", fg=self.MUTED if self.muted else self.LIME)

    def start_camera(self) -> None:
        if self.running: self.stop_camera(); return
        if not TASK_MODEL.exists(): messagebox.showerror("Missing model", f"{TASK_MODEL.name} is missing."); return
        capture = open_camera(self.camera_index)
        if not capture.isOpened():
            messagebox.showerror("Camera unavailable", f"Could not open camera {self.camera_index}. Close other camera apps or restart with --camera 1.")
            return
        try:
            options = vision.PoseLandmarkerOptions(base_options=python.BaseOptions(model_asset_path=str(TASK_MODEL)), running_mode=vision.RunningMode.VIDEO, num_poses=1, min_pose_detection_confidence=.55, min_pose_presence_confidence=.55, min_tracking_confidence=.55)
            self.landmarker = vision.PoseLandmarker.create_from_options(options)
        except Exception as error:
            capture.release(); messagebox.showerror("Pose model error", str(error)); return
        self.capture, self.running, self.last_time = capture, True, time.perf_counter()
        self.start_button.config(text="Stop camera", bg=self.RED, fg="#2a0e0b"); self.update_frame()

    def stop_camera(self) -> None:
        self.running = False; self.speech.stop()
        if self.capture: self.capture.release(); self.capture = None
        if self.landmarker: self.landmarker.close(); self.landmarker = None
        self.video.config(image="", text="Camera stopped. Select an exercise or start another set.")
        self.start_button.config(text="Start camera", bg=self.LIME, fg="#102022")

    def refresh_text(self, evaluation: Evaluation) -> None:
        label = evaluation.label; bad, good = label.startswith("BAD FORM"), label.startswith("GOOD FORM") or label.endswith("POSITION")
        color = self.RED if bad else self.LIME if good else self.AMBER
        self.status.config(text=label, fg=color); self.feedback.config(text=label, fg=color if good or bad else self.MUTED)
        self.rep_label.config(text=self.analyzer.counter_text())

    def update_frame(self) -> None:
        if not self.running or not self.capture or not self.landmarker: return
        ok, frame = self.capture.read()
        if not ok: self.stop_camera(); messagebox.showerror("Camera error", "Camera frame read failed."); return
        frame = cv2.flip(frame, 1)
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        result = self.landmarker.detect_for_video(mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb), int(time.monotonic() * 1000))
        points = result.pose_landmarks[0] if result.pose_landmarks else None
        evaluation = self.analyzer.evaluate(points)
        bad, good = evaluation.label.startswith("BAD FORM"), evaluation.label.startswith("GOOD FORM") or evaluation.label.endswith("POSITION")
        color = (55,70,240) if bad else (55,210,100) if good else (0,190,255)
        if points: draw_skeleton(frame, points, color)
        self.speech.update(evaluation.sustained_bad, self.muted); self.refresh_text(evaluation)
        now = time.perf_counter(); self.fps = .9 * self.fps + .1 / max(now - self.last_time, .0001); self.last_time = now
        metric = f"{evaluation.primary_name} {evaluation.primary:.0f}" if evaluation.primary is not None else ""
        self.fps_label.config(text=f"{metric}   FPS {self.fps:.0f}")
        image = ImageTk.PhotoImage(Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)))
        self.video.config(image=image, text=""); self.video.image = image
        self.root.after(12, self.update_frame)

    def close(self) -> None:
        self.stop_camera(); self.root.destroy()


def main() -> None:
    parser = argparse.ArgumentParser(description="Desktop multi-exercise form coach")
    parser.add_argument("--camera", type=int, default=0, help="camera index; default 0")
    args = parser.parse_args()
    root = tk.Tk(); CoachApp(root, args.camera); root.mainloop()


if __name__ == "__main__": main()
