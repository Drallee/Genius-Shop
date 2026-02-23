const API_BASE = `${window.location.protocol}//${window.location.host}`;

async function parseJsonSafe(response) {
    return response.json().catch(() => ({}));
}

export async function autoLogin(token) {
    const response = await fetch(`${API_BASE}/api/autologin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token })
    });
    const data = await parseJsonSafe(response);
    if (!response.ok) return { ok: false, status: response.status, data };

    localStorage.setItem("sessionToken", data.sessionToken || "");
    localStorage.setItem("username", data.username || "");
    window.history.replaceState({}, document.title, window.location.pathname);
    return { ok: true, status: response.status, data };
}

export async function fetchFiles(sessionToken) {
    const response = await fetch(`${API_BASE}/api/files?t=${Date.now()}`, {
        headers: { "X-Session-Token": sessionToken }
    });
    const data = await parseJsonSafe(response);
    if (!response.ok) {
        const message = data.message || data.error || `HTTP ${response.status}`;
        const err = new Error(message);
        err.status = response.status;
        throw err;
    }
    return data;
}

export async function saveFile(sessionToken, path, content) {
    const response = await fetch(`${API_BASE}/api/file/${path}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Session-Token": sessionToken
        },
        body: JSON.stringify({ content })
    });
    const data = await parseJsonSafe(response);
    if (!response.ok) {
        const message = data.message || data.error || `HTTP ${response.status}`;
        const err = new Error(message);
        err.status = response.status;
        throw err;
    }
    return data;
}

