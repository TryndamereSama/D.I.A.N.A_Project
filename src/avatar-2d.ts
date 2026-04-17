import lottie, { AnimationItem } from "lottie-web";

const ANIMATIONS = {
  idle:     "/animations/idle.json",
  talking:  "/animations/talking.json",
  thinking: "/animations/thinking.json",
  happy:    "/animations/happy.json",
  sad:      "/animations/sad.json",
};

type AnimationName = keyof typeof ANIMATIONS;

let current: AnimationItem | null = null;
let container: HTMLElement | null = null;
let activeState: AnimationName = "idle";

export function initAvatar(canvas: HTMLCanvasElement): () => void {
  // Lottie renders into a div, not canvas — swap element
  const parent = canvas.parentElement!;
  canvas.style.display = "none";

  container = document.createElement("div");
  container.id = "lottie-container";
  container.style.cssText = `
    position: fixed;
    top: 0; left: 0;
    width: 100%; height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
  `;
  parent.appendChild(container);

  playAnimation("idle");

  return () => {
    current?.destroy();
    container?.remove();
  };
}

function playAnimation(name: AnimationName, loop = true) {
  if (activeState === name && current) return;

  current?.destroy();
  activeState = name;

  current = lottie.loadAnimation({
    container: container!,
    renderer: "svg",
    loop,
    autoplay: true,
    path: ANIMATIONS[name],
  });

  // If non-looping animation finishes, return to idle
  if (!loop) {
    current.addEventListener("complete", () => {
      playAnimation("idle");
    });
  }
}

export function setTalking(state: boolean) {
  playAnimation(state ? "talking" : "idle");
}

export function setExpression(
  name: "happy" | "sad" | "angry" | "surprised" | "neutral"
) {
  const map: Partial<Record<string, AnimationName>> = {
    happy:     "happy",
    sad:       "sad",
    neutral:   "idle",
    surprised: "happy",
    angry:     "sad",
  };

  const anim = map[name] ?? "idle";
  const loop = anim === "idle";
  playAnimation(anim, loop);
}
