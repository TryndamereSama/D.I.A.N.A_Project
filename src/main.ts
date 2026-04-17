import "./style.css";
import { initAvatar, setTalking, setExpression } from "./avatar";
import { sendMessage } from "./claude";

const canvas = document.getElementById("avatar-canvas") as HTMLCanvasElement;
const inputEl = document.getElementById("user-input") as HTMLInputElement;
const sendBtn = document.getElementById("send-btn") as HTMLButtonElement;
const chatBubble = document.getElementById("chat-bubble") as HTMLDivElement;
const chatText = document.getElementById("chat-text") as HTMLDivElement;

// Init 3D avatar
initAvatar(canvas);

// UI logic
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

      // Auto-hide bubble after 8s of silence
      setTimeout(() => {
        hideBubble();
        setExpression("neutral");
      }, 8000);
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
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
});
