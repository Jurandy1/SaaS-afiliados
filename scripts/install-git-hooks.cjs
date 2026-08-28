#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const gitDir = path.join(root, ".git");
const hooksDir = path.join(gitDir, "hooks");

if (!fs.existsSync(gitDir)) {
  console.warn("[install-git-hooks] Pasta .git não encontrada — ignorando.");
  process.exit(0);
}

const hookBody = `#!/bin/sh
# Instalado por scripts/install-git-hooks.cjs — remove Co-authored-by de Cursor/Claude
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
node "$ROOT/scripts/git-hooks/strip-coauthors.cjs" "$1"
exit $?
`;

const hookNames = ["commit-msg", "prepare-commit-msg"];

fs.mkdirSync(hooksDir, { recursive: true });

for (const name of hookNames) {
  const target = path.join(hooksDir, name);
  fs.writeFileSync(target, hookBody, { mode: 0o755 });
  try { fs.chmodSync(target, 0o755); } catch (_) { /* Windows */ }
}

console.log("[install-git-hooks] Hooks ativos:", hookNames.join(", "));
