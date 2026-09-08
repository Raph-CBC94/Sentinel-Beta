function parseRoleIds(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((roleId) => roleId.trim())
    .filter(Boolean);
}

export type BotConfig = {
  token: string;
  clientId: string;
  guildId: string;
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  logChannelId?: string;
  roles: {
    warn: string[];
    timeout: string[];
    removeWarning: string[];
  };
};

export function getBotConfig(): BotConfig {
  const requiredKeys = [
    "DISCORD_TOKEN",
    "DISCORD_CLIENT_ID",
    "DISCORD_GUILD_ID",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
  ] as const;
  const missing = requiredKeys.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Discord bot configuration is incomplete: ${missing.join(", ")}`);
  }

  return {
    token: process.env.DISCORD_TOKEN!,
    clientId: process.env.DISCORD_CLIENT_ID!,
    guildId: process.env.DISCORD_GUILD_ID!,
    supabaseUrl: process.env.SUPABASE_URL!,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
    logChannelId: process.env.LOG_CHANNEL_ID,
    roles: {
      warn: parseRoleIds(process.env.WARN_ROLE_IDS),
      timeout: parseRoleIds(process.env.TIMEOUT_ROLE_IDS),
      removeWarning: parseRoleIds(process.env.REMOVE_WARNING_ROLE_IDS),
    },
  };
}