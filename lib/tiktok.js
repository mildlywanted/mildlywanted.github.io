// Thin wrapper over TikTok's Login Kit and Content Posting API (Direct Post).
import { getSession, setSession } from "./session.js";

const API = "https://open.tiktokapis.com";
export const SCOPES = [
  "user.info.basic",
  "user.info.profile",
  "user.info.stats",
  "video.list",
  "video.upload",
  "video.publish",
];

// The site's own address: APP_URL if set, otherwise the host the request came in on.
export function baseUrl(req) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `https://${host}`;
}

export function config(req) {
  const { TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET } = process.env;
  if (!TIKTOK_CLIENT_KEY || !TIKTOK_CLIENT_SECRET) {
    throw new Error("TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET must be set");
  }
  const redirectUri = req ? `${baseUrl(req)}/api/callback` : undefined;
  return { clientKey: TIKTOK_CLIENT_KEY, clientSecret: TIKTOK_CLIENT_SECRET, redirectUri };
}

export function authorizeUrl(req, state) {
  const { clientKey, redirectUri } = config(req);
  const q = new URLSearchParams({
    client_key: clientKey,
    response_type: "code",
    scope: SCOPES.join(","),
    redirect_uri: redirectUri,
    state,
  });
  return `https://www.tiktok.com/v2/auth/authorize/?${q}`;
}

async function tokenRequest(params) {
  const { clientKey, clientSecret } = config();
  const r = await fetch(`${API}/v2/oauth/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_key: clientKey, client_secret: clientSecret, ...params }),
  });
  const data = await r.json();
  if (!r.ok || data.error) {
    throw new Error(`${data.error || r.status}: ${data.error_description || "token request failed"} (log_id ${data.log_id || "none"})`);
  }
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    openId: data.open_id,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
}

export function exchangeCode(req, code) {
  return tokenRequest({ code, grant_type: "authorization_code", redirect_uri: config(req).redirectUri });
}

export async function revoke(accessToken) {
  const { clientKey, clientSecret } = config();
  await fetch(`${API}/v2/oauth/revoke/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_key: clientKey, client_secret: clientSecret, token: accessToken }),
  }).catch(() => {});
}

// Returns a valid access token for the signed-in user, refreshing it when needed.
export async function accessToken(req, res) {
  const s = getSession(req);
  if (!s) return null;
  if (Date.now() < s.expiresAt) return s.accessToken;
  const fresh = await tokenRequest({ grant_type: "refresh_token", refresh_token: s.refreshToken });
  setSession(res, fresh);
  return fresh.accessToken;
}

export async function api(token, path, { method = "POST", body, query } = {}) {
  const url = `${API}${path}${query ? `?${new URLSearchParams(query)}` : ""}`;
  const r = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=UTF-8" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await r.json().catch(() => ({}));
  const err = json.error;
  if (!r.ok || (err && err.code && err.code !== "ok")) {
    const e = new Error(err?.message || `TikTok API error (${r.status})`);
    e.code = err?.code || "http_error";
    e.status = r.status;
    throw e;
  }
  return json.data;
}

// TikTok's chunk rules: files under 5 MB go up whole; otherwise chunks of
// 5-64 MB, and the last chunk absorbs the remainder (up to 128 MB).
export const MIN_CHUNK = 5 * 1024 * 1024;
export const CHUNK = 10 * 1024 * 1024;

export function chunkPlan(size) {
  if (!Number.isInteger(size) || size <= 0) throw new Error("invalid video size");
  if (size <= MIN_CHUNK) return { chunk_size: size, total_chunk_count: 1 };
  const total = Math.floor(size / CHUNK);
  if (total === 0) return { chunk_size: size, total_chunk_count: 1 };
  return { chunk_size: CHUNK, total_chunk_count: total };
}
