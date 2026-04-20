import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRM, VRMLoaderPlugin, VRMUtils, VRMExpressionPresetName } from "@pixiv/three-vrm";

const MODEL_PATH = "/models/6493143135142452442.vrm";

// ─── State ────────────────────────────────────────────────────────────────────

let vrm: VRM | null = null;
let isTalking = false;
let targetExpression: VRMExpressionPresetName | null = null;
let currentExpressionWeight = 0;
let prevExpression: VRMExpressionPresetName | null = null;
let prevExpressionWeight = 0;

// Mouse tracking
const mouse = new THREE.Vector2(0, 0);
const targetHeadEuler = new THREE.Euler(0, 0, 0);
const currentHeadEuler = new THREE.Euler(0, 0, 0);
const targetEyeOffset = new THREE.Vector2(0, 0);
const currentEyeOffset = new THREE.Vector2(0, 0);

// Blink
let blinkTimer = 0;
let nextBlinkAt = randomBlink();
let isBlinking = false;
let blinkPhase = 0;
let doubleBlink = false;
let doubleBlinkPending = false;

// Breathing
let breathPhase = 0;

// Idle look
let idleLookTimer = 0;
let nextIdleLookAt = randomIdleLook();
let idleLookTarget = new THREE.Vector2(0, 0);
let targetHeadTiltZ = 0; // random head tilt Z added on idle look change

// Idle body sway
let idleSwayPhase = 0;

// Idle expression cycling
let idleExprTimer = 0;
let nextIdleExprAt = 12 + Math.random() * 15;
const IDLE_EXPR_POOL: Array<"happy" | "neutral" | "surprised"> =
  ["neutral", "neutral", "neutral", "happy", "happy", "surprised"];

// Talking
let talkPhase = 0;
const VISEMES: VRMExpressionPresetName[] = ["aa", "ih", "ou", "ee", "oh"];
let visemeIndex = 0;
let visemeTimer = 0;
let nextVisemeAt = 0;
let currentVisemeWeight = 0;

// Head bob while talking
let headBobPhase = 0;

// Arms
let armIdlePhase = 0;

// Gesture system
interface ArmPose {
  lUpperArm: THREE.Euler;
  rUpperArm: THREE.Euler;
  lLowerArm: THREE.Euler;
  rLowerArm: THREE.Euler;
  lShoulder:  THREE.Euler;
  rShoulder:  THREE.Euler;
}

// VRM1 arm Z convention: lUpperArm.z negative = arm down; rUpperArm.z positive = arm down
const POSES: Record<string, ArmPose> = {
  rest: {
    lUpperArm: new THREE.Euler( 0.1,  0,    -1.1),
    rUpperArm: new THREE.Euler( 0.1,  0,     1.1),
    lLowerArm: new THREE.Euler( 0.35, 0,     0),
    rLowerArm: new THREE.Euler( 0.35, 0,     0),
    lShoulder:  new THREE.Euler( 0,    0,     0.05),
    rShoulder:  new THREE.Euler( 0,    0,    -0.05),
  },
  raiseLeft: {
    lUpperArm: new THREE.Euler(-0.5,  0.1,  -0.4),
    rUpperArm: new THREE.Euler( 0.1,  0,     1.1),
    lLowerArm: new THREE.Euler( 0.5,  0,     0),
    rLowerArm: new THREE.Euler( 0.35, 0,     0),
    lShoulder:  new THREE.Euler(-0.1,  0,     0.1),
    rShoulder:  new THREE.Euler( 0,    0,    -0.05),
  },
  raiseRight: {
    lUpperArm: new THREE.Euler( 0.1,  0,    -1.1),
    rUpperArm: new THREE.Euler(-0.5, -0.1,   0.4),
    lLowerArm: new THREE.Euler( 0.35, 0,     0),
    rLowerArm: new THREE.Euler( 0.5,  0,     0),
    lShoulder:  new THREE.Euler( 0,    0,     0.05),
    rShoulder:  new THREE.Euler(-0.1,  0,    -0.1),
  },
  bothUp: {
    lUpperArm: new THREE.Euler(-0.4,  0.04, -0.5),
    rUpperArm: new THREE.Euler(-0.4, -0.04,  0.5),
    lLowerArm: new THREE.Euler( 0.45, 0,     0),
    rLowerArm: new THREE.Euler( 0.45, 0,     0),
    lShoulder:  new THREE.Euler(-0.08, 0,     0.08),
    rShoulder:  new THREE.Euler(-0.08, 0,    -0.08),
  },
  expressiveLeft: {
    lUpperArm: new THREE.Euler(-0.3,  0.2,  -0.6),
    rUpperArm: new THREE.Euler( 0.05, 0,     1.05),
    lLowerArm: new THREE.Euler( 0.6,  0.1,   0),
    rLowerArm: new THREE.Euler( 0.1,  0,     0),
    lShoulder:  new THREE.Euler(-0.08, 0,     0.1),
    rShoulder:  new THREE.Euler( 0,    0,    -0.05),
  },
  happy: {
    lUpperArm: new THREE.Euler(-0.5,  0.1,  -0.55),
    rUpperArm: new THREE.Euler(-0.5, -0.1,   0.55),
    lLowerArm: new THREE.Euler( 0.5,  0,     0),
    rLowerArm: new THREE.Euler( 0.5,  0,     0),
    lShoulder:  new THREE.Euler(-0.1,  0,     0.1),
    rShoulder:  new THREE.Euler(-0.1,  0,    -0.1),
  },
  sad: {
    lUpperArm: new THREE.Euler( 0.2,  0,    -0.95),
    rUpperArm: new THREE.Euler( 0.2,  0,     0.95),
    lLowerArm: new THREE.Euler( 0.5,  0,     0),
    rLowerArm: new THREE.Euler( 0.5,  0,     0),
    lShoulder:  new THREE.Euler( 0.05, 0,     0.02),
    rShoulder:  new THREE.Euler( 0.05, 0,    -0.02),
  },
};

type PoseName = keyof typeof POSES;

const TALK_GESTURES: PoseName[] = ["raiseLeft", "raiseRight", "bothUp", "expressiveLeft"];

let currentPose: ArmPose = copyPose(POSES.rest);
let targetPose:  ArmPose = copyPose(POSES.rest);
let gestureTimer = 0;
let nextGestureAt = randomGestureInterval();

function copyPose(p: ArmPose): ArmPose {
  return {
    lUpperArm: p.lUpperArm.clone(),
    rUpperArm: p.rUpperArm.clone(),
    lLowerArm: p.lLowerArm.clone(),
    rLowerArm: p.rLowerArm.clone(),
    lShoulder:  p.lShoulder.clone(),
    rShoulder:  p.rShoulder.clone(),
  };
}

function randomGestureInterval() { return 1.0 + Math.random() * 1.5; }

// ─── World constants ──────────────────────────────────────────────────────────

export const WORLD_H = 10.0; // world units visible vertically
const AVATAR_SCALE    = 9.0;    // tune: bigger = avatar larger on screen
const BASE_ROT_Y      = Math.PI; // VRM must face +Z toward camera at Z=5
const HEAD_SCREEN_Y   = 7.5;    // lower = more room for hair above head bone

export function screenXToWorldX(px: number, sw: number, sh: number): number {
  const worldW = WORLD_H * (sw / sh);
  return (px / sw - 0.5) * worldW;
}

// ─── Position / inertia ───────────────────────────────────────────────────────

let avatarTargetX  = 0;
let avatarCurrentX = 0;
let avatarVelocityX = 0;
let groundY = 0; // Y where feet rest; set after VRM load
let vrmVersion: "0" | "1" = "1"; // VRM0 arm Z convention is inverted after rotateVRM0

export function setAvatarTargetX(worldX: number) {
  avatarTargetX = worldX;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function randomBlink() { return 2.8 + Math.random() * 4.0; }
function randomIdleLook() { return 3.0 + Math.random() * 5.0; }
function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function lerpAngle(a: number, b: number, t: number) { return lerp(a, b, t); }
function clamp(v: number, min: number, max: number) { return Math.max(min, Math.min(max, v)); }
// VRM0 after rotateVRM0: 180° Y root rotation inverts arm-bone Z from camera's POV
function az(z: number) { return vrmVersion === "0" ? -z : z; }

// ─── Init ─────────────────────────────────────────────────────────────────────

export function initAvatar(canvas: HTMLCanvasElement): () => void {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setClearColor(0x000000, 0);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();

  // Orthographic camera — correct aspect ratio, no distortion
  function makeOrtho() {
    const sw = window.innerWidth, sh = window.innerHeight;
    const worldW = WORLD_H * (sw / sh);
    const cam = new THREE.OrthographicCamera(-worldW / 2, worldW / 2, WORLD_H, 0, 0.1, 20);
    cam.position.set(0, 0, 5);
    cam.lookAt(0, 0, 0);
    return cam;
  }
  let camera = makeOrtho();

  // Lighting
  scene.add(new THREE.AmbientLight(0xffeeff, 0.55));

  const key = new THREE.DirectionalLight(0xfff5e0, 1.3);
  key.position.set(1.5, 2.5, 2);
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xd0e8ff, 0.5);
  fill.position.set(-2, 1.5, 1);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0x9966ff, 0.35);
  rim.position.set(-0.5, 2, -2.5);
  scene.add(rim);

  // Load VRM
  const loader = new GLTFLoader();
  loader.register((p) => new VRMLoaderPlugin(p));

  loader.load(MODEL_PATH, (gltf) => {
    const loaded = gltf.userData.vrm as VRM;
    VRMUtils.removeUnnecessaryVertices(gltf.scene);
    VRMUtils.combineSkeletons(gltf.scene);
    vrmVersion = (loaded.meta as any).metaVersion === "0" ? "0" : "1";
    if (vrmVersion === "0") VRMUtils.rotateVRM0(loaded);
    vrm = loaded;
    scene.add(vrm.scene);

    vrm.scene.scale.set(AVATAR_SCALE, AVATAR_SCALE, AVATAR_SCALE);
    vrm.scene.rotation.y = BASE_ROT_Y;
    vrm.update(0);
    const box = new THREE.Box3().setFromObject(vrm.scene);
    // Anchor on head bone — bounding box unreliable (long hair skews it)
    const headBone = vrm.humanoid?.getRawBoneNode("head");
    const headPos  = new THREE.Vector3();
    if (headBone) headBone.getWorldPosition(headPos);
    // Shift avatar so head appears at HEAD_SCREEN_Y
    groundY = HEAD_SCREEN_Y - headPos.y;
    vrm.scene.position.y = groundY;
    console.log(`[DIANA] VRM loaded — scale:${AVATAR_SCALE} headY:${headPos.y.toFixed(2)} groundY:${groundY.toFixed(2)} height:${(box.max.y - box.min.y).toFixed(2)}u`);
  },
  (p) => console.log(`[DIANA] Loading: ${((p.loaded / p.total) * 100).toFixed(0)}%`),
  (e) => console.error("[DIANA] Load error:", e));

  // Mouse tracking
  const onMouseMove = (e: MouseEvent) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  };
  window.addEventListener("mousemove", onMouseMove);

  // Resize — rebuild ortho camera
  const onResize = () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera = makeOrtho();
  };
  window.addEventListener("resize", onResize);

  // Loop
  const clock = new THREE.Clock();
  let rafId: number;

  function animate() {
    rafId = requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);

    if (vrm) {
      updatePosition(dt);
      vrm.update(dt);        // runs first: syncs normalized→raw bones, spring physics
      // manual bone overrides applied AFTER vrm.update so they aren't reset
      updateMouseTracking(dt);
      updateBlink(dt);
      updateBreathing(dt);
      updateIdleLook(dt);
      updateIdleSway(dt);
      updateArms(dt);
      if (isTalking) { updateLipSync(dt); updateHeadBob(dt); }
      else { fadeOutLipSync(dt); updateIdleExpression(dt); }
      applyExpression(dt);
    }

    renderer.render(scene, camera);
  }
  animate();

  return () => {
    cancelAnimationFrame(rafId);
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("resize", onResize);
    renderer.dispose();
  };
}

// ─── Idle sway ───────────────────────────────────────────────────────────────

function updateIdleSway(dt: number) {
  if (!vrm?.humanoid) return;
  idleSwayPhase += dt * 0.65;

  const sideS  = Math.sin(idleSwayPhase) * 0.022;
  const fwdS   = Math.sin(idleSwayPhase * 0.6) * 0.012;
  const t      = dt * 1.8;

  const spine = vrm.humanoid.getRawBoneNode("spine");
  if (spine) {
    spine.rotation.z = lerp(spine.rotation.z, sideS, t);
    spine.rotation.x = lerp(spine.rotation.x, fwdS, t);
  }
  const chest = vrm.humanoid.getRawBoneNode("chest");
  if (chest) chest.rotation.z = lerp(chest.rotation.z, sideS * 0.6, t);

  const hips = vrm.humanoid.getRawBoneNode("hips");
  if (hips) hips.rotation.z = lerp(hips.rotation.z, -sideS * 0.4, t);
}

// ─── Idle expression cycling ─────────────────────────────────────────────────

function updateIdleExpression(dt: number) {
  idleExprTimer += dt;
  if (idleExprTimer >= nextIdleExprAt) {
    idleExprTimer = 0;
    nextIdleExprAt = 7 + Math.random() * 10;
    const expr = IDLE_EXPR_POOL[Math.floor(Math.random() * IDLE_EXPR_POOL.length)];
    setExpression(expr);
  }
}

// ─── Position with inertia ───────────────────────────────────────────────────

function updatePosition(dt: number) {
  if (!vrm?.scene) return;

  // Smooth damp X toward target
  const diff = avatarTargetX - avatarCurrentX;
  avatarVelocityX += diff * dt * 6;
  avatarVelocityX *= Math.pow(0.04, dt); // damping
  avatarCurrentX += avatarVelocityX * dt;

  vrm.scene.position.x = avatarCurrentX;

  vrm.scene.position.y = lerp(vrm.scene.position.y, groundY, dt * 8);
}

// ─── Mouse / Head / Eye tracking ─────────────────────────────────────────────

function updateMouseTracking(dt: number) {
  if (!vrm?.humanoid) return;

  // Target head angles from mouse — subtle range
  targetHeadEuler.y = mouse.x * 0.25;
  targetHeadEuler.x = mouse.y * 0.18;

  // Smooth lerp head
  currentHeadEuler.x = lerpAngle(currentHeadEuler.x, targetHeadEuler.x, dt * 4.5);
  currentHeadEuler.y = lerpAngle(currentHeadEuler.y, targetHeadEuler.y, dt * 4.5);

  currentHeadEuler.z = lerpAngle(currentHeadEuler.z, targetHeadTiltZ, dt * 2.5);

  const headBone = vrm.humanoid.getRawBoneNode("head");
  if (headBone) {
    headBone.rotation.x = currentHeadEuler.x;
    headBone.rotation.y = currentHeadEuler.y;
    headBone.rotation.z = currentHeadEuler.z;
  }

  const neckBone = vrm.humanoid.getRawBoneNode("neck");
  if (neckBone) {
    neckBone.rotation.x = currentHeadEuler.x * 0.4;
    neckBone.rotation.y = currentHeadEuler.y * 0.35;
  }

  // Eyes follow mouse independently (wider range than head)
  targetEyeOffset.x = clamp(mouse.x * 0.6 - currentHeadEuler.y * 1.5, -0.8, 0.8);
  targetEyeOffset.y = clamp(mouse.y * 0.4 - currentHeadEuler.x * 1.2, -0.5, 0.5);

  currentEyeOffset.x = lerp(currentEyeOffset.x, targetEyeOffset.x, dt * 8);
  currentEyeOffset.y = lerp(currentEyeOffset.y, targetEyeOffset.y, dt * 8);

  if (vrm.lookAt) {
    vrm.lookAt.offsetFromHeadBone.set(0, 0.06, 0);
    vrm.lookAt.applier?.applyYawPitch(
      currentEyeOffset.x * 15,
      currentEyeOffset.y * 10
    );
  }
}

// ─── Blink ────────────────────────────────────────────────────────────────────

function updateBlink(dt: number) {
  if (!vrm?.expressionManager) return;

  blinkTimer += dt;

  if (!isBlinking && blinkTimer >= nextBlinkAt) {
    isBlinking = true;
    blinkPhase = 0;
    doubleBlink = Math.random() < 0.2; // 20% chance double blink
    doubleBlinkPending = doubleBlink;
    blinkTimer = 0;
    nextBlinkAt = randomBlink();
  }

  if (isBlinking) {
    blinkPhase += dt * 14;
    // Phase 0→1 close, 1→2 open
    let weight: number;
    if (blinkPhase < 1) {
      weight = blinkPhase;
    } else if (blinkPhase < 1.3) {
      weight = 1;
    } else if (blinkPhase < 2.3) {
      weight = 1 - (blinkPhase - 1.3);
    } else {
      weight = 0;
      isBlinking = false;

      if (doubleBlinkPending) {
        doubleBlinkPending = false;
        setTimeout(() => {
          isBlinking = true;
          blinkPhase = 0;
          doubleBlink = false;
        }, 80);
      }
    }

    vrm.expressionManager.setValue(VRMExpressionPresetName.Blink, clamp(weight, 0, 1));
  }
}

// ─── Breathing ───────────────────────────────────────────────────────────────

function updateBreathing(dt: number) {
  if (!vrm?.humanoid) return;

  breathPhase += dt * (isTalking ? 1.5 : 1.0);
  const breath = Math.sin(breathPhase);
  const breathSlow = Math.sin(breathPhase * 0.5);

  const chest = vrm.humanoid.getRawBoneNode("chest");
  if (chest) {
    chest.rotation.x = breath * 0.014;
    chest.rotation.z = breathSlow * 0.005;
  }

  const spine = vrm.humanoid.getRawBoneNode("spine");
  if (spine) {
    spine.rotation.x = breath * 0.009;
  }

  const hips = vrm.humanoid.getRawBoneNode("hips");
  if (hips) {
    hips.position.y = (hips.position.y || 0) + Math.sin(breathPhase) * 0.0003;
  }
}

// ─── Idle look-around ────────────────────────────────────────────────────────

function updateIdleLook(dt: number) {
  if (isTalking) return;

  idleLookTimer += dt;
  if (idleLookTimer >= nextIdleLookAt) {
    idleLookTimer = 0;
    nextIdleLookAt = 1.5 + Math.random() * 3.5; // more frequent
    idleLookTarget.set(
      (Math.random() - 0.5) * 0.9,  // wider horizontal
      (Math.random() - 0.5) * 0.5   // wider vertical
    );
    targetHeadTiltZ = (Math.random() - 0.5) * 0.28;
  }

  targetHeadEuler.y += idleLookTarget.x * 0.22;
  targetHeadEuler.x += idleLookTarget.y * 0.15;
}

// ─── Lip sync ────────────────────────────────────────────────────────────────

function updateLipSync(dt: number) {
  if (!vrm?.expressionManager) return;

  talkPhase += dt;
  visemeTimer += dt;

  // Switch viseme at random intervals simulating natural speech rhythm
  if (visemeTimer >= nextVisemeAt) {
    visemeTimer = 0;
    nextVisemeAt = 0.06 + Math.random() * 0.1;

    // Fade out current viseme
    const prev = VISEMES[visemeIndex];
    vrm.expressionManager.setValue(prev, 0);

    // Pick next viseme (bias toward aa/oh for natural look)
    const weights = [0.35, 0.15, 0.15, 0.15, 0.2];
    let rand = Math.random();
    let acc = 0;
    for (let i = 0; i < weights.length; i++) {
      acc += weights[i];
      if (rand < acc) { visemeIndex = i; break; }
    }
  }

  // Animate current viseme weight with natural variation
  const targetWeight = 0.5 + Math.sin(talkPhase * 9) * 0.35;
  currentVisemeWeight = lerp(currentVisemeWeight, clamp(targetWeight, 0.1, 0.9), dt * 18);
  vrm.expressionManager.setValue(VISEMES[visemeIndex], currentVisemeWeight);
}

function fadeOutLipSync(dt: number) {
  if (!vrm?.expressionManager) return;
  currentVisemeWeight = lerp(currentVisemeWeight, 0, dt * 12);
  vrm.expressionManager.setValue(VISEMES[visemeIndex], currentVisemeWeight);
}

// ─── Head bob while talking ───────────────────────────────────────────────────

function updateHeadBob(dt: number) {
  if (!vrm?.humanoid) return;
  headBobPhase += dt * 5.5;

  const headBone = vrm.humanoid.getRawBoneNode("head");
  if (headBone) {
    headBone.rotation.z = Math.sin(headBobPhase) * 0.018;
    headBone.rotation.x += Math.sin(headBobPhase * 0.7) * 0.008;
  }
}

// ─── Expression blending ─────────────────────────────────────────────────────

function applyExpression(dt: number) {
  if (!vrm?.expressionManager) return;

  // Fade out previous expression gradually (no hard snap to 0)
  if (prevExpression) {
    prevExpressionWeight = lerp(prevExpressionWeight, 0, dt * 3);
    vrm.expressionManager.setValue(prevExpression, prevExpressionWeight);
    if (prevExpressionWeight < 0.01) {
      vrm.expressionManager.setValue(prevExpression, 0);
      prevExpression = null;
      prevExpressionWeight = 0;
    }
  }

  if (!targetExpression) return;

  // Soft blend in — slow lerp, capped at 0.7 for natural look (not "face stuck on max")
  currentExpressionWeight = lerp(currentExpressionWeight, 0.7, dt * 3.0);
  vrm.expressionManager.setValue(targetExpression, currentExpressionWeight);
}

// ─── Arms ─────────────────────────────────────────────────────────────────────

function lerpEuler(current: THREE.Euler, target: THREE.Euler, t: number) {
  current.x = lerp(current.x, target.x, t);
  current.y = lerp(current.y, target.y, t);
  current.z = lerp(current.z, target.z, t);
}

function applyPoseToSkeleton(speed: number, dt: number) {
  if (!vrm?.humanoid) return;

  const t = dt * speed;

  lerpEuler(currentPose.lUpperArm, targetPose.lUpperArm, t);
  lerpEuler(currentPose.rUpperArm, targetPose.rUpperArm, t);
  lerpEuler(currentPose.lLowerArm, targetPose.lLowerArm, t);
  lerpEuler(currentPose.rLowerArm, targetPose.rLowerArm, t);
  lerpEuler(currentPose.lShoulder,  targetPose.lShoulder,  t);
  lerpEuler(currentPose.rShoulder,  targetPose.rShoulder,  t);

  const bones: [string, THREE.Euler][] = [
    ["leftUpperArm",  currentPose.lUpperArm],
    ["rightUpperArm", currentPose.rUpperArm],
    ["leftLowerArm",  currentPose.lLowerArm],
    ["rightLowerArm", currentPose.rLowerArm],
    ["leftShoulder",  currentPose.lShoulder],
    ["rightShoulder", currentPose.rShoulder],
  ];

  for (const [boneName, euler] of bones) {
    const bone = vrm.humanoid.getRawBoneNode(boneName as any);
    if (bone) {
      const isArm = boneName.includes("Arm") || boneName.includes("Shoulder");
      bone.rotation.x = euler.x;
      bone.rotation.y = euler.y;
      bone.rotation.z = isArm ? az(euler.z) : euler.z;
    }
  }
}

function updateArms(dt: number) {
  armIdlePhase += dt * 0.9;

  if (isTalking) {
    gestureTimer += dt;

    if (gestureTimer >= nextGestureAt) {
      gestureTimer = 0;
      nextGestureAt = randomGestureInterval();

      const name = TALK_GESTURES[Math.floor(Math.random() * TALK_GESTURES.length)];
      targetPose = copyPose(POSES[name]);
    }

    // Add subtle arm sway on top of gesture
    const sway = Math.sin(armIdlePhase * 1.2) * 0.018;
    targetPose.lUpperArm.z += sway;
    targetPose.rUpperArm.z -= sway;

    applyPoseToSkeleton(5.0, dt);
  } else {
    const basePose = copyPose(POSES.rest);
    const sway = Math.sin(armIdlePhase) * 0.012;
    basePose.lUpperArm.z += sway;
    basePose.rUpperArm.z -= sway;

    targetPose = basePose;
    applyPoseToSkeleton(3.5, dt);
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function setTalking(state: boolean) {
  isTalking = state;
  if (!state) {
    talkPhase = 0;
    visemeTimer = 0;
    currentVisemeWeight = 0;
  }
}

export function setExpression(
  name: "happy" | "sad" | "angry" | "surprised" | "neutral"
) {
  if (!vrm?.expressionManager) return;

  const map: Record<string, VRMExpressionPresetName | null> = {
    happy:     VRMExpressionPresetName.Happy,
    sad:       VRMExpressionPresetName.Sad,
    angry:     VRMExpressionPresetName.Angry,
    surprised: VRMExpressionPresetName.Surprised,
    neutral:   null,
  };

  // Hand off current expression to prev so it fades out softly
  if (targetExpression && targetExpression !== map[name]) {
    prevExpression = targetExpression;
    prevExpressionWeight = currentExpressionWeight;
  }

  targetExpression = map[name];
  currentExpressionWeight = 0;

  // Arm pose matches expression
  const armMap: Record<string, PoseName> = {
    happy:     "happy",
    sad:       "sad",
    angry:     "bothUp",
    surprised: "bothUp",
    neutral:   "rest",
  };
  targetPose = copyPose(POSES[armMap[name] ?? "rest"]);
}
