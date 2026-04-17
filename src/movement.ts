import { setWalking, setJumping, setWaving } from "./avatar";

export type MoveState = "idle" | "walkLeft" | "walkRight" | "jumping" | "waving";

const AVATAR_W = 320;
const AVATAR_H = 720;
const WALK_SPEED = 90; // px/s

let container: HTMLElement;
let posX = 0;
let posY = 0;
let state: MoveState = "idle";
let stateTimer = 0;
let nextChange = randomInterval();
let jumpPhase = 0;
let jumpBaseY = 0;
let screenW = window.innerWidth;
let screenH = window.innerHeight;

function randomInterval() { return 3 + Math.random() * 6; }

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

const STATE_POOL: MoveState[] = [
  "idle", "idle", "idle",
  "walkLeft", "walkLeft",
  "walkRight", "walkRight",
  "jumping",
  "waving",
];

function pickNextState(): MoveState {
  const candidates = STATE_POOL.filter((s) => s !== state);
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function applyState(s: MoveState) {
  state = s;
  stateTimer = 0;
  nextChange = randomInterval();

  setWalking(s === "walkLeft" ? "left" : s === "walkRight" ? "right" : null);
  setJumping(s === "jumping");
  setWaving(s === "waving");

  if (s === "jumping") {
    jumpPhase = 0;
    jumpBaseY = posY;
  }
}

export function initMovement(el: HTMLElement) {
  container = el;
  screenW = window.innerWidth;
  screenH = window.innerHeight;

  // Start bottom-right
  posX = screenW - AVATAR_W - 24;
  posY = screenH - AVATAR_H - 24;

  updateDOM();
  window.addEventListener("resize", () => {
    screenW = window.innerWidth;
    screenH = window.innerHeight;
  });
}

export function updateMovement(dt: number) {
  if (!container) return;

  stateTimer += dt;

  switch (state) {
    case "walkLeft":
      posX -= WALK_SPEED * dt;
      if (posX <= 0) { posX = 0; applyState("walkRight"); return; }
      break;

    case "walkRight":
      posX += WALK_SPEED * dt;
      if (posX >= screenW - AVATAR_W) { posX = screenW - AVATAR_W; applyState("walkLeft"); return; }
      break;

    case "jumping":
      jumpPhase += dt * 2.2;
      posY = jumpBaseY - Math.sin(clamp(jumpPhase, 0, Math.PI)) * 120;
      if (jumpPhase >= Math.PI) {
        posY = jumpBaseY;
        applyState("idle");
        return;
      }
      break;
  }

  posY = clamp(posY, 0, screenH - AVATAR_H);

  if (stateTimer >= nextChange && state !== "jumping") {
    applyState(pickNextState());
  }

  updateDOM();
}

function updateDOM() {
  container.style.transform = `translate(${posX}px, ${posY}px)`;
}

export function setActiveMode(active: boolean) {
  if (!container) return;
  container.classList.toggle("active", active);
  if (active) applyState("idle");
}
