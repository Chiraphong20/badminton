# SmashPang 🏸

ระบบจัดการก๊วนแบดมินตันและ POS — จัดคิว จับคู่ทีมตามฝีมือ คิดค่าคอร์ตค่าลูก และเก็บเงินให้ครบทุกบาทอัตโนมัติ

- 📄 ภาพรวมผลิตภัณฑ์ ฟีเจอร์ทั้งหมด จุดเด่น/จุดด้อย: [PROJECT-OVERVIEW.md](PROJECT-OVERVIEW.md)
- 📋 รายละเอียดฟีเจอร์แบบเจาะลึก: [features.md](features.md)
- 🌐 หน้าพรีเซนต์สำหรับลูกค้า/นักลงทุน: [marketing/index.html](marketing/index.html) (เปิดไฟล์นี้ในเบราว์เซอร์ได้โดยตรง)

## Tech Stack

React 19 + TypeScript + Vite · Express · MySQL · Tailwind CSS

## เริ่มใช้งาน (Run Locally)

**Prerequisites:** Node.js, MySQL

1. ติดตั้ง dependencies:
   ```
   npm install
   ```
2. คัดลอก `.env.example` เป็น `.env` แล้วใส่ค่าฐานข้อมูลจริง (`DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT`):
   ```
   cp .env.example .env
   ```
3. สร้างตารางฐานข้อมูลเริ่มต้น (ดู [backend/init.js](backend/init.js))
4. รันแอป (frontend + backend พร้อมกัน):
   ```
   npm run dev
   ```

แอปจะรันที่ `http://localhost:3000` (backend API ที่พอร์ต `3001`)

## Deploy

มี Docker setup พร้อมใช้ใน [backend/Dockerfile](backend/Dockerfile) และ [backend/docker-compose.yml](backend/docker-compose.yml) สำหรับรัน backend แบบ container โดยแยกอิสระจาก frontend ซึ่ง build เป็น static site แล้ว deploy ขึ้น Vercel/Netlify ได้ (`npm run build` → โฟลเดอร์ `dist/`)

## ⚠️ ก่อนส่งมอบ/ขายให้ลูกค้า

โปรเจกต์นี้ยังไม่มีระบบยืนยันตัวตนฝั่ง backend (PIN login เช็คแค่ฝั่ง client) — **ต้องเพิ่ม auth middleware ป้องกัน API ก่อนใช้งานกับข้อมูลจริงหรือส่งมอบให้ลูกค้ารายอื่น** ดูรายละเอียดความเสี่ยงและสิ่งที่ควรทำเพิ่มในหัวข้อ "จุดด้อย" ของ [PROJECT-OVERVIEW.md](PROJECT-OVERVIEW.md)
