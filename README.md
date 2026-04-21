# OtaruChain Partner Portal

B2B Document Intelligence API untuk koperasi, bank, dan lembaga keuangan.

## Setup

```bash
cp .env.example .env
npm install
npm run dev
```

## Deploy ke Vercel

1. Buat project baru di Vercel
2. Connect ke repo ini (`Patner-OtaruChain`)
3. Set **Root Directory** ke `/` (root project ini)
4. **Environment Variables** di Vercel:
   ```
   VITE_SUPABASE_URL=https://uwzrsqhnseepshkffaud.supabase.co
   VITE_SUPABASE_ANON_KEY=sb_publishable_zH6Rlz5vJs3bcOS3AIHIbQ_4Aqerrj5
   VITE_API_URL=https://api-ocr.xyz
   ```
5. Deploy — domain otomatis `otaruchain-partner.vercel.app` atau custom `otaruchain.my.id`

## Arsitektur

- **Frontend**: React 18 + Vite + TypeScript + Tailwind (repo ini)
- **Backend (shared)**: FastAPI VPS `api-ocr.xyz` — sama dengan ocr.wtf
- **Database (shared)**: Supabase `uwzrsqhnseepshkffaud` — sama dengan ocr.wtf
- **Auth**: Supabase OAuth (Google) — user yang sama bisa login ke ocr.wtf dan OtaruChain
- **Payment**: Louvin (`api.louvin.dev`) — diproses di backend, key tidak pernah ke frontend
