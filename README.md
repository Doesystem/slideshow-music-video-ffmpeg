# slideshow-music-video-ffmpeg

สร้าง music video จากรูปภาพ slideshow + เพลง โดยใช้ [ffmpeg](https://ffmpeg.org) โดยตรง  
รองรับ **16:9** (landscape) และ **9:16** (portrait/vertical)

## โครงสร้างโปรเจ็ค

```
slideshow-music-video-ffmpeg/
├── image/          # รูปภาพสำหรับ slideshow (jpg, png, webp, gif)
├── song/           # ไฟล์เพลง (mp3, aac, wav, flac, m4a)
├── output/         # ผลลัพธ์ (auto-generated)
│   ├── ชื่อเพลง_landscape.mp4
│   └── ชื่อเพลง_portrait.mp4
├── generate.mjs    # script สร้าง ffmpeg command
├── render.mjs      # script generate + render ในขั้นตอนเดียว
├── render.sh       # ffmpeg command ที่ generate สร้างให้ (auto-generated)
└── package.json
```

## วิธีใช้

### 1. เตรียมไฟล์

- วางรูปภาพไว้ใน `image/`
- วางไฟล์เพลงไว้ใน `song/`

### 2. Render

```bash
# 16:9 landscape (1920×1080) — default
npm run render

# 9:16 portrait (1080×1920) — สำหรับ Reels / TikTok / Shorts
npm run render:portrait
```

output จะถูกบันทึกที่ `output/<ชื่อเพลง>_landscape.mp4` หรือ `output/<ชื่อเพลง>_portrait.mp4`

### หรือระบุ aspect ratio โดยตรง

```bash
node render.mjs --aspect 16:9
node render.mjs --aspect 9:16
```

### แยกขั้นตอน generate กับ render

```bash
# ดู ffmpeg command ก่อน render
npm run generate
npm run generate:portrait

# render จาก command ที่ generate สร้างไว้
node render.mjs
```

## Config

แก้ค่าใน `generate.mjs`:

| ตัวแปร | ค่าเริ่มต้น | คำอธิบาย |
|---|---|---|
| `SLIDE_DURATION` | `8` | ระยะเวลาแสดงแต่ละรูป (วินาที) |
| `CROSSFADE` | `0.5` | ระยะเวลา crossfade ระหว่างรูป (วินาที) |
| `FPS` | `30` | frame rate ของ output |

> ไม่ต้องระบุความยาวเพลงหรือขนาดวิดีโอ — script จัดการให้อัตโนมัติ

## การทำงาน

1. ใช้ `ffprobe` หาความยาวเพลงอัตโนมัติ
2. random รูปจาก `image/` จนครบความยาวเพลง โดยไม่ให้รูปเดิมซ้ำกัน 2 ครั้งติดกัน
3. สร้าง ffmpeg filter complex:
   - `scale` + `crop` รูปให้เต็มจอตาม aspect ratio (cover, ไม่มีแถบดำ)
   - `xfade=transition=fade` crossfade ระหว่างทุกรูป
4. mix เพลงเข้า video ด้วย `-shortest`
5. บันทึกไปที่ `output/<ชื่อเพลง>_<landscape|portrait>.mp4`

## Output spec

| ค่า | รายละเอียด |
|---|---|
| Video codec | H.264 (libx264), CRF 18 |
| Audio codec | AAC, 192 kbps |
| 16:9 | 1920×1080 |
| 9:16 | 1080×1920 |
| FPS | 30 |
| Format | MP4 |

## Requirements

- Node.js 18+
- FFmpeg พร้อม ffprobe — ติดตั้งได้จาก [ffmpeg.org](https://ffmpeg.org/download.html)

```bash
ffmpeg -version
ffprobe -version
```
