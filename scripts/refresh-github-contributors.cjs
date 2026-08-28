#!/usr/bin/env node
"use strict";

/**
 * Força o GitHub a recalcular a lista de Contributors (sidebar).
 * A API /contributors pode já mostrar só Jurandy1; a sidebar demora.
 *
 * Uso: node scripts/refresh-github-contributors.cjs
 */
const { spawnSync } = require("child_process");

const AUTHOR = "Jurandy1 <jujuba100054@gmail.com>";
const MSG = "chore: atualizar cache de contributors no GitHub";

function run(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: "utf8", shell: false });
  if (r.status !== 0) {
    console.error(r.stderr || r.stdout || `Falhou: ${cmd} ${args.join(" ")}`);
    process.exit(r.status || 1);
  }
  return (r.stdout || "").trim();
}

run("node", ["scripts/install-git-hooks.cjs"]);
run("git", ["commit", "--allow-empty", `--author=${AUTHOR}`, "-m", MSG]);
console.log("\nCommit vazio criado. Enviando para origin e mestreafil...\n");
run("git", ["push", "origin", "main"]);
run("git", ["push", "mestreafil", "main"]);
console.log(`
Próximo passo MANUAL (limpa o cache da sidebar do GitHub):

Em CADA repositório (Jurandy1/SaaS-afiliados e mestreafil-lgtm/SaaS-afiliados):
  1. Settings → Branches
  2. Renomeie a branch padrão: main → main-temp
  3. Renomeie de volta: main-temp → main
  4. Aguarde 1–2 minutos e recarregue a página do repo (Ctrl+F5)

No Cursor (evitar novos co-autores):
  Settings → Git & PRs → Attribution → desligar Commit e PR attribution
`);
