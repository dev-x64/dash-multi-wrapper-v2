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

let wrappers = [];
const cardState = new Map();

function pretty(data) {
  return JSON.stringify(data, null, 2);
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
      me: {
        username: null,
        runtime: null,
      },
    });
  }
  return cardState.get(wrapperId);
}

function applyBadge(badgeEl, badgeClass, badgeText) {
  badgeEl.classList.remove('status-idle', 'status-ok', 'status-warn', 'status-error');
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

function writeRawResponse(state, title, payload) {
  state.rawTitle = title;
  state.rawPayload = payload;
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

function applyMeInfo(cardRef, state) {
  const usernameText = state.me.username ? state.me.username.trim() : '';
  cardRef.usernameEl.textContent = usernameText || 'Unknown';

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
    return;
  }

  if (result?.status !== 200 || !result?.body) {
    return;
  }

  const username = result.body.auth?.username ?? result.body.auth?.apple_id ?? null;
  const runtime = result.body.runtime ?? null;

  state.me = {
    username: typeof username === 'string' ? username : null,
    runtime: runtime && typeof runtime === 'object' ? runtime : null,
  };
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

  writeRawResponse(state, `${title} ...`, {});
  if (cardRef) {
    cardRef.responseEl.textContent = `${state.rawTitle}\n${pretty(state.rawPayload)}`;
  }

  const { body } = await api(endpoint, options);
  writeRawResponse(state, title, body);
  updateBadgeByResult(state, body);
  updateMeInfoFromResult(state, endpoint, body);

  if (cardRef) {
    applyBadge(cardRef.badgeEl, state.badgeClass, state.badgeText);
    applyMeInfo(cardRef, state);
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
    const usernameEl = node.querySelector('.me-username');
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

    const cardRef = { badgeEl, responseEl, usernameEl, runtimePills };
    const state = ensureCardState(wrapper.id);

    nameEl.textContent = wrapper.name;
    urlEl.textContent = wrapper.baseUrl;
    urlEl.href = wrapper.baseUrl;

    editFormEl.elements.name.value = wrapper.name;
    editFormEl.elements.baseUrl.value = wrapper.baseUrl;

    applyBadge(badgeEl, state.badgeClass, state.badgeText);
    applyMeInfo(cardRef, state);
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
      const { response, body } = await api(`/api/wrappers/${wrapper.id}`, { method: 'DELETE' });
      if (!response.ok) {
        writeRawResponse(state, 'DELETE wrapper error', body);
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

      const { response, body } = await api(`/api/wrappers/${wrapper.id}`, {
        method: 'PUT',
        body: JSON.stringify({ name, baseUrl }),
      });

      if (!response.ok) {
        writeRawResponse(state, 'PUT /wrappers/:id error', body);
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
    });

    loginFormEl.addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = new FormData(loginFormEl);
      const username = String(form.get('username') || '').trim();
      const password = String(form.get('password') || '');

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
