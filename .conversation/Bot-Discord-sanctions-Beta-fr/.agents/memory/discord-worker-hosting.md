---
name: Discord worker hosting
description: Durable hosting and gateway-intent constraints for the moderation bot.
---

The Discord gateway process should run on an always-on worker/service, with an HTTP health endpoint available for monitoring. Do not treat a serverless request platform as the primary host for the bot connection.

**Why:** Discord gateway sessions are long-lived and slash-command registration fails when the application has not been invited to the target guild. Privileged intents should not be requested unless the bot truly needs them.

**How to apply:** Keep gateway intents minimal, register commands against the configured guild on startup, and require the `bot` plus `applications.commands` invite scopes before diagnosing command-registration errors.