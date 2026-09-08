---
name: Discord component selection
description: Reliable pattern for waiting on a select menu after a slash command in discord.js.
---

In the installed discord.js version, `ChatInputCommandInteraction` does not expose `awaitMessageComponent`. For ephemeral select menus, fetch the reply and collect components from the returned message.

**Why:** Calling the interaction-level helper causes a TypeScript failure even though message component collectors are supported.

**How to apply:** Use `interaction.fetchReply()` followed by `createMessageComponentCollector`, constrain the custom ID and the selecting user, and remove the components after selection or timeout.