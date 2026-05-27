# Wrapper API Dashboard

A simple dashboard for managing multiple wrapper APIs (https://github.com/glomatico/wrapper-v2).

<img width="1525" height="907" alt="Screenshot_3" src="https://github.com/user-attachments/assets/9672fb7d-d14e-4fe0-b370-341238e67b3a" />



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

Public list endpoint: `GET /apis.json` (always generated from current `data/wrappers.json`).
