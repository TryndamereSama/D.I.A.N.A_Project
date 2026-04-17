#!/usr/bin/env bash
# D.I.A.N.A — setup validation script

ROOT="$(cd "$(dirname "$0")" && pwd)"
PASS=0
FAIL=0

ok()   { echo "  [OK]  $1"; ((PASS++)); }
fail() { echo "  [MISS] $1"; ((FAIL++)); }

echo ""
echo "=== D.I.A.N.A Setup Check ==="
echo ""

echo ">> Runtime"
command -v node   &>/dev/null && ok  "Node $(node --version)" || fail "Node not found"
command -v npm    &>/dev/null && ok  "npm $(npm --version)"   || fail "npm not found"
command -v rustc  &>/dev/null && ok  "Rust $(rustc --version)" || fail "Rust not installed — run: winget install Rustlang.Rustup"
command -v cargo  &>/dev/null && ok  "Cargo found"            || fail "Cargo not found (install Rust)"

echo ""
echo ">> Project files"
[ -f "$ROOT/package.json" ]                         && ok  "package.json"                   || fail "package.json missing"
[ -f "$ROOT/index.html" ]                           && ok  "index.html"                     || fail "index.html missing"
[ -f "$ROOT/vite.config.ts" ]                       && ok  "vite.config.ts"                 || fail "vite.config.ts missing"
[ -f "$ROOT/src/main.ts" ]                          && ok  "src/main.ts"                    || fail "src/main.ts missing"
[ -f "$ROOT/src/avatar.ts" ]                        && ok  "src/avatar.ts"                  || fail "src/avatar.ts missing"
[ -f "$ROOT/src/claude.ts" ]                        && ok  "src/claude.ts"                  || fail "src/claude.ts missing"
[ -f "$ROOT/src-tauri/Cargo.toml" ]                 && ok  "src-tauri/Cargo.toml"           || fail "src-tauri/Cargo.toml missing"
[ -f "$ROOT/src-tauri/tauri.conf.json" ]            && ok  "src-tauri/tauri.conf.json"      || fail "src-tauri/tauri.conf.json missing"
[ -f "$ROOT/src-tauri/src/main.rs" ]                && ok  "src-tauri/src/main.rs"          || fail "src-tauri/src/main.rs missing"
[ -f "$ROOT/src-tauri/capabilities/default.json" ]  && ok  "capabilities/default.json"      || fail "capabilities/default.json missing"

echo ""
echo ">> VRM model"
[ -f "$ROOT/public/models/6493143135142452442.vrm" ] \
  && ok  "VRM model found in public/models/" \
  || fail "VRM model missing — move file to: public/models/6493143135142452442.vrm"

echo ""
echo ">> Environment"
if [ -f "$ROOT/.env" ]; then
  ok ".env exists"
  grep -q "VITE_ANTHROPIC_API_KEY=sk-ant-" "$ROOT/.env" \
    && ok  "API key set in .env" \
    || fail "API key missing or invalid in .env — must start with sk-ant-"
else
  fail ".env missing — copy .env.example to .env and fill API key"
fi

echo ""
echo ">> Dependencies"
[ -d "$ROOT/node_modules" ] \
  && ok  "node_modules installed" \
  || fail "node_modules missing — run: npm install"

if command -v npx &>/dev/null && [ -d "$ROOT/node_modules" ]; then
  npx tauri --version &>/dev/null \
    && ok  "Tauri CLI available ($(npx tauri --version))" \
    || fail "Tauri CLI not available — run: npm install"
fi

echo ""
echo "================================"
echo "  PASSED: $PASS   FAILED: $FAIL"
echo "================================"

if [ "$FAIL" -eq 0 ]; then
  echo ""
  echo "  Tudo ok! Rode: npm run tauri dev"
  echo ""
else
  echo ""
  echo "  Corrija os itens [MISS] acima antes de rodar."
  echo ""
fi
