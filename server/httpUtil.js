"use strict";

function fetchWithTimeout(url, opts = {}, ms = 15000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  const parent = opts.signal;
  if (parent) {
    if (parent.aborted) ctrl.abort();
    else parent.addEventListener("abort", () => ctrl.abort(), { once: true });
  }
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

module.exports = { fetchWithTimeout };
