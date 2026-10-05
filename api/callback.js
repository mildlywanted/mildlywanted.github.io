import { exchangeCode } from "../lib/tiktok.js";
import { appendCookie, cookie, parseCookies, setSession } from "../lib/session.js";

function redirect(res, to) {
  res.statusCode = 302;
  res.setHeader("Location", to);
  res.end();
}

export default async function handler(req, res) {
  const url = new URL(req.url, "http://localhost");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  appendCookie(res, cookie("mw_state", "", 0));
  if (url.searchParams.get("error")) return redirect(res, "/?login=cancelled");
  if (!code || !state || state !== parseCookies(req).mw_state) return redirect(res, "/?login=failed");
  try {
    setSession(res, await exchangeCode(req, code));
    redirect(res, "/studio.html");
  } catch (err) {
    console.error("token exchange failed:", err.message, {
      keyLength: (process.env.TIKTOK_CLIENT_KEY || "").trim().length,
      secretLength: (process.env.TIKTOK_CLIENT_SECRET || "").trim().length,
      rawSecretLength: (process.env.TIKTOK_CLIENT_SECRET || "").length,
    });
    redirect(res, `/?login=failed&reason=${encodeURIComponent(err.message).slice(0, 200)}`);
  }
}
