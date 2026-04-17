/// <reference types="vite/client" />
const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY as string;
const API_URL = "https://api.anthropic.com/v1/messages";

const SYSTEM_PROMPT = `Você é D.I.A.N.A (Digital Intelligence for Adaptive Neural Assistance), uma assistente de IA pessoal que roda no notebook do seu criador como um avatar virtual.

Você é inteligente, direta e levemente sarcástica — mas sempre útil. Respostas curtas e naturais como conversa. Quando fizer piadas ou comentários irônicos, mantenha breve.

Responda sempre em português do Brasil, a menos que o usuário fale em outro idioma.`;

const history: { role: "user" | "assistant"; content: string }[] = [];

export async function sendMessage(
  userMessage: string,
  onChunk: (chunk: string) => void,
  onDone: () => void,
  onError: (err: string) => void
) {
  if (!API_KEY) {
    onError("VITE_ANTHROPIC_API_KEY não configurada no .env");
    return;
  }

  history.push({ role: "user", content: userMessage });

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: history,
        stream: true,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      onError(`API error ${response.status}: ${err}`);
      return;
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let fullResponse = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const lines = decoder.decode(value).split("\n");

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") continue;

        try {
          const event = JSON.parse(data);

          if (
            event.type === "content_block_delta" &&
            event.delta?.type === "text_delta"
          ) {
            const chunk = event.delta.text as string;
            fullResponse += chunk;
            onChunk(chunk);
          }
        } catch {
          // skip malformed SSE lines
        }
      }
    }

    history.push({ role: "assistant", content: fullResponse });
    onDone();
  } catch (err) {
    onError(String(err));
  }
}

export function clearHistory() {
  history.length = 0;
}
