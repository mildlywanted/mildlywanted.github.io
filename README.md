# Mildly Wanted

Free web app for posting gameplay clips to TikTok (Login Kit + Content Posting API).
Deployed on Vercel: static pages at the root, serverless functions in `api/`.

Environment variables (Vercel → Project → Settings → Environment Variables):
- `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`: from developers.tiktok.com (sandbox or production)
- `PUBLIC_URL`: e.g. `https://mildlywanted.vercel.app` (redirect URI is `PUBLIC_URL/api/callback`)
- `SESSION_SECRET`: any random string of 32+ characters

Tests: `npm test`
