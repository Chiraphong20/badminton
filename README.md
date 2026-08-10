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
2. คัดลอก `.env.example` เป็น `.env` แล้วใส่ค่าจริง:
   - `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT` — ฐานข้อมูล
   - `AUTH_SECRET` — สตริงสุ่มยาวๆ ไว้เซ็น session login (เช่น `openssl rand -hex 32`) **ต้องตั้งก่อนใช้งานจริง** ไม่งั้นทุกคนจะหลุด login เมื่อ restart เซิร์ฟเวอร์
   - `ADMIN_PIN` — PIN เริ่มต้น (ไม่ตั้งจะเป็น `1234`) ใช้ครั้งแรกเท่านั้น หลังจากนั้นไปเปลี่ยนที่หน้า "ตั้งค่าระบบ" ในแอป
   - `CORS_ORIGIN` — โดเมนจริงของ frontend (เช่น `https://smashpangg.vercel.app`) ไม่ตั้งจะอนุญาตแค่ `http://localhost:3000` (dev)
   ```
   cp .env.example .env
   ```
3. สร้างตารางฐานข้อมูลเริ่มต้น (ดู [backend/init.js](backend/init.js))
4. รันแอป (frontend + backend พร้อมกัน):
   ```
   npm run dev
   ```

แอปจะรันที่ `http://localhost:3000` (backend API ที่พอร์ต `3001`) เข้าระบบด้วย PIN ที่ตั้งไว้ใน `ADMIN_PIN` (ค่าเริ่มต้น `1234` — **เปลี่ยนทันทีที่หน้า "ตั้งค่าระบบ" หลังใช้งานจริง**)

## Deploy

มี Docker setup พร้อมใช้ใน [backend/Dockerfile](backend/Dockerfile) และ [backend/docker-compose.yml](backend/docker-compose.yml) สำหรับรัน backend แบบ container โดยแยกอิสระจาก frontend ซึ่ง build เป็น static site แล้ว deploy ขึ้น Vercel/Netlify ได้ (`npm run build` → โฟลเดอร์ `dist/`)

## ✅ ระบบยืนยันตัวตน & CORS

API หลังบ้านตรวจสอบสิทธิ์ด้วย PIN → bearer token ที่เซิร์ฟเวอร์เป็นคนออกให้แล้ว (ดู `backend/server.js` — `requireAuth`) ทุก endpoint ที่แก้ไข/อ่านข้อมูลอ่อนไหวต้องผ่าน token ก่อน ยกเว้น `GET /api/state` ที่เปิดสาธารณะไว้เพื่อรองรับหน้าจอคิว (`/?queue`) ที่ออกแบบให้ดูได้โดยไม่ต้อง login — และ CORS จำกัดเฉพาะโดเมนที่ตั้งไว้ใน `CORS_ORIGIN` แล้ว ไม่เปิดกว้างให้ทุกเว็บเรียกได้เหมือนเดิม

สิ่งที่ยังควรทำต่อก่อนขยายสเกล ดูในหัวข้อ "แผนต่อยอด" ของ [PROJECT-OVERVIEW.md](PROJECT-OVERVIEW.md) (เช่น multi-tenant, automated test)
