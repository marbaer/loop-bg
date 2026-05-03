import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Environment, MeshTransmissionMaterial } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import type { R3FPreset, SceneProps } from "./types";

// Liquid Glass — refractive 3D blobs floating in front of an HDRI environment.
// The transmission material gives true refraction + chromatic aberration; the
// HDRI is what's seen *through* and *reflected on* the glass, which is what
// makes this read as actual glass instead of "lit blobs".
//
// Drives all motion from the t parameter (in [0,1)) for deterministic
// playback — preview-loop and any future export pipeline can sample any
// frame deterministically. Animation is sin/cos based at integer cycle
// counts → seamless loop.

const TAU = Math.PI * 2;

interface BlobConfig {
  basePos: [number, number, number];
  orbitRadius: number;
  orbitAxis: [number, number, number];
  orbitCycles: number;
  spinCycles: [number, number, number];
  scale: number;
  detail: number;
}

function makeBlobs(seed: number, count: number): BlobConfig[] {
  const out: BlobConfig[] = [];
  for (let i = 0; i < count; i++) {
    const r = Math.sin(seed * 7.13 + i * 2.31);
    const r2 = Math.cos(seed * 3.71 + i * 1.97);
    const r3 = Math.sin(seed * 11.3 + i * 0.89);
    out.push({
      basePos: [
        r * 1.6 + (i - (count - 1) / 2) * 1.2,
        r2 * 0.4,
        r3 * 0.5 - i * 0.3,
      ],
      orbitRadius: 0.18 + Math.abs(r2) * 0.15,
      orbitAxis: [r, 1, r3],
      orbitCycles: 1 + (i % 2),
      spinCycles: [1 + (i % 3), 1 + ((i + 1) % 3), 1 + ((i + 2) % 3)],
      scale: 0.7 + Math.abs(r) * 0.5,
      detail: i % 2 === 0 ? 0 : 1,
    });
  }
  return out;
}

function Blob({
  config,
  t,
  primaryColor,
  thickness,
  chromaticAberration,
  ior,
  roughness,
}: {
  config: BlobConfig;
  t: number;
  primaryColor: string;
  thickness: number;
  chromaticAberration: number;
  ior: number;
  roughness: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    const m = meshRef.current;
    if (!m) return;

    // Position: base + orbit on a tilted axis, integer-cycle for seamless loop.
    const phi = TAU * t * config.orbitCycles;
    const ax = config.orbitAxis;
    const norm = Math.hypot(ax[0], ax[1], ax[2]) || 1;
    const a0 = ax[0] / norm;
    const a1 = ax[1] / norm;
    const a2 = ax[2] / norm;

    // Tangent vector roughly perpendicular to axis for orbit plane.
    const tx = a1 * Math.sin(phi) - a2 * Math.cos(phi);
    const ty = a2 * Math.sin(phi * 1.0) - a0 * Math.cos(phi);
    const tz = a0 * Math.sin(phi * 1.0) - a1 * Math.cos(phi);
    const tnorm = Math.hypot(tx, ty, tz) || 1;

    m.position.set(
      config.basePos[0] + (tx / tnorm) * config.orbitRadius,
      config.basePos[1] + (ty / tnorm) * config.orbitRadius,
      config.basePos[2] + (tz / tnorm) * config.orbitRadius
    );

    // Spin: integer cycles per axis.
    m.rotation.set(
      TAU * t * config.spinCycles[0] * 0.25,
      TAU * t * config.spinCycles[1] * 0.25,
      TAU * t * config.spinCycles[2] * 0.25
    );
  });

  return (
    <mesh ref={meshRef} scale={config.scale}>
      <icosahedronGeometry args={[1, 4]} />
      <MeshTransmissionMaterial
        backside
        backsideThickness={thickness * 0.5}
        thickness={thickness}
        roughness={roughness}
        chromaticAberration={chromaticAberration}
        anisotropy={0.2}
        ior={ior}
        transmission={1}
        distortion={0.4}
        distortionScale={0.5}
        temporalDistortion={0}
        color={primaryColor}
        attenuationDistance={2.5}
        attenuationColor={primaryColor}
        samples={6}
        resolution={512}
      />
    </mesh>
  );
}

function LiquidGlassScene({ params, palette, t }: SceneProps) {
  const blobCount = Math.max(1, Math.min(5, Math.round(params.u_blob_count ?? 3)));
  const blobs = makeBlobs(params.u_seed ?? 1.42, blobCount);

  const envPreset = (() => {
    const idx = Math.round(params.u_env ?? 1);
    const presets = ["studio", "city", "sunset", "dawn", "warehouse", "forest", "apartment", "park", "lobby", "night"];
    return (presets[Math.min(presets.length - 1, Math.max(0, idx))] ?? "city") as
      | "studio"
      | "city"
      | "sunset"
      | "dawn"
      | "warehouse"
      | "forest"
      | "apartment"
      | "park"
      | "lobby"
      | "night";
  })();

  return (
    <>
      <color attach="background" args={[palette.bg]} />
      {/* HDRI environment (drei bundles the EXR files for these presets). */}
      <Environment preset={envPreset} background={false} environmentIntensity={params.u_env_intensity ?? 1.0} />

      {/* Subtle accent fill light from below to keep glass from going black at the bottom. */}
      <pointLight position={[0, -3, 1]} intensity={0.4} color={palette.primary} />
      <pointLight position={[3, 2, 2]} intensity={0.6} color={palette.secondary} />

      {blobs.map((cfg, i) => (
        <Blob
          key={i}
          config={cfg}
          t={t}
          primaryColor={palette.primary}
          thickness={params.u_thickness ?? 0.5}
          chromaticAberration={params.u_aberration ?? 0.06}
          ior={params.u_ior ?? 1.4}
          roughness={params.u_roughness ?? 0.05}
        />
      ))}

      <EffectComposer multisampling={0} disableNormalPass>
        <Bloom
          intensity={params.u_bloom ?? 0.4}
          luminanceThreshold={0.6}
          luminanceSmoothing={0.4}
          mipmapBlur
        />
      </EffectComposer>
    </>
  );
}

export const liquidGlass: R3FPreset = {
  kind: "r3f",
  id: "liquid-glass",
  name: "Liquid Glass",
  description: "Refractive 3D glass blobs in HDRI environment. Apple Vision Pro vibe.",
  Scene: LiquidGlassScene,
  schema: [
    { kind: "int", key: "u_blob_count", label: "Blobs", min: 1, max: 5, default: 3 },
    { kind: "int", key: "u_env", label: "Environment", min: 0, max: 9, default: 1 },
    { kind: "range", key: "u_env_intensity", label: "Env intensity", min: 0.2, max: 2.0, step: 0.05, default: 1.0 },
    { kind: "range", key: "u_thickness", label: "Glass thickness", min: 0.1, max: 1.5, step: 0.02, default: 0.5 },
    { kind: "range", key: "u_aberration", label: "Chromatic aberration", min: 0, max: 0.25, step: 0.005, default: 0.06 },
    { kind: "range", key: "u_ior", label: "Index of refraction", min: 1.0, max: 2.0, step: 0.02, default: 1.42 },
    { kind: "range", key: "u_roughness", label: "Roughness", min: 0, max: 0.4, step: 0.01, default: 0.05 },
    { kind: "range", key: "u_bloom", label: "Bloom", min: 0, max: 1.5, step: 0.05, default: 0.4 },
    { kind: "seed", key: "u_seed", label: "Seed", default: 1.42 },
  ],
  defaults: {
    u_blob_count: 3,
    u_env: 1,
    u_env_intensity: 1.0,
    u_thickness: 0.5,
    u_aberration: 0.06,
    u_ior: 1.42,
    u_roughness: 0.05,
    u_bloom: 0.4,
    u_seed: 1.42,
  },
};
