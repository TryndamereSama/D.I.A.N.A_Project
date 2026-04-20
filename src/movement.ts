import { setAvatarTargetX } from "./avatar";

export type MoveState = "idle" | "idle_look";

let stateTimer = 0;
let nextChange = randomIdle();
let worldX = 0;

function randomIdle() { return 6 + Math.random() * 10; }

export function initMovement() {
  worldX = 0;
  setAvatarTargetX(worldX);
}

export function updateMovement(dt: number) {
  stateTimer += dt;

  if (stateTimer >= nextChange) {
    stateTimer = 0;
    nextChange = randomIdle();
    // Small drift — window is narrow, keep avatar roughly centered
    worldX = (Math.random() - 0.5) * 0.5;
    setAvatarTargetX(worldX);
  }
}
