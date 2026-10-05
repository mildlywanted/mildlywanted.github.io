# Mildly Wanted

Free web app for posting gameplay clips to TikTok (Login Kit + Content Posting API).
Deployed on Vercel: static pages at the root, serverless functions in `api/`.

Environment variables (Vercel → Project → Settings → Environment Variables):
- `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`: from developers.tiktok.com (sandbox or production)
- `APP_URL` (optional): the site's address; defaults to the request's host. The redirect URI is `<address>/api/callback`
- `SESSION_SECRET`: any random string of 32+ characters

Tests: `npm test`
