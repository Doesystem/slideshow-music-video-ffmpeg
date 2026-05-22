# slideshow-music-video-ffmpeg

สร้าง music video จากรูปภาพ slideshow + เพลง โดยใช้ [ffmpeg](https://ffmpeg.org) โดยตรง  
รองรับ **16:9** (landscape) และ **9:16** (portrait/vertical)

## โครงสร้างโปรเจ็ค

```
slideshow-music-video-ffmpeg/
├── image/                  # รูปภาพสำหรับ slideshow
│   ├── photo1.jpg          # วางตรงๆ หรือจัดเป็น subfolder ก็ได้
│   ├── nature/             # subfolder แบ่งประเภท
│   │   ├── forest.jpg
│   │   └── mountain.jpg
│   └── people/
│       └── portrait.jpg
├── song/                   # ไฟล์เพลง (mp3, aac, wav, flac, m4a)
├── effects/                # ไฟล์ effect overlay (mp4, webm, mov) — optional
│   ├── rain.mp4            # พื้นหลังสีดำ → ใช้ --effect-mode screen
│   └── fog.mp4             # พื้นหลังสีเขียว → ใช้ --effect-mode chromakey
├── output/                 # ผลลัพธ์ (auto-generated)
│   ├── ชื่อเพลง_landscape.mp4
│   └── ชื่อเพลง_portrait.mp4
├── generate.mjs            # script สร้าง ffmpeg filter และ args
├── render.mjs              # script generate + render ในขั้นตอนเดียว
├── filter.txt              # filter_complex script (auto-generated)
└── package.json
```

## วิธีใช้

### 1. เตรียมไฟล์

- วางรูปภาพไว้ใน `image/` — รองรับ jpg, png, webp, gif ชื่อไฟล์อะไรก็ได้
- สร้าง subfolder ใน `image/` เพื่อแบ่งประเภทรูปได้ตามต้องการ
- วางไฟล์เพลงไว้ใน `song/` — ใช้ไฟล์แรกที่พบอัตโนมัติ

### 2. Render

```bash
# รูปทั้งหมดใน image/ (รวม subfolder), 16:9
npm run render

# รูปทั้งหมดใน image/, 9:16 portrait
npm run render:portrait

# เลือกเฉพาะ subfolder
node render.mjs --images nature
node render.mjs --images nature --aspect 9:16

# รวมหลาย subfolder (คั่นด้วย ,)
node render.mjs --images nature,people
node render.mjs --images nature,people --aspect 9:16

# เพิ่ม effect overlay — พื้นหลังสีดำ (ชื่อไฟล์ลงท้าย _black)
node render.mjs --effect rain_black.mp4
node render.mjs --effect snow_black.mp4 --aspect 9:16

# เพิ่ม effect overlay — พื้นหลังสีเขียว (ชื่อไฟล์ลงท้าย _green)
node render.mjs --effect fog_green.mp4

# ปรับสี chroma key (ถ้าพื้นหลังไม่ใช่สีเขียวมาตรฐาน)
node render.mjs --effect fog_green.mp4 --chroma-color 0x00FF00
```

output จะถูกบันทึกที่ `output/<ชื่อเพลง>_landscape.mp4` หรือ `output/<ชื่อเพลง>_portrait.mp4`

### ระบุ aspect ratio โดยตรง

```bash
node render.mjs --aspect 16:9
node render.mjs --aspect 9:16
```

### แยกขั้นตอน generate กับ render

```bash
# สร้าง filter.txt และ .render-meta.json ก่อน render
npm run generate
npm run generate:portrait

# render จาก meta ที่ generate สร้างไว้
node render.mjs
```

## Arguments

| Argument | ค่า | คำอธิบาย |
|---|---|---|
| `--aspect` | `16:9` (default) / `9:16` | aspect ratio ของ output |
| `--images` | ชื่อ subfolder | random รูปเฉพาะ subfolder ที่ระบุ คั่นหลาย folder ด้วย `,` |
| `--effect` | ชื่อไฟล์ใน `effects/` | ไฟล์ effect overlay ชื่อต้องลงท้ายด้วย `_black` หรือ `_green` |
| `--effect-opacity` | `0.4` (default), `0.0`-`1.0` | ความเข้มของ effect — น้อย = จาง, มาก = ชัด |
| `--chroma-color` | `0x00FF00` (default) | ปรับสี chroma key สำหรับไฟล์ `_green` ที่ไม่ใช่สีเขียวมาตรฐาน |

ถ้าไม่ระบุ `--images` จะใช้รูปทั้งหมดใน `image/` รวมทุก subfolder

## Effect Overlay

วางไฟล์ effect ไว้ใน `effects/` folder โดย **ตั้งชื่อให้ลงท้ายด้วย `_black` หรือ `_green`** เพื่อบอก mode อัตโนมัติ

| Suffix | พื้นหลัง | Blend mode | เหมาะกับ |
|---|---|---|---|
| `_black` | สีดำ | screen | ฝน, หิมะ, ประกายไฟ, แสง |
| `_green` | สีเขียว | chromakey | ควัน, หมอก, เอฟเฟกต์สีอ่อน |

ตัวอย่างชื่อไฟล์: `rain_black.mp4`, `snow_black.mp4`, `fog_green.mp4`

```bash
node render.mjs --effect rain_black.mp4
node render.mjs --effect fog_green.mp4
node render.mjs --effect snow_black.mp4 --images nature --aspect 9:16

# ปรับความเข้มของ effect (default: 0.5)
node render.mjs --effect rain_black.mp4 --effect-opacity 0.3   # จางลง
node render.mjs --effect rain_black.mp4 --effect-opacity 0.8   # เข้มขึ้น
```

แหล่งโหลด effect ฟรี: [Pixabay](https://pixabay.com/videos/search/rain%20overlay/) · [Pexels](https://www.pexels.com/search/videos/rain%20overlay/)

## Config

แก้ค่าใน `generate.mjs`:

| ตัวแปร | ค่าเริ่มต้น | คำอธิบาย |
|---|---|---|
| `SLIDE_DURATION` | `8` | ระยะเวลาแสดงแต่ละรูป (วินาที) |
| `CROSSFADE` | `0.5` | ระยะเวลา crossfade ระหว่างรูป (วินาที) |
| `FPS` | `30` | frame rate ของ output |
| `ZOOM_START` | `1.0` | zoom เริ่มต้น (1.0 = ขนาดปกติ) |
| `ZOOM_END` | `1.12` | zoom สุดท้าย (1.12 = ซูมเข้า 12%) |
| `FONT_SIZE` | `64` / `72` | ขนาด font (landscape / portrait) |
| `COLOR_INTERVAL` | `= SLIDE_DURATION` | เปลี่ยนสีตัวหนังสือทุก N วินาที |

> ไม่ต้องระบุความยาวเพลงหรือขนาดวิดีโอ — script จัดการให้อัตโนมัติ

## การทำงาน

1. ใช้ `ffprobe` หาความยาวเพลงอัตโนมัติ
2. random รูปจาก `image/` จนครบความยาวเพลง โดยไม่ให้รูปเดิมซ้ำกัน 2 ครั้งติดกัน
3. สร้าง ffmpeg filter complex:
   - `scale` + `crop` รูปให้เต็มจอตาม aspect ratio (cover, ไม่มีแถบดำ)
   - `zoompan` Ken Burns effect: ซูมเข้าช้าๆ ตลอดแต่ละรูป
   - `xfade=transition=fade` crossfade ระหว่างทุกรูป
   - `drawtext` ชื่อเพลงกลางจอ พร้อม word wrap อัตโนมัติ และ random สีทุก slide
4. บันทึก filter_complex ลง `filter.txt` แยกต่างหาก (หลีกเลี่ยง Windows command line limit)
5. ส่ง args เป็น array ผ่าน `spawnSync` โดยตรง (ไม่ผ่าน shell)
6. mix เพลงเข้า video ด้วย `-shortest`
7. บันทึกไปที่ `output/<ชื่อเพลง>_<landscape|portrait>.mp4`

## Visual effects

| Effect | รายละเอียด |
|---|---|
| Ken Burns zoom | ซูมเข้าจากกลางภาพ 100% → 112% ตลอดแต่ละ slide |
| Crossfade | fade ระหว่างรูป 0.5 วินาที |
| ชื่อเพลง | กลางจอ, word wrap อัตโนมัติ, shadow สีดำ |
| Random สี | เปลี่ยนสีตัวหนังสือทุก slide จาก palette 10 สี ไม่ซ้ำกัน 2 ครั้งติดกัน |
| Fade in/out | ตัวหนังสือ fade in 1 วินาทีแรก, fade out 1 วินาทีสุดท้าย |

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
