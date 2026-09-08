import {
  Client,
  Events,
  GatewayIntentBits,
  type ChatInputCommandInteraction,
} from "discord.js";
import { logger } from "../lib/logger";
import { getBotConfig } from "./config";
import { handleCommand, registerCommands } from "./commands";

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

let started = false;

client.once(Events.ClientReady, async (readyClient) => {
  try {
    await registerCommands(getBotConfig());
    logger.info(
      { user: readyClient.user.tag, guilds: readyClient.guilds.cache.size },
      "Discord bot ready",
    );
  } catch (error) {
    logger.error({ err: error }, "Could not register Discord slash commands");
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  await handleCommand(interaction as ChatInputCommandInteraction);
});

client.on(Events.Error, (error) => {
  logger.error({ err: error }, "Discord client error");
});

export async function startDiscordBot(): Promise<void> {
  if (started) return;
  started = true;
  await client.login(getBotConfig().token);
}