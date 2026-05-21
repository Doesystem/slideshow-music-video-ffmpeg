/**
 * generate.mjs
 * สร้าง ffmpeg command สำหรับทำ slideshow music video
 * - random รูปจาก image/ จนครบความยาวเพลง
 * - crossfade ระหว่างรูปด้วย xfade filter
 * - mix เพลงจาก song/
 *
 * วิธีใช้: node generate.mjs
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ===== CONFIG =====
const IMAGE_DIR = path.join(__dirname, "image");
const SONG_DIR = path.join(__dirname, "song");
const OUTPUT = "output.mp4";
const SLIDE_DURATION = 8;    // วินาทีต่อรูป
const CROSSFADE = 0.5;       // วินาที crossfade ระหว่างรูป
const WIDTH = 1920;
const HEIGHT = 1080;
const FPS = 30;
// ==================

// --- หาไฟล์เพลงแรกใน song/ ---
const songFiles = fs.readdirSync(SONG_DIR).filter((f) => /\.(mp3|aac|wav|flac|m4a)$/i.test(f));
if (songFiles.length === 0) {
  console.error("❌ ไม่พบไฟล์เพลงใน song/");
  process.exit(1);
}
const SONG_FILE = path.join(SONG_DIR, songFiles[0]);
console.log(`🎵 เพลง: ${songFiles[0]}`);

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

// --- หารูปทั้งหมดใน image/ ---
const images = fs
  .readdirSync(IMAGE_DIR)
  .filter((f) => /\.(jpe?g|png|webp|gif)$/i.test(f))
  .map((f) => path.join(IMAGE_DIR, f));

if (images.length === 0) {
  console.error("❌ ไม่พบรูปภาพใน image/");
  process.exit(1);
}

// --- random รูปโดยไม่ให้ซ้ำกัน 2 ครั้งติดกัน ---
function pickRandom(pool, lastPick) {
  if (pool.length === 1) return pool[0];
  let pick;
  do {
    pick = pool[Math.floor(Math.random() * pool.length)];
  } while (pick === lastPick);
  return pick;
}

// คำนวณจำนวน slides ที่ต้องการ
// effective duration ต่อ slide = SLIDE_DURATION - CROSSFADE (เพราะ overlap)
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

// ===== สร้าง ffmpeg command =====
//
// แนวทาง:
// 1. input แต่ละรูปด้วย -loop 1 -t SLIDE_DURATION
// 2. scale รูปให้ได้ขนาด WIDTH x HEIGHT (pad ถ้าสัดส่วนไม่ตรง)
// 3. ต่อรูปด้วย xfade filter (crossfade)
// 4. mix เพลงด้วย -i SONG_FILE และ -shortest เพื่อตัดตาม video

const inputs = [];
const filterParts = [];

// --- inputs: รูปแต่ละรูป ---
for (const img of slides) {
  inputs.push(`-loop 1 -t ${SLIDE_DURATION} -i "${img}"`);
}

// --- input: เพลง ---
inputs.push(`-i "${SONG_FILE}"`);
const audioInputIndex = slides.length; // index ของ audio input

// --- filter_complex ---
// ขั้นที่ 1: scale + pad แต่ละรูปให้ได้ขนาด WIDTH x HEIGHT
const scaledLabels = [];
for (let i = 0; i < slides.length; i++) {
  const label = `v${i}`;
  filterParts.push(
    `[${i}:v]scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=decrease,` +
    `pad=${WIDTH}:${HEIGHT}:(ow-iw)/2:(oh-ih)/2:black,` +
    `setsar=1,fps=${FPS}[${label}]`
  );
  scaledLabels.push(label);
}

// ขั้นที่ 2: xfade ต่อกันทีละคู่
// xfade offset = เวลาที่รูปถัดไปเริ่ม crossfade
// = (i * effectiveDuration) วินาทีนับจากต้น
let currentLabel = scaledLabels[0];
for (let i = 1; i < slides.length; i++) {
  const offset = (i * effectiveDuration).toFixed(3);
  const nextLabel = scaledLabels[i];
  const outLabel = i === slides.length - 1 ? "vout" : `xf${i}`;
  filterParts.push(
    `[${currentLabel}][${nextLabel}]xfade=transition=fade:duration=${CROSSFADE}:offset=${offset}[${outLabel}]`
  );
  currentLabel = outLabel;
}

const filterComplex = filterParts.join("; ");

// --- สร้าง command ---
const cmd = [
  "ffmpeg -y",
  inputs.join(" "),
  `-filter_complex "${filterComplex}"`,
  `-map "[vout]"`,
  `-map ${audioInputIndex}:a`,
  `-c:v libx264 -preset fast -crf 18`,
  `-c:a aac -b:a 192k`,
  `-pix_fmt yuv420p`,
  `-shortest`,
  `"${OUTPUT}"`,
].join(" \\\n  ");

// --- บันทึก command ลงไฟล์ ---
const cmdFile = path.join(__dirname, "render.sh");
fs.writeFileSync(cmdFile, `#!/bin/bash\n${cmd}\n`, "utf8");
console.log(`\n✅ บันทึก ffmpeg command ไว้ที่ render.sh`);

// --- แสดง command ---
console.log("\n📋 ffmpeg command:\n");
console.log(cmd);
console.log("\n▶  รัน: npm run render");
