require('dotenv').config({ quiet: true });

const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const express = require('express');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');

const app = express();

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || '23148822';
const AUTH_SECRET = process.env.AUTH_SECRET || 'change-me-in-env';
const COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'dash_auth';
const COOKIE_SECURE = process.env.COOKIE_SECURE === 'true';
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 3000);
const APIS_REFRESH_INTERVAL_MS = Number(process.env.APIS_REFRESH_INTERVAL_MS || 5 * 60 * 1000);
const APIS_CLIENT_MAX_AGE_SEC = Number(process.env.APIS_CLIENT_MAX_AGE_SEC || 30);

const WRAPPERS_PATH = path.join(process.cwd(), 'data', 'wrappers.json');
const apisCache = {
  updatedAt: null,
  wrappers: [],
  lastError: null,
};
let apisRefreshPromise = null;

const COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

function base64UrlEncode(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(input) {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const padLength = (4 - (padded.length % 4)) % 4;
  return Buffer.from(padded + '='.repeat(padLength), 'base64').toString('utf8');
}

function signToken(payload) {
  const encoded = base64UrlEncode(JSON.stringify(payload));
  const signature = crypto
    .createHmac('sha256', AUTH_SECRET)
    .update(encoded)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${encoded}.${signature}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) {
    return null;
  }

  const [encoded, signature] = token.split('.', 2);
  const expected = crypto
    .createHmac('sha256', AUTH_SECRET)
    .update(encoded)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const sigA = Buffer.from(signature);
  const sigB = Buffer.from(expected);

  if (sigA.length !== sigB.length || !crypto.timingSafeEqual(sigA, sigB)) {
    return null;
  }

  let payload;
  try {
    payload = JSON.parse(base64UrlDecode(encoded));
  } catch {
    return null;
  }

  if (!payload || typeof payload.exp !== 'number') {
    return null;
  }

  if (Date.now() > payload.exp) {
    return null;
  }

  return payload;
}

function setAuthCookie(res) {
  const now = Date.now();
  const token = signToken({
    iat: now,
    exp: now + COOKIE_MAX_AGE_MS,
  });

  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: COOKIE_SECURE,
    maxAge: COOKIE_MAX_AGE_MS,
    path: '/',
  });
}

function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    secure: COOKIE_SECURE,
    path: '/',
  });
}

function requireDashboardAuth(req, res, next) {
  const payload = verifyToken(req.cookies[COOKIE_NAME]);
  if (!payload) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  req.auth = payload;
  next();
}

async function ensureWrappersFile() {
  const dir = path.dirname(WRAPPERS_PATH);
  await fs.mkdir(dir, { recursive: true });

  try {
    await fs.access(WRAPPERS_PATH);
  } catch {
    await fs.writeFile(WRAPPERS_PATH, '[]\n', 'utf8');
  }
}

async function readWrappers() {
  await ensureWrappersFile();
  const raw = await fs.readFile(WRAPPERS_PATH, 'utf8');
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeWrappers(wrappers) {
  await ensureWrappersFile();
  await fs.writeFile(WRAPPERS_PATH, `${JSON.stringify(wrappers, null, 2)}\n`, 'utf8');
}

function normalizeBaseUrl(input) {
  if (typeof input !== 'string') {
    return null;
  }

  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const url = new URL(trimmed);
    if (!['http:', 'https:'].includes(url.protocol)) {
      return null;
    }
    return url.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

function findWrapperOr404(wrappers, id, res) {
  const wrapper = wrappers.find((item) => item.id === id);
  if (!wrapper) {
    res.status(404).json({ error: 'wrapper_not_found' });
    return null;
  }
  return wrapper;
}

function looksLikeHtmlDocument(text) {
  if (typeof text !== 'string') {
    return false;
  }

  const sample = text.trim().slice(0, 200).toLowerCase();
  return sample.startsWith('<!doctype html') || sample.startsWith('<html');
}

function extractWrapperMePayload(result) {
  const root = result?.body && typeof result.body === 'object' ? result.body : null;
  const nested = root?.body && typeof root.body === 'object' ? root.body : null;

  if (root?.auth || root?.runtime || typeof root?.version === 'string') {
    return root;
  }

  if (nested?.auth || nested?.runtime || typeof nested?.version === 'string') {
    return nested;
  }

  return null;
}

function buildWrapperStatus(payload) {
  const authState = payload?.auth?.state;
  const runtime = payload?.runtime;

  const allRuntimeReady =
    runtime?.playback_ready === true &&
    runtime?.loader_ok === true &&
    runtime?.initialized === true &&
    runtime?.apple_init_enabled === true;

  if (allRuntimeReady && authState === 'authenticated') {
    return 'ok';
  }

  return 'not_ok';
}

async function buildApisSnapshot() {
  const wrappers = await readWrappers();

  return Promise.all(
    wrappers.map(async (wrapper) => {
      const meResult = await callWrapperJson(wrapper, '/me', { method: 'GET' });
      const payload = extractWrapperMePayload(meResult);

      return {
        url: wrapper.baseUrl,
        version: typeof payload?.version === 'string' ? payload.version.trim() || null : null,
        status: meResult?.status === 200 && payload ? buildWrapperStatus(payload) : 'error',
      };
    })
  );
}

async function refreshApisCache() {
  if (apisRefreshPromise) {
    return apisRefreshPromise;
  }

  apisRefreshPromise = (async () => {
    try {
      const wrappers = await buildApisSnapshot();
      apisCache.wrappers = wrappers;
      apisCache.updatedAt = new Date().toISOString();
      apisCache.lastError = null;
    } catch (error) {
      apisCache.lastError = {
        message: error?.message || 'apis_refresh_failed',
        at: new Date().toISOString(),
      };
    } finally {
      apisRefreshPromise = null;
    }
  })();

  return apisRefreshPromise;
}

function scheduleApisRefresh() {
  void refreshApisCache();
}

async function callWrapperJson(wrapper, endpoint, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const url = `${wrapper.baseUrl}${endpoint}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'content-type': 'application/json',
        ...(options.headers || {}),
      },
      signal: controller.signal,
    });

    const contentType = response.headers.get('content-type') || '';
    const rawText = await response.text();
    const normalizedType = contentType.toLowerCase();
    const looksLikeJson = normalizedType.includes('application/json');

    if (!looksLikeJson) {
      const isHtml = normalizedType.includes('text/html');
      const snippet = rawText.trim().slice(0, 500);
      return {
        ok: false,
        status: 502,
        body: {
          error: 'non_json_response',
          message: 'Wrapper returned a non-JSON response',
          upstreamStatus: response.status,
          upstreamContentType: contentType || null,
          snippet: isHtml ? null : snippet || null,
        },
        wrapperUrl: url,
      };
    }

    let body = null;
    if (rawText) {
      try {
        body = JSON.parse(rawText);
      } catch {
        return {
          ok: false,
          status: 502,
          body: {
            error: 'invalid_json_response',
            message: 'Wrapper returned invalid JSON',
            upstreamStatus: response.status,
            upstreamContentType: contentType || null,
            snippet: rawText.trim().slice(0, 500) || null,
          },
          wrapperUrl: url,
        };
      }
    }

    if (looksLikeHtmlDocument(body)) {
      return {
        ok: false,
        status: 502,
        body: {
          error: 'non_json_response',
          message: 'Wrapper returned HTML payload inside JSON response',
          upstreamStatus: response.status,
          upstreamContentType: contentType || null,
          snippet: null,
        },
        wrapperUrl: url,
      };
    }

    return {
      ok: response.ok,
      status: response.status,
      body,
      wrapperUrl: url,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      body: {
        error: 'request_failed',
        message: error.name === 'AbortError' ? 'Request timed out' : error.message,
      },
      wrapperUrl: url,
    };
  } finally {
    clearTimeout(timeout);
  }
}

app.post('/auth/login', (req, res) => {
  const providedPassword = typeof req.body?.password === 'string' ? req.body.password : '';

  const a = Buffer.from(providedPassword);
  const b = Buffer.from(DASHBOARD_PASSWORD);

  const valid = a.length === b.length && crypto.timingSafeEqual(a, b);

  if (!valid) {
    return res.status(401).json({ error: 'invalid_password' });
  }

  setAuthCookie(res);
  return res.json({ ok: true });
});

app.post('/auth/logout', (req, res) => {
  clearAuthCookie(res);
  return res.json({ ok: true });
});

app.get('/auth/me', requireDashboardAuth, (req, res) => {
  return res.json({ ok: true, exp: req.auth.exp });
});

app.get('/apis.json', async (_req, res) => {
  if (!apisCache.updatedAt) {
    await refreshApisCache();
  }

  res.set('cache-control', `public, max-age=${APIS_CLIENT_MAX_AGE_SEC}, stale-while-revalidate=30`);
  return res.json({
    updatedAt: apisCache.updatedAt,
    wrappers: apisCache.wrappers,
  });
});

app.use('/api', requireDashboardAuth);

app.get('/api/wrappers', async (_req, res) => {
  const wrappers = await readWrappers();
  res.json({ wrappers });
});

app.post('/api/wrappers', async (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const baseUrl = normalizeBaseUrl(req.body?.baseUrl);

  if (!name || !baseUrl) {
    return res.status(400).json({ error: 'invalid_wrapper_payload' });
  }

  const wrappers = await readWrappers();
  const exists = wrappers.some((item) => item.baseUrl === baseUrl);
  if (exists) {
    return res.status(409).json({ error: 'wrapper_already_exists' });
  }

  const wrapper = {
    id: crypto.randomUUID(),
    name,
    baseUrl,
    createdAt: new Date().toISOString(),
  };

  wrappers.push(wrapper);
  await writeWrappers(wrappers);
  scheduleApisRefresh();

  return res.status(201).json({ wrapper });
});

app.put('/api/wrappers/:id', async (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const baseUrl = normalizeBaseUrl(req.body?.baseUrl);

  if (!name || !baseUrl) {
    return res.status(400).json({ error: 'invalid_wrapper_payload' });
  }

  const wrappers = await readWrappers();
  const index = wrappers.findIndex((item) => item.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'wrapper_not_found' });
  }

  const exists = wrappers.some((item) => item.id !== req.params.id && item.baseUrl === baseUrl);
  if (exists) {
    return res.status(409).json({ error: 'wrapper_already_exists' });
  }

  wrappers[index] = {
    ...wrappers[index],
    name,
    baseUrl,
    updatedAt: new Date().toISOString(),
  };

  await writeWrappers(wrappers);
  scheduleApisRefresh();
  return res.json({ wrapper: wrappers[index] });
});

app.delete('/api/wrappers/:id', async (req, res) => {
  const wrappers = await readWrappers();
  const next = wrappers.filter((item) => item.id !== req.params.id);

  if (next.length === wrappers.length) {
    return res.status(404).json({ error: 'wrapper_not_found' });
  }

  await writeWrappers(next);
  scheduleApisRefresh();
  return res.json({ ok: true });
});

app.get('/api/wrappers/:id/me', async (req, res) => {
  const wrappers = await readWrappers();
  const wrapper = findWrapperOr404(wrappers, req.params.id, res);
  if (!wrapper) {
    return;
  }

  const result = await callWrapperJson(wrapper, '/me', { method: 'GET' });
  return res.status(result.status || 502).json(result);
});

app.get('/api/wrappers/:id/health', async (req, res) => {
  const wrappers = await readWrappers();
  const wrapper = findWrapperOr404(wrappers, req.params.id, res);
  if (!wrapper) {
    return;
  }

  const result = await callWrapperJson(wrapper, '/health', { method: 'GET' });
  return res.status(result.status || 502).json(result);
});

app.post('/api/wrappers/:id/login', async (req, res) => {
  const wrappers = await readWrappers();
  const wrapper = findWrapperOr404(wrappers, req.params.id, res);
  if (!wrapper) {
    return;
  }

  const username = req.body?.username ?? req.body?.apple_id;
  const password = req.body?.password;

  if (typeof username !== 'string' || typeof password !== 'string' || !username.trim() || !password) {
    return res.status(400).json({ error: 'invalid_login_payload' });
  }

  const result = await callWrapperJson(wrapper, '/login', {
    method: 'POST',
    body: JSON.stringify({ username: username.trim(), password }),
  });

  return res.status(result.status || 502).json(result);
});

app.post('/api/wrappers/:id/login/2fa', async (req, res) => {
  const wrappers = await readWrappers();
  const wrapper = findWrapperOr404(wrappers, req.params.id, res);
  if (!wrapper) {
    return;
  }

  const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
  if (!code) {
    return res.status(400).json({ error: 'invalid_2fa_payload' });
  }

  const result = await callWrapperJson(wrapper, '/login/2fa', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });

  return res.status(result.status || 502).json(result);
});

app.delete('/api/wrappers/:id/login', async (req, res) => {
  const wrappers = await readWrappers();
  const wrapper = findWrapperOr404(wrappers, req.params.id, res);
  if (!wrapper) {
    return;
  }

  const result = await callWrapperJson(wrapper, '/login', {
    method: 'DELETE',
  });

  return res.status(result.status || 502).json(result);
});

app.use(express.static(path.join(process.cwd(), 'public')));

app.get(/.*/, (_req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
});

async function start() {
  await ensureWrappersFile();
  scheduleApisRefresh();

  const refreshTimer = setInterval(() => {
    scheduleApisRefresh();
  }, APIS_REFRESH_INTERVAL_MS);
  if (typeof refreshTimer.unref === 'function') {
    refreshTimer.unref();
  }

  app.listen(PORT, HOST, () => {
    console.log(`Wrapper dashboard running on http://${HOST}:${PORT}`);
  });
}

start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
