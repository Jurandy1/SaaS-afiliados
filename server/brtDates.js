"use strict";

/** Datas civis em America/Sao_Paulo (UTC−3), iguais ao Afiliadoteste. */

function brtTodayISO(date = new Date()) {
  const ms = (date instanceof Date ? date.getTime() : new Date(date).getTime()) - 3 * 3600 * 1000;
  return new Date(ms).toISOString().slice(0, 10);
}

function brtSubtractDays(days, refIso = brtTodayISO()) {
  const [y, m, d] = String(refIso).slice(0, 10).split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d - Number(days || 0)));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

/** conversionReport / insights diários: último dia útil = ontem BRT. */
function shopeeEndDate(date = new Date()) {
  return brtSubtractDays(1, brtTodayISO(date));
}

function brtFirstDayOfMonth(iso = brtTodayISO()) {
  return `${String(iso).slice(0, 7)}-01`;
}

function brtLastDayOfMonth(yearMonth) {
  const [y, m] = String(yearMonth).split("-").map(Number);
  const day = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${yearMonth}-${String(day).padStart(2, "0")}`;
}

function brtPreviousYearMonth(yearMonth = brtTodayISO().slice(0, 7)) {
  const [y, m] = String(yearMonth).split("-").map(Number);
  if (m === 1) return `${y - 1}-12`;
  return `${y}-${String(m - 1).padStart(2, "0")}`;
}

/**
 * Presets do painel. 7d = ontem e os 6 dias anteriores (7 dias fechados).
 * Shopee e Meta diário não consolidam o dia corrente.
 */
function rangeForPreset(kind) {
  const ate = shopeeEndDate();
  if (kind === "yesterday" || kind === "ontem") {
    return { startDate: ate, endDate: ate };
  }
  if (kind === "14d") return { startDate: brtSubtractDays(13, ate), endDate: ate };
  if (kind === "30d") return { startDate: brtSubtractDays(29, ate), endDate: ate };
  if (kind === "all") return { startDate: brtSubtractDays(89, ate), endDate: ate };
  if (kind === "month" || kind === "mes_atual") {
    return { startDate: brtFirstDayOfMonth(brtTodayISO()), endDate: ate };
  }
  if (kind === "prev_month" || kind === "mes_anterior") {
    const ym = brtPreviousYearMonth();
    return { startDate: brtFirstDayOfMonth(`${ym}-01`), endDate: brtLastDayOfMonth(ym) };
  }
  // 7d (padrão)
  return { startDate: brtSubtractDays(6, ate), endDate: ate };
}

function defaultRange() {
  return rangeForPreset("7d");
}

function isIsoDate(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
}

/** Garante que o fim do filtro nunca passe de ontem BRT (API Shopee/Meta não fecha o dia corrente). */
function clampDashRange(startDate, endDate) {
  const max = shopeeEndDate();
  const def = defaultRange();
  let start = String(startDate || "").slice(0, 10);
  let end = String(endDate || "").slice(0, 10);
  if (!isIsoDate(end) || end > max) end = max;
  if (!isIsoDate(start)) start = def.startDate;
  if (start > end) start = brtSubtractDays(6, end);
  return { startDate: start, endDate: end };
}

module.exports = {
  brtTodayISO,
  brtSubtractDays,
  shopeeEndDate,
  brtFirstDayOfMonth,
  brtLastDayOfMonth,
  brtPreviousYearMonth,
  rangeForPreset,
  defaultRange,
  clampDashRange,
};
