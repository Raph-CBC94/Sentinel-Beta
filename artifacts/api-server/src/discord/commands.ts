import {
  ActionRowBuilder,
  ChatInputCommandInteraction,
  ComponentType,
  EmbedBuilder,
  GuildMember,
  REST,
  Routes,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  TextChannel,
} from "discord.js";
import { logger } from "../lib/logger";
import { getBotConfig, type BotConfig } from "./config";
import {
  createSanction,
  getMemberHistory,
  recordEvent,
  removeActiveTimeouts,
  removeWarning,
  updateSanction,
  type Sanction,
} from "./database";

const MAX_TIMEOUT_SECONDS = 28 * 24 * 60 * 60;

export const commandDefinitions = [
  new SlashCommandBuilder()
    .setName("avertir")
    .setDescription("Attribuer un avertissement à un membre")
    .addUserOption((option) =>
      option.setName("membre").setDescription("Membre à avertir").setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("raison")
        .setDescription("Raison de l'avertissement")
        .setMaxLength(500)
        .setRequired(true),
    ),
  new SlashCommandBuilder()
    .setName("sourdine")
    .setDescription("Mettre un membre en sourdine")
    .addUserOption((option) =>
      option.setName("membre").setDescription("Membre à mettre en sourdine").setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("duree")
        .setDescription("Durée de la sourdine : 30m, 2h ou 1d")
        .setMaxLength(10)
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("raison")
        .setDescription("Raison de la mise en sourdine")
        .setMaxLength(500)
        .setRequired(true),
    ),
  new SlashCommandBuilder()
    .setName("retirer-sourdine")
    .setDescription("Retirer la sourdine d'un membre")
    .addUserOption((option) =>
      option.setName("membre").setDescription("Membre à libérer").setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("raison")
        .setDescription("Raison du retrait")
        .setMaxLength(500)
        .setRequired(false),
    ),
  new SlashCommandBuilder()
    .setName("historique")
    .setDescription("Consulter l'historique des sanctions")
    .addUserOption((option) =>
      option.setName("membre").setDescription("Membre à consulter").setRequired(true),
    ),
  new SlashCommandBuilder()
    .setName("retirer-avertissement")
    .setDescription("Choisir l'avertissement à retirer")
    .addUserOption((option) =>
      option.setName("membre").setDescription("Membre concerné").setRequired(true),
    ),
].map((command) => command.toJSON());

export async function registerCommands(config: BotConfig): Promise<void> {
  const rest = new REST({ version: "10" }).setToken(config.token);
  await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), {
    body: commandDefinitions,
  });
  logger.info({ guildId: config.guildId }, "Discord slash commands registered");
}

function getGuildMember(interaction: ChatInputCommandInteraction): GuildMember | null {
  const member = interaction.options.getMember("membre");
  return member instanceof GuildMember ? member : null;
}

function hasAuthorizedRole(member: GuildMember, roleIds: string[]): boolean {
  return roleIds.length > 0 && roleIds.some((roleId) => member.roles.cache.has(roleId));
}

function hasAuthorizedUser(member: GuildMember, userIds: string[]): boolean {
  return userIds.length > 0 && userIds.includes(member.id);
}

function hasAnyModeratorAccess(member: GuildMember, config: BotConfig): boolean {
  return (
    hasAuthorizedRole(member, config.roles.warn) ||
    hasAuthorizedRole(member, config.roles.timeout) ||
    hasAuthorizedUser(member, config.removeWarningUserIds)
  );
}

async function requireAuthorized(
  interaction: ChatInputCommandInteraction,
  roleIds: string[],
  action: string,
): Promise<GuildMember | null> {
  const moderator = interaction.member;
  if (!(moderator instanceof GuildMember) || !hasAuthorizedRole(moderator, roleIds)) {
    await interaction.reply({
      content: `Vous n'êtes pas autorisé à ${action}.`,
      ephemeral: true,
    });
    return null;
  }

  return moderator;
}

async function requireAuthorizedUser(
  interaction: ChatInputCommandInteraction,
  userIds: string[],
  action: string,
): Promise<GuildMember | null> {
  const moderator = interaction.member;
  if (!(moderator instanceof GuildMember) || !hasAuthorizedUser(moderator, userIds)) {
    await interaction.reply({
      content: `Vous n'êtes pas autorisé à ${action}.`,
      ephemeral: true,
    });
    return null;
  }

  return moderator;
}

function parseDuration(value: string): number | null {
  const match = /^(\d{1,5})\s*(s|m|h|d)$/i.exec(value.trim());
  if (!match) {
    return null;
  }

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multiplier = unit === "s" ? 1 : unit === "m" ? 60 : unit === "h" ? 3600 : 86400;
  const seconds = amount * multiplier;
  return seconds > 0 && seconds <= MAX_TIMEOUT_SECONDS ? seconds : null;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "—";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const parts = [
    days ? `${days} j` : "",
    hours ? `${hours} h` : "",
    minutes ? `${minutes} min` : "",
  ].filter(Boolean);
  return parts.join(" ") || `${seconds} s`;
}

function referenceFor(sanction: Sanction): string {
  return `#${sanction.id.slice(0, 8).toUpperCase()}`;
}

function formatDate(value: string): string {
  return `<t:${Math.floor(new Date(value).getTime() / 1000)}:f>`;
}

function formatSelectionDate(value: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
  }).format(new Date(value));
}

function formatSelectionDescription(sanction: Sanction): string {
  const reason = sanction.reason.replace(/\s+/g, " ").trim();
  return `${reason} · ${formatSelectionDate(sanction.created_at)}`.slice(0, 100);
}

async function notifyMember(
  member: GuildMember,
  content: string,
): Promise<{ sent: boolean; error?: string }> {
  try {
    await member.send(content);
    return { sent: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Discord DM error";
    return { sent: false, error: message.slice(0, 500) };
  }
}

async function sendLog(
  interaction: ChatInputCommandInteraction,
  config: BotConfig,
  embed: EmbedBuilder,
): Promise<void> {
  if (!config.logChannelId) {
    logger.warn("LOG_CHANNEL_ID is not configured; sanction log was not sent to Discord");
    return;
  }

  try {
    const channel = await interaction.client.channels.fetch(config.logChannelId);
    if (!(channel instanceof TextChannel)) {
      throw new Error("LOG_CHANNEL_ID is not a text channel");
    }
    await channel.send({ embeds: [embed] });
  } catch (error) {
    logger.error({ err: error, channelId: config.logChannelId }, "Could not send sanction log");
  }
}

function sanctionEmbed(
  title: string,
  color: number,
  sanction: Sanction,
): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(title)
    .setColor(color)
    .addFields(
      { name: "Membre", value: `<@${sanction.member_id}>`, inline: true },
      { name: "Modérateur", value: `<@${sanction.moderator_id}>`, inline: true },
      { name: "Référence", value: referenceFor(sanction), inline: true },
      { name: "Raison", value: sanction.reason.slice(0, 1024) },
      { name: "Date", value: formatDate(sanction.created_at), inline: true },
      ...(sanction.type === "timeout"
        ? [
            {
              name: "Durée",
              value: formatDuration(sanction.duration_seconds),
              inline: true,
            },
            {
              name: "Fin",
              value: sanction.expires_at ? formatDate(sanction.expires_at) : "—",
              inline: true,
            },
          ]
        : []),
    );
}

async function handleWarn(
  interaction: ChatInputCommandInteraction,
  config: BotConfig,
): Promise<void> {
  const moderator = await requireAuthorized(interaction, config.roles.warn, "attribuer un avertissement");
  if (!moderator) return;
  const member = getGuildMember(interaction);
  const reason = interaction.options.getString("raison", true).trim();

  if (!member) {
    await interaction.reply({ content: "Ce membre n'est plus présent sur le serveur.", ephemeral: true });
    return;
  }

  const sanction = await createSanction({
    guild_id: interaction.guildId!,
    member_id: member.id,
    member_tag: member.user.tag,
    type: "warning",
    reason,
    moderator_id: moderator.id,
    moderator_tag: moderator.user.tag,
    duration_seconds: null,
    expires_at: null,
    status: "applied",
  });
  const dm = await notifyMember(
    member,
    `Vous avez reçu un avertissement sur **${interaction.guild?.name ?? "ce serveur"}**.\nRaison : ${reason}\nRéférence : ${referenceFor(sanction)}`,
  );
  await updateSanction(sanction.id, { dm_sent: dm.sent, dm_error: dm.error ?? null });

  await interaction.reply({
    embeds: [sanctionEmbed("Avertissement ajouté", 0xf59e0b, sanction)],
  });
  await sendLog(
    interaction,
    config,
    sanctionEmbed("Avertissement enregistré", 0xf59e0b, sanction).addFields({
      name: "Message privé",
      value: dm.sent ? "Envoyé" : `Échec : ${dm.error ?? "inconnu"}`,
    }),
  );
}

async function handleTimeout(
  interaction: ChatInputCommandInteraction,
  config: BotConfig,
): Promise<void> {
  const moderator = await requireAuthorized(interaction, config.roles.timeout, "mettre un membre en sourdine");
  if (!moderator) return;
  const member = getGuildMember(interaction);
  const durationInput = interaction.options.getString("duree", true);
  const reason = interaction.options.getString("raison", true).trim();
  const durationSeconds = parseDuration(durationInput);

  if (!member) {
    await interaction.reply({ content: "Ce membre n'est plus présent sur le serveur.", ephemeral: true });
    return;
  }
  if (!durationSeconds) {
    await interaction.reply({
      content: "Durée de sourdine invalide. Utilisez une valeur comme `30m`, `2h` ou `1d` (maximum 28 jours).",
      ephemeral: true,
    });
    return;
  }

  const expiresAt = new Date(Date.now() + durationSeconds * 1000).toISOString();
  const sanction = await createSanction({
    guild_id: interaction.guildId!,
    member_id: member.id,
    member_tag: member.user.tag,
    type: "timeout",
    reason,
    moderator_id: moderator.id,
    moderator_tag: moderator.user.tag,
    duration_seconds: durationSeconds,
    expires_at: expiresAt,
    status: "pending",
  });

  try {
    await member.timeout(durationSeconds * 1000, reason);
    await updateSanction(sanction.id, { status: "applied" });
  } catch (error) {
    await updateSanction(sanction.id, {
      status: "failed",
      dm_error: error instanceof Error ? error.message.slice(0, 500) : "La sourdine a échoué",
    });
    await interaction.reply({
      content: "Le timeout Discord a échoué. Vérifiez ma permission `Modérer les membres`.",
      ephemeral: true,
    });
    return;
  }

  const dm = await notifyMember(
    member,
    `Vous avez été mis en sourdine sur **${interaction.guild?.name ?? "ce serveur"}**.\nDurée : ${formatDuration(durationSeconds)}\nFin : ${formatDate(expiresAt)}\nRaison : ${reason}\nRéférence : ${referenceFor(sanction)}`,
  );
  await updateSanction(sanction.id, { dm_sent: dm.sent, dm_error: dm.error ?? null });
  const appliedSanction = { ...sanction, status: "applied" as const };

  await interaction.reply({
    embeds: [sanctionEmbed("Sourdine appliquée", 0xef4444, appliedSanction)],
  });
  await sendLog(
    interaction,
    config,
    sanctionEmbed("Sourdine enregistrée", 0xef4444, appliedSanction).addFields({
      name: "Message privé",
      value: dm.sent ? "Envoyé" : `Échec : ${dm.error ?? "inconnu"}`,
    }),
  );
}

async function handleUntimeout(
  interaction: ChatInputCommandInteraction,
  config: BotConfig,
): Promise<void> {
  const moderator = await requireAuthorized(interaction, config.roles.timeout, "retirer une sourdine");
  if (!moderator) return;
  const member = getGuildMember(interaction);
  const reason = interaction.options.getString("raison")?.trim() || "Retrait manuel de la sourdine";

  if (!member) {
    await interaction.reply({ content: "Ce membre n'est plus présent sur le serveur.", ephemeral: true });
    return;
  }

  try {
    await member.timeout(null, reason);
    await recordEvent({
      guildId: interaction.guildId!,
      memberId: member.id,
      moderatorId: moderator.id,
      action: "untimeout",
      reason,
    });
    await removeActiveTimeouts(interaction.guildId!, member.id);
    await interaction.reply({ content: `La sourdine de <@${member.id}> a été retirée.` });
    await sendLog(
      interaction,
      config,
      new EmbedBuilder()
        .setTitle("Sourdine retirée")
        .setColor(0x22c55e)
        .addFields(
          { name: "Membre", value: `<@${member.id}>`, inline: true },
          { name: "Modérateur", value: `<@${moderator.id}>`, inline: true },
          { name: "Raison", value: reason },
          { name: "Date", value: formatDate(new Date().toISOString()) },
        ),
    );
  } catch (error) {
    logger.error({ err: error, memberId: member.id }, "Impossible de retirer la sourdine");
    await interaction.reply({
      content: "Le retrait de la sourdine a échoué. Vérifiez ma permission `Modérer les membres`.",
      ephemeral: true,
    });
  }
}

async function handleHistory(
  interaction: ChatInputCommandInteraction,
  config: BotConfig,
): Promise<void> {
  const moderator = interaction.member;
  if (!(moderator instanceof GuildMember) || !hasAnyModeratorAccess(moderator, config)) {
    await interaction.reply({
      content: "Vous n'êtes pas autorisé à consulter les historiques.",
      ephemeral: true,
    });
    return;
  }
  const member = getGuildMember(interaction);
  if (!member) {
    await interaction.reply({ content: "Ce membre n'est plus présent sur le serveur.", ephemeral: true });
    return;
  }

  const history = await getMemberHistory(interaction.guildId!, member.id);
  if (history.length === 0) {
    await interaction.reply({ content: `<@${member.id}> ne possède aucune sanction enregistrée.` });
    return;
  }

  const warnings = history.filter((sanction) => sanction.type === "warning").length;
  const timeouts = history.filter((sanction) => sanction.type === "timeout").length;
  const lines = history.map((sanction) => {
    const duration =
      sanction.type === "timeout" ? ` — ${formatDuration(sanction.duration_seconds)}` : "";
    return `${referenceFor(sanction)} **${sanction.type === "warning" ? "Avertissement" : "Sourdine"}**${duration}\n${sanction.reason}\nPar <@${sanction.moderator_id}> · ${formatDate(sanction.created_at)}`;
  });
  const intro = `**Historique de ${member.user.tag}**\nAvertissements : **${warnings}** · Sourdines : **${timeouts}**\n\n`;
  const chunks: string[] = [];
  let current = intro;
  for (const line of lines) {
    if (current.length + line.length + 2 > 3900) {
      chunks.push(current);
      current = "";
    }
    current += `${line}\n\n`;
  }
  if (current) chunks.push(current);

  await interaction.reply({ content: chunks[0] });
  for (const chunk of chunks.slice(1)) {
    await interaction.followUp({ content: chunk });
  }
}

async function handleRemoveWarning(
  interaction: ChatInputCommandInteraction,
  config: BotConfig,
): Promise<void> {
  const moderator = await requireAuthorizedUser(
    interaction,
    config.removeWarningUserIds,
    "retirer un avertissement",
  );
  if (!moderator) return;
  const member = getGuildMember(interaction);

  if (!member) {
    await interaction.reply({ content: "Ce membre n'est plus présent sur le serveur.", ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const activeWarnings = (await getMemberHistory(interaction.guildId!, member.id)).filter(
    (sanction) => sanction.type === "warning" && sanction.status === "applied",
  );
  if (activeWarnings.length === 0) {
    await interaction.editReply({
      content: `<@${member.id}> ne possède aucun avertissement actif à retirer.`,
    });
    return;
  }

  const visibleWarnings = activeWarnings.slice(0, 125);
  const rows = [];
  for (let index = 0; index < visibleWarnings.length; index += 25) {
    const options = visibleWarnings.slice(index, index + 25).map((warning) => ({
      label: `Avertissement ${referenceFor(warning)}`,
      description: formatSelectionDescription(warning),
      value: warning.id,
    }));
    const menu = new StringSelectMenuBuilder()
      .setCustomId(`retirer-avertissement:${interaction.id}:${index / 25}`)
      .setPlaceholder("Choisissez un avertissement à retirer")
      .addOptions(options);
    rows.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu));
  }

  await interaction.editReply({
    content:
      visibleWarnings.length < activeWarnings.length
        ? "Choisissez l'avertissement à retirer parmi les 125 plus récents :"
        : "Choisissez l'avertissement à retirer :",
    components: rows,
  });

  const reply = await interaction.fetchReply();
  let selection: StringSelectMenuInteraction;
  try {
    const collector = reply.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      time: 60_000,
      filter: (component) =>
        component.user.id === moderator.id &&
        component.customId.startsWith(`retirer-avertissement:${interaction.id}:`),
    });
    selection = await new Promise<StringSelectMenuInteraction>((resolve, reject) => {
      collector.once("collect", resolve);
      collector.once("end", (_collected, reason) => {
        if (reason === "time") reject(new Error("selection_timeout"));
      });
    });
  } catch {
    await interaction
      .editReply({
        content: "La sélection a expiré. Relancez la commande pour choisir un avertissement.",
        components: [],
      })
      .catch(() => undefined);
    return;
  }

  const warning = activeWarnings.find((sanction) => sanction.id === selection.values[0]);
  if (!warning) {
    await selection.update({
      content: "Cet avertissement n'est plus disponible. Relancez la commande.",
      components: [],
    });
    return;
  }

  const removed = await removeWarning(warning.id, moderator.id);
  await selection.update({
    content: `L'avertissement ${referenceFor(removed)} de <@${member.id}> a été retiré.`,
    components: [],
  });
  await sendLog(
    interaction,
    config,
    sanctionEmbed("Avertissement retiré", 0x22c55e, removed).addFields({
      name: "Retiré par",
      value: `<@${moderator.id}>`,
    }),
  );
}

export async function handleCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const config = getBotConfig();
  try {
    switch (interaction.commandName) {
      case "avertir":
        await handleWarn(interaction, config);
        break;
      case "sourdine":
        await handleTimeout(interaction, config);
        break;
      case "retirer-sourdine":
        await handleUntimeout(interaction, config);
        break;
      case "historique":
        await handleHistory(interaction, config);
        break;
      case "retirer-avertissement":
        await handleRemoveWarning(interaction, config);
        break;
      default:
        await interaction.reply({ content: "Commande inconnue.", ephemeral: true });
    }
  } catch (error) {
    logger.error({ err: error, command: interaction.commandName }, "Sanction command failed");
    const content = "Une erreur interne est survenue. La sanction n'a pas pu être finalisée.";
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content, ephemeral: true }).catch(() => undefined);
    } else {
      await interaction.reply({ content, ephemeral: true }).catch(() => undefined);
    }
  }
}