# D.I.A.N.A — Manual Técnico Completo
**Digital Intelligence for Adaptive Neural Assistance**  
Versão 0.1 · PT-BR

---

## Índice

1. [O que é o projeto](#1-o-que-é-o-projeto)
2. [Estrutura de arquivos](#2-estrutura-de-arquivos)
3. [Stack tecnológica](#3-stack-tecnológica)
4. [Como rodar](#4-como-rodar)
5. [Variáveis de ambiente](#5-variáveis-de-ambiente)
6. [Arquivo: `index.html`](#6-arquivo-indexhtml)
7. [Arquivo: `src/main.ts`](#7-arquivo-srcmaints)
8. [Arquivo: `src/avatar.ts`](#8-arquivo-srcavatarts)
9. [Arquivo: `src/movement.ts`](#9-arquivo-srcmovementts)
10. [Arquivo: `src/claude.ts`](#10-arquivo-srcclaудets)
11. [Arquivo: `src/style.css`](#11-arquivo-srcstylecss)
12. [Arquivo: `src-tauri/tauri.conf.json`](#12-arquivo-src-tauritauriconfjson)
13. [Sistema de coordenadas 3D](#13-sistema-de-coordenadas-3d)
14. [Como o avatar é posicionado](#14-como-o-avatar-é-posicionado)
15. [Animações — guia de cada sistema](#15-animações--guia-de-cada-sistema)
16. [Expressões faciais](#16-expressões-faciais)
17. [Sistema de poses de braço](#17-sistema-de-poses-de-braço)
18. [Integração com a API Claude](#18-integração-com-a-api-claude)
19. [Parâmetros para ajuste fino (tuning)](#19-parâmetros-para-ajuste-fino-tuning)
20. [Problemas conhecidos e soluções](#20-problemas-conhecidos-e-soluções)
21. [Roadmap / próximos passos](#21-roadmap--próximos-passos)

---

## 1. O que é o projeto

D.I.A.N.A é uma mascote de desktop estilo **VTuber** que roda como aplicativo nativo no Windows via **Tauri**. Ela fica no canto inferior direito da tela, exibe um avatar 3D animado no formato **VRM**, e conversa com o usuário através da **API da Anthropic (Claude)**.

Características principais:
- Janela transparente, sem bordas, sempre no topo (`alwaysOnTop`)
- Avatar VRM 3D com animações procedurais (respiração, piscar, olhar, expressões)
- Cabeça e olhos seguem o cursor do mouse
- Lip sync simulado durante respostas
- Expressões faciais suaves que mudam conforme emoção
- Poses de braço gestuais durante fala
- Chat em português com personalidade sarcástica e direta

---

## 2. Estrutura de arquivos

```
D.I.A.N.A/
├── index.html                  # HTML raiz da aplicação
├── package.json                # Dependências Node/npm
├── tsconfig.json               # Configuração TypeScript
├── vite.config.ts              # Configuração do Vite (bundler)
├── .env                        # Chave da API (NÃO commitar!)
│
├── src/
│   ├── main.ts                 # Ponto de entrada — liga tudo
│   ├── avatar.ts               # Motor 3D do avatar (Three.js + VRM)
│   ├── movement.ts             # Máquina de estado de movimentação
│   ├── claude.ts               # Comunicação com API Anthropic
│   ├── style.css               # Estilos da janela e chat UI
│   └── avatar-2d.ts            # (arquivo legado, não usado)
│
├── public/
│   └── models/
│       └── 6493143135142452442.vrm   # Modelo 3D da avatar
│
└── src-tauri/
    ├── tauri.conf.json         # Configuração da janela nativa Tauri
    ├── Cargo.toml              # Dependências Rust
    └── src/
        └── main.rs             # Entry point Rust (mínimo)
```

---

## 3. Stack tecnológica

| Camada | Tecnologia | Versão | Função |
|--------|-----------|--------|--------|
| Framework desktop | **Tauri 2** | ^2.0 | Janela nativa, transparência, always-on-top |
| Renderização 3D | **Three.js** | ^0.170 | Cena 3D, câmera, iluminação |
| Formato avatar | **@pixiv/three-vrm** | ^3.1.3 | Carregamento VRM, bones, expressões, spring bones |
| Bundler | **Vite** | ^6.0 | Dev server, build |
| Linguagem | **TypeScript** | ^5.6 | Tipagem estática |
| IA | **Anthropic Claude** | claude-sonnet-4-6 | Respostas conversacionais via streaming |

---

## 4. Como rodar

### Pré-requisitos
- Node.js 18+
- Rust + Cargo (para Tauri)
- `@tauri-apps/cli` instalado

### Desenvolvimento (browser, sem janela nativa)
```bash
cd "C:\Users\vfaria\OneDrive\Documents\Projetos\D.I.A.N.A"
npm run dev
# Abre em http://localhost:1420
```

### Desenvolvimento com Tauri (janela nativa)
```bash
npm run tauri dev
```

### Build para produção
```bash
npm run build          # só frontend
npm run tauri build    # gera .exe instalável
```

---

## 5. Variáveis de ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
VITE_ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxx
```

> **Atenção:** O prefixo `VITE_` é obrigatório para o Vite expor a variável ao frontend.  
> Nunca commite o `.env` no Git.

---

## 6. Arquivo: `index.html`

Estrutura HTML mínima:

```html
<canvas id="avatar-canvas"></canvas>

<div id="chat-ui">
  <div id="drag-handle" data-tauri-drag-region></div>
  <div id="chat-bubble" class="hidden">
    <div id="chat-text"></div>
  </div>
  <div id="input-area">
    <input id="user-input" ... />
    <button id="send-btn">➤</button>
  </div>
</div>
```

- `avatar-canvas` → Three.js renderiza o avatar aqui
- `drag-handle` → O atributo `data-tauri-drag-region` permite arrastar a janela clicando nessa div
- `chat-bubble` → Começa escondida (`class="hidden"`), aparece quando há resposta
- `chat-text` → Texto da resposta é inserido aqui via `textContent`

---

## 7. Arquivo: `src/main.ts`

Ponto de entrada da aplicação. Responsabilidades:

### 7.1 Posicionamento da janela (`fitToMonitor`)

```typescript
const WIDGET_W = 380;  // largura em pixels lógicos
const WIDGET_H = 570;  // altura em pixels lógicos
const WIDGET_MARGIN = 12;
const TASKBAR_H = 48;  // altura aproximada da barra de tarefas Windows
```

Ao iniciar, a função `fitToMonitor()` usa a API do Tauri para:
1. Obter a lista de monitores disponíveis
2. Calcular a posição no canto inferior direito do monitor principal
3. Redimensionar e reposicionar a janela

**Cálculo de posição (pixels físicos):**
```
posX = monitor.width  - (WIDGET_W * scaleFactor) - margin
posY = monitor.height - (WIDGET_H * scaleFactor) - taskbar
```

`scaleFactor` lida com monitores HiDPI (ex: 4K com 150% de escala = sf 1.5).

### 7.2 Loop de movimento

```typescript
function movementLoop() {
  const dt = (now - lastTime) / 1000;  // delta em segundos
  updateMovement(dt);
  requestAnimationFrame(movementLoop);
}
```

Loop separado do render loop do Three.js. Atualiza a máquina de estados de movimentação (~60fps).

### 7.3 Fluxo de envio de mensagem (`handleSend`)

```
usuário digita → [Enter ou clique] → handleSend()
  ├── desabilita input
  ├── setTalking(true)    → ativa lip sync + head bob
  ├── setExpression("neutral")
  ├── showBubble("...")   → mostra "..." enquanto carrega
  ├── sendMessage() → streaming SSE da API
  │     └── onChunk → atualiza bubble em tempo real
  ├── onDone:
  │     ├── setTalking(false)
  │     ├── setExpression("happy")
  │     └── após 8s: hideBubble + setExpression("neutral")
  └── onError:
        ├── setTalking(false)
        ├── showBubble("Erro: ...")
        └── setExpression("sad")
```

---

## 8. Arquivo: `src/avatar.ts`

O arquivo mais complexo. Contém todo o motor de animação 3D.

### 8.1 Constantes principais

```typescript
export const WORLD_H = 10.0;   // altura do mundo em unidades 3D
const AVATAR_SCALE   = 5.0;    // escala do modelo VRM
const BASE_ROT_Y     = Math.PI; // rotação Y do avatar (Math.PI = virado para câmera)
const HEAD_SCREEN_Y  = 9.2;    // posição Y do rosto na tela (0=baixo, 10=topo)
```

**Como ajustar o tamanho do avatar:**
- Aumentar `AVATAR_SCALE` → avatar maior
- Diminuir `AVATAR_SCALE` → avatar menor

**Como subir/descer o avatar na tela:**
- Aumentar `HEAD_SCREEN_Y` → cabeça mais perto do topo (ex: 9.5)
- Diminuir `HEAD_SCREEN_Y` → cabeça mais baixa (ex: 7.0)

### 8.2 Câmera ortográfica

```typescript
function makeOrtho() {
  const worldW = WORLD_H * (sw / sh);  // largura em proporção ao aspect ratio
  const cam = new THREE.OrthographicCamera(
    -worldW/2, worldW/2,  // esquerda, direita
    WORLD_H, 0,           // topo, baixo
    0.1, 20               // near, far
  );
  cam.position.set(0, 0, 5);
  cam.lookAt(0, 0, 0);
}
```

Câmera **ortográfica** (sem perspectiva) mantém o avatar com tamanho constante independente da distância. A câmera fica em Z=5 olhando para Z=0 (onde o avatar está).

**Sistema de coordenadas visível:**
- X: de `-worldW/2` (esquerda) a `+worldW/2` (direita)
- Y: de `0` (baixo da tela) a `10` (topo da tela)
- Z: câmera em 5, avatar em 0

### 8.3 Carregamento do VRM

```typescript
loader.load(MODEL_PATH, (gltf) => {
  // 1. Otimizações de mesh
  VRMUtils.removeUnnecessaryVertices(gltf.scene);
  VRMUtils.combineSkeletons(gltf.scene);

  // 2. Detecta versão VRM (0 ou 1)
  vrmVersion = metaVersion === "0" ? "0" : "1";
  if (vrmVersion === "0") VRMUtils.rotateVRM0(loaded);

  // 3. Escala e rotação inicial
  vrm.scene.scale.set(AVATAR_SCALE, AVATAR_SCALE, AVATAR_SCALE);
  vrm.scene.rotation.y = BASE_ROT_Y;

  // 4. Ancora pelo osso da cabeça
  vrm.update(0);  // força cálculo de posições
  headBone.getWorldPosition(headPos);
  groundY = HEAD_SCREEN_Y - headPos.y;
  vrm.scene.position.y = groundY;
});
```

**Por que ancorar pelo osso da cabeça?**  
O bounding box (`Box3`) é inflado por cabelos longos e acessórios, causando cálculos imprecisos. O osso da cabeça dá a posição real.

**O que é `groundY`?**  
É o offset Y do `vrm.scene` para que a cabeça apareça exatamente em `HEAD_SCREEN_Y`. Calculado como:
```
groundY = HEAD_SCREEN_Y - posição_Y_da_cabeça_no_modelo_escalado
```

### 8.4 Loop de animação (`animate`)

Executado ~60fps via `requestAnimationFrame`. Ordem de execução:

```typescript
function animate() {
  updatePosition(dt);      // 1. Move o avatar no eixo X (inércia)
  vrm.update(dt);          // 2. Physics de spring bones (cabelo, etc)
  // ← Overrides de osso DEVEM vir APÓS vrm.update()
  updateMouseTracking(dt); // 3. Cabeça e olhos seguem o mouse
  updateBlink(dt);         // 4. Piscar automático
  updateBreathing(dt);     // 5. Respiração (tórax/coluna)
  updateIdleLook(dt);      // 6. Olhares aleatórios em idle
  updateIdleSway(dt);      // 7. Balanço suave do corpo
  updateArms(dt);          // 8. Poses e gestos dos braços
  // Fala ou idle:
  if (isTalking) {
    updateLipSync(dt);     // 9a. Lip sync simulado
    updateHeadBob(dt);     // 9b. Cabeça balança ao falar
  } else {
    fadeOutLipSync(dt);    // 9c. Fecha a boca gradualmente
    updateIdleExpression(dt); // 9d. Cicla expressões em idle
  }
  applyExpression(dt);     // 10. Aplica blend de expressão facial
}
```

> **Regra crítica:** Qualquer override de rotação de osso deve ocorrer APÓS `vrm.update(dt)`, senão o VRM reseta os valores calculados manualmente.

### 8.5 VRM versão 0 vs versão 1

```typescript
function az(z: number) { return vrmVersion === "0" ? -z : z; }
```

Modelos **VRM0** passam por `VRMUtils.rotateVRM0()` que aplica 180° no eixo Y. Isso inverte o eixo Z local dos ossos dos braços. A função `az()` corrige isso automaticamente ao aplicar poses.

### 8.6 `updatePosition` — inércia no eixo X

```typescript
const diff = avatarTargetX - avatarCurrentX;
avatarVelocityX += diff * dt * 6;       // força proporcional à distância
avatarVelocityX *= Math.pow(0.04, dt);  // amortecimento exponencial
avatarCurrentX += avatarVelocityX * dt;
```

Sistema de **spring damper**: o avatar "escorrega" suavemente para o alvo X com inércia, não teleporta.

---

## 9. Arquivo: `src/movement.ts`

Máquina de estados simples que controla o movimento lateral do avatar.

```typescript
export function updateMovement(dt: number) {
  stateTimer += dt;
  if (stateTimer >= nextChange) {
    stateTimer = 0;
    nextChange = randomIdle();  // próxima mudança em 6-16 segundos
    worldX = (Math.random() - 0.5) * 0.5;  // deriva leve (±0.25 unidades)
    setAvatarTargetX(worldX);
  }
}
```

- **Estado único:** `idle` — apenas deriva suave a cada 6-16 segundos
- **Deriva:** ±0.25 unidades de mundo (equivale a ~15px numa janela de 380px)
- Isso faz o avatar parecer "vivo" sem se mexer demais

**Para centralizar o avatar:** o worldX parte de 0 (centro da janela).

---

## 10. Arquivo: `src/claude.ts`

Comunicação com a API da Anthropic.

### 10.1 System prompt

```typescript
const SYSTEM_PROMPT = `Você é D.I.A.N.A (Digital Intelligence for Adaptive Neural Assistance),
uma assistente de IA pessoal que roda no notebook do seu criador como um avatar virtual.

Você é inteligente, direta e levemente sarcástica — mas sempre útil. 
Respostas curtas e naturais como conversa...`;
```

Define a personalidade da D.I.A.N.A: **direta, sarcástica, útil, respostas curtas em PT-BR**.

### 10.2 Histórico de conversa

```typescript
const history: { role: "user" | "assistant"; content: string }[] = [];
```

O histórico é mantido **em memória** (não persiste entre sessões). Cada mensagem enviada inclui todo o histórico anterior, dando contexto à API.

### 10.3 Streaming SSE

```typescript
const response = await fetch(API_URL, {
  body: JSON.stringify({ stream: true, ... })
});

const reader = response.body!.getReader();
while (true) {
  const { done, value } = await reader.read();
  // parse SSE: "data: {...}"
  // extrai event.delta.text → chama onChunk()
}
```

A API retorna texto em **tempo real** via Server-Sent Events. Cada chunk de texto é passado ao `onChunk()` callback, que atualiza o bubble instantaneamente enquanto a IA "digita".

### 10.4 Headers especiais

```typescript
"anthropic-dangerous-direct-browser-access": "true"
```

Necessário porque a chamada parte do **browser** (frontend Tauri/Vite), não de um servidor. Normalmente chamadas diretas de browser são bloqueadas por CORS.

---

## 11. Arquivo: `src/style.css`

### 11.1 Janela transparente

```css
html, body {
  background: transparent;
  pointer-events: none;  /* cliques passam através da janela */
}
```

Todo o fundo é transparente — só o canvas 3D e a UI de chat são visíveis.

### 11.2 Crop do avatar (clip-path)

```css
#avatar-canvas {
  clip-path: inset(0 0 55% 0 round 16px 16px 0 0);
}
```

`inset(topo direita baixo esquerda)` — esconde **55% do canvas pelo baixo**, cortando as pernas/cintura. O `round 16px 16px 0 0` arredonda os cantos superiores do canvas.

**Para ajustar o corte:**
- `55%` → mais corte (mostra menos corpo, mais foco no rosto)
- `30%` → menos corte (mostra mais corpo)
- `0%` → sem corte (corpo completo)

### 11.3 Chat UI

```css
#chat-ui {
  position: fixed;
  bottom: 10px;
  left: 10px;
  right: 10px;    /* full width da janela */
  pointer-events: auto;  /* permite cliques mesmo com body bloqueado */
}
```

O `pointer-events: none` no body bloqueia todos os cliques (para não interferir com o desktop). Mas o `#chat-ui` reativa isso com `pointer-events: auto`.

---

## 12. Arquivo: `src-tauri/tauri.conf.json`

```json
{
  "width": 380,
  "height": 570,
  "decorations": false,    // sem barra de título nativa
  "transparent": true,     // fundo transparente
  "alwaysOnTop": true,     // sempre sobre outras janelas
  "skipTaskbar": true,     // não aparece na barra de tarefas
  "shadow": false,         // sem sombra nativa do Windows
  "x": 1508, "y": 460     // posição padrão (sobrescrita pelo fitToMonitor)
}
```

A posição `x/y` são valores padrão. `fitToMonitor()` em `main.ts` calcula a posição real baseada no monitor do usuário em runtime.

---

## 13. Sistema de coordenadas 3D

```
Y=10 (topo da tela)
  │
  │   [cabeça ≈ Y=9.2]
  │   [tórax  ≈ Y=7-8]
  │   [cintura≈ Y=5-6]  ← cortado pelo clip-path
  │   [pernas ≈ Y=1-4]  ← cortado
  │
Y=0 (baixo da tela)

X: -worldW/2 (esquerda) ←──────→ +worldW/2 (direita)
Z: câmera em Z=5, avatar em Z=0 (não muda)
```

**worldW** (largura do mundo) varia com o aspect ratio da janela:
```
worldW = WORLD_H × (largura_janela / altura_janela)
       = 10 × (380 / 570)
       = 6.67 unidades
```

Converter pixel X para unidade de mundo:
```typescript
worldX = (pixelX / screenW - 0.5) * worldW
```

---

## 14. Como o avatar é posicionado

### Passo a passo ao carregar o VRM:

1. **Escala:** `vrm.scene.scale.set(5, 5, 5)`
2. **Rotação:** `vrm.scene.rotation.y = Math.PI` (vira para câmera)
3. **Força atualização:** `vrm.update(0)` — necessário para ossos calcularem posições mundiais
4. **Mede cabeça:** `headBone.getWorldPosition(headPos)` → ex: `headPos.y = 8.0`
5. **Calcula groundY:** `groundY = HEAD_SCREEN_Y - headPos.y = 9.2 - 8.0 = 1.2`
6. **Posiciona:** `vrm.scene.position.y = 1.2`

Resultado: cabeça aparece em Y=9.2 (92% do topo da tela).

---

## 15. Animações — guia de cada sistema

### `updateMouseTracking(dt)`
- Lê `mouse.x` e `mouse.y` (normalizados -1 a +1)
- Rotaciona `headBone` suavemente para apontar ao cursor
- Rotaciona `neckBone` com 40% do valor da cabeça (movimento mais natural)
- Move os olhos via `vrm.lookAt.applier.applyYawPitch()` com alcance maior que a cabeça

### `updateBlink(dt)`
- Timer aleatório: pisca a cada **2.8 a 6.8 segundos**
- 20% de chance de **piscar duplo** (mais natural)
- Animação em 3 fases: fechar → mantido → abrir
- Velocidade: `blinkPhase += dt * 14` (piscar completo em ~0.16s)

### `updateBreathing(dt)`
- Senoidal suave no `chestBone` (tórax) e `spineBone` (coluna)
- Frequência: 0.75 rad/s em idle, 1.1 rad/s ao falar (respiração mais rápida)
- Amplitude mínima para não parecer mecânico

### `updateIdleLook(dt)`
- A cada **1.5 a 5 segundos**, define um novo `idleLookTarget`
- Altera `targetHeadTiltZ`: inclinação aleatória da cabeça (±0.18 rad)
- Soma ao movimento de tracking do mouse — não o substitui

### `updateIdleSway(dt)`
- `idleSwayPhase += dt * 0.35` → período de ~18 segundos
- Balanço lateral (`z`) no spine, chest e hips em fases opostas
- Balanço frontal (`x`) no spine (leve inclinação para frente/trás)

### `updateLipSync(dt)`
- Cicla aleatoriamente entre 5 visemes: **aa, ih, ou, ee, oh**
- Intervalo entre visemes: 0.06 a 0.16s (ritmo natural de fala)
- Peso do viseme atual oscila com `Math.sin(talkPhase * 9)` → variação natural
- Ao parar de falar: `fadeOutLipSync()` fecha a boca em ~0.08s

### `updateHeadBob(dt)`
- Ativo apenas enquanto `isTalking = true`
- Balança a cabeça em Z e X suavemente sincronizado com a "fala"

### `updateIdleExpression(dt)`
- Ativo apenas em idle (não falando)
- A cada **12 a 30 segundos**, escolhe aleatoriamente: neutral (3x), happy (2x), surprised (1x)

---

## 16. Expressões faciais

### Expressões disponíveis

| Nome | Efeito VRM | Pose de braço associada |
|------|-----------|------------------------|
| `neutral` | Sem expressão | rest (braços ao lado) |
| `happy` | Olhos fechados feliz, sorriso | happy (braços levantados) |
| `sad` | Olhos tristes, boca caída | sad (braços caídos) |
| `surprised` | Olhos arregalados, boca aberta | bothUp (braços para cima) |
| `angry` | Sobrancelha franzida | bothUp (braços para cima) |

### Como as expressões são aplicadas (`applyExpression`)

Sistema de **cross-fade suave** — sem transição abrupta:

```
setExpression("happy"):
  1. expressão anterior (ex: neutral) → prevExpression
  2. targetExpression = "happy"
  3. currentExpressionWeight = 0  ← começa do zero

applyExpression(dt):
  - prevExpression: fade OUT (lerp → 0 em ~0.3s)
  - targetExpression: fade IN (lerp → 0.7 em ~0.5s)
  - peso máximo: 0.7 (não 1.0, evita expressão exagerada)
```

### Para mudar expressão pelo código

```typescript
import { setExpression } from "./avatar";

setExpression("happy");    // feliz
setExpression("sad");      // triste
setExpression("surprised");// surpresa
setExpression("angry");    // raiva
setExpression("neutral");  // neutro
```

---

## 17. Sistema de poses de braço

### Poses definidas em `POSES`

| Pose | Descrição |
|------|-----------|
| `rest` | Braços ao lado do corpo (default) |
| `raiseLeft` | Braço esquerdo levantado |
| `raiseRight` | Braço direito levantado |
| `bothUp` | Ambos os braços levantados |
| `expressiveLeft` | Braço esquerdo expressivo, gesticulando |
| `happy` | Braços levantados levemente abertos |
| `sad` | Braços caídos com ombros baixos |

### Transição de pose (`applyPoseToSkeleton`)

Usa `lerpEuler()` — interpola cada eixo (x, y, z) dos ossos individualmente:

```
currentPose → lerp → targetPose (a cada frame)
velocidade: 3.5 (falando) ou 2.5 (idle)
```

### Gestos durante fala

```typescript
const TALK_GESTURES = ["raiseLeft", "raiseRight", "bothUp", "expressiveLeft"];
```

A cada **1.8 a 4.3 segundos** durante fala, um gesto aleatório é ativado.

---

## 18. Integração com a API Claude

### Modelo usado
`claude-sonnet-4-6` — versão Sonnet da Claude 4.6.

### Parâmetros da requisição

```json
{
  "model": "claude-sonnet-4-6",
  "max_tokens": 1024,
  "system": "...",
  "messages": [...histórico...],
  "stream": true
}
```

### Modificar a personalidade da D.I.A.N.A

Edite `SYSTEM_PROMPT` em `src/claude.ts`:

```typescript
const SYSTEM_PROMPT = `Você é D.I.A.N.A...
// ← mude aqui o comportamento, tom, conhecimentos, etc.
`;
```

### Limpar histórico de conversa

```typescript
import { clearHistory } from "./claude";
clearHistory();
```

---

## 19. Parâmetros para ajuste fino (tuning)

Todos os valores abaixo são constantes no topo de seus respectivos arquivos. Não requerem conhecimento profundo de 3D para ajustar.

### `src/avatar.ts`

| Constante | Valor atual | O que faz |
|-----------|------------|-----------|
| `AVATAR_SCALE` | `5.0` | Tamanho do avatar. +valor = maior |
| `HEAD_SCREEN_Y` | `9.2` | Altura da cabeça (0-10). +valor = cabeça mais para cima |
| `WORLD_H` | `10.0` | Altura total do mundo 3D. Não alterar |
| `BASE_ROT_Y` | `Math.PI` | Rotação base do avatar. Math.PI = virado para frente |

### `src/style.css`

| Propriedade | Valor atual | O que faz |
|-------------|------------|-----------|
| `clip-path` no `#avatar-canvas` | `inset(0 0 55% 0 ...)` | Corta o canvas pelo baixo. 55% = corta 55% da altura |
| `width` do `#chat-ui` | auto (left+right: 10px) | Largura do chat |

### `src/main.ts`

| Constante | Valor atual | O que faz |
|-----------|------------|-----------|
| `WIDGET_W` | `380` | Largura da janela em px lógicos |
| `WIDGET_H` | `570` | Altura da janela em px lógicos |
| `WIDGET_MARGIN` | `12` | Margem da borda da tela (px) |
| `TASKBAR_H` | `48` | Altura da barra de tarefas Windows (px) |

### `src/movement.ts`

| Código | Valor atual | O que faz |
|--------|------------|-----------|
| `randomIdle()` | `6 + rand * 10` | Intervalo entre derivas (6-16s) |
| `worldX drift` | `(rand - 0.5) * 0.5` | Amplitude da deriva lateral (±0.25 unidades) |

---

## 20. Problemas conhecidos e soluções

### Avatar com corpo visível (não está em "bust up")
**Causa:** `clip-path` muito pequeno ou `HEAD_SCREEN_Y` muito baixo.  
**Solução:** Aumentar o valor de clip (ex: `55%` → `62%`) e/ou aumentar `HEAD_SCREEN_Y`.

### Avatar deformado/esticado
**Causa:** `CAMERA_BOTTOM` diferente de `0` sem ajustar `worldW`.  
**Solução:** Manter `CAMERA_BOTTOM = 0`. Usar CSS `clip-path` para cortar — não alterar o frustum da câmera.

### Avatar aparece "flutuando" muito acima da tela
**Causa:** `HEAD_SCREEN_Y` muito alto (ex: > 10).  
**Solução:** Reduzir `HEAD_SCREEN_Y` para 8.0-9.0.

### Janela não se posiciona no canto correto
**Causa:** `TASKBAR_H` incorreto para o monitor do usuário.  
**Solução:** Ajustar `TASKBAR_H` em `main.ts` (barra de tarefas grande = valor maior).

### Braços em posição "Y" (T-pose de braços)
**Causa:** Bug histórico com modelos VRM0 — eixo Z dos braços invertido.  
**Solução:** Já resolvido com a função `az()` que inverte Z para modelos VRM0.

### API retorna erro CORS
**Causa:** Header `anthropic-dangerous-direct-browser-access` ausente ou API key inválida.  
**Solução:** Verificar `.env` e confirmar que o header está presente em `claude.ts`.

---

## 21. Roadmap / próximos passos

Funcionalidades planejadas mas não implementadas:

### Visão de tela (Screen Vision)
- Capturar screenshot da área de trabalho via Tauri
- Enviar para a API junto com a mensagem do usuário
- D.I.A.N.A conseguiria comentar sobre o que o usuário está fazendo

### Integração com sistema operacional
- Notificações do Windows → D.I.A.N.A reage
- Calendário / Tarefas → D.I.A.N.A lembra reuniões
- Abrir apps / URLs por comando de voz

### Lip sync real
- Substituir lip sync simulado por análise de áudio real
- Usar Web Audio API para detectar amplitude e frequência da fala

### Text-to-Speech
- D.I.A.N.A falar em voz alta as respostas
- Opções: ElevenLabs, Azure TTS, Coqui

### Histórico persistente
- Salvar `history` em arquivo local via Tauri `fs` plugin
- D.I.A.N.A lembrar conversas anteriores

### Hotkey global
- Atalho de teclado para abrir/fechar D.I.A.N.A sem clicar
- Ex: `Ctrl+Alt+D`

### Múltiplos modelos VRM
- Suporte a troca de avatar em runtime
- Pasta `models/` com vários `.vrm` selecionáveis

---

*Documento gerado em 20/04/2026 · D.I.A.N.A v0.1*
