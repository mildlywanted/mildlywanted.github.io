import { accessToken, api } from "../lib/tiktok.js";
import { send, fail, readJson } from "../lib/http.js";

export default async function handler(req, res) {
  try {
    const token = await accessToken(req, res);
    if (!token) return send(res, 401, { error: "not_signed_in" });
    const { publish_id } = await readJson(req);
    if (!publish_id) return send(res, 400, { error: "publish_id_required" });
    send(res, 200, await api(token, "/v2/post/publish/status/fetch/", { body: { publish_id } }));
  } catch (err) {
    fail(res, err);
  }
}
