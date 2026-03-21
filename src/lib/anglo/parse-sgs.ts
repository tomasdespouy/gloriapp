import * as XLSX from "xlsx";

// ═══ Types ═══
export interface SGSWeekReport {
  fileName: string;
  batch: string;
  weekLabel: string;       // "SEM_08_2026"
  weekNumber: number;
  year: number;
  plant: string;           // "PL1" | "PL2"
  sampleNames: string[];   // short: ["ALI","CO FI","RE RO","RE SCV","RE FI Mo"]
  sampleCount: number;
  modal: SheetData;
  modalDist: SheetData;
  cuDeportAbs: SheetData;
  cuDeportPct: SheetData;
  sDeportAbs: SheetData;
  ccpLibPct: SheetData;
  moLibPct: SheetData;
  cuSulphLibPct: SheetData;
  grainSizeMoCum: SheetData;
}

export type SheetData = Record<string, number[]>;

type Row = (string | number | null | undefined)[];

// ═══ Helpers ═══
function getRows(wb: XLSX.WorkBook, name: string): Row[] {
  // Fuzzy match sheet name
  const exact = wb.SheetNames.find((n) => n === name);
  const fuzzy = wb.SheetNames.find((n) => n.replace(/\s+/g, " ").trim() === name);
  const sheetName = exact || fuzzy;
  if (!sheetName) return [];
  return XLSX.utils.sheet_to_json<Row>(wb.Sheets[sheetName], { header: 1, defval: null });
}

function isNum(v: unknown): v is number {
  return typeof v === "number" && !isNaN(v);
}

function parseNumericRow(row: Row): { label: string; values: number[] } | null {
  const nonNull = row.filter((v) => v != null && v !== "");
  if (nonNull.length < 2) return null;
  const label = String(nonNull[0]);
  const values: number[] = [];
  for (let i = 1; i < nonNull.length; i++) {
    const v = nonNull[i];
    if (isNum(v)) values.push(v);
    else {
      const n = parseFloat(String(v));
      if (!isNaN(n)) values.push(n);
    }
  }
  if (values.length === 0) return null;
  return { label, values };
}

// ═══ Portada parser ═══
function parsePortada(wb: XLSX.WorkBook): { batch: string; weekLabel: string; weekNumber: number; year: number } {
  const rows = getRows(wb, "Portada");
  let batch = "", weekLabel = "", weekNumber = 0, year = 2026;

  for (const row of rows) {
    for (const cell of row) {
      if (cell == null) continue;
      const s = String(cell);
      // Week: "Los Bronces - Semana 08_2026" or contains SEM_
      const weekMatch = s.match(/Semana\s*(\d+)/i) || s.match(/SEM[_\s]*(\d+)/i);
      if (weekMatch) weekNumber = parseInt(weekMatch[1]);
      const yearMatch = s.match(/(\d{4})/);
      if (yearMatch && parseInt(yearMatch[1]) >= 2020) year = parseInt(yearMatch[1]);
    }
  }

  // Batch from "2. Id Muestras"
  const idRows = getRows(wb, "2. Id Muestras");
  for (const row of idRows) {
    for (const cell of row) {
      if (cell == null) continue;
      const s = String(cell);
      if (/^T\d{4}/.test(s)) { batch = s.trim(); break; }
    }
    if (batch) break;
  }

  weekLabel = `SEM_${String(weekNumber).padStart(2, "0")}_${year}`;
  return { batch, weekLabel, weekNumber, year };
}

// ═══ Sample names ═══
function parseSamples(wb: XLSX.WorkBook): { names: string[]; plant: string } {
  const SHORT_NAMES = ["ALI", "CO FI", "RE RO", "RE SCV", "RE FI Mo"];
  // Try from modal header row
  const rows = getRows(wb, "3.2 Modal");
  let plant = "PL2";
  const found: string[] = [];

  for (let i = 10; i < Math.min(20, rows.length); i++) {
    const row = rows[i];
    if (!row) continue;
    const cells = row.filter((c) => c != null && String(c).includes("SEM_"));
    if (cells.length >= 3) {
      for (const cell of cells) {
        const s = String(cell);
        const plantMatch = s.match(/PL(\d)/);
        if (plantMatch) plant = `PL${plantMatch[1]}`;
        // Determine short name
        for (const sn of SHORT_NAMES) {
          if (s.startsWith(sn + " ") || s.startsWith(sn.replace(" ", "") + " ")) {
            if (!found.includes(sn)) found.push(sn);
          }
        }
      }
      break;
    }
  }

  return { names: found.length > 0 ? found : SHORT_NAMES.slice(0, 5), plant };
}

// ═══ Generic table parser ═══
function parseTable(wb: XLSX.WorkBook, sheet: string, startRow: number, endRow: number): SheetData {
  const rows = getRows(wb, sheet);
  const data: SheetData = {};
  for (let i = startRow; i < Math.min(endRow, rows.length); i++) {
    const parsed = parseNumericRow(rows[i]);
    if (parsed && parsed.values.length >= 1) {
      data[parsed.label] = parsed.values;
    }
  }
  return data;
}

// ═══ Two-section parser (abs + pct) ═══
function parseTwoSections(wb: XLSX.WorkBook, sheet: string): { abs: SheetData; pct: SheetData } {
  const rows = getRows(wb, sheet);
  const abs: SheetData = {};
  const pct: SheetData = {};
  let section: "abs" | "pct" = "abs";
  let foundTotal = false;

  for (let i = 14; i < Math.min(50, rows.length); i++) {
    const parsed = parseNumericRow(rows[i]);
    if (!parsed) continue;

    if (parsed.label === "Total" && !foundTotal) {
      abs[parsed.label] = parsed.values;
      foundTotal = true;
      continue;
    }
    if (foundTotal && (parsed.label === "Full List" || parsed.label === "Sample")) {
      section = "pct";
      continue;
    }

    if (section === "abs") abs[parsed.label] = parsed.values;
    else pct[parsed.label] = parsed.values;
  }
  return { abs, pct };
}

// ═══ Liberation percentage parser ═══
function parseLiberationPct(wb: XLSX.WorkBook, sheet: string): SheetData {
  const rows = getRows(wb, sheet);
  const data: SheetData = {};
  let foundTotal = false;

  for (let i = 14; i < Math.min(35, rows.length); i++) {
    const parsed = parseNumericRow(rows[i]);
    if (!parsed) continue;
    if (parsed.label === "Total" && !foundTotal) { foundTotal = true; continue; }
    if (foundTotal && parsed.label !== "Samples" && parsed.label !== "Sample" && parsed.label !== "Total") {
      data[parsed.label] = parsed.values;
    }
  }
  return data;
}

// ═══ Mo grain size (cumulative) ═══
function parseGrainSizeMo(wb: XLSX.WorkBook): SheetData {
  const rows = getRows(wb, "3.17 Mineral Grain Size");
  const data: SheetData = {};

  for (let i = 84; i < Math.min(94, rows.length); i++) {
    const row = rows[i];
    if (!row) continue;
    const nonNull = row.filter((v) => v != null && v !== "");
    if (nonNull.length < 12) continue;

    const sizeLabel = String(nonNull[0]);
    // Cumulative values are at positions 7-11 (after the size label repeated)
    const cumVals: number[] = [];
    for (let j = 7; j < Math.min(12, nonNull.length); j++) {
      const v = nonNull[j];
      if (isNum(v)) cumVals.push(v);
    }
    if (cumVals.length >= 1) data[sizeLabel] = cumVals;
  }
  return data;
}

// ═══ Main parser ═══
export function parseSGSFile(buffer: ArrayBuffer, fileName: string): SGSWeekReport {
  const wb = XLSX.read(buffer, { type: "array" });

  const { batch, weekLabel, weekNumber, year } = parsePortada(wb);
  const { names, plant } = parseSamples(wb);

  const cuDep = parseTwoSections(wb, "3.4 Cu Deportment");
  const sDep = parseTwoSections(wb, "3.5 S Deportment");

  return {
    fileName,
    batch,
    weekLabel,
    weekNumber,
    year,
    plant,
    sampleNames: names,
    sampleCount: names.length,
    modal: parseTable(wb, "3.2 Modal", 14, 49),
    modalDist: parseTable(wb, "3.3 Modal Dist", 15, 36),
    cuDeportAbs: cuDep.abs,
    cuDeportPct: cuDep.pct,
    sDeportAbs: sDep.abs,
    ccpLibPct: parseLiberationPct(wb, "3.7 Ccp liberation"),
    moLibPct: parseLiberationPct(wb, "3.15 Mo Liberation"),
    cuSulphLibPct: parseLiberationPct(wb, "3.20 CuSulph liberation"),
    grainSizeMoCum: parseGrainSizeMo(wb),
  };
}

// ═══ Constants ═══
export const SAMPLE_SHORT = ["ALI", "CO FI", "RE RO", "RE SCV", "RE FI Mo"];
export const KEY_MINERALS = ["Chalcopyrite", "Pyrite", "Molybdenite", "Gypsum/Anhydrite", "Bornite", "Chalcocite/Digenite"];
export const CHART_COLORS = ["#4DD0E1", "#FF8A65", "#81C784", "#FFD54F", "#BA68C8", "#4FC3F7", "#AED581", "#F06292", "#FFB74D", "#90A4AE"];
