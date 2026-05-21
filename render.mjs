/**
 * render.mjs
 * generate composition แล้ว render ด้วย ffmpeg
 *
 * วิธีใช้:
 *   node render.mjs               → 16:9 (default)
 *   node render.mjs --aspect 9:16  → 9:16 portrait
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ส่ง arguments ทั้งหมดต่อไปยัง generate.mjs
const args = process.argv.slice(2).join(" ");

console.log("🔧 Generating composition...\n");
execSync(`node generate.mjs ${args}`, { stdio: "inherit", cwd: __dirname });

// อ่าน output path จาก meta ที่ generate เขียนไว้
const metaFile = path.join(__dirname, ".render-meta.json");
if (!fs.existsSync(metaFile)) {
  console.error("❌ ไม่พบ .render-meta.json — generate.mjs อาจ error");
  process.exit(1);
}
const { outputFile } = JSON.parse(fs.readFileSync(metaFile, "utf8"));

// อ่าน ffmpeg command จาก render.sh
const cmdFile = path.join(__dirname, "render.sh");
if (!fs.existsSync(cmdFile)) {
  console.error("❌ ไม่พบ render.sh — generate.mjs อาจ error");
  process.exit(1);
}

const script = fs.readFileSync(cmdFile, "utf8");
const cmd = script
  .split("\n")
  .filter((l) => l.trim() && !l.startsWith("#"))
  .join(" ")
  .replace(/\\\s+/g, " ")
  .trim();

console.log("\n🎬 Rendering...\n");
try {
  execSync(cmd, { stdio: "inherit", cwd: __dirname });
  console.log(`\n✅ Render เสร็จแล้ว → ${path.relative(__dirname, outputFile)}`);
} catch (err) {
  console.error("\n❌ ffmpeg error:", err.message);
  process.exit(1);
}
