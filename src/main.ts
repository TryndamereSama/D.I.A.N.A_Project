import "./style.css";
import { initAvatar, setTalking, setExpression } from "./avatar";
import { sendMessage } from "./claude";
import { initMovement, updateMovement, setActiveMode } from "./movement";

const canvas    = document.getElementById("avatar-canvas") as HTMLCanvasElement;
const inputEl   = document.getElementById("user-input") as HTMLInputElement;
const sendBtn   = document.getElementById("send-btn") as HTMLButtonElement;
const chatBubble = document.getElementById("chat-bubble") as HTMLDivElement;
const chatText  = document.getElementById("chat-text") as HTMLDivElement;
const container = document.getElementById("avatar-container") as HTMLDivElement;

// Resize window to full monitor via Tauri API
async function fitToMonitor() {
  try {
    const { getCurrentWindow, availableMonitors, PhysicalSize, PhysicalPosition } = await import("@tauri-apps/api/window");
    const monitors = await availableMonitors();
    const primary = monitors[0];
    if (primary) {
      const win = getCurrentWindow();
      await win.setSize(new PhysicalSize(primary.size.width, primary.size.height));
      await win.setPosition(new PhysicalPosition(0, 0));
    }
  } catch {
    // Running in browser dev mode — skip
  }
}

fitToMonitor();

// Init 3D avatar
initAvatar(canvas);

// Init screen movement
initMovement(container);

// Movement loop (runs independent of render loop)
let lastTime = performance.now();
function movementLoop() {
  const now = performance.now();
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;
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
  setActiveMode(true);

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

      setTimeout(() => {
        hideBubble();
        setExpression("neutral");
        setActiveMode(false);
      }, 8000);
    },
    (err) => {
      setTalking(false);
      setInputBusy(false);
      showBubble(`Erro: ${err}`);
      setExpression("sad");
      setActiveMode(false);
    }
  );
}

sendBtn.addEventListener("click", handleSend);
inputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
});

// Pause movement while user is typing
inputEl.addEventListener("focus", () => setActiveMode(true));
inputEl.addEventListener("blur",  () => setActiveMode(false));
