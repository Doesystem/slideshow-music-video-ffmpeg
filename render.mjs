/**
 * render.mjs
 * generate composition แล้ว render ด้วย ffmpeg
 * ใช้ spawnSync แทน execSync เพื่อหลีกเลี่ยง Windows CMD command line limit
 *
 * วิธีใช้:
 *   node render.mjs               → 16:9 (default)
 *   node render.mjs --aspect 9:16  → 9:16 portrait
 */

import fs from "fs";
import path from "path";
import { execSync, spawnSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ส่ง arguments ทั้งหมดต่อไปยัง generate.mjs
const args = process.argv.slice(2).join(" ");

console.log("🔧 Generating composition...\n");
execSync(`node generate.mjs ${args}`, { stdio: "inherit", cwd: __dirname });

// อ่าน meta จาก generate
const metaFile = path.join(__dirname, ".render-meta.json");
if (!fs.existsSync(metaFile)) {
  console.error("❌ ไม่พบ .render-meta.json — generate.mjs อาจ error");
  process.exit(1);
}
const { ffmpegArgs, outputFile } = JSON.parse(fs.readFileSync(metaFile, "utf8"));

console.log("\n🎬 Rendering...\n");

// ใช้ spawnSync ส่ง args เป็น array โดยตรง
// ไม่ผ่าน shell → ไม่มี command line length limit
const result = spawnSync("ffmpeg", ffmpegArgs, {
  stdio: "inherit",
  cwd: __dirname,
});

if (result.status !== 0) {
  console.error("\n❌ ffmpeg error (exit code:", result.status, ")");
  process.exit(1);
}

console.log(`\n✅ Render เสร็จแล้ว → ${path.relative(__dirname, outputFile)}`);
