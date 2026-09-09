# Discord Sanctions Bot

Bot Discord de modération avec avertissements, mises en sourdine, historique persistant et logs détaillés dans Supabase.

## Architecture

- Le site est un build Vite statique déployé sur Vercel.
- Discord utilise la Function HTTP /api/discord/interactions ; aucun Gateway permanent n'est démarré en production.
- Chaque interaction est vérifiée avec la clé publique Discord, puis traitée avec l'API REST Discord et Supabase côté serveur.
- Le menu /retirer-avertissement est stateless : le clic sur le select menu arrive comme une nouvelle interaction HTTP.
- Les secrets ne doivent jamais être préfixés par VITE_ ni envoyés au navigateur.

## Commandes locales

- pnpm --filter @workspace/api-server run dev — lancer l'API de santé locale
- pnpm run typecheck — vérifier les types
- pnpm run build — construire les packages et le site
- pnpm run discord:register — enregistrer les commandes guild Discord avec les variables serveur
- Appliquer supabase/schema.sql une fois dans l'éditeur SQL Supabase.

## Variables nécessaires

DISCORD_TOKEN, DISCORD_PUBLIC_KEY, DISCORD_CLIENT_ID, DISCORD_GUILD_ID, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, WARN_ROLE_IDS, TIMEOUT_ROLE_IDS, REMOVE_WARNING_USER_IDS et éventuellement LOG_CHANNEL_ID.

Le token Discord, la clé publique et la clé service Supabase vont uniquement dans les variables d'environnement Vercel. Ne jamais les committer.
