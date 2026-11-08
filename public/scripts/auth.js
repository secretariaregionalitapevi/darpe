const SESSION_KEY = "darpe_mobile_session";
const INACTIVITY_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 horas de inatividade

let lastActivityUpdate = 0;
let isRefreshing = false;
let refreshPromise = null;

function updateActivityTimestamp() {
  const now = Date.now();
  if (now - lastActivityUpdate < 10000) return; // Limita gravações no localStorage a no máximo cada 10s
  lastActivityUpdate = now;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return;
    const session = JSON.parse(raw);
    if (session && typeof session === "object") {
      session.lastActivity = now;
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    }
  } catch (e) {}
}

window.mobileSession = {
  get() {
    try {
      const session = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
      if (session && typeof session === "object" && !session.lastActivity) {
        session.lastActivity = Date.now();
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      }
      return session;
    } catch {
      return null;
    }
  },

  set(value) {
    const data = { ...value, lastActivity: Date.now() };
    lastActivityUpdate = data.lastActivity;
    localStorage.setItem(SESSION_KEY, JSON.stringify(data));
  },

  updateActivity() {
    updateActivityTimestamp();
  },

  isInactive() {
    const session = this.get();
    if (!session || !session.access_token) return true;
    const last = session.lastActivity || Date.now();
    const elapsed = Date.now() - last;
    return elapsed > INACTIVITY_TIMEOUT_MS;
  },

  clear() {
    localStorage.removeItem(SESSION_KEY);
  },

  token() {
    if (this.isInactive()) {
      this.clear();
      return "";
    }
    return this.get()?.access_token || "";
  }
};

async function refreshToken() {
  const session = window.mobileSession.get();
  if (!session || !session.refresh_token) {
    window.mobileSession.clear();
    return null;
  }
  try {
    const res = await fetch("/api/mobile/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: session.refresh_token })
    });
    if (!res.ok) {
      window.mobileSession.clear();
      return null;
    }
    const data = await res.json();
    if (data.access_token) {
      const newSession = {
        ...session,
        access_token: data.access_token,
        refresh_token: data.refresh_token || session.refresh_token,
        expires_in: data.expires_in,
        lastActivity: Date.now()
      };
      window.mobileSession.set(newSession);
      return data.access_token;
    }
  } catch (e) {
    console.error("Erro ao renovar sessão:", e);
  }
  return null;
}

window.authFetch = async (url, options = {}) => {
  if (window.mobileSession.isInactive()) {
    window.mobileSession.clear();
    if (location.pathname !== "/login" && location.pathname !== "/login.html") {
      location.href = "/login";
    }
    throw new Error("Sua sessão expirou.");
  }

  window.mobileSession.updateActivity();

  let token = window.mobileSession.token();
  const headers = new Headers(options.headers || {});
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  let response = await fetch(url, { ...options, headers });

  // Se o servidor retornar 401 mas o usuário estiver ATIVO (< 1h de inatividade), tenta renovar o token
  if (response.status === 401 && !window.mobileSession.isInactive()) {
    if (!isRefreshing) {
      isRefreshing = true;
      refreshPromise = refreshToken().finally(() => { isRefreshing = false; });
    }
    const newToken = await refreshPromise;
    if (newToken) {
      const retryHeaders = new Headers(options.headers || {});
      retryHeaders.set("Authorization", `Bearer ${newToken}`);
      if (options.body && !retryHeaders.has("Content-Type")) retryHeaders.set("Content-Type", "application/json");
      response = await fetch(url, { ...options, headers: retryHeaders });
    }
  }

  if (response.status === 401) {
    window.mobileSession.clear();
    if (location.pathname !== "/login" && location.pathname !== "/login.html") {
      location.href = "/login";
    }
  }
  return response;
};

window.requireAuth = () => {
  if (window.mobileSession.isInactive()) {
    window.mobileSession.clear();
    if (location.pathname !== "/login" && location.pathname !== "/login.html") {
      location.replace("/login");
    }
    return false;
  }
  return true;
};

window.logoutMobile = () => {
  window.mobileSession.clear();
  location.replace("/login");
};

// Listeners de atividade para manter a sessão ativa durante uso contínuo
["mousedown", "keydown", "touchstart", "scroll", "click"].forEach(eventType => {
  window.addEventListener(eventType, () => {
    if (!window.mobileSession.isInactive()) {
      updateActivityTimestamp();
    }
  }, { passive: true });
});

// Verificação periódica de inatividade (a cada 30 segundos) e ao mudar de aba/foco
function checkInactivityState() {
  if (location.pathname === "/login" || location.pathname === "/login.html") return;
  const rawSession = localStorage.getItem(SESSION_KEY);
  if (!rawSession) return;
  if (window.mobileSession.isInactive()) {
    window.mobileSession.clear();
    location.href = "/login";
  }
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") checkInactivityState();
});
window.addEventListener("focus", checkInactivityState);
setInterval(checkInactivityState, 30000);
