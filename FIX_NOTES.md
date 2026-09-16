# Correction des commandes Discord

## Diagnostic

`/say` et `/avis-ia` étaient encore présents dans :

- `api/discord/interactions.ts`
- `scripts/src/register-discord-commands.mjs`

Le script utilisait toutefois `PUT /applications/.../guilds/.../commands`. Cette route remplace toute la liste des commandes du serveur. Une exécution avec une ancienne liste pouvait donc retirer ces deux commandes sans modification du handler Vercel.

## Correction appliquée

Le script met maintenant à jour les commandes existantes avec `PATCH` et crée uniquement les commandes absentes avec `POST`. Il ne supprime plus les commandes présentes dans Discord.

## Remise en ligne

1. Déployer cette version sur Vercel.
2. Vérifier que `DISCORD_TOKEN`, `DISCORD_CLIENT_ID` et `DISCORD_GUILD_ID` désignent bien la même application et le même serveur.
3. Définir `GROQ_API_KEY` dans Vercel pour rendre `/avis-ia` opérationnelle.
4. Depuis la racine du projet, lancer une fois :

   ```bash
   pnpm run discord:register
   ```

Après cette synchronisation, Discord doit afficher les sept commandes définies par le script, dont `/say` et `/avis-ia`. Vercel ne lance pas automatiquement cette synchronisation lors d'un déploiement de la Function HTTP.