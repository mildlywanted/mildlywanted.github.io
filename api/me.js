// Who is signed in, plus TikTok's creator_info (posting limits and allowed privacy levels).
import { accessToken, api } from "../lib/tiktok.js";
import { send, fail } from "../lib/http.js";

export default async function handler(req, res) {
  try {
    const token = await accessToken(req, res);
    if (!token) return send(res, 401, { error: "not_signed_in" });
    const [user, creator] = await Promise.all([
      api(token, "/v2/user/info/", { method: "GET", query: { fields: "open_id,display_name,avatar_url" } }),
      api(token, "/v2/post/publish/creator_info/query/"),
    ]);
    send(res, 200, { user: user.user, creator });
  } catch (err) {
    fail(res, err);
  }
}
