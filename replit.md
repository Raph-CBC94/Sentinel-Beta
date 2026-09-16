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
- Appliquer `supabase/schema.sql` une fois dans l'éditeur SQL Supabase. Pour une base existante, appliquer aussi `supabase/ban-migration.sql` avant d'utiliser `/ban` ou les boutons de signalement.

## Variables nécessaires

DISCORD_TOKEN, DISCORD_PUBLIC_KEY, DISCORD_CLIENT_ID, DISCORD_GUILD_ID, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, WARN_ROLE_IDS, TIMEOUT_ROLE_IDS, BAN_ROLE_IDS, REMOVE_WARNING_USER_IDS, GROQ_API_KEY pour `/avis-ia` et LOG_CHANNEL_ID pour les logs et signalements.

Le token Discord, la clé publique et la clé service Supabase vont uniquement dans les variables d'environnement Vercel. Ne jamais les committer.

## Réenregistrer les commandes Discord

Vercel déploie la Function HTTP mais n'enregistre pas les commandes slash dans Discord. Après avoir défini les variables serveur, lancer `pnpm run discord:register` une fois. Le script met à jour les commandes de ce projet et crée celles qui manquent sans remplacer les commandes d'autres versions.

`/signaler` attend l'ID du message à signaler. Active le mode développeur Discord pour copier cet ID. Le signalement est envoyé dans `LOG_CHANNEL_ID` avec des boutons de sanction : avertissement niveau 1, sourdine d'une heure ou bannissement. `BAN_ROLE_IDS` contrôle l'accès à `/ban` et au bouton de bannissement.
