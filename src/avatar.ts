import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRM, VRMLoaderPlugin, VRMUtils, VRMExpressionPresetName } from "@pixiv/three-vrm";

const MODEL_PATH = "/models/6493143135142452442.vrm";

// ─── State ────────────────────────────────────────────────────────────────────

let vrm: VRM | null = null;
let isTalking = false;
let targetExpression: VRMExpressionPresetName | null = null;
let currentExpressionWeight = 0;

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

// Legs / locomotion
let isWalking = false;
let walkDirection: "left" | "right" | null = null;
let walkCycle = 0;

// Jump
let isJumping = false;
let jumpCycle = 0;

// Wave
let isWaving = false;
let wavePhase = 0;
let waveDuration = 0;

// Gesture system
interface ArmPose {
  lUpperArm: THREE.Euler;
  rUpperArm: THREE.Euler;
  lLowerArm: THREE.Euler;
  rLowerArm: THREE.Euler;
  lShoulder:  THREE.Euler;
  rShoulder:  THREE.Euler;
}

const POSES: Record<string, ArmPose> = {
  rest: {
    lUpperArm: new THREE.Euler( 0.12, 0,     0.06),
    rUpperArm: new THREE.Euler( 0.12, 0,    -0.06),
    lLowerArm: new THREE.Euler( 0.18, 0,     0.02),
    rLowerArm: new THREE.Euler( 0.18, 0,    -0.02),
    lShoulder:  new THREE.Euler( 0,    0,     0.02),
    rShoulder:  new THREE.Euler( 0,    0,    -0.02),
  },
  raiseLeft: {
    lUpperArm: new THREE.Euler(-0.45, 0.1,   0.22),
    rUpperArm: new THREE.Euler( 0.12, 0,    -0.06),
    lLowerArm: new THREE.Euler( 0.35, 0,     0.04),
    rLowerArm: new THREE.Euler( 0.18, 0,    -0.02),
    lShoulder:  new THREE.Euler(-0.08, 0,     0.06),
    rShoulder:  new THREE.Euler( 0,    0,    -0.02),
  },
  raiseRight: {
    lUpperArm: new THREE.Euler( 0.12, 0,     0.06),
    rUpperArm: new THREE.Euler(-0.45,-0.1,  -0.22),
    lLowerArm: new THREE.Euler( 0.18, 0,     0.02),
    rLowerArm: new THREE.Euler( 0.35, 0,    -0.04),
    lShoulder:  new THREE.Euler( 0,    0,     0.02),
    rShoulder:  new THREE.Euler(-0.08, 0,    -0.06),
  },
  bothUp: {
    lUpperArm: new THREE.Euler(-0.28, 0.04,  0.18),
    rUpperArm: new THREE.Euler(-0.28,-0.04, -0.18),
    lLowerArm: new THREE.Euler( 0.28, 0,     0.04),
    rLowerArm: new THREE.Euler( 0.28, 0,    -0.04),
    lShoulder:  new THREE.Euler(-0.05, 0,     0.05),
    rShoulder:  new THREE.Euler(-0.05, 0,    -0.05),
  },
  expressiveLeft: {
    lUpperArm: new THREE.Euler(-0.2,  0.2,   0.5),
    rUpperArm: new THREE.Euler( 0.05, 0,    -0.18),
    lLowerArm: new THREE.Euler( 0.6,  0.1,   0.1),
    rLowerArm: new THREE.Euler( 0.05, 0,    -0.04),
    lShoulder:  new THREE.Euler(-0.05, 0,     0.1),
    rShoulder:  new THREE.Euler( 0,    0,    -0.04),
  },
  happy: {
    lUpperArm: new THREE.Euler(-0.45, 0.1,   0.45),
    rUpperArm: new THREE.Euler(-0.45,-0.1,  -0.45),
    lLowerArm: new THREE.Euler( 0.4,  0,     0.08),
    rLowerArm: new THREE.Euler( 0.4,  0,    -0.08),
    lShoulder:  new THREE.Euler(-0.1,  0,     0.1),
    rShoulder:  new THREE.Euler(-0.1,  0,    -0.1),
  },
  sad: {
    lUpperArm: new THREE.Euler( 0.2,  0,     0.08),
    rUpperArm: new THREE.Euler( 0.2,  0,    -0.08),
    lLowerArm: new THREE.Euler( 0.5,  0,     0.06),
    rLowerArm: new THREE.Euler( 0.5,  0,    -0.06),
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

function randomGestureInterval() { return 1.8 + Math.random() * 2.5; }

// ─── Helpers ─────────────────────────────────────────────────────────────────

function randomBlink() { return 2.8 + Math.random() * 4.0; }
function randomIdleLook() { return 3.0 + Math.random() * 5.0; }
function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function lerpAngle(a: number, b: number, t: number) { return lerp(a, b, t); }
function clamp(v: number, min: number, max: number) { return Math.max(min, Math.min(max, v)); }

// ─── Init ─────────────────────────────────────────────────────────────────────

export function initAvatar(canvas: HTMLCanvasElement): () => void {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setClearColor(0x000000, 0);
  renderer.setSize(canvas.clientWidth, canvas.clientHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(22, canvas.clientWidth / canvas.clientHeight, 0.1, 20);
  camera.position.set(0, 0.9, 3.8);
  camera.lookAt(0, 0.85, 0);

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
    VRMUtils.rotateVRM0(loaded);
    vrm = loaded;
    scene.add(vrm.scene);
    console.log("[DIANA] VRM loaded");
  },
  (p) => console.log(`[DIANA] Loading: ${((p.loaded / p.total) * 100).toFixed(0)}%`),
  (e) => console.error("[DIANA] Load error:", e));

  // Mouse tracking
  const onMouseMove = (e: MouseEvent) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  };
  window.addEventListener("mousemove", onMouseMove);

  // Resize
  const onResize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  window.addEventListener("resize", onResize);

  // Loop
  const clock = new THREE.Clock();
  let rafId: number;

  function animate() {
    rafId = requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);

    if (vrm) {
      updateMouseTracking(dt);
      updateBlink(dt);
      updateBreathing(dt);
      updateIdleLook(dt);
      updateArms(dt);
      updateLegs(dt);
      if (isJumping) updateJump(dt);
      if (isWaving) updateWave(dt);
      if (isTalking) { updateLipSync(dt); updateHeadBob(dt); }
      else { fadeOutLipSync(dt); }
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

// ─── Mouse / Head / Eye tracking ─────────────────────────────────────────────

function updateMouseTracking(dt: number) {
  if (!vrm?.humanoid) return;

  // Target head angles from mouse — subtle range
  targetHeadEuler.y = mouse.x * 0.25;
  targetHeadEuler.x = mouse.y * 0.18;

  // Smooth lerp head
  currentHeadEuler.x = lerpAngle(currentHeadEuler.x, targetHeadEuler.x, dt * 4.5);
  currentHeadEuler.y = lerpAngle(currentHeadEuler.y, targetHeadEuler.y, dt * 4.5);

  const headBone = vrm.humanoid.getRawBoneNode("head");
  if (headBone) {
    headBone.rotation.x = currentHeadEuler.x;
    headBone.rotation.y = currentHeadEuler.y;
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

  breathPhase += dt * (isTalking ? 1.1 : 0.75);
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
    nextIdleLookAt = randomIdleLook();
    // Pick a random subtle look direction
    idleLookTarget.set(
      (Math.random() - 0.5) * 0.4,
      (Math.random() - 0.5) * 0.2
    );
  }

  // Blend idle look into the mouse target
  targetHeadEuler.y += idleLookTarget.x * 0.15;
  targetHeadEuler.x += idleLookTarget.y * 0.1;
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
  headBobPhase += dt * 3.5;

  const headBone = vrm.humanoid.getRawBoneNode("head");
  if (headBone) {
    headBone.rotation.z = Math.sin(headBobPhase) * 0.018;
    headBone.rotation.x += Math.sin(headBobPhase * 0.7) * 0.008;
  }
}

// ─── Expression blending ─────────────────────────────────────────────────────

function applyExpression(dt: number) {
  if (!vrm?.expressionManager || !targetExpression) return;

  currentExpressionWeight = lerp(currentExpressionWeight, 1.0, dt * 5);
  vrm.expressionManager.setValue(targetExpression, currentExpressionWeight);
  vrm.update(dt);
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
      bone.rotation.x = euler.x;
      bone.rotation.y = euler.y;
      bone.rotation.z = euler.z;
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

    applyPoseToSkeleton(3.5, dt);
  } else {
    // Return to rest with idle breathing sway
    const basePose = copyPose(POSES.rest);
    const sway = Math.sin(armIdlePhase) * 0.012;
    const swayY = Math.sin(armIdlePhase * 0.6) * 0.006;
    basePose.lUpperArm.z += sway;
    basePose.rUpperArm.z -= sway;
    basePose.lUpperArm.x += swayY;
    basePose.rUpperArm.x += swayY;
    targetPose = basePose;

    applyPoseToSkeleton(2.5, dt);
  }
}

// ─── Legs ─────────────────────────────────────────────────────────────────────

function setBone(name: string, x: number, y = 0, z = 0) {
  const bone = vrm!.humanoid?.getRawBoneNode(name as any);
  if (bone) { bone.rotation.x = x; bone.rotation.y = y; bone.rotation.z = z; }
}

function lerpBone(name: string, tx: number, ty: number, tz: number, t: number) {
  const bone = vrm!.humanoid?.getRawBoneNode(name as any);
  if (!bone) return;
  bone.rotation.x = lerp(bone.rotation.x, tx, t);
  bone.rotation.y = lerp(bone.rotation.y, ty, t);
  bone.rotation.z = lerp(bone.rotation.z, tz, t);
}

function updateLegs(dt: number) {
  if (!vrm?.humanoid) return;

  if (isWalking) {
    walkCycle += dt * 3.8;
    const L = Math.sin(walkCycle);
    const R = Math.sin(walkCycle + Math.PI);

    // Upper legs swing
    setBone("leftUpperLeg",  L * 0.38);
    setBone("rightUpperLeg", R * 0.38);

    // Lower legs bend on backswing
    setBone("leftLowerLeg",  Math.max(0, -L) * 0.55);
    setBone("rightLowerLeg", Math.max(0, -R) * 0.55);

    // Feet angle with step
    setBone("leftFoot",  -L * 0.18);
    setBone("rightFoot", -R * 0.18);

    // Hip sway side to side
    const hipBone = vrm.humanoid.getRawBoneNode("hips");
    if (hipBone) hipBone.rotation.z = Math.sin(walkCycle * 0.5) * 0.04;

    // Face direction
    if (vrm.scene) {
      const targetY = walkDirection === "left" ? Math.PI * 0.15 : -Math.PI * 0.15;
      vrm.scene.rotation.y = lerp(vrm.scene.rotation.y, targetY, dt * 6);
    }
  } else {
    // Return legs to neutral
    const t = dt * 4;
    lerpBone("leftUpperLeg",  0, 0, 0, t);
    lerpBone("rightUpperLeg", 0, 0, 0, t);
    lerpBone("leftLowerLeg",  0, 0, 0, t);
    lerpBone("rightLowerLeg", 0, 0, 0, t);
    lerpBone("leftFoot",      0, 0, 0, t);
    lerpBone("rightFoot",     0, 0, 0, t);

    if (vrm.scene) {
      vrm.scene.rotation.y = lerp(vrm.scene.rotation.y, 0, dt * 4);
    }
  }
}

// ─── Jump ─────────────────────────────────────────────────────────────────────

function updateJump(dt: number) {
  if (!vrm?.humanoid) return;

  jumpCycle += dt * 2.4;
  const t = clamp(jumpCycle / Math.PI, 0, 1);
  const arc = Math.sin(jumpCycle);

  // Anticipation squat → launch → land
  const bend = arc > 0 ? -arc * 0.3 : arc * 0.2;

  setBone("leftUpperLeg",  bend * 0.8);
  setBone("rightUpperLeg", bend * 0.8);
  setBone("leftLowerLeg",  Math.max(0, -bend) * 1.2);
  setBone("rightLowerLeg", Math.max(0, -bend) * 1.2);

  // Arms rise at peak
  const armLift = Math.max(0, arc) * 0.5;
  const lArm = vrm.humanoid.getRawBoneNode("leftUpperArm");
  const rArm = vrm.humanoid.getRawBoneNode("rightUpperArm");
  if (lArm) lArm.rotation.z = lerp(lArm.rotation.z, 0.06 + armLift, dt * 10);
  if (rArm) rArm.rotation.z = lerp(rArm.rotation.z, -0.06 - armLift, dt * 10);

  void t;
}

// ─── Wave ─────────────────────────────────────────────────────────────────────

function updateWave(dt: number) {
  if (!vrm?.humanoid) return;

  wavePhase += dt * 6;
  waveDuration += dt;

  // Right arm waves
  const wave = Math.sin(wavePhase) * 0.4;
  const rUpper = vrm.humanoid.getRawBoneNode("rightUpperArm");
  const rLower = vrm.humanoid.getRawBoneNode("rightLowerArm");
  if (rUpper) {
    rUpper.rotation.x = lerp(rUpper.rotation.x, -0.9, dt * 6);
    rUpper.rotation.z = lerp(rUpper.rotation.z, -0.3 + wave, dt * 6);
  }
  if (rLower) {
    rLower.rotation.x = lerp(rLower.rotation.x, 0.6, dt * 6);
  }

  // Head tilt toward wave side
  const headBone = vrm.humanoid.getRawBoneNode("head");
  if (headBone) headBone.rotation.z = lerp(headBone.rotation.z, -0.12, dt * 4);
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

export function setWalking(dir: "left" | "right" | null) {
  walkDirection = dir;
  isWalking = dir !== null;
  if (!isWalking) walkCycle = 0;
}

export function setJumping(state: boolean) {
  isJumping = state;
  if (state) jumpCycle = 0;
}

export function setWaving(state: boolean) {
  isWaving = state;
  if (state) { wavePhase = 0; waveDuration = 0; }
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

  // Fade out all expressions
  const all: VRMExpressionPresetName[] = [
    VRMExpressionPresetName.Happy,
    VRMExpressionPresetName.Sad,
    VRMExpressionPresetName.Angry,
    VRMExpressionPresetName.Surprised,
  ];
  all.forEach((e) => vrm!.expressionManager!.setValue(e, 0));

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
