import crypto from "node:crypto";
import { authorizeUrl } from "../lib/tiktok.js";
import { appendCookie, cookie } from "../lib/session.js";

export default function handler(req, res) {
  const state = crypto.randomBytes(16).toString("hex");
  appendCookie(res, cookie("mw_state", state, 600));
  res.statusCode = 302;
  res.setHeader("Location", authorizeUrl(state));
  res.end();
}
