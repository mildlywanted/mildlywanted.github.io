const $ = (id) => document.getElementById(id);
const PRIVACY_LABELS = {
  PUBLIC_TO_EVERYONE: "Everyone",
  MUTUAL_FOLLOW_FRIENDS: "Friends",
  FOLLOWER_OF_CREATOR: "Followers",
  SELF_ONLY: "Only me",
};
const MUSIC = '<a href="https://www.tiktok.com/legal/page/global/music-usage-confirmation/en" target="_blank" rel="noopener">Music Usage Confirmation</a>';
const BRANDED = '<a href="https://www.tiktok.com/legal/page/global/bc-policy/en" target="_blank" rel="noopener">Branded Content Policy</a>';

let creator = null;
let file = null;
let durationOk = false;
let busy = false;

async function call(path, body) {
  const r = await fetch(path, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {});
  const data = await r.json().catch(() => ({}));
  if (r.status === 401) { location.href = "/"; throw new Error("signed out"); }
  if (!r.ok) throw Object.assign(new Error(data.message || "Something went wrong."), { code: data.error });
  return data;
}

const fmt = (n) => (n == null ? "–" : Intl.NumberFormat(undefined, { notation: "compact" }).format(n));

function show(el, on = true) { el.classList.toggle("hidden", !on); }

function renderAccount(user) {
  $("avatar").src = user.avatar_url || "";
  $("nickname").textContent = user.display_name || "";
  $("username").textContent = user.username ? "@" + user.username : "";
  $("postingTo").textContent = user.display_name + (user.username ? ` (@${user.username})` : "");
  $("sFollowers").textContent = fmt(user.follower_count);
  $("sLikes").textContent = fmt(user.likes_count);
  $("sVideos").textContent = fmt(user.video_count);
  $("sFollowing").textContent = fmt(user.following_count);
}

function renderVideos(videos) {
  const wrap = $("videos");
  wrap.innerHTML = "";
  show($("noVideos"), videos.length === 0);
  for (const v of videos) {
    const a = document.createElement("a");
    a.href = v.share_url; a.target = "_blank"; a.rel = "noopener";
    const img = document.createElement("img");
    img.src = v.cover_image_url; img.alt = "";
    const t = document.createElement("div");
    t.textContent = v.title || "(no caption)";
    const s = document.createElement("div");
    s.className = "muted";
    s.textContent = `${fmt(v.view_count)} views · ${fmt(v.like_count)} likes · ${fmt(v.comment_count)} comments`;
    a.append(img, t, s);
    wrap.append(a);
  }
}

function renderCreator() {
  const sel = $("privacy");
  for (const opt of creator.privacy_level_options) {
    const o = document.createElement("option");
    o.value = opt; o.textContent = PRIVACY_LABELS[opt] || opt;
    sel.append(o);
  }
  for (const [box, wrap, off] of [["allowComment", "cComment", creator.comment_disabled], ["allowDuet", "cDuet", creator.duet_disabled], ["allowStitch", "cStitch", creator.stitch_disabled]]) {
    $(box).disabled = !!off;
    $(wrap).classList.toggle("disabled", !!off);
    if (off) $(wrap).title = "Turned off in your TikTok settings";
  }
}

function update() {
  const commercial = $("commercial").checked;
  const yours = $("yourBrand").checked;
  const branded = $("brandedContent").checked;
  show($("commercialOptions"), commercial);

  // Branded content can't be private, and private posts can't be branded content.
  const privateSelected = $("privacy").value === "SELF_ONLY";
  const selfOnly = [...$("privacy").options].find((o) => o.value === "SELF_ONLY");
  if (selfOnly) selfOnly.disabled = commercial && branded;
  $("brandedContent").disabled = privateSelected;
  $("cBranded").classList.toggle("disabled", privateSelected);
  $("cBranded").title = privateSelected ? "Branded content visibility cannot be set to private" : "";
  show($("privacyNote"), commercial && branded);

  let label = "";
  if (commercial && branded) label = "Your photo/video will be labeled as 'Paid partnership'";
  else if (commercial && yours) label = "Your photo/video will be labeled as 'Promotional content'";
  $("commercialLabel").textContent = label;
  show($("commercialLabel"), !!label);
  const needsChoice = commercial && !yours && !branded;
  show($("commercialNeedsChoice"), needsChoice);

  $("declaration").innerHTML = commercial && branded
    ? `By posting, you agree to TikTok's ${BRANDED} and ${MUSIC}`
    : `By posting, you agree to TikTok's ${MUSIC}`;

  const ready = creator && !creator.cantPost && file && durationOk && !busy;
  $("postBtn").disabled = !(ready && $("privacy").value && !needsChoice);
  $("postBtn").title = needsChoice ? "You need to indicate if your content promotes yourself, a third party, or both." : "";
  $("draftBtn").disabled = !ready;
}

function onFile() {
  file = $("file").files[0] || null;
  durationOk = false;
  $("durationMsg").textContent = "";
  show($("durationMsg"), false);
  const v = $("preview");
  if (!file) { show(v, false); v.removeAttribute("src"); update(); return; }
  v.src = URL.createObjectURL(file);
  show(v, true);
  // Browsers may not load media in a background tab; don't block posting on the preview.
  const fallback = setTimeout(() => { if (!durationOk && !$("durationMsg").textContent) { durationOk = true; update(); } }, 5000);
  v.onloadedmetadata = () => {
    clearTimeout(fallback);
    const max = creator?.max_video_post_duration_sec;
    durationOk = !max || v.duration <= max;
    if (!durationOk) {
      $("durationMsg").textContent = `This video is ${Math.round(v.duration)} seconds long. Your account can post videos up to ${max} seconds.`;
      show($("durationMsg"), true);
    }
    update();
  };
}

async function uploadChunks(plan) {
  const total = file.size;
  for (let i = 0; i < plan.total_chunk_count; i++) {
    const start = i * plan.chunk_size;
    const end = i === plan.total_chunk_count - 1 ? total - 1 : start + plan.chunk_size - 1;
    const r = await fetch(plan.upload_url, {
      method: "PUT",
      headers: { "Content-Type": file.type || "video/mp4", "Content-Range": `bytes ${start}-${end}/${total}` },
      body: file.slice(start, end + 1),
    });
    if (!r.ok) throw new Error(`Upload failed (${r.status}). Please try again.`);
    const pct = Math.round(((end + 1) / total) * 100);
    $("progress").value = pct;
    $("progressText").textContent = `Uploading… ${pct}%`;
  }
}

async function waitForStatus(publishId, doneStates) {
  for (let delay = 3000, tries = 0; tries < 40; tries++, delay = Math.min(delay * 1.5, 15000)) {
    const s = await call("/api/status", { publish_id: publishId });
    if (doneStates.includes(s.status)) return s;
    if (s.status === "FAILED") throw new Error(`TikTok couldn't process this video (${s.fail_reason || "unknown reason"}).`);
    $("progressText").textContent = "TikTok is processing your video…";
    await new Promise((r) => setTimeout(r, delay));
  }
  return { status: "PROCESSING" };
}

function result(kind, html) {
  const el = $("result");
  el.className = `notice ${kind}`;
  el.innerHTML = html;
  show(el, true);
}

async function send(mode) {
  if (busy) return;
  busy = true; update();
  show($("result"), false);
  show($("progressWrap"), true);
  $("progress").value = 0;
  $("progressText").textContent = "Starting…";
  try {
    let plan;
    if (mode === "post") {
      const commercial = $("commercial").checked;
      plan = await call("/api/init", {
        video_size: file.size,
        duration_sec: Number.isFinite($("preview").duration) ? $("preview").duration : undefined,
        post: {
          title: $("title").value,
          privacy_level: $("privacy").value,
          disable_comment: !$("allowComment").checked,
          disable_duet: !$("allowDuet").checked,
          disable_stitch: !$("allowStitch").checked,
          brand_organic_toggle: commercial && $("yourBrand").checked,
          brand_content_toggle: commercial && $("brandedContent").checked,
        },
      });
    } else {
      plan = await call("/api/draft", { video_size: file.size });
    }
    await uploadChunks(plan);
    const s = await waitForStatus(plan.publish_id, mode === "post" ? ["PUBLISH_COMPLETE"] : ["SEND_TO_USER_INBOX"]);
    show($("progressWrap"), false);
    if (mode === "post") {
      result("ok", s.status === "PUBLISH_COMPLETE"
        ? "Posted! It may take a few minutes for your video to process and be visible on your TikTok profile."
        : "Your video was sent to TikTok. It may take a few minutes for it to process and be visible on your profile.");
    } else {
      result("ok", "Sent to your TikTok drafts. Open the TikTok app and tap the notification in your inbox to finish editing and posting.");
    }
  } catch (err) {
    show($("progressWrap"), false);
    result("err", err.message);
  } finally {
    busy = false; update();
  }
}

async function main() {
  const dash = await call("/api/dashboard");
  renderAccount(dash.user);
  renderVideos(dash.videos);
  try {
    creator = (await call("/api/me")).creator;
    renderCreator();
  } catch (err) {
    creator = { cantPost: true };
    $("cantPost").textContent = err.code && err.code.startsWith("spam_risk")
      ? "TikTok isn't accepting new posts from this account right now. Please try again later."
      : `We couldn't load your posting settings: ${err.message}`;
    show($("cantPost"), true);
  }
  show($("loading"), false);
  show($("app"), true);
  for (const id of ["privacy", "commercial", "yourBrand", "brandedContent"]) $(id).addEventListener("change", update);
  $("file").addEventListener("change", onFile);
  $("postForm").addEventListener("submit", (e) => { e.preventDefault(); send("post"); });
  $("draftBtn").addEventListener("click", () => send("draft"));
  update();
}

main().catch((err) => { $("loading").textContent = err.message; });
