# Wrapper API Dashboard

A simple dashboard for managing multiple wrapper APIs (Apple auth wrappers).

Supported actions per wrapper:
- `GET /me`
- `GET /health` (automatically called for all cards on page load)
- `POST /login`
- `POST /login/2fa`
- `DELETE /login`

## 1) Setup

1. Install Node.js 20+.
2. Create `.env` (you can copy from `.env.example`).
3. Set the dashboard login password in `.env`:

```env
DASHBOARD_PASSWORD=
```

Dashboard auth cookie is stored for **30 days**.
Wrapper API request timeout is **3000 ms** (`REQUEST_TIMEOUT_MS=3000`).

## 2) Run locally

```bash
npm install
npm start
```

Open: `http://127.0.0.1:3000`

## 3) Run with Docker

```bash
docker compose up --build -d
```

Open: `http://127.0.0.1:3000`

## 4) Usage

1. Sign in with the password from `.env`.
2. Add a wrapper (name + URL, for example `http://127.0.0.1:8180`).
3. Use wrapper card actions:
   - `POST /login` (username/apple_id + password)
   - `POST /login/2fa` (2FA code)
   - `GET /me` (check status)
   - `DELETE /login` (clear auth)

Wrapper list is stored in `data/wrappers.json`.
