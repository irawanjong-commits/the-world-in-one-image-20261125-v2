// the-world-in-one-image-20261125-v2 — "EVENING EXTRA" tabloid
// Original Node 22 stdlib-only program. Own rasterizer, own 5x7 bitmap
// font, own deterministic PNG encoder. No packages, no network, no assets.
// Draws one 1024x1024 PNG summarising world news, Wed 25 November 2026.
import * as fs from "node:fs";
import * as path from "node:path";
import * as zlib from "node:zlib";

const W = 1024;
const H = 1024;

// ---------- palette ----------
const WHITE = [255, 255, 255] as const;
const PAPER = [253, 250, 244] as const;
const BLACK = [12, 12, 12] as const;
const RED = [198, 12, 32] as const;
const DARKRED = [150, 8, 24] as const;
const GREY = [110, 110, 108] as const;
const LGREY = [228, 226, 220] as const;
const MGREY = [200, 198, 192] as const;
const PINK = [248, 214, 218] as const;
const CREAM = [255, 244, 214] as const;
type RGB = readonly [number, number, number];

// ---------- framebuffer ----------
const px = new Uint8Array(W * H * 3);
function setPix(x: number, y: number, c: RGB): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2];
}
function fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
  const x0 = Math.max(0, x), y0 = Math.max(0, y);
  const x1 = Math.min(W, x + w), y1 = Math.min(H, y + h);
  for (let yy = y0; yy < y1; yy++) {
    let i = (yy * W + x0) * 3;
    for (let xx = x0; xx < x1; xx++) {
      px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; i += 3;
    }
  }
}
function rectOutline(x: number, y: number, w: number, h: number, c: RGB, t = 2): void {
  fillRect(x, y, w, t, c);
  fillRect(x, y + h - t, w, t, c);
  fillRect(x, y, t, h, c);
  fillRect(x + w - t, y, t, h, c);
}
// Bresenham line, thickness t (square brush)
function line(x0: number, y0: number, x1: number, y1: number, c: RGB, t = 1): void {
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy, x = x0, y = y0;
  const r = Math.floor(t / 2);
  for (;;) {
    fillRect(x - r, y - r, t, t, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
  }
}
function fillCircle(cx: number, cy: number, r: number, c: RGB): void {
  for (let y = -r; y <= r; y++) {
    const half = Math.floor(Math.sqrt(r * r - y * y));
    fillRect(cx - half, cy + y, half * 2 + 1, 1, c);
  }
}
// Scanline polygon fill (convex or concave, even-odd)
function fillPoly(pts: Array<[number, number]>, c: RGB): void {
  let minY = H, maxY = 0;
  for (const [, y] of pts) { if (y < minY) minY = y; if (y > maxY) maxY = y; }
  minY = Math.max(0, minY); maxY = Math.min(H - 1, maxY);
  for (let y = minY; y <= maxY; y++) {
    const xs: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[(i + 1) % pts.length];
      if ((y0 <= y && y1 > y) || (y1 <= y && y0 > y)) {
        xs.push(x0 + ((y - y0) * (x1 - x0)) / (y1 - y0));
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      fillRect(Math.ceil(xs[k]), y, Math.floor(xs[k + 1]) - Math.ceil(xs[k]) + 1, 1, c);
    }
  }
}
// Right triangle "burst" corner used on tabloid kickers
function burst(x: number, y: number, s: number, c: RGB): void {
  fillPoly([[x, y], [x + s, y + s / 2], [x, y + s], [x + s / 4, y + s / 2]], c);
}

// ---------- 5x7 bitmap font (hand-authored, uppercase only) ----------
// Each glyph: 7 rows of 5 cells, '#' = ink.
const FONT: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  "3": ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ",": ["00000", "00000", "00000", "00000", "01100", "00100", "01000"],
  "%": ["11001", "11010", "00010", "00100", "01000", "01011", "10011"],
  "+": ["00000", "00100", "00100", "01110", "00100", "00100", "00000"],
  "-": ["00000", "00000", "00000", "01110", "00000", "00000", "00000"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  "(": ["00010", "00100", "01000", "01000", "01000", "00100", "00010"],
  ")": ["01000", "00100", "00010", "00010", "00010", "00100", "01000"],
  "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
  "&": ["01100", "10010", "10100", "01000", "10101", "10010", "01101"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  "?": ["01110", "10001", "00001", "00010", "00100", "00000", "00100"],
  $: ["00100", "01111", "10100", "01110", "00101", "11110", "00100"],
  "=": ["00000", "00000", "11111", "00000", "11111", "00000", "00000"],
  "*": ["00000", "10101", "01110", "11111", "01110", "10101", "00000"],
  "—": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  "•": ["00000", "00000", "01100", "01100", "01100", "00000", "00000"],
  "<": ["00010", "00100", "01000", "10000", "01000", "00100", "00010"],
  ">": ["01000", "00100", "00010", "00001", "00010", "00100", "01000"],
};
const BLANK = FONT[" "];
function glyph(ch: string): string[] {
  return FONT[ch] ?? BLANK;
}
// Width of one glyph cell at a given scale (5 ink + 1 gap).
const CHAR_W = (s: number) => 6 * s;
function textWidth(t: string, s: number): number {
  let w = 0;
  for (const ch of t.toUpperCase()) w += CHAR_W(s);
  return w === 0 ? 0 : w - s; // no trailing gap
}

// ---------- text drawing ----------
// Draw one glyph with its top-left at (x, y), scaled by s.
function drawChar(ch: string, x: number, y: number, s: number, c: RGB): void {
  const g = glyph(ch);
  for (let r = 0; r < 7; r++) {
    const row = g[r];
    for (let col = 0; col < 5; col++) {
      if (row[col] === "1") fillRect(x + col * s, y + r * s, s, s, c);
    }
  }
}
// Draw a string; returns the x position just past the last glyph.
function drawText(t: string, x: number, y: number, s: number, c: RGB): number {
  let cx = x;
  for (const ch of t.toUpperCase()) {
    drawChar(ch, cx, y, s, c);
    cx += CHAR_W(s);
  }
  return cx - s;
}
function drawCentred(t: string, cx: number, y: number, s: number, c: RGB): void {
  drawText(t, cx - Math.floor(textWidth(t, s) / 2), y, s, c);
}
// Greedy word wrap: returns lines that fit maxW. Long words are split.
function wrap(t: string, s: number, maxW: number): string[] {
  const words = t.toUpperCase().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const trial = cur ? cur + " " + w : w;
    if (textWidth(trial, s) <= maxW) { cur = trial; continue; }
    if (cur) lines.push(cur);
    if (textWidth(w, s) > maxW) {
      // split the oversized word across lines
      let rest = w;
      const per = Math.max(1, Math.floor(maxW / CHAR_W(s)));
      while (textWidth(rest, s) > maxW) {
        lines.push(rest.slice(0, per));
        rest = rest.slice(per);
      }
      cur = rest;
    } else {
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}
function drawWrapped(t: string, x: number, y: number, s: number, c: RGB, maxW: number, lh: number): number {
  const lines = wrap(t, s, maxW);
  lines.forEach((ln, i) => drawText(ln, x, y + i * lh, s, c));
  return y + lines.length * lh;
}

// ---------- deterministic PNG encoder (stdlib zlib only) ----------
const CRC_TABLE = (() => {
  const tab = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tab[n] = c;
  }
  return tab;
})();
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, "ascii"), data])), 8 + data.length);
  return out;
}
function encodePNG(): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type 2 = RGB
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  // scanlines: filter byte 0 + raw RGB per row
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0;
    raw.set(px.subarray(y * W * 3, (y + 1) * W * 3), y * (1 + W * 3) + 1);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------- page layout: "EVENING EXTRA" red-top tabloid ----------
function drawMasthead(): void {
  fillRect(0, 0, W, 118, BLACK);
  drawCentred("EVENING EXTRA", 512, 16, 9, WHITE);
  drawCentred("WEDNESDAY 25 NOVEMBER 2026", 512, 88, 2, WHITE);
  // red LATE flag, right of the masthead
  fillRect(884, 28, 108, 44, RED);
  drawCentred("LATE", 938, 40, 3, WHITE);
  fillRect(0, 118, W, 8, RED);
}

function drawKickerAndHeadline(): void {
  burst(32, 136, 20, RED);
  drawText("US ECONOMY ROARS — INFLATION STICKS", 60, 136, 3, RED);
  drawText("GROWTH BEATS,", 32, 166, 6, BLACK);
  drawText("MARKETS BLEED", 32, 212, 6, RED);
  drawWrapped(
    "WASHINGTON — THE US ECONOMY GREW 4.3% IN Q3, ITS FASTEST PACE IN THREE YEARS, " +
    "WHILE CORE PCE, THE FED'S GAUGE, ROSE 0.3% IN OCTOBER TO 3.3% FOR THE YEAR. " +
    "STRONG GROWTH PLUS STICKY INFLATION SPOOKED TRADERS: S+P FUTURES FELL 2.1% " +
    "AND THE NASDAQ SELLOFF DEEPENED.",
    32, 264, 2, BLACK, 960, 19,
  );
}

function drawDataRow(): void {
  // Box A — GDP
  fillRect(32, 348, 300, 142, WHITE);
  rectOutline(32, 348, 300, 142, BLACK, 3);
  drawText("+4.3%", 52, 362, 9, RED);
  drawText("GDP Q3 ANNUALISED", 52, 434, 2, BLACK);
  drawText("SPENDING +4.2%", 52, 452, 2, BLACK);
  drawText("INVEST +16.1%", 52, 468, 2, BLACK);
  // Box B — core PCE
  fillRect(352, 348, 300, 142, WHITE);
  rectOutline(352, 348, 300, 142, BLACK, 3);
  drawText("+3.3%", 372, 362, 9, BLACK);
  drawText("CORE PCE YOY OCT", 372, 434, 2, BLACK);
  drawText("HEADLINE +3.8% YOY", 372, 452, 2, BLACK);
  drawText("VS +3.2% EXPECTED", 372, 468, 2, BLACK);
  // Box C — falling futures chart
  fillRect(672, 348, 320, 142, WHITE);
  rectOutline(672, 348, 320, 142, BLACK, 3);
  drawText("S+P FUTURES -2.1%", 690, 358, 2, RED);
  const pts: Array<[number, number]> = [
    [690, 392], [730, 400], [770, 392], [810, 418],
    [850, 430], [890, 452], [930, 470], [975, 472],
  ];
  fillPoly([...pts, [975, 478], [690, 478]], PINK);
  line(684, 380, 684, 478, BLACK, 2);
  line(684, 478, 982, 478, BLACK, 2);
  for (let i = 0; i + 1 < pts.length; i++) {
    line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], RED, 4);
  }
  for (const [x, y] of pts) fillCircle(x, y, 3, BLACK);
  // down arrow at the end of the fall
  fillPoly([[966, 458], [984, 458], [975, 476]], RED);
}

function drawMarketsStrip(): void {
  fillRect(0, 502, W, 64, BLACK);
  const x0 = 32;
  drawText("MARKETS", x0, 512, 2, RED);
  drawText("KOSPI -6.16%   NIKKEI -2.78%   TAIWAN -4.5%   SOFTBANK -14.1%",
    x0 + textWidth("MARKETS", 2) + 24, 512, 2, WHITE);
  drawText("BTC $58,123 -3.1% (LOW $57,990)   GOLD -1%   ETF OUTFLOW $4.71BN",
    x0, 536, 2, WHITE);
}

interface Brief { tag: string; head: string; body: string; }
const BRIEFS: Brief[] = [
  { tag: "ASIA ROUT", head: "KOSPI -6.16% IN ROUT",
    body: "SEOUL 4,697.51. SIDECAR HALTS SELLING AS $186BN IS WIPED OUT. TAIWAN -4.5%, CHIP STOCKS ABOUT -9%." },
  { tag: "STRAIT OF HORMUZ", head: "MINES HIT THE TANKERS",
    body: "IRGC NAVY SAYS 2 TANKERS HIT. IRAN CLAIMS IT DOWNED A US MQ-9 DRONE. OIL EASED DESPITE THE ATTACKS." },
  { tag: "UKRAINE / RUSSIA", head: "DRONES HIT REFINERIES",
    body: "SYZRAN AND KUIBYSHEV IN SAMARA HIT. PUTIN: RETALIATION IS INEVITABLE. RECORDS: 490,000+ WAR DEAD." },
  { tag: "MIDDLE EAST", head: "HAMAS CHIEF KILLED",
    body: "ABU NAHEL AND 6 OTHERS KILLED IN STRIKES DESPITE THE TRUCE. ZELENSKY: US PUSHES PEACE DEAL BY JANUARY." },
  { tag: "US DATA", head: "CONSUMER MOOD HOLDS",
    body: "US CONSUMER CONFIDENCE 103.3 IN NOVEMBER. JOBLESS CLAIMS 189,000. DURABLE GOODS +0.2%, BELOW FORECAST." },
  { tag: "AHEAD", head: "WHAT TO WATCH NEXT",
    body: "FED DECISION 9 DECEMBER. OPEC+ MEETS 29 NOVEMBER. HIKE ODDS NEAR 97% BEFORE THE DATA. GOLD -1%." },
];

function drawBriefs(): void {
  const colW = 468, rowH = 118, gap = 6;
  const xs = [32, 524];
  const ys = [580, 704, 828];
  BRIEFS.forEach((b, i) => {
    const x = xs[i % 2], y = ys[Math.floor(i / 2)];
    fillRect(x, y, colW, rowH, WHITE);
    rectOutline(x, y, colW, rowH, BLACK, 2);
    fillRect(x, y, colW, 4, RED);
    drawText(b.tag, x + 14, y + 12, 2, RED);
    drawText(b.head, x + 14, y + 36, 3, BLACK);
    drawWrapped(b.body, x + 14, y + 66, 2, BLACK, colW - 28, 16);
  });
}

function drawFooter(): void {
  fillRect(0, 954, W, 70, BLACK);
  drawCentred("WEDNESDAY 25 NOVEMBER 2026", 512, 968, 2, WHITE);
  drawCentred("EVENING EXTRA • ALL FIGURES AS REPORTED 25 NOVEMBER 2026", 512, 992, 2, WHITE);
}

function drawPage(): void {
  fillRect(0, 0, W, H, PAPER);
  drawMasthead();
  drawKickerAndHeadline();
  drawDataRow();
  drawMarketsStrip();
  drawBriefs();
  drawFooter();
}

// ---------- main ----------
function main(): void {
  drawPage();
  const outDir = process.env.MAKEFUN_OUTPUT_DIR || "out";
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "entry.png");
  fs.writeFileSync(outPath, encodePNG());
  console.log(`wrote ${outPath} (${W}x${H})`);
}
main();
