# slideshow-music-video-ffmpeg

สร้าง music video จากรูปภาพ slideshow + เพลง โดยใช้ [ffmpeg](https://ffmpeg.org) โดยตรง

## โครงสร้างโปรเจ็ค

```
slideshow-music-video-ffmpeg/
├── image/          # รูปภาพสำหรับ slideshow (jpg, png, webp, gif)
├── song/           # ไฟล์เพลง (mp3, aac, wav, flac, m4a)
├── generate.mjs    # script สร้าง ffmpeg command + render.sh
├── render.mjs      # script รัน generate แล้ว render เลย
├── render.sh       # ffmpeg command ที่ generate สร้างให้ (auto-generated)
├── output.mp4      # ผลลัพธ์ (auto-generated)
└── package.json
```

## วิธีใช้

### 1. เตรียมไฟล์

- วางรูปภาพไว้ใน `image/`
- วางไฟล์เพลงไว้ใน `song/`

### 2. แก้ config (ถ้าต้องการ)

```js
// generate.mjs
const SLIDE_DURATION = 8;   // วินาทีต่อรูป
const CROSSFADE = 0.5;      // วินาที crossfade ระหว่างรูป
const WIDTH = 1920;
const HEIGHT = 1080;
const FPS = 30;
```

> ไม่ต้องระบุความยาวเพลง — script ใช้ `ffprobe` หาให้อัตโนมัติ

### 3. Render

```bash
npm run render
```

ทำทุกขั้นตอนในคำสั่งเดียว: random รูป → สร้าง ffmpeg command → render → `output.mp4`

### หรือแยกขั้นตอน

```bash
# ดู ffmpeg command ก่อน render
npm run generate

# render จาก command ที่ generate สร้างไว้
node render.mjs
```

## การทำงาน

1. `generate.mjs` ใช้ `ffprobe` หาความยาวเพลงอัตโนมัติ
2. random รูปจาก `image/` จนครบความยาวเพลง โดยไม่ให้รูปเดิมซ้ำกัน 2 ครั้งติดกัน
3. สร้าง ffmpeg filter complex:
   - `scale` + `pad` รูปให้ได้ขนาด WIDTH × HEIGHT (letterbox ถ้าสัดส่วนไม่ตรง)
   - `xfade=transition=fade` crossfade ระหว่างทุกรูป
4. mix เพลงเข้า video ด้วย `-shortest` (ตัดตามความยาวที่สั้นกว่า)
5. encode เป็น H.264 + AAC

## Output

| ค่า | รายละเอียด |
|---|---|
| Video codec | H.264 (libx264), CRF 18 |
| Audio codec | AAC, 192 kbps |
| ขนาด | 1920×1080 (ปรับได้ใน config) |
| FPS | 30 |
| Format | MP4 |

## Requirements

- Node.js 18+
- FFmpeg พร้อม ffprobe — ติดตั้งได้จาก [ffmpeg.org](https://ffmpeg.org/download.html)

ตรวจสอบว่าติดตั้งแล้ว:

```bash
ffmpeg -version
ffprobe -version
```
