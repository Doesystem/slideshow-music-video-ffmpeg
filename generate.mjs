/**
 * generate.mjs
 * สร้าง ffmpeg command สำหรับทำ slideshow music video
 * - random รูปจาก image/ หรือ subfolder ที่ระบุ จนครบความยาวเพลง
 * - Ken Burns zoom-in แต่ละรูป
 * - crossfade ระหว่างรูปด้วย xfade filter
 * - ชื่อเพลง overlay ตลอดวิดีโอ
 * - mix เพลงจาก song/
 * - รองรับ 16:9 (landscape) และ 9:16 (portrait)
 *
 * วิธีใช้:
 *   node generate.mjs                          → รูปทั้งหมดใน image/, 16:9
 *   node generate.mjs --aspect 9:16            → portrait
 *   node generate.mjs --images nature          → รูปจาก image/nature/
 *   node generate.mjs --images nature,people   → รูปจาก image/nature/ และ image/people/
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ===== parse arguments =====
const args = process.argv.slice(2);

// helper: หาค่าของ flag เช่น --aspect 9:16 → "9:16"
function getArg(flag, defaultVal = null) {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return defaultVal;
  return args[idx + 1];
}

const aspectArg = getArg("--aspect", "16:9");
const imagesArg = getArg("--images", null); // "nature" หรือ "nature,people"

const ASPECT_PRESETS = {
  "16:9": { width: 1920, height: 1080, label: "landscape" },
  "9:16": { width: 1080, height: 1920, label: "portrait" },
};

if (!ASPECT_PRESETS[aspectArg]) {
  console.error(`❌ --aspect ต้องเป็น 16:9 หรือ 9:16 (ได้รับ: ${aspectArg})`);
  process.exit(1);
}

const { width: WIDTH, height: HEIGHT, label: ASPECT_LABEL } = ASPECT_PRESETS[aspectArg];

// ===== CONFIG =====
const IMAGE_DIR  = path.join(__dirname, "image");
const SONG_DIR   = path.join(__dirname, "song");
const OUTPUT_DIR = path.join(__dirname, "output");
const SLIDE_DURATION = 8;    // วินาทีต่อรูป
const CROSSFADE      = 0.5;  // วินาที crossfade ระหว่างรูป
const FPS            = 30;
const ZOOM_START     = 1.0;  // zoom เริ่มต้น (1.0 = ขนาดปกติ)
const ZOOM_END       = 1.12; // zoom สุดท้าย (1.12 = ซูมเข้า 12%)

// ขนาด font ตาม aspect
const FONT_SIZE = ASPECT_LABEL === "portrait" ? 72 : 64;
// ===== ==================

// --- สร้าง output/ ถ้ายังไม่มี ---
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);
// --- หาไฟล์เพลงแรกใน song/ ---
const songFiles = fs
  .readdirSync(SONG_DIR)
  .filter((f) => /\.(mp3|aac|wav|flac|m4a)$/i.test(f));

if (songFiles.length === 0) {
  console.error("❌ ไม่พบไฟล์เพลงใน song/");
  process.exit(1);
}

const songFileName = songFiles[0];
const SONG_FILE    = path.join(SONG_DIR, songFileName);
const songBaseName = path.basename(songFileName, path.extname(songFileName));
const OUTPUT_FILE  = path.join(OUTPUT_DIR, `${songBaseName}_${ASPECT_LABEL}.mp4`);

console.log(`🎵 เพลง: ${songFileName}`);
console.log(`📐 Aspect: ${aspectArg} (${WIDTH}×${HEIGHT})`);
console.log(`💾 Output: output/${path.basename(OUTPUT_FILE)}`);

// --- หาความยาวเพลงด้วย ffprobe ---
let SONG_DURATION;
try {
  const result = execSync(
    `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${SONG_FILE}"`,
    { encoding: "utf8" }
  ).trim();
  SONG_DURATION = parseFloat(result);
  console.log(`⏱  ความยาวเพลง: ${SONG_DURATION.toFixed(2)}s`);
} catch {
  console.error("❌ ffprobe ไม่พบหรือ error — ตรวจสอบว่าติดตั้ง ffmpeg แล้ว");
  process.exit(1);
}

// --- หารูปทั้งหมดจาก folder ที่ระบุ ---
const IMAGE_EXT = /\.(jpe?g|png|webp|gif)$/i;

function scanImages(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => IMAGE_EXT.test(f))
    .map((f) => path.join(dir, f));
}

let images;
let imageSourceLabel; // สำหรับแสดงใน log

if (imagesArg) {
  // --images nature  หรือ  --images nature,people,city
  const folders = imagesArg.split(",").map((s) => s.trim()).filter(Boolean);
  const invalidFolders = folders.filter((f) => !fs.existsSync(path.join(IMAGE_DIR, f)));
  if (invalidFolders.length > 0) {
    console.error(`❌ ไม่พบ folder: ${invalidFolders.map((f) => `image/${f}`).join(", ")}`);
    console.error(`   folder ที่มีอยู่: ${fs.readdirSync(IMAGE_DIR).filter((f) => fs.statSync(path.join(IMAGE_DIR, f)).isDirectory()).join(", ") || "(ไม่มี)"}`);
    process.exit(1);
  }
  images = folders.flatMap((f) => scanImages(path.join(IMAGE_DIR, f)));
  imageSourceLabel = folders.map((f) => `image/${f}`).join(", ");
} else {
  // ไม่ระบุ --images → ใช้รูปทั้งหมดใน image/ (รวม subfolder)
  const topLevel = scanImages(IMAGE_DIR);
  const subDirs  = fs.readdirSync(IMAGE_DIR)
    .filter((f) => fs.statSync(path.join(IMAGE_DIR, f)).isDirectory())
    .flatMap((d) => scanImages(path.join(IMAGE_DIR, d)));
  images = [...topLevel, ...subDirs];
  imageSourceLabel = "image/ (ทั้งหมด)";
}

if (images.length === 0) {
  console.error(`❌ ไม่พบรูปภาพใน ${imageSourceLabel}`);
  process.exit(1);
}

console.log(`🖼  รูปจาก: ${imageSourceLabel} (${images.length} ไฟล์)`);

// --- random รูปโดยไม่ให้ซ้ำกัน 2 ครั้งติดกัน ---
function pickRandom(pool, lastPick) {
  if (pool.length === 1) return pool[0];
  let pick;
  do {
    pick = pool[Math.floor(Math.random() * pool.length)];
  } while (pick === lastPick);
  return pick;
}

const effectiveDuration = SLIDE_DURATION - CROSSFADE;
const slideCount = Math.ceil(SONG_DURATION / effectiveDuration) + 1;

const slides = [];
let last = null;
for (let i = 0; i < slideCount; i++) {
  last = pickRandom(images, last);
  slides.push(last);
}

console.log(`📸 สร้าง ${slides.length} slides (รูปละ ${SLIDE_DURATION}s, crossfade ${CROSSFADE}s)`);
console.log("   ลำดับ:", slides.map((s) => path.basename(s)).join(" → "));

// ===== สร้าง ffmpeg filter_complex =====
//
// pipeline ต่อ slide:
//   input → scale (cover) → crop → zoompan (Ken Burns) → [vN]
//
// pipeline รวม:
//   [v0][v1] xfade → [xf1]
//   [xf1][v2] xfade → [xf2]
//   ...
//   [xfN] → drawtext (ชื่อเพลง) → [vout]

const inputs     = [];
const filterParts = [];

// จำนวน frames ต่อ slide (zoompan ต้องการ d=frames)
const FRAMES_PER_SLIDE = SLIDE_DURATION * FPS;

// zoom expression: เพิ่มจาก ZOOM_START → ZOOM_END ตลอด FRAMES_PER_SLIDE frames
// zoom(t) = ZOOM_START + (ZOOM_END - ZOOM_START) * (on / FRAMES_PER_SLIDE)
// 'on' = frame number ภายใน clip (reset ทุก slide)
const zoomExpr = `${ZOOM_START}+${(ZOOM_END - ZOOM_START).toFixed(4)}*on/${FRAMES_PER_SLIDE}`;

// --- inputs: รูปแต่ละรูป ---
for (const img of slides) {
  inputs.push(`-loop 1 -t ${SLIDE_DURATION} -i "${img}"`);
}

// --- input: เพลง ---
inputs.push(`-i "${SONG_FILE}"`);
const audioInputIndex = slides.length;

// --- filter per slide: scale → crop → zoompan ---
const scaledLabels = [];
for (let i = 0; i < slides.length; i++) {
  const label = `v${i}`;

  // scale ให้ใหญ่กว่า canvas เผื่อ zoom (ZOOM_END * canvas size)
  // เพื่อไม่ให้เห็นขอบดำตอน zoom
  const scaleW = Math.ceil(WIDTH  * ZOOM_END);
  const scaleH = Math.ceil(HEIGHT * ZOOM_END);

  filterParts.push(
    // 1. scale ให้ cover canvas * ZOOM_END (เผื่อ zoom)
    `[${i}:v]scale=${scaleW}:${scaleH}:force_original_aspect_ratio=increase,` +
    // 2. crop ให้ได้ขนาด canvas * ZOOM_END ตรงกลาง
    `crop=${scaleW}:${scaleH},` +
    // 3. zoompan: zoom เข้าจากกลางภาพ, output ขนาด WIDTH x HEIGHT
    `zoompan=z='${zoomExpr}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':` +
    `d=${FRAMES_PER_SLIDE}:s=${WIDTH}x${HEIGHT}:fps=${FPS},` +
    `setsar=1[${label}]`
  );
  scaledLabels.push(label);
}

// --- xfade ต่อกันทีละคู่ ---
let currentLabel = scaledLabels[0];
for (let i = 1; i < slides.length; i++) {
  const offset   = (i * effectiveDuration).toFixed(3);
  const nextLabel = scaledLabels[i];
  const outLabel  = i === slides.length - 1 ? "xfall" : `xf${i}`;
  filterParts.push(
    `[${currentLabel}][${nextLabel}]xfade=transition=fade:duration=${CROSSFADE}:offset=${offset}[${outLabel}]`
  );
  currentLabel = outLabel;
}

// --- drawtext: ชื่อเพลง overlay ---
// - กลางจอทั้ง landscape และ portrait
// - word wrap อัตโนมัติ: ตัดบรรทัดใน Node.js ก่อนส่งให้ drawtext
// - random สี: stack drawtext หลายชั้น แต่ละชั้น enable ช่วงเวลาต่างกัน

// font path — ใช้ Tahoma รองรับภาษาไทย (มีใน Windows ทุกเวอร์ชัน)
const fontPath = "C\\:/Windows/Fonts/tahoma.ttf";

// --- word wrap ---
// ประมาณความกว้างตัวอักษร (Tahoma ขนาด FONT_SIZE ≈ 0.55 * fontSize per char)
// ใช้ค่า conservative เพื่อให้ข้อความไม่ล้นขอบ
const MAX_LINE_WIDTH = Math.floor(WIDTH * 0.8); // 80% ของความกว้างจอ
const CHAR_WIDTH_EST = FONT_SIZE * 0.6;         // ประมาณความกว้างต่อตัวอักษร
const MAX_CHARS_PER_LINE = Math.floor(MAX_LINE_WIDTH / CHAR_WIDTH_EST);

function wrapText(text, maxChars) {
  // ตัดตามช่องว่างก่อน ถ้าไม่มีช่องว่างให้ตัดตามความยาว
  const words = text.split(/\s+/);
  const lines = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (test.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

const titleLines = wrapText(songBaseName, MAX_CHARS_PER_LINE);
const lineCount  = titleLines.length;
const lineHeight = Math.round(FONT_SIZE * 1.3);

// y กลางจอ: คำนวณให้ block ข้อความอยู่กึ่งกลางแนวตั้ง
const blockHeight = lineCount * lineHeight;
const textBlockY  = Math.round((HEIGHT - blockHeight) / 2);

// alpha expression: fade in 1s, fade out 1s สุดท้าย
const fadeOutStart = SONG_DURATION - 1;
const alphaExpr =
  `if(lt(t,1),t,if(gt(t,${fadeOutStart.toFixed(2)}),(${SONG_DURATION.toFixed(2)}-t),1))`;

// --- random color palette ---
// สีสดใส อ่านง่ายบนรูปภาพ
const COLOR_PALETTE = [
  "white",
  "#FFD700",  // gold
  "#FF6B6B",  // coral red
  "#4ECDC4",  // turquoise
  "#A8E6CF",  // mint green
  "#FFB347",  // orange
  "#DDA0DD",  // plum
  "#87CEEB",  // sky blue
  "#F0E68C",  // khaki yellow
  "#FF69B4",  // hot pink
];

// เปลี่ยนสีทุก SLIDE_DURATION วินาที (sync กับการเปลี่ยนรูป)
const COLOR_INTERVAL = SLIDE_DURATION;

// escape text สำหรับ drawtext
function escapeDrawtext(s) {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/:/g, "\\:");
}

// สร้าง drawtext filter สำหรับแต่ละสี
// แต่ละ layer enable เฉพาะช่วงเวลาที่เป็นสีนั้น
// ใช้ input label [xfall] → chain ผ่านทุก layer → [vout]

let chainIn = "xfall";

// สร้าง color schedule: กำหนดว่าแต่ละช่วงเวลาใช้สีอะไร
// random สีโดยไม่ซ้ำกัน 2 ครั้งติดกัน
const totalSlots = Math.ceil(SONG_DURATION / COLOR_INTERVAL) + 1;
const colorSchedule = [];
let lastColor = null;
for (let i = 0; i < totalSlots; i++) {
  let color;
  do {
    color = COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)];
  } while (color === lastColor);
  colorSchedule.push(color);
  lastColor = color;
}

// group slots ที่ใช้สีเดียวกันติดกันเข้าด้วยกัน → ลดจำนวน drawtext layers
// สร้าง segments: [{color, start, end}, ...]
const segments = [];
for (let i = 0; i < colorSchedule.length; i++) {
  const tStart = i * COLOR_INTERVAL;
  const tEnd   = Math.min((i + 1) * COLOR_INTERVAL, SONG_DURATION);
  if (segments.length > 0 && segments[segments.length - 1].color === colorSchedule[i]) {
    segments[segments.length - 1].end = tEnd;
  } else {
    segments.push({ color: colorSchedule[i], start: tStart, end: tEnd });
  }
}

// สร้าง drawtext layer ต่อ segment
// แต่ละ layer วาดทุกบรรทัดของชื่อเพลง
for (let si = 0; si < segments.length; si++) {
  const { color, start, end } = segments[si];
  const isLast = si === segments.length - 1;
  const outLabel = isLast ? "vout" : `dt${si}`;

  // enable เฉพาะช่วงเวลานี้
  const enableExpr = `between(t,${start.toFixed(3)},${end.toFixed(3)})`;

  // วาดทีละบรรทัด โดย chain ผ่าน drawtext ซ้อนกัน
  // บรรทัดแรก: [chainIn] → [tmp_si_0]
  // บรรทัดถัดไป: [tmp_si_N] → [tmp_si_N+1]
  // บรรทัดสุดท้าย: → [outLabel]
  for (let li = 0; li < titleLines.length; li++) {
    const lineText = escapeDrawtext(titleLines[li]);
    const lineY    = textBlockY + li * lineHeight;
    const isLastLine = li === titleLines.length - 1;

    const lineIn  = li === 0 ? chainIn : `tmp_${si}_${li - 1}`;
    const lineOut = isLastLine ? outLabel : `tmp_${si}_${li}`;

    filterParts.push(
      `[${lineIn}]drawtext=` +
      `fontfile='${fontPath}':` +
      `text='${lineText}':` +
      `fontsize=${FONT_SIZE}:` +
      `fontcolor=${color}:` +
      `alpha='${alphaExpr}':` +
      `shadowcolor=black@0.7:shadowx=3:shadowy=3:` +
      `x=(w-text_w)/2:y=${lineY}:` +
      `enable='${enableExpr}'[${lineOut}]`
    );
  }

  chainIn = outLabel;
}

console.log(`🎨 Text: ${lineCount} บรรทัด, ${segments.length} color segments`);

const filterComplex = filterParts.join("; ");

// --- บันทึก filter_complex ลงไฟล์แยก ---
// ใช้ -filter_complex_script แทนการใส่ใน command line
// เพื่อหลีกเลี่ยง Windows CMD limit (~8191 chars)
const filterScriptFile = path.join(__dirname, "filter.txt");
fs.writeFileSync(filterScriptFile, filterComplex, "utf8");

// --- สร้าง ffmpeg args array (ไม่ใช่ string เพื่อหลีกเลี่ยง shell limit) ---
const ffmpegArgs = [
  "-y",
  // inputs: รูปแต่ละรูป + เพลง (flatten จาก array of strings)
  ...inputs.flatMap((s) => s.match(/(?:[^\s"]+|"[^"]*")+/g).map((t) => t.replace(/^"|"$/g, ""))),
  "-filter_complex_script", filterScriptFile,
  "-map", "[vout]",
  "-map", `${audioInputIndex}:a`,
  "-c:v", "libx264",
  "-preset", "fast",
  "-crf", "18",
  "-c:a", "aac",
  "-b:a", "192k",
  "-pix_fmt", "yuv420p",
  "-shortest",
  OUTPUT_FILE,
];

// --- บันทึก meta สำหรับ render.mjs ---
const metaFile = path.join(__dirname, ".render-meta.json");
fs.writeFileSync(
  metaFile,
  JSON.stringify({ ffmpegArgs, outputFile: OUTPUT_FILE }),
  "utf8"
);

console.log(`\n✅ บันทึก filter script ไว้ที่ filter.txt`);
console.log("\n▶  รัน: npm run render");
