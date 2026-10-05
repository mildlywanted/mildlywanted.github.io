import { getSession, clearSession } from "../lib/session.js";
import { revoke } from "../lib/tiktok.js";

export default async function handler(req, res) {
  const s = getSession(req);
  if (s) await revoke(s.accessToken);
  clearSession(res);
  res.statusCode = 302;
  res.setHeader("Location", "/");
  res.end();
}
