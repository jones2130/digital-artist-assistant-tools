import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export interface LightingOptions {
  preset: string;
  keyAngleDeg: number;
  contrastBoost: number;
}

interface ThreeViewportProps {
  sceneGroup?: THREE.Group | THREE.Object3D | null;
  lighting?: LightingOptions;
  height?: string | number;
}

export const ThreeViewport: React.FC<ThreeViewportProps> = ({
  sceneGroup,
  lighting = { preset: 'Rembrandt Lighting (Dramatic Chiaroscuro)', keyAngleDeg: 45, contrastBoost: 2.0 },
  height = '520px',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const keyLightRef = useRef<THREE.DirectionalLight | null>(null);
  const fillLightRef = useRef<THREE.DirectionalLight | null>(null);
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null);
  const activeContentGroup = useRef<THREE.Group>(new THREE.Group());

  useEffect(() => {
    if (!containerRef.current) return;

    const width = containerRef.current.clientWidth || 600;
    const h = containerRef.current.clientHeight || 520;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#111827'); // dark slate
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / h, 0.1, 1000);
    camera.position.set(0, 0.5, 20);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    rendererRef.current = renderer;

    containerRef.current.appendChild(renderer.domElement);

    // OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controlsRef.current = controls;

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambientLight);
    ambientLightRef.current = ambientLight;

    const keyLight = new THREE.DirectionalLight(0xfff5ea, 1.2);
    keyLight.position.set(5, 5, 10);
    scene.add(keyLight);
    keyLightRef.current = keyLight;

    const fillLight = new THREE.DirectionalLight(0xdce7ff, 0.3);
    fillLight.position.set(-5, -2, 5);
    scene.add(fillLight);
    fillLightRef.current = fillLight;

    // Content group
    scene.add(activeContentGroup.current);

    // Animation Loop
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Resize Observer
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        const newH = entry.contentRect.height || 520;
        if (w > 0 && newH > 0 && cameraRef.current && rendererRef.current) {
          cameraRef.current.aspect = w / newH;
          cameraRef.current.updateProjectionMatrix();
          rendererRef.current.setSize(w, newH);
        }
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      if (renderer.domElement && containerRef.current) {
        containerRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  // Update lights based on lighting props
  useEffect(() => {
    if (!keyLightRef.current || !fillLightRef.current || !ambientLightRef.current) return;

    const rad = (lighting.keyAngleDeg * Math.PI) / 180;
    const radius = 12;
    keyLightRef.current.position.set(radius * Math.sin(rad), 4, radius * Math.cos(rad));
    fillLightRef.current.position.set(-radius * Math.sin(rad), -2, radius * Math.cos(rad));

    const { preset, contrastBoost } = lighting;

    if (preset === 'Caravaggio Extreme Chiaroscuro') {
      ambientLightRef.current.intensity = 0.05;
      keyLightRef.current.intensity = 2.0 * contrastBoost;
      fillLightRef.current.intensity = 0.05;
    } else if (preset === 'Rembrandt Lighting (Dramatic Chiaroscuro)') {
      ambientLightRef.current.intensity = 0.1;
      keyLightRef.current.intensity = 1.6 * contrastBoost;
      fillLightRef.current.intensity = 0.1;
    } else if (preset === 'High-Key Studio (Bright & Soft)') {
      ambientLightRef.current.intensity = 0.8;
      keyLightRef.current.intensity = 0.6;
      fillLightRef.current.intensity = 0.4;
    } else if (preset === 'Flat Studio Clay') {
      ambientLightRef.current.intensity = 1.2;
      keyLightRef.current.intensity = 0.0;
      fillLightRef.current.intensity = 0.0;
    } else {
      // Three-Point Studio
      ambientLightRef.current.intensity = 0.3;
      keyLightRef.current.intensity = 1.2 * contrastBoost;
      fillLightRef.current.intensity = 0.25;
    }
  }, [lighting]);

  // Update content group
  useEffect(() => {
    const group = activeContentGroup.current;
    while (group.children.length > 0) {
      const child = group.children[0];
      group.remove(child);
    }

    if (sceneGroup) {
      group.add(sceneGroup);

      // Auto-fit camera to bounding box
      const bbox = new THREE.Box3().setFromObject(sceneGroup);
      const center = bbox.getCenter(new THREE.Vector3());
      const size = bbox.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);

      if (maxDim > 0 && cameraRef.current && controlsRef.current) {
        const fov = cameraRef.current.fov * (Math.PI / 180);
        let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.8;
        cameraZ = Math.max(cameraZ, 5);

        cameraRef.current.position.set(center.x, center.y + size.y * 0.1, center.z + cameraZ);
        cameraRef.current.lookAt(center);
        controlsRef.current.target.copy(center);
        controlsRef.current.update();
      }
    }
  }, [sceneGroup]);

  return (
    <div
      ref={containerRef}
      className="relative w-full rounded-xl overflow-hidden shadow-2xl border border-slate-700 bg-slate-900 cursor-grab active:cursor-grabbing"
      style={{ height: typeof height === 'number' ? `${height}px` : height }}
    >
      <div className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-md px-3 py-1 rounded-md text-xs text-slate-300 pointer-events-none border border-slate-700">
        🖱️ Rotate: Left Click | Pan: Shift+Click / Right Click | Zoom: Scroll
      </div>
    </div>
  );
};

