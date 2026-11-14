import { useEffect, useRef, useState } from 'react';
import type { AvatarId } from '../avatars';
import { createAvatar, loadAvatar } from './avatarRig.js';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { Exercise } from '../types';
import { addLights, clipFor, createChair, loadModel, viewFor } from './library';
import { Loader2 } from 'lucide-react';

export default function ExerciseViewer({
  exercise,
  playing,
  speed,
  avatar,
}: {
  exercise: Exercise;
  playing: boolean;
  speed: number;
  avatar: AvatarId;
}) {
  const [status, setStatus] = useState('Loading 3D avatar...');
  const playback = useRef({ playing, speed });
  playback.current = { playing, speed };
  const mount = useRef<HTMLDivElement>(null);
  const actionRef = useRef<THREE.AnimationAction | null>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);

  useEffect(() => {
    if (actionRef.current) actionRef.current.paused = !playing;
  }, [playing]);

  useEffect(() => {
    if (mixerRef.current) mixerRef.current.timeScale = speed;
  }, [speed]);

  useEffect(() => {
    const node = mount.current;
    if (!node) return;
    let disposed = false,
      raf = 0,
      hold = 0;
    setStatus('Loading 3D motion model...');
    let adapter: ReturnType<typeof createAvatar> | undefined;
    let figure: THREE.Object3D | undefined, chair: THREE.Group | undefined;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0e1726); // modern deep navy/slate studio
    addLights(scene);

    // Grid studio floor
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(2.6, 48),
      new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        roughness: 0.85,
        metalness: 0.15,
      })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.01;
    scene.add(floor);

    // Subtle outer ring glow
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(2.55, 2.62, 48),
      new THREE.MeshBasicMaterial({ color: 0x10b981, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    scene.add(ring);

    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 30);
    const view = viewFor(exercise);
    camera.position.set(...view[0]);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    node.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(...view[1]);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 0.8;
    controls.maxDistance = 8;
    controls.update();

    const resize = () => {
      if (!node) return;
      const { width, height } = node.getBoundingClientRect();
      if (width && height) {
        renderer.setSize(width, height);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      }
    };
    const ro = new ResizeObserver(resize);
    ro.observe(node);
    resize();

    const clock = new THREE.Clock();
    let mixer: THREE.AnimationMixer | undefined;

    Promise.all([
      loadModel(),
      avatar === 'wood' ? Promise.resolve(null) : loadAvatar(avatar).catch(() => null),
    ])
      .then(([source, template]) => {
        if (disposed) return;
        figure = clone(source);
        figure.traverse((o) => {
          if ((o as THREE.SkinnedMesh).isSkinnedMesh) {
            (o as THREE.SkinnedMesh).frustumCulled = false;
          }
        });

        if (template) {
          try {
            adapter = createAvatar(figure, template, exercise.id);
            scene.add(adapter.figure);
          } catch {
            scene.add(figure);
          }
        } else {
          scene.add(figure);
        }

        if (exercise.seated) {
          chair = createChair();
          scene.add(chair);
        }

        const clip = clipFor(exercise, source);
        if (!clip) throw new Error('Exercise animation unavailable');

        mixer = new THREE.AnimationMixer(figure);
        mixerRef.current = mixer;
        const action = mixer.clipAction(clip);
        actionRef.current = action;
        mixer.timeScale = playback.current.speed;

        if (exercise.once) {
          action.setLoop(THREE.LoopOnce, 1);
          action.clampWhenFinished = true;
          mixer.addEventListener('finished', () => {
            hold = 2;
          });
        }

        action.play();
        action.paused = !playback.current.playing;
        mixer.update(0);
        adapter?.update();
        setStatus('');
      })
      .catch((error) => {
        if (!disposed) setStatus(`Preview unavailable: ${error.message}`);
      });

    const render = () => {
      raf = requestAnimationFrame(render);
      const dt = Math.min(clock.getDelta(), 0.05);
      if (!document.hidden) {
        if (playback.current.playing) {
          if (hold > 0) {
            hold -= dt * playback.current.speed;
            if (hold <= 0) actionRef.current?.reset().play();
          } else {
            mixer?.update(dt);
          }
        }
        adapter?.update();
        controls.update();
        renderer.render(scene, camera);
      }
    };
    render();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      mixer?.stopAllAction();
      if (figure) {
        mixer?.uncacheRoot(figure);
        figure.traverse((o) => {
          if ((o as THREE.SkinnedMesh).isSkinnedMesh) {
            (o as THREE.SkinnedMesh).skeleton.dispose();
          }
        });
      }
      adapter?.dispose();
      chair?.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
      });
      floor.geometry.dispose();
      (floor.material as THREE.Material).dispose();
      ring.geometry.dispose();
      (ring.material as THREE.Material).dispose();
      renderer.dispose();
      renderer.domElement.remove();
      actionRef.current = null;
      mixerRef.current = null;
    };
  }, [exercise, avatar]);

  return (
    <div
      className="relative w-full h-[380px] sm:h-[460px] md:h-[520px] rounded-2xl overflow-hidden bg-slate-950/80 border border-emerald-500/20 select-none shadow-2xl"
      aria-label={`${exercise.en ?? 'Exercise'} 3D animation`}
    >
      <div ref={mount} className="w-full h-full cursor-grab active:cursor-grabbing" />
      {status ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/70 backdrop-blur-sm z-10 p-4 text-center">
          <Loader2 className="w-8 h-8 text-emerald-400 animate-spin mb-3" />
          <p className="text-sm font-medium text-emerald-200">{status}</p>
        </div>
      ) : null}
      <div className="absolute bottom-3 right-3 text-[11px] text-slate-400 bg-slate-900/80 backdrop-blur px-2.5 py-1 rounded-full border border-slate-700/50 pointer-events-none hidden sm:block">
        Drag to rotate · Scroll to zoom
      </div>
    </div>
  );
}