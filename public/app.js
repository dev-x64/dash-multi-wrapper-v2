const loginView = document.getElementById('loginView');
const appView = document.getElementById('appView');
const loginForm = document.getElementById('dashboardLoginForm');
const loginError = document.getElementById('loginError');
const logoutBtn = document.getElementById('logoutBtn');
const addWrapperForm = document.getElementById('addWrapperForm');
const addWrapperError = document.getElementById('addWrapperError');
const wrappersList = document.getElementById('wrappersList');
const wrapperTemplate = document.getElementById('wrapperCardTemplate');
const refreshAllBtn = document.getElementById('refreshAllBtn');
const APPLE_STOREFRONT_MAP_SOURCE_URL = 'https://music.apple.com/includes/js-cdn/musickit/v3/amp/musickit.js';

const APPLE_STOREFRONT_BY_ID = {
  143441: 'United States',
  143442: 'France',
  143443: 'Germany',
  143444: 'United Kingdom',
  143445: 'Austria',
  143446: 'Belgium',
  143447: 'Finland',
  143448: 'Greece',
  143449: 'Ireland',
  143450: 'Italy',
  143451: 'Luxembourg',
  143452: 'Netherlands',
  143453: 'Portugal',
  143454: 'Spain',
  143455: 'Canada',
  143456: 'Sweden',
  143457: 'Norway',
  143458: 'Denmark',
  143459: 'Switzerland',
  143460: 'Australia',
  143461: 'New Zealand',
  143462: 'Japan',
  143463: 'Hong Kong',
  143464: 'Singapore',
  143465: 'China',
  143466: 'Republic of Korea',
  143467: 'India',
  143468: 'Mexico',
  143469: 'Russia',
  143470: 'Taiwan',
  143471: 'Vietnam',
  143472: 'South Africa',
  143473: 'Malaysia',
  143474: 'Philippines',
  143475: 'Thailand',
  143476: 'Indonesia',
  143477: 'Pakistan',
  143478: 'Poland',
  143479: 'Saudi Arabia',
  143480: 'Turkey',
  143481: 'United Arab Emirates',
  143482: 'Hungary',
  143483: 'Chile',
  143484: 'Nepal',
  143485: 'Panama',
  143486: 'Sri Lanka',
  143487: 'Romania',
  143489: 'Czech Republic',
  143491: 'Israel',
  143492: 'Ukraine',
  143493: 'Kuwait',
  143494: 'Croatia',
  143495: 'Costa Rica',
  143496: 'Slovakia',
  143497: 'Lebanon',
  143498: 'Qatar',
  143499: 'Slovenia',
  143501: 'Colombia',
  143502: 'Venezuela',
  143503: 'Brazil',
  143504: 'Guatemala',
  143505: 'Argentina',
  143506: 'El Salvador',
  143507: 'Peru',
  143508: 'Dominican Republic',
  143509: 'Ecuador',
  143510: 'Honduras',
  143511: 'Jamaica',
  143512: 'Nicaragua',
  143513: 'Paraguay',
  143514: 'Uruguay',
  143515: 'Macau',
  143516: 'Egypt',
  143517: 'Kazakhstan',
  143518: 'Estonia',
  143519: 'Latvia',
  143520: 'Lithuania',
  143521: 'Malta',
  143523: 'Moldova',
  143524: 'Armenia',
  143525: 'Botswana',
  143526: 'Bulgaria',
  143528: 'Jordan',
  143529: 'Kenya',
  143530: 'Macedonia',
  143531: 'Madagascar',
  143532: 'Mali',
  143533: 'Mauritius',
  143534: 'Niger',
  143535: 'Senegal',
  143536: 'Tunisia',
  143537: 'Uganda',
  143538: 'Anguilla',
  143539: 'Bahamas',
  143540: 'Antigua and Barbuda',
  143541: 'Barbados',
  143542: 'Bermuda',
  143543: 'British Virgin Islands',
  143544: 'Cayman Islands',
  143545: 'Dominica',
  143546: 'Grenada',
  143547: 'Montserrat',
  143548: 'St. Kitts and Nevis',
  143549: 'St. Lucia',
  143550: 'St. Vincent and The Grenadines',
  143551: 'Trinidad and Tobago',
  143552: 'Turks and Caicos',
  143553: 'Guyana',
  143554: 'Suriname',
  143555: 'Belize',
  143556: 'Bolivia',
  143557: 'Cyprus',
  143558: 'Iceland',
  143559: 'Bahrain',
  143560: 'Brunei Darussalam',
  143561: 'Nigeria',
  143562: 'Oman',
  143563: 'Algeria',
  143564: 'Angola',
  143565: 'Belarus',
  143566: 'Uzbekistan',
  143568: 'Azerbaijan',
  143571: 'Yemen',
  143572: 'Tanzania',
  143573: 'Ghana',
  143575: 'Albania',
  143576: 'Benin',
  143577: 'Bhutan',
  143578: 'Burkina Faso',
  143579: 'Cambodia',
  143580: 'Cape Verde',
  143581: 'Chad',
  143582: 'Republic of the Congo',
  143583: 'Fiji',
  143584: 'Gambia',
  143585: 'Guinea-Bissau',
  143586: 'Kyrgyzstan',
  143587: "Lao People's Democratic Republic",
  143588: 'Liberia',
  143589: 'Malawi',
  143590: 'Mauritania',
  143591: 'Federated States of Micronesia',
  143592: 'Mongolia',
  143593: 'Mozambique',
  143594: 'Namibia',
  143595: 'Palau',
  143597: 'Papua New Guinea',
  143598: 'Sao Tome and Principe',
  143599: 'Seychelles',
  143600: 'Sierra Leone',
  143601: 'Solomon Islands',
  143602: 'Swaziland',
  143603: 'Tajikistan',
  143604: 'Turkmenistan',
  143605: 'Zimbabwe',
};
let storefrontNameById = { ...APPLE_STOREFRONT_BY_ID };
let storefrontMapLoadPromise = null;
let storefrontMapLoaded = false;

let wrappers = [];
const cardState = new Map();

function pretty(data) {
  return JSON.stringify(data, null, 2);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json') ? await response.json() : await response.text();

  return { response, body };
}

function setAuthState(authenticated) {
  loginView.classList.toggle('hidden', authenticated);
  appView.classList.toggle('hidden', !authenticated);
}

function ensureCardState(wrapperId) {
  if (!cardState.has(wrapperId)) {
    cardState.set(wrapperId, {
      badgeClass: 'status-idle',
      badgeText: 'idle',
      rawTitle: 'No data',
      rawPayload: null,
      actionFeedback: {
        tone: 'idle',
        text: 'No actions yet.',
      },
      me: {
        username: null,
        authState: null,
        version: null,
        storefront: null,
        runtime: null,
      },
    });
  }
  return cardState.get(wrapperId);
}

function applyBadge(badgeEl, badgeClass, badgeText) {
  badgeEl.classList.remove('status-idle', 'status-ok', 'status-warn', 'status-error', 'status-pending');
  badgeEl.classList.add(badgeClass);
  badgeEl.textContent = badgeText;
}

function updateBadgeByResult(state, result) {
  if (result?.status === 200) {
    if (result?.body?.runtime?.playback_ready === true) {
      state.badgeClass = 'status-ok';
      state.badgeText = 'ready';
      return;
    }

    if (result?.body?.runtime?.playback_ready === false) {
      state.badgeClass = 'status-warn';
      state.badgeText = 'not ready';
      return;
    }

    state.badgeClass = 'status-ok';
    state.badgeText = result.body?.auth?.state === 'authenticated' ? 'authenticated' : 'online';
    return;
  }

  if (result?.status === 202 || result?.body?.status === 202) {
    state.badgeClass = 'status-warn';
    state.badgeText = '2fa required';
    return;
  }

  if (result?.status >= 400 || result?.status === 0) {
    state.badgeClass = 'status-error';
    state.badgeText = `error ${result.status || 0}`;
    return;
  }

  state.badgeClass = 'status-idle';
  state.badgeText = 'idle';
}

function markRequestPending(wrapperId, cardRef, title) {
  const state = ensureCardState(wrapperId);
  state.badgeClass = 'status-pending';
  state.badgeText = 'sending';
  state.actionFeedback = {
    tone: 'pending',
    text: `${title} ...`,
  };

  if (cardRef) {
    applyBadge(cardRef.badgeEl, state.badgeClass, state.badgeText);
    applyActionFeedback(cardRef, state);
  }
}

function writeRawResponse(state, title, payload) {
  state.rawTitle = title;
  state.rawPayload = payload;
}

function summarizeAction(title, result) {
  const status = Number.isFinite(result?.status) ? result.status : 0;
  const payload = result?.body;
  const details = [];

  if (payload && typeof payload === 'object') {
    if (typeof payload.state === 'string') {
      details.push(`state: ${payload.state}`);
    }
    if (typeof payload.was === 'string') {
      details.push(`was: ${payload.was}`);
    }
    if (typeof payload.auth?.state === 'string') {
      details.push(`auth: ${payload.auth.state}`);
    }
    if (typeof payload.error === 'string') {
      details.push(`error: ${payload.error}`);
    }
    if (typeof payload.message === 'string') {
      details.push(payload.message);
    }
  }

  const statusLabel = status ? String(status) : 'n/a';
  const baseText = `${title} (${statusLabel})`;
  const suffix = details.length ? ` - ${details.join(' | ')}` : '';

  let tone = 'success';
  if (status === 202 || result?.body?.status === 202) {
    tone = 'warn';
  } else if (status >= 400 || status === 0 || result?.ok === false) {
    tone = 'error';
  }

  return {
    tone,
    text: `${baseText}${suffix}`,
  };
}

function writeActionFeedback(state, title, result) {
  state.actionFeedback = summarizeAction(title, result);
}

function applyActionFeedback(cardRef, state) {
  if (!cardRef.feedbackEl || !cardRef.feedbackTextEl) {
    return;
  }

  cardRef.feedbackEl.classList.remove(
    'action-feedback-idle',
    'action-feedback-success',
    'action-feedback-warn',
    'action-feedback-error',
    'action-feedback-pending'
  );

  const toneClassMap = {
    idle: 'action-feedback-idle',
    success: 'action-feedback-success',
    warn: 'action-feedback-warn',
    error: 'action-feedback-error',
    pending: 'action-feedback-pending',
  };

  const toneClass = toneClassMap[state.actionFeedback?.tone] || 'action-feedback-idle';
  cardRef.feedbackEl.classList.add(toneClass);
  cardRef.feedbackTextEl.textContent = state.actionFeedback?.text || 'No actions yet.';
}

function normalizeRuntimeValue(value) {
  if (value === true) {
    return { text: 'true', className: 'is-true' };
  }
  if (value === false) {
    return { text: 'false', className: 'is-false' };
  }
  return { text: '-', className: 'is-unknown' };
}

function parseStorefrontIdsFromMusicKitSource(source) {
  if (typeof source !== 'string' || !source) {
    return null;
  }

  const matches = source.matchAll(/\b([A-Z]{3}):"(143\d{3})"\b/g);
  const ids = new Set();

  for (const match of matches) {
    const id = match?.[2];
    if (id) {
      ids.add(id);
    }
  }

  return ids.size ? Array.from(ids) : null;
}

async function ensureStorefrontMapLoaded() {
  if (storefrontMapLoaded) {
    return;
  }

  if (!storefrontMapLoadPromise) {
    storefrontMapLoadPromise = fetch(APPLE_STOREFRONT_MAP_SOURCE_URL)
      .then((response) => (response.ok ? response.text() : ''))
      .then((source) => {
        const ids = parseStorefrontIdsFromMusicKitSource(source);
        if (!ids) {
          return;
        }

        const next = {};
        ids.forEach((id) => {
          if (APPLE_STOREFRONT_BY_ID[id]) {
            next[id] = APPLE_STOREFRONT_BY_ID[id];
          }
        });

        if (Object.keys(next).length) {
          storefrontNameById = next;
        }
      })
      .catch(() => {})
      .finally(() => {
        storefrontMapLoaded = true;
      });
  }

  return storefrontMapLoadPromise;
}

function formatStorefront(value) {
  if (!storefrontMapLoaded) {
    void ensureStorefrontMapLoaded();
  }

  if (value === null || value === undefined) {
    return '-';
  }

  const raw = String(value).trim();
  if (!raw) {
    return '-';
  }

  const idMatch = raw.match(/^\d+/);
  if (!idMatch) {
    return raw;
  }

  const id = idMatch[0];
  const country = storefrontNameById[id];
  return country ? `${raw} (${country})` : raw;
}

function applyMeInfo(cardRef, state) {
  const usernameText = state.me.username ? state.me.username.trim() : '';
  cardRef.usernameEl.textContent = usernameText || 'Unknown';
  const authStateText = state.me.authState || 'unknown';
  cardRef.authStateEl.textContent = authStateText;
  cardRef.authStateEl.classList.remove('state-authenticated', 'state-not-authenticated');
  if (authStateText === 'authenticated') {
    cardRef.authStateEl.classList.add('state-authenticated');
  } else if (authStateText !== 'unknown') {
    cardRef.authStateEl.classList.add('state-not-authenticated');
  }
  cardRef.versionEl.textContent = state.me.version || '-';
  cardRef.storefrontEl.textContent = formatStorefront(state.me.storefront);

  cardRef.runtimePills.forEach((pill) => {
    const key = pill.dataset.runtimeKey;
    const value = state.me.runtime ? state.me.runtime[key] : undefined;
    const normalized = normalizeRuntimeValue(value);

    pill.classList.remove('is-true', 'is-false', 'is-unknown');
    pill.classList.add(normalized.className);
    pill.textContent = `${key}: ${normalized.text}`;
  });
}

function updateMeInfoFromResult(state, endpoint, result) {
  if (!endpoint.endsWith('/me')) {
    return false;
  }

  const root = result.body && typeof result.body === 'object' ? result.body : null;
  const nested = root?.body && typeof root.body === 'object' ? root.body : null;
  const payload =
    root?.auth || root?.runtime || typeof root?.version === 'string'
      ? root
      : nested?.auth || nested?.runtime || typeof nested?.version === 'string'
        ? nested
        : null;

  if (!payload) {
    return false;
  }

  const username = payload.auth?.username ?? payload.auth?.apple_id ?? null;
  const authState = payload.auth?.state ?? null;
  const storefront = payload.auth?.storefront ?? payload.auth?.storefont ?? null;
  const version = payload.version ?? null;
  const runtime = payload.runtime ?? null;

  state.me = {
    username: typeof username === 'string' ? username : null,
    authState: typeof authState === 'string' ? authState : null,
    version: typeof version === 'string' ? version.trim() || null : null,
    storefront: storefront === null || storefront === undefined ? null : String(storefront).trim() || null,
    runtime: runtime && typeof runtime === 'object' ? runtime : null,
  };
  return true;
}

async function refreshMeState(wrapperId, cardRef) {
  const state = ensureCardState(wrapperId);
  const endpoint = `/api/wrappers/${wrapperId}/me`;

  try {
    markRequestPending(wrapperId, cardRef, 'GET /me');
    const { body } = await api(endpoint, { method: 'GET' });

    writeRawResponse(state, 'GET /me', body);
    writeActionFeedback(state, 'GET /me', body);
    updateBadgeByResult(state, body);
    const meUpdated = updateMeInfoFromResult(state, endpoint, body);
    if (!meUpdated && Number(body?.status) >= 400) {
      state.me = {
        username: null,
        authState: 'not_authenticated',
        version: null,
        storefront: null,
        runtime: null,
      };
    }

    if (cardRef) {
      applyBadge(cardRef.badgeEl, state.badgeClass, state.badgeText);
      applyMeInfo(cardRef, state);
      applyActionFeedback(cardRef, state);
      cardRef.responseEl.textContent = `${state.rawTitle}\n${pretty(state.rawPayload)}`;
    }

    return body;
  } catch {
    state.badgeClass = 'status-error';
    state.badgeText = 'me sync failed';
    state.actionFeedback = {
      tone: 'error',
      text: 'GET /me failed',
    };

    if (cardRef) {
      applyBadge(cardRef.badgeEl, state.badgeClass, state.badgeText);
      applyActionFeedback(cardRef, state);
    }

    return null;
  }
}

async function waitBeforeMeSync(wrapperId, cardRef, delayMs = 3000) {
  const state = ensureCardState(wrapperId);
  const seconds = Math.ceil(delayMs / 1000);

  state.badgeClass = 'status-pending';
  state.badgeText = `sync in ${seconds}s`;
  state.actionFeedback = {
    tone: 'pending',
    text: `POST /login accepted. Waiting ${seconds}s before GET /me`,
  };

  if (cardRef) {
    applyBadge(cardRef.badgeEl, state.badgeClass, state.badgeText);
    applyActionFeedback(cardRef, state);
  }

  await sleep(delayMs);
}

function finalizeLoginMeFeedback(wrapperId, cardRef, meResult) {
  const state = ensureCardState(wrapperId);
  const status = meResult && Number.isFinite(meResult.status) ? meResult.status : 0;

  if (status === 200) {
    state.actionFeedback = {
      tone: 'success',
      text: 'POST /login -> GET /me synced',
    };
  } else if (status) {
    state.actionFeedback = {
      tone: status >= 400 ? 'error' : 'warn',
      text: `POST /login -> GET /me (${status})`,
    };
  } else {
    state.actionFeedback = {
      tone: 'error',
      text: 'POST /login -> GET /me failed',
    };
  }

  if (cardRef) {
    applyActionFeedback(cardRef, state);
  }
}

async function checkAuth() {
  try {
    const { response } = await api('/auth/me');
    setAuthState(response.ok);
    if (response.ok) {
      await loadWrappers();
      await refreshAllMe();
    }
  } catch {
    setAuthState(false);
  }
}

async function loadWrappers() {
  const { response, body } = await api('/api/wrappers');
  if (!response.ok) {
    wrappersList.innerHTML = '<p class="error">Failed to load wrappers.</p>';
    return;
  }

  wrappers = body.wrappers || [];
  wrappers.forEach((wrapper) => ensureCardState(wrapper.id));
  renderWrappers();
}

async function callAndRender(wrapperId, endpoint, options, title, cardRef) {
  const state = ensureCardState(wrapperId);

  markRequestPending(wrapperId, cardRef, title);
  writeRawResponse(state, `${title} ...`, {});
  if (cardRef) {
    cardRef.responseEl.textContent = `${state.rawTitle}\n${pretty(state.rawPayload)}`;
  }

  const { body } = await api(endpoint, options);
  writeRawResponse(state, title, body);
  writeActionFeedback(state, title, body);
  updateBadgeByResult(state, body);
  updateMeInfoFromResult(state, endpoint, body);

  if (cardRef) {
    applyBadge(cardRef.badgeEl, state.badgeClass, state.badgeText);
    applyMeInfo(cardRef, state);
    applyActionFeedback(cardRef, state);
    cardRef.responseEl.textContent = `${state.rawTitle}\n${pretty(state.rawPayload)}`;
  }

  return body;
}

function renderWrappers() {
  wrappersList.innerHTML = '';

  if (!wrappers.length) {
    wrappersList.innerHTML = '<p class="muted">No wrappers yet. Add your first wrapper.</p>';
    return;
  }

  wrappers.forEach((wrapper) => {
    const node = wrapperTemplate.content.firstElementChild.cloneNode(true);

    const nameEl = node.querySelector('.wrapper-name');
    const urlEl = node.querySelector('.wrapper-url');
    const badgeEl = node.querySelector('.status-badge');
    const responseEl = node.querySelector('.response-box');
    const feedbackEl = node.querySelector('.action-feedback');
    const feedbackTextEl = node.querySelector('.action-feedback-text');
    const usernameEl = node.querySelector('.me-username');
    const authStateEl = node.querySelector('.me-auth-state');
    const versionEl = node.querySelector('.me-version');
    const storefrontEl = node.querySelector('.me-storefront');
    const runtimePills = Array.from(node.querySelectorAll('.runtime-pill'));
    const refreshBtn = node.querySelector('.refresh-btn');
    const meBtn = node.querySelector('.me-btn');
    const removeBtn = node.querySelector('.remove-btn');
    const clearLoginBtn = node.querySelector('.clear-login-btn');
    const loginFormEl = node.querySelector('.login-form');
    const twofaFormEl = node.querySelector('.twofa-form');
    const editToggleBtn = node.querySelector('.edit-toggle-btn');
    const editCancelBtn = node.querySelector('.edit-cancel-btn');
    const editFormEl = node.querySelector('.edit-form');

    const cardRef = {
      badgeEl,
      responseEl,
      feedbackEl,
      feedbackTextEl,
      usernameEl,
      authStateEl,
      versionEl,
      storefrontEl,
      runtimePills,
    };
    const state = ensureCardState(wrapper.id);

    nameEl.textContent = wrapper.name;
    urlEl.textContent = wrapper.baseUrl;
    urlEl.href = wrapper.baseUrl;

    editFormEl.elements.name.value = wrapper.name;
    editFormEl.elements.baseUrl.value = wrapper.baseUrl;

    applyBadge(badgeEl, state.badgeClass, state.badgeText);
    applyMeInfo(cardRef, state);
    applyActionFeedback(cardRef, state);
    if (state.rawPayload === null) {
      responseEl.textContent = state.rawTitle;
    } else {
      responseEl.textContent = `${state.rawTitle}\n${pretty(state.rawPayload)}`;
    }

    const refreshHandler = async () => {
      await callAndRender(wrapper.id, `/api/wrappers/${wrapper.id}/health`, { method: 'GET' }, 'GET /health', cardRef);
    };

    refreshBtn.addEventListener('click', refreshHandler);
    refreshBtn.runRefresh = refreshHandler;

    meBtn.addEventListener('click', async () => {
      await callAndRender(wrapper.id, `/api/wrappers/${wrapper.id}/me`, { method: 'GET' }, 'GET /me', cardRef);
    });
    meBtn.runMe = async () => {
      await callAndRender(wrapper.id, `/api/wrappers/${wrapper.id}/me`, { method: 'GET' }, 'GET /me', cardRef);
    };

    removeBtn.addEventListener('click', async () => {
      markRequestPending(wrapper.id, cardRef, 'DELETE wrapper');
      const { response, body } = await api(`/api/wrappers/${wrapper.id}`, { method: 'DELETE' });
      if (!response.ok) {
        writeRawResponse(state, 'DELETE wrapper error', body);
        state.badgeClass = 'status-error';
        state.badgeText = `error ${response.status || 0}`;
        state.actionFeedback = {
          tone: 'error',
          text: `DELETE wrapper (${response.status || 'n/a'})`,
        };
        applyActionFeedback(cardRef, state);
        applyBadge(cardRef.badgeEl, state.badgeClass, state.badgeText);
        responseEl.textContent = `${state.rawTitle}\n${pretty(state.rawPayload)}`;
        return;
      }
      cardState.delete(wrapper.id);
      wrappers = wrappers.filter((item) => item.id !== wrapper.id);
      renderWrappers();
    });

    editToggleBtn.addEventListener('click', () => {
      editFormEl.classList.toggle('hidden');
    });

    editCancelBtn.addEventListener('click', () => {
      editFormEl.classList.add('hidden');
      editFormEl.elements.name.value = wrapper.name;
      editFormEl.elements.baseUrl.value = wrapper.baseUrl;
    });

    editFormEl.addEventListener('submit', async (event) => {
      event.preventDefault();

      const name = String(editFormEl.elements.name.value || '').trim();
      const baseUrl = String(editFormEl.elements.baseUrl.value || '').trim();

      markRequestPending(wrapper.id, cardRef, 'PUT /wrappers/:id');
      const { response, body } = await api(`/api/wrappers/${wrapper.id}`, {
        method: 'PUT',
        body: JSON.stringify({ name, baseUrl }),
      });

      if (!response.ok) {
        writeRawResponse(state, 'PUT /wrappers/:id error', body);
        state.badgeClass = 'status-error';
        state.badgeText = `error ${response.status || 0}`;
        state.actionFeedback = {
          tone: 'error',
          text: `PUT /wrappers/:id (${response.status || 'n/a'})`,
        };
        applyActionFeedback(cardRef, state);
        applyBadge(cardRef.badgeEl, state.badgeClass, state.badgeText);
        responseEl.textContent = `${state.rawTitle}\n${pretty(state.rawPayload)}`;
        return;
      }

      wrapper.name = body.wrapper.name;
      wrapper.baseUrl = body.wrapper.baseUrl;

      nameEl.textContent = wrapper.name;
      urlEl.textContent = wrapper.baseUrl;
      urlEl.href = wrapper.baseUrl;

      editFormEl.classList.add('hidden');
      writeRawResponse(state, 'PUT /wrappers/:id', body);
      state.badgeClass = 'status-ok';
      state.badgeText = 'saved';
      state.actionFeedback = {
        tone: 'success',
        text: `PUT /wrappers/:id (${response.status || 200})`,
      };
      applyBadge(cardRef.badgeEl, state.badgeClass, state.badgeText);
      applyActionFeedback(cardRef, state);
      responseEl.textContent = `${state.rawTitle}\n${pretty(state.rawPayload)}`;
    });

    clearLoginBtn.addEventListener('click', async () => {
      await callAndRender(
        wrapper.id,
        `/api/wrappers/${wrapper.id}/login`,
        { method: 'DELETE' },
        'DELETE /login',
        cardRef
      );
      await refreshMeState(wrapper.id, cardRef);
    });

    loginFormEl.addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = new FormData(loginFormEl);
      const username = String(form.get('username') || '').trim();
      const password = String(form.get('wrapper_secret') || '');

      await callAndRender(
        wrapper.id,
        `/api/wrappers/${wrapper.id}/login`,
        {
          method: 'POST',
          body: JSON.stringify({ username, password }),
        },
        'POST /login',
        cardRef
      );
      await waitBeforeMeSync(wrapper.id, cardRef, 3000);
      const meResult = await refreshMeState(wrapper.id, cardRef);
      finalizeLoginMeFeedback(wrapper.id, cardRef, meResult);
    });

    twofaFormEl.addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = new FormData(twofaFormEl);
      const code = String(form.get('code') || '').trim();

      await callAndRender(
        wrapper.id,
        `/api/wrappers/${wrapper.id}/login/2fa`,
        {
          method: 'POST',
          body: JSON.stringify({ code }),
        },
        'POST /login/2fa',
        cardRef
      );
      await refreshMeState(wrapper.id, cardRef);
    });

    wrappersList.appendChild(node);
  });
}

async function refreshAllHealth() {
  const cards = Array.from(document.querySelectorAll('.wrapper-card'));
  await Promise.all(
    cards.map(async (card) => {
      const button = card.querySelector('.refresh-btn');
      if (typeof button.runRefresh === 'function') {
        await button.runRefresh();
      }
    })
  );
}

async function refreshAllMe() {
  const cards = Array.from(document.querySelectorAll('.wrapper-card'));
  await Promise.all(
    cards.map(async (card) => {
      const button = card.querySelector('.me-btn');
      if (typeof button.runMe === 'function') {
        await button.runMe();
      }
    })
  );
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  loginError.textContent = '';

  const password = document.getElementById('dashboardPassword').value;
  const { response, body } = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ password }),
  });

  if (!response.ok) {
    loginError.textContent = body?.error || 'Sign-in failed';
    return;
  }

  document.getElementById('dashboardPassword').value = '';
  setAuthState(true);
  await loadWrappers();
  await refreshAllMe();
});

logoutBtn.addEventListener('click', async () => {
  await api('/auth/logout', { method: 'POST' });
  wrappers = [];
  wrappersList.innerHTML = '';
  cardState.clear();
  setAuthState(false);
});

addWrapperForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  addWrapperError.textContent = '';

  const name = document.getElementById('wrapperName').value.trim();
  const baseUrl = document.getElementById('wrapperBaseUrl').value.trim();

  const { response, body } = await api('/api/wrappers', {
    method: 'POST',
    body: JSON.stringify({ name, baseUrl }),
  });

  if (!response.ok) {
    addWrapperError.textContent = body?.error || 'Failed to add wrapper';
    return;
  }

  addWrapperForm.reset();
  wrappers.push(body.wrapper);
  ensureCardState(body.wrapper.id);
  renderWrappers();
  const lastCardButton = wrappersList.querySelector('.wrapper-card:last-child .me-btn');
  if (lastCardButton && typeof lastCardButton.runMe === 'function') {
    lastCardButton.runMe();
  }
});

refreshAllBtn.addEventListener('click', async () => {
  await refreshAllHealth();
});

checkAuth();
