# Discord Sanctions Bot

Bot Discord de modération avec avertissements, mises en sourdine, historique persistant et logs détaillés dans Supabase.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run typecheck` — verify the bot and API types
- `pnpm --filter @workspace/api-server run build` — build the long-running Discord worker/API service
- Apply `supabase/schema.sql` once in the Supabase SQL editor before starting the bot.
- Required env: `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_GUILD_ID`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- Permission env: `WARN_ROLE_IDS`, `TIMEOUT_ROLE_IDS`, `REMOVE_WARNING_ROLE_IDS` (comma-separated role IDs)
- Optional env: `LOG_CHANNEL_ID`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/api-server/src/discord/` — Discord client, slash commands, permission checks, and Supabase persistence
- `supabase/schema.sql` — source of truth for sanction and audit-event tables
- `.env.example` — required configuration names without secret values

## Architecture decisions

- The Discord gateway runs in the existing API service, which also keeps a health endpoint for worker hosting.
- Permission checks use explicit role-ID allowlists per action; Discord administrator permissions do not bypass these lists.
- Sanctions are written to Supabase before public confirmation; failed timeout applications remain auditable with `failed` status.
- Discord messages are best-effort notifications: a blocked DM never prevents the sanction or database record.

## Product

- `/avertir` ajoute un avertissement, envoie un message public, tente un message privé et écrit un journal détaillé.
- `/sourdine` et `/retirer-sourdine` gèrent les mises en sourdine avec une durée limitée.
- `/historique` affiche l'historique complet des avertissements et mises en sourdine, tandis que `/retirer-avertissement` retire un avertissement précis par référence.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Discord slash commands are registered for `DISCORD_GUILD_ID` on every bot start.
- The bot needs the `Moderate Members`, `Send Messages`, `Embed Links`, and `View Channel` permissions.
- The bot application must be invited to `DISCORD_GUILD_ID` with both `bot` and `applications.commands` scopes before slash-command registration can succeed.
- Apply `supabase/schema.sql` before starting the service or every command will fail at persistence.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
