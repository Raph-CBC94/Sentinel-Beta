---
name: Vercel and Discord hosting
description: Hosting boundary between the Sentinel landing page and its persistent Discord gateway.
---

Vercel hosts the static Sentinel website, while the Discord gateway remains in the server-side API service. The bot token must never be sent to browser code.

**Why:** A Discord gateway bot needs a persistent server-side connection; a browser page and Vercel Functions are not a safe replacement for that process.

**How to apply:** Keep the website deployable to Vercel and keep the bot on an always-on server host. If the site needs bot status, expose a safe server-side health/status endpoint instead of connecting Discord from the client.