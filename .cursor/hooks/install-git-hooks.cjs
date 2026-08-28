#!/usr/bin/env node
"use strict";

const { spawnSync } = require("child_process");
const path = require("path");

const script = path.join(__dirname, "..", "..", "scripts", "install-git-hooks.cjs");
spawnSync(process.execPath, [script], { stdio: "inherit" });
