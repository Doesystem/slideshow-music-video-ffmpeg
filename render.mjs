/**
 * render.mjs
 * อ่าน ffmpeg command จาก generate.mjs แล้วรันเลย
 * (generate + render ในขั้นตอนเดียว)
 *
 * วิธีใช้: node render.mjs
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// run generate ก่อน
console.log("🔧 Generating composition...\n");
execSync("node generate.mjs", { stdio: "inherit", cwd: __dirname });

// อ่าน command จาก render.sh
const cmdFile = path.join(__dirname, "render.sh");
if (!fs.existsSync(cmdFile)) {
  console.error("❌ ไม่พบ render.sh — generate.mjs อาจ error");
  process.exit(1);
}

const script = fs.readFileSync(cmdFile, "utf8");
// ดึงเฉพาะ ffmpeg command (ข้าม shebang)
const cmd = script
  .split("\n")
  .filter((l) => l.trim() && !l.startsWith("#"))
  .join(" ")
  .replace(/\\\s+/g, " ")
  .trim();

console.log("\n🎬 Rendering...\n");
try {
  execSync(cmd, { stdio: "inherit", cwd: __dirname });
  console.log("\n✅ Render เสร็จแล้ว → output.mp4");
} catch (err) {
  console.error("\n❌ ffmpeg error:", err.message);
  process.exit(1);
}
