// Starts a Direct Post with FILE_UPLOAD. The browser then PUTs the file straight to
// TikTok's upload_url, so video bytes never pass through this server.
import { accessToken, api, chunkPlan } from "../lib/tiktok.js";
import { send, fail, readJson } from "../lib/http.js";

const PRIVACY = ["PUBLIC_TO_EVERYONE", "MUTUAL_FOLLOW_FRIENDS", "FOLLOWER_OF_CREATOR", "SELF_ONLY"];

export function buildInit(body, creator) {
  const p = body.post || {};
  if (!PRIVACY.includes(p.privacy_level)) throw Object.assign(new Error("Choose who can view this post."), { code: "privacy_required" });
  if (!creator.privacy_level_options.includes(p.privacy_level)) {
    throw Object.assign(new Error("That privacy option isn't available for this account."), { code: "privacy_not_allowed" });
  }
  if (p.brand_content_toggle && p.privacy_level === "SELF_ONLY") {
    throw Object.assign(new Error("Branded content can't be private."), { code: "branded_private" });
  }
  return {
    post_info: {
      title: String(p.title || "").slice(0, 2200),
      privacy_level: p.privacy_level,
      disable_comment: creator.comment_disabled || !!p.disable_comment,
      disable_duet: creator.duet_disabled || !!p.disable_duet,
      disable_stitch: creator.stitch_disabled || !!p.disable_stitch,
      brand_content_toggle: !!p.brand_content_toggle,
      brand_organic_toggle: !!p.brand_organic_toggle,
    },
    source_info: { source: "FILE_UPLOAD", video_size: body.video_size, ...chunkPlan(body.video_size) },
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "method_not_allowed" });
  try {
    const token = await accessToken(req, res);
    if (!token) return send(res, 401, { error: "not_signed_in" });
    const body = await readJson(req);
    const creator = await api(token, "/v2/post/publish/creator_info/query/");
    if (body.duration_sec > creator.max_video_post_duration_sec) {
      return send(res, 400, { error: "too_long", message: `Videos can be at most ${creator.max_video_post_duration_sec} seconds for this account.` });
    }
    const init = buildInit(body, creator);
    const data = await api(token, "/v2/post/publish/video/init/", { body: init });
    send(res, 200, { publish_id: data.publish_id, upload_url: data.upload_url, ...init.source_info });
  } catch (err) {
    fail(res, err);
  }
}
