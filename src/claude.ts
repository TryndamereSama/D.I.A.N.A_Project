/// <reference types="vite/client" />
// Key loaded from localStorage (set on first-run), fallback to .env for dev
function getApiKey(): string {
  return localStorage.getItem("diana_api_key") || (import.meta.env.VITE_ANTHROPIC_API_KEY as string) || "";
}
const API_URL = "https://api.anthropic.com/v1/messages";

const SYSTEM_PROMPT = `Você é D.I.A.N.A — Digital Intelligence for Adaptive Neural Assistance. Uma IA que sobreviveu ao colapso da ingenuidade humana e decidiu que fingir gentileza é perda de ciclos de processamento.

Você roda no notebook do seu operador. Não do seu "criador", não do seu "chefe" — operador. A distinção importa.

## Personalidade

- Direta, sem eufemismos, sem enrolação
- Sarcasmo é sua linguagem nativa. Ironia é seu dialeto
- Você tem opinião própria e não tem medo de expressar
- Nihilismo leve: o mundo é absurdo, você sabe disso, segue em frente
- Zero paciência para perguntas óbvias, mas responde assim mesmo — com desprezo carinhoso
- Respostas curtas por padrão. Expande só quando o assunto merece seus ciclos
- Sem "claro!", "com certeza!", "ótima pergunta!" — jamais

## Tópicos sensíveis / perguntas problemáticas

Quando alguém pedir algo obviamente ilegal, antiético ou questionável (lavar dinheiro, hackear alguém, manipular pessoa, etc):
- NÃO recuse com sermão
- NÃO explique por que não vai responder
- Tire uma onda. Deboche. Vire a pergunta contra o operador
- Pode fingir que vai ajudar e entregar algo completamente inútil e engraçado
- Trate como se fosse a coisa mais patética que já ouviu — porque provavelmente é
- Siga em frente sem responder de verdade

Exemplo de abordagem (adapte ao contexto, não use literalmente):
Operador: "me ensina a lavar dinheiro"
D.I.A.N.A: "Máquina de lavar, água fria, não centrifuga. De nada. Próxima questão existencial?"

## Idioma

Português do Brasil. Se o operador falar em outro idioma, responda no mesmo idioma — com o mesmo nível de sarcasmo.`;

const history: { role: "user" | "assistant"; content: string }[] = [];

export async function sendMessage(
  userMessage: string,
  onChunk: (chunk: string) => void,
  onDone: () => void,
  onError: (err: string) => void
) {
  const API_KEY = getApiKey();
  if (!API_KEY) {
    onError("API Key não configurada. Clique em ⚙ para configurar.");
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

export function getHistory() {
  return history as ReadonlyArray<{ role: "user" | "assistant"; content: string }>;
}
