import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { mkdirSync } from "node:fs";

// sharp ships with Next but isn't hoisted under pnpm, so resolve it through next.
const require = createRequire(import.meta.url);
const sharp = createRequire(require.resolve("next/package.json"))("sharp");

const W = 1920;
const H = 1080;
const HORIZON = 470;
const VANISH_X = 1180;
const OUT = join(import.meta.dirname, "..", "src", "assets", "hero-poster.jpg");

const lerp = (a, b, t) => a + (b - a) * t;

// Perspective: t=0 at the horizon, t=1 at the bottom edge. Squaring t compresses distant marks.
const pointAt = (edgeX, t) => {
  const depth = t * t;
  return [lerp(VANISH_X, edgeX, depth), lerp(HORIZON, H + 120, depth)];
};

const runwayLeft = -260;
const runwayRight = 2500;

const edgeLights = (edgeX) =>
  Array.from({ length: 26 }, (_, i) => {
    const t = (i + 1) / 26;
    const [x, y] = pointAt(edgeX, t);
    const r = lerp(0.8, 9, t * t);
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="url(#light)"/>`;
  }).join("");

const centreline = Array.from({ length: 14 }, (_, i) => {
  const t0 = (i + 0.15) / 14;
  const t1 = (i + 0.6) / 14;
  const half = (t) => lerp(0.4, 16, t * t);
  const [x0, y0] = pointAt((runwayLeft + runwayRight) / 2, t0);
  const [x1, y1] = pointAt((runwayLeft + runwayRight) / 2, t1);
  return `<polygon points="${x0 - half(t0)},${y0} ${x0 + half(t0)},${y0} ${x1 + half(t1)},${y1} ${x1 - half(t1)},${y1}" fill="#f2b705" opacity="0.85"/>`;
}).join("");

const [blX, blY] = pointAt(runwayLeft, 1);
const [brX, brY] = pointAt(runwayRight, 1);

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0a1429"/>
      <stop offset="0.55" stop-color="#16305f"/>
      <stop offset="1" stop-color="#3a4f7a"/>
    </linearGradient>
    <radialGradient id="glow" cx="${VANISH_X / W}" cy="1" r="0.55">
      <stop offset="0" stop-color="#f2b705" stop-opacity="0.45"/>
      <stop offset="0.35" stop-color="#e07a3a" stop-opacity="0.18"/>
      <stop offset="1" stop-color="#e07a3a" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#1b2433"/>
      <stop offset="1" stop-color="#080c14"/>
    </linearGradient>
    <linearGradient id="tarmac" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2a3446"/>
      <stop offset="1" stop-color="#121822"/>
    </linearGradient>
    <radialGradient id="light">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="0.35" stop-color="#fff4d0" stop-opacity="0.9"/>
      <stop offset="1" stop-color="#f2b705" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${HORIZON}" fill="url(#sky)"/>
  <rect width="${W}" height="${HORIZON}" fill="url(#glow)"/>
  <rect y="${HORIZON}" width="${W}" height="${H - HORIZON}" fill="url(#ground)"/>
  <polygon points="${VANISH_X - 2},${HORIZON} ${VANISH_X + 2},${HORIZON} ${brX},${brY} ${blX},${blY}" fill="url(#tarmac)"/>
  ${centreline}
  ${edgeLights(runwayLeft)}
  ${edgeLights(runwayRight)}
</svg>`;

mkdirSync(dirname(OUT), { recursive: true });
await sharp(Buffer.from(svg)).jpeg({ quality: 84, mozjpeg: true }).toFile(OUT);
console.log(`✓ Wrote ${OUT}`);
