// "Send to TikTok drafts": uploads to the creator's TikTok inbox so they can finish
// editing and posting in the TikTok app (video.upload scope).
import { accessToken, api, chunkPlan } from "../lib/tiktok.js";
import { send, fail, readJson } from "../lib/http.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "method_not_allowed" });
  try {
    const token = await accessToken(req, res);
    if (!token) return send(res, 401, { error: "not_signed_in" });
    const { video_size } = await readJson(req);
    const source_info = { source: "FILE_UPLOAD", video_size, ...chunkPlan(video_size) };
    const data = await api(token, "/v2/post/publish/inbox/video/init/", { body: { source_info } });
    send(res, 200, { publish_id: data.publish_id, upload_url: data.upload_url, ...source_info });
  } catch (err) {
    fail(res, err);
  }
}
