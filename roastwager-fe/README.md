# RoastWager Frontend

Frontend ini memakai arsitektur/tampilan referensi `hackathon-anjay/fe`, tapi data read diintegrasikan ke backend RoastWager (`roastwager-be`).

## Requirements

- Node.js 20+
- Backend RoastWager aktif di `http://localhost:3001` (atau set `NEXT_PUBLIC_API_URL`)

## Setup

```bash
npm install
cp .env.example .env.local
```

Isi `.env.local` minimal:

- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_CONTRACT_ADDRESS`
- `NEXT_PUBLIC_STABLE_TOKEN_ADDRESS`
- `NEXT_PUBLIC_STABLE_SYMBOL` (`USDC`)
- `NEXT_PUBLIC_STABLE_DECIMALS` (`6`)
- `NEXT_PUBLIC_VOTE_MODE` (`erc20`)

## Run

```bash
npm run dev
```

## Notes

- Feed/Explore/Profile/Post detail membaca data dari REST backend:
  - `GET /api/posts`
  - `GET /api/posts/:id`
  - `GET /api/users/:address`
  - `GET /api/users/:address/wagers`
- Vote flow default sekarang USDC (`erc20`) dengan approve + vote.
- Upload image lewat backend endpoint `POST /api/uploads/pinata`.
- UI dan komponen mengikuti referensi frontend.
