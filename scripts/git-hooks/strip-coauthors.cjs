#!/usr/bin/env node
"use strict";

const fs = require("fs");

const msgFile = process.argv[2];
if (!msgFile) process.exit(0);

let msg = fs.readFileSync(msgFile, "utf8");
const blocked = /cursor|cursoragent|claude|anthropic|@cursor\.com|@anthropic\.com/i;

const lines = msg.split(/\r?\n/);
const filtered = lines.filter((line) => {
  const trimmed = line.trim();
  if (!/^co-authored-by:/i.test(trimmed)) return true;
  return !blocked.test(trimmed);
});

const out = `${filtered.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd()}\n`;
if (out !== msg) {
  fs.writeFileSync(msgFile, out, "utf8");
  process.stderr.write("[git-hook] Removido Co-authored-by de Cursor/Claude.\n");
}

process.exit(0);
