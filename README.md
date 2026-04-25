# RoastWager Monorepo

RoastWager adalah aplikasi "opini + taruhan" di mana user bisa:
- membuat postingan opini (hot take),
- memilih `Agree` atau `Nah`,
- menaruh stake token (contoh: USDC),
- melihat hasil setelah market ditutup,
- klaim reward kalau menang (atau refund kalau kondisi tertentu).

Repository ini berisi 3 bagian utama:
- `roastwager-sc` → smart contract (aturan on-chain)
- `roastwager-be` → backend/indexer (membaca event blockchain, simpan ke database, sediakan API)
- `roastwager-fe` → frontend web app (UI untuk user)

Ada juga folder `landing-page` untuk halaman promosi terpisah.

## Gambaran Sederhana (End-to-End)

1. User membuat post dari frontend.
2. Frontend kirim transaksi `createWager` ke smart contract.
3. Smart contract emit event (contoh `WagerCreated`, `Voted`, `Resolved`, `Claimed`).
4. Backend listener menangkap event dari chain Monad.
5. Backend simpan/update data ke Supabase.
6. Frontend membaca data dari backend API (bukan baca chain langsung untuk semua tampilan), jadi UI lebih cepat dan konsisten.

Intinya: smart contract = sumber kebenaran, backend = mesin sinkronisasi data, frontend = pengalaman pengguna.

## Fitur yang Sudah Ada

### Smart Contract (`roastwager-sc`)
- Buat market: `createWager(content, imageUrl)`
- Vote sekali per wallet per post: `vote(postId, isBull, amount)`
- Tutup market: `resolve(postId)` oleh owner atau creator post
- Klaim reward/refund: `claim(postId)`
- Kondisi refund otomatis:
  - salah satu sisi tidak ada bettor, atau
  - total pool dua sisi sama (imbang)

### Backend (`roastwager-be`)
- REST API untuk posts, user, wagers, upload image
- Event listener on-chain dengan auto reconnect
- Sinkronisasi block terlewat (`syncMissedEvents`)
- Rate limit sederhana per IP
- Penyimpanan data ke Supabase
- Scoping ID berdasarkan `CONTRACT_ADDRESS` (aman jika ganti kontrak)
- Sistem XP/level user:
  - +10 XP saat vote
  - saat market resolve: pemenang +25 XP, kalah +5 XP

### Frontend (`roastwager-fe`)
- Feed market aktif + pending post optimistic
- Explore (filter status, search, viral/discover)
- Profile (level, win rate, riwayat, claim all)
- Post detail
- Create post dengan optional upload image ke Pinata
- Vote via ERC-20 (approve + vote)

## Struktur Folder

```text
.
├─ roastwager-sc/      # Smart contract (Foundry)
├─ roastwager-be/      # Backend/indexer (Node + Hono + Supabase + viem)
├─ roastwager-fe/      # Frontend (Next.js + wagmi + RainbowKit)
└─ landing-page/       # Landing page terpisah (opsional)
```

## Prasyarat

- Node.js 20+
- npm
- Foundry (untuk build/deploy contract)
- Akun Supabase (database)
- RPC Monad Testnet
- Wallet private key deployer (jika deploy kontrak sendiri)
- (Opsional) Pinata untuk upload image

## Setup Cepat (Urutan Aman untuk Pemula)

## 1) Smart Contract

Masuk folder:

```bash
cd roastwager-sc
```

Install dependency Foundry (jika belum):

```bash
forge install foundry-rs/forge-std --no-commit
```

Copy env:

```bash
cp .env.example .env
```

Isi `.env` minimal:
- `MONAD_RPC_URL`
- `PRIVATE_KEY`
- `STABLE_TOKEN_ADDRESS`
- `MIN_VOTE_AMOUNT` (raw unit token, contoh USDC 6 desimal: `500000` = 0.5 USDC)
- `OWNER_ADDRESS` (opsional)

Build:

```bash
forge build
```

Deploy:

```bash
source .env
forge script script/Deploy.s.sol:DeployRoastWager \
  --rpc-url "$MONAD_RPC_URL" \
  --broadcast
```

Catat address kontrak hasil deploy. Ini akan dipakai di backend + frontend.

## 2) Database Supabase

Masuk `roastwager-be/supabase/migrations` lalu jalankan SQL berikut di Supabase SQL Editor:
1. `001_init_roastwager.sql`
2. `002_scope_by_contract.sql`

Tujuannya membuat tabel:
- `posts`
- `wagers`
- `users`
- `sync_state`

## 3) Backend

Masuk folder:

```bash
cd roastwager-be
npm install
cp .env.example .env
```

Isi `.env` minimal:
- `MONAD_RPC_URL`
- `CONTRACT_ADDRESS` (hasil deploy smart contract)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PORT` (default `3001`)

Opsional:
- `SYNC_START_BLOCK` (kalau mau sync dari block tertentu)
- `STABLE_SYMBOL` (default `USDC`)
- `STABLE_DECIMALS` (default `6`)
- Pinata credentials (`PINATA_JWT` atau API key/secret) untuk upload gambar

Jalankan backend:

```bash
npm run dev
```

Cek health:

```bash
curl http://localhost:3001/health
```

## 4) Frontend

Masuk folder:

```bash
cd roastwager-fe
npm install
cp .env.example .env.local
```

Isi `.env.local` minimal:
- `NEXT_PUBLIC_API_URL=http://localhost:3001`
- `NEXT_PUBLIC_CONTRACT_ADDRESS=<alamat kontrak>`
- `NEXT_PUBLIC_STABLE_TOKEN_ADDRESS=<alamat token stake>`

Disarankan juga isi:
- `NEXT_PUBLIC_STABLE_SYMBOL=USDC`
- `NEXT_PUBLIC_STABLE_DECIMALS=6`
- `NEXT_PUBLIC_MIN_BET=0.5`
- `NEXT_PUBLIC_VOTE_MODE=erc20`

Jalankan frontend:

```bash
npm run dev
```

Buka app di browser (biasanya `http://localhost:3000`).

## API Ringkas (Backend)

Base URL default: `http://localhost:3001`

- `GET /health`
- `GET /api/posts?limit=20&offset=0&status=active|settled|refunded`
- `GET /api/posts/:id`
- `GET /api/posts/:id/wagers`
- `GET /api/users/:address`
- `GET /api/users/:address/wagers`
- `GET /api/users/:address/unclaimed`
- `GET /api/wagers/:postId/:address`
- `POST /api/uploads/pinata`

Catatan penting:
- Untuk `status=active`, backend menyembunyikan pool/count detail (blind market behavior).

## Cara Pakai dari Sisi User (Paling Singkat)

1. Connect wallet di frontend.
2. Buat post (opsional upload gambar).
3. Pilih `Agree` atau `Nah`, lalu konfirmasi approve + vote.
4. Tunggu market berakhir.
5. Creator/owner resolve market.
6. Jika menang/refund, klaim reward dari halaman profile.

## Troubleshooting Umum

- Error `Missing CONTRACT_ADDRESS` (backend):
  `.env` backend belum diisi atau salah.

- Frontend error `NEXT_PUBLIC_CONTRACT_ADDRESS is not configured`:
  `.env.local` frontend belum benar.

- Data tidak muncul padahal transaksi sukses:
  tunggu beberapa detik sampai backend listener memproses event; cek log backend.

- Upload image gagal:
  periksa env Pinata (`PINATA_JWT` atau `PINATA_API_KEY` + `PINATA_API_SECRET`).

- Bet gagal karena limit:
  cek level user dan batas max stake di profile.

## Checklist Verifikasi Instalasi

- Smart contract sudah terdeploy dan address valid.
- Backend `GET /health` mengembalikan status `ok`.
- Frontend bisa load feed tanpa error API.
- Bisa create post, vote, lalu data muncul di feed/profile.
- Event on-chain terlihat masuk ke database Supabase.

## Catatan

- Proyek ini fokus ke Monad testnet flow.
- `landing-page` tidak wajib untuk flow utama app taruhan.
