$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Pass = 0
$Fail = 0

function ok($msg) {
    Write-Host "  [OK]   $msg" -ForegroundColor Green
    $script:Pass++
}

function fail($msg) {
    Write-Host "  [MISS] $msg" -ForegroundColor Red
    $script:Fail++
}

Write-Host ""
Write-Host "=== D.I.A.N.A Setup Check ===" -ForegroundColor Cyan
Write-Host ""

Write-Host ">> Runtime"

if (Get-Command node -ErrorAction SilentlyContinue) {
    ok "Node $(node --version)"
} else {
    fail "Node nao encontrado"
}

if (Get-Command npm -ErrorAction SilentlyContinue) {
    ok "npm $(npm --version)"
} else {
    fail "npm nao encontrado"
}

if (Get-Command rustc -ErrorAction SilentlyContinue) {
    ok "Rust $(rustc --version)"
} else {
    fail "Rust nao instalado. Rode: winget install Rustlang.Rustup"
}

if (Get-Command cargo -ErrorAction SilentlyContinue) {
    ok "Cargo encontrado"
} else {
    fail "Cargo nao encontrado. Instale o Rust primeiro."
}

Write-Host ""
Write-Host ">> Project files"

$files = @(
    "package.json",
    "index.html",
    "vite.config.ts",
    "src\main.ts",
    "src\avatar.ts",
    "src\claude.ts",
    "src\style.css",
    "src-tauri\Cargo.toml",
    "src-tauri\tauri.conf.json",
    "src-tauri\src\main.rs",
    "src-tauri\capabilities\default.json"
)

foreach ($f in $files) {
    if (Test-Path "$Root\$f") {
        ok $f
    } else {
        fail "$f ausente"
    }
}

Write-Host ""
Write-Host ">> VRM model"

if (Test-Path "$Root\public\models\6493143135142452442.vrm") {
    ok "VRM model encontrado em public\models\"
} else {
    fail "VRM ausente. Mova para: public\models\6493143135142452442.vrm"
}

Write-Host ""
Write-Host ">> Environment"

if (Test-Path "$Root\.env") {
    ok ".env existe"
    $envContent = Get-Content "$Root\.env" -Raw
    if ($envContent -match "VITE_ANTHROPIC_API_KEY=sk-ant-") {
        ok "API key configurada"
    } else {
        fail "API key invalida ou ausente no .env"
    }
} else {
    fail ".env nao encontrado. Copie .env.example para .env"
}

Write-Host ""
Write-Host ">> Dependencies"

if (Test-Path "$Root\node_modules") {
    ok "node_modules instalado"
} else {
    fail "node_modules ausente. Rode: npm install"
}

if ((Test-Path "$Root\node_modules") -and (Get-Command npx -ErrorAction SilentlyContinue)) {
    $tauriVer = & npx tauri --version 2>$null
    if ($LASTEXITCODE -eq 0) {
        ok "Tauri CLI: $tauriVer"
    } else {
        fail "Tauri CLI indisponivel. Rode: npm install"
    }
}

Write-Host ""
Write-Host "================================" -ForegroundColor Cyan
Write-Host "  PASSED: $Pass   FAILED: $Fail"
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

if ($Fail -eq 0) {
    Write-Host "  Tudo ok! Rode: npm run tauri dev" -ForegroundColor Green
} else {
    Write-Host "  Corrija os itens [MISS] antes de rodar." -ForegroundColor Yellow
}

Write-Host ""
