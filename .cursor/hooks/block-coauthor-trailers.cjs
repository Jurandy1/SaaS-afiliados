#!/usr/bin/env node
"use strict";

const blocked = /co-authored-by:\s*.*(cursor|cursoragent|claude|anthropic)|--trailer[\s=][^\n]*?(cursor|cursoragent|claude|anthropic)/i;

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => { input += chunk; });
process.stdin.on("end", () => {
  try {
    const data = JSON.parse(input || "{}");
    const cmd = String(data.command || "");
    if (/\bgit\s+commit\b/i.test(cmd) && blocked.test(cmd)) {
      process.stdout.write(JSON.stringify({
        permission: "deny",
        user_message: "Neste repositório commits são só de Jurandy1 — sem Co-authored-by de Cursor/Claude.",
        agent_message: "Refaça o git commit sem --trailer Co-authored-by. Use --author=\"Jurandy1 <jujuba100054@gmail.com>\".",
      }));
      return;
    }
  } catch (_) { /* allow */ }
  process.stdout.write(JSON.stringify({ permission: "allow" }));
});
