import "./style.css";
import { initAvatar, setTalking, setExpression } from "./avatar";
import { sendMessage } from "./claude";
import { initMovement, updateMovement } from "./movement";

const canvas     = document.getElementById("avatar-canvas") as HTMLCanvasElement;
const inputEl    = document.getElementById("user-input") as HTMLInputElement;
const sendBtn    = document.getElementById("send-btn") as HTMLButtonElement;
const chatBubble = document.getElementById("chat-bubble") as HTMLDivElement;
const chatText   = document.getElementById("chat-text") as HTMLDivElement;

// Place compact widget at bottom-right corner
const WIDGET_W = 380; // logical px
const WIDGET_H = 570;
const WIDGET_MARGIN = 12;
const TASKBAR_H = 48; // approximate Windows taskbar

async function fitToMonitor() {
  try {
    const { getCurrentWindow, LogicalSize, LogicalPosition } =
      await import("@tauri-apps/api/window");
    const win = getCurrentWindow();
    const sw = window.screen.width;
    const sh = window.screen.height;
    await win.setSize(new LogicalSize(WIDGET_W, WIDGET_H));
    await win.setPosition(new LogicalPosition(
      sw - WIDGET_W - WIDGET_MARGIN,
      sh - WIDGET_H - TASKBAR_H,
    ));
  } catch (e) {
    console.error("[DIANA] fitToMonitor error:", e);
  }
}

fitToMonitor();

// Click-through: poll OS cursor position every 50ms via Rust command.
// setIgnoreCursorEvents(true) stops JS mouse events — can't use mousemove alone.
async function initClickThrough() {
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    const { invoke } = await import("@tauri-apps/api/core");
    const win = getCurrentWindow();
    const chatUI = document.getElementById("chat-ui")!;

    setInterval(async () => {
      const [cx, cy] = await invoke<[number, number]>("get_cursor_pos");
      const pos  = await win.outerPosition();
      const sf   = window.devicePixelRatio || 1;
      // Convert physical screen coords → logical window-local coords
      const lx = (cx - pos.x) / sf;
      const ly = (cy - pos.y) / sf;
      const r  = chatUI.getBoundingClientRect();
      const overChat = lx >= r.left && lx <= r.right && ly >= r.top && ly <= r.bottom;
      win.setIgnoreCursorEvents(!overChat);
    }, 50);
  } catch {
    // browser dev mode — skip
  }
}

initClickThrough();

// Init 3D avatar (owns the render loop)
initAvatar(canvas);

// Init + tick movement inside avatar's RAF via a shared clock
initMovement();

let lastMovementTime = performance.now();
function movementLoop() {
  const now = performance.now();
  const dt  = Math.min((now - lastMovementTime) / 1000, 0.05);
  lastMovementTime = now;
  updateMovement(dt);
  requestAnimationFrame(movementLoop);
}
movementLoop();

// ── UI ────────────────────────────────────────────────────────────────────────

function showBubble(text: string) {
  chatBubble.classList.remove("hidden");
  chatText.textContent = text;
  chatBubble.scrollTop = chatBubble.scrollHeight;
}

function hideBubble() {
  chatBubble.classList.add("hidden");
  chatText.textContent = "";
}

function setInputBusy(busy: boolean) {
  inputEl.disabled = busy;
  sendBtn.disabled = busy;
}

async function handleSend() {
  const message = inputEl.value.trim();
  if (!message) return;

  inputEl.value = "";
  setInputBusy(true);
  setTalking(true);
  setExpression("neutral");
  let responseText = "";
  showBubble("...");

  await sendMessage(
    message,
    (chunk) => {
      responseText += chunk;
      showBubble(responseText);
    },
    () => {
      setTalking(false);
      setExpression("happy");
      setInputBusy(false);
      setTimeout(() => { hideBubble(); setExpression("neutral"); }, 8000);
    },
    (err) => {
      setTalking(false);
      setInputBusy(false);
      showBubble(`Erro: ${err}`);
      setExpression("sad");
    }
  );
}

sendBtn.addEventListener("click", handleSend);
inputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
});

