// Account overview: profile, follower/like/video counts, and the creator's recent public videos.
import { accessToken, api } from "../lib/tiktok.js";
import { send, fail } from "../lib/http.js";

const USER_FIELDS = "open_id,display_name,avatar_url,username,bio_description,profile_deep_link,follower_count,following_count,likes_count,video_count";
const VIDEO_FIELDS = "id,title,cover_image_url,share_url,create_time,view_count,like_count,comment_count,share_count";

export default async function handler(req, res) {
  try {
    const token = await accessToken(req, res);
    if (!token) return send(res, 401, { error: "not_signed_in" });
    const [user, videos] = await Promise.all([
      api(token, "/v2/user/info/", { method: "GET", query: { fields: USER_FIELDS } }),
      api(token, "/v2/video/list/", { query: { fields: VIDEO_FIELDS }, body: { max_count: 12 } }),
    ]);
    send(res, 200, { user: user.user, videos: videos.videos || [] });
  } catch (err) {
    fail(res, err);
  }
}
