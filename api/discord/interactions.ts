import { createPublicKey, verify } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  createSanction,
  getMemberHistory,
  recordEvent,
  removeActiveTimeouts,
  removeWarning,
  updateSanction,
  type Sanction,
} from "../../artifacts/api-server/src/discord/database.js";
import { getBotConfig, type BotConfig } from "../../artifacts/api-server/src/discord/config.js";

type DiscordUser = { id: string; username?: string; global_name?: string | null; discriminator?: string };
type DiscordMember = { user?: DiscordUser; roles?: string[] };
type InteractionOption = { name: string; value?: string | number | boolean };
type DiscordInteraction = {
  id: string; application_id: string; token: string; type: number; guild_id?: string; user?: DiscordUser; member?: DiscordMember;
  data?: {
    name?: string;
    options?: InteractionOption[];
    custom_id?: string;
    values?: string[];
    resolved?: { users?: Record<string, DiscordUser>; members?: Record<string, DiscordMember> };
  };
};
type ResponsePayload = { content?: string; embeds?: unknown[]; components?: unknown[] };
type TargetMember = { id: string; tag: string };

const MAX_TIMEOUT_SECONDS = 28 * 24 * 60 * 60;
const DISCORD_API = "https://discord.com/api/v10";
const EPHEMERAL = 64;
const ED25519_SPKI_PREFIX = "302a300506032b6570032100";

function json(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer | string) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function verifyDiscordSignature(rawBody: string, req: IncomingMessage): boolean {
  const signature = req.headers["x-signature-ed25519"];
  const timestamp = req.headers["x-signature-timestamp"];
  const publicKey = process.env.DISCORD_PUBLIC_KEY;
  if (!signature || Array.isArray(signature) || !timestamp || Array.isArray(timestamp) || !publicKey) return false;
  try {
    const key = createPublicKey({ key: Buffer.concat([Buffer.from(ED25519_SPKI_PREFIX, "hex"), Buffer.from(publicKey, "hex")]), format: "der", type: "spki" });
    return verify(null, Buffer.from(timestamp + rawBody), key, Buffer.from(signature, "hex"));
  } catch {
    return false;
  }
}

async function discordRequest<T>(config: BotConfig, path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (!path.startsWith("/interactions/") && !path.startsWith("/webhooks/")) headers.set("authorization", "Bot " + config.token);
  if (init.body !== undefined) headers.set("content-type", "application/json");
  const response = await fetch(DISCORD_API + path, { ...init, headers });
  const text = await response.text();
  if (!response.ok) throw new Error("Discord " + response.status + " on " + path + ": " + text.slice(0, 500));
  if (!text) return null as T;
  return JSON.parse(text) as T;
}

async function acknowledge(interaction: DiscordInteraction, type: 5 | 6, ephemeral: boolean, config: BotConfig): Promise<void> {
  const body: { type: number; data?: { flags: number } } = { type };
  if (type === 5 && ephemeral) body.data = { flags: EPHEMERAL };
  await discordRequest(config, "/interactions/" + interaction.id + "/" + interaction.token + "/callback", { method: "POST", body: JSON.stringify(body) });
}

async function editOriginal(interaction: DiscordInteraction, payload: ResponsePayload, config: BotConfig): Promise<void> {
  await discordRequest(config, "/webhooks/" + interaction.application_id + "/" + interaction.token + "/messages/@original", { method: "PATCH", body: JSON.stringify(payload) });
}

async function followUp(interaction: DiscordInteraction, payload: ResponsePayload, config: BotConfig): Promise<void> {
  await discordRequest(config, "/webhooks/" + interaction.application_id + "/" + interaction.token, { method: "POST", body: JSON.stringify(payload) });
}

function actorOf(interaction: DiscordInteraction): DiscordUser | null { return interaction.member?.user ?? interaction.user ?? null; }
function actorRoles(interaction: DiscordInteraction): string[] { return interaction.member?.roles ?? []; }
function hasRole(interaction: DiscordInteraction, roleIds: string[]): boolean { return roleIds.length > 0 && roleIds.some((roleId) => actorRoles(interaction).includes(roleId)); }
function hasUser(interaction: DiscordInteraction, userIds: string[]): boolean { const actor = actorOf(interaction); return Boolean(actor && userIds.includes(actor.id)); }
function hasAnyModeratorAccess(interaction: DiscordInteraction, config: BotConfig): boolean { return hasRole(interaction, config.roles.warn) || hasRole(interaction, config.roles.timeout) || hasUser(interaction, config.removeWarningUserIds); }
function option(interaction: DiscordInteraction, name: string): string | null { const value = interaction.data?.options?.find((item) => item.name === name)?.value; return value === undefined ? null : String(value); }

function targetOf(interaction: DiscordInteraction): TargetMember | null {
  const id = option(interaction, "membre");
  if (!id) return null;
  const user = interaction.data?.resolved?.users?.[id];
  const member = interaction.data?.resolved?.members?.[id];
  const resolvedUser = user ?? member?.user;
  if (!resolvedUser) return null;
  return { id, tag: resolvedUser.username || resolvedUser.global_name || id };
}

function parseDuration(value: string): number | null {
  const match = /^(\\d{1,5})\\s*(s|m|h|d)$/i.exec(value.trim());
  if (!match) return null;
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
  const parts = [days ? days + " j" : "", hours ? hours + " h" : "", minutes ? minutes + " min" : ""].filter(Boolean);
  return parts.join(" ") || seconds + " s";
}
function referenceFor(sanction: Sanction): string { return "#" + sanction.id.slice(0, 8).toUpperCase(); }
function formatDate(value: string): string { return "<t:" + Math.floor(new Date(value).getTime() / 1000) + ":f>"; }
function formatSelectionDescription(sanction: Sanction): string { const reason = sanction.reason.replace(/\\s+/g, " ").trim(); return (reason + " · " + new Intl.DateTimeFormat("fr-FR", { dateStyle: "short" }).format(new Date(sanction.created_at))).slice(0, 100); }

function sanctionEmbed(title: string, color: number, sanction: Sanction, extraFields: unknown[] = []): unknown {
  return { title, color, fields: [
    { name: "Membre", value: "<@" + sanction.member_id + ">", inline: true },
    { name: "Modérateur", value: "<@" + sanction.moderator_id + ">", inline: true },
    { name: "Référence", value: referenceFor(sanction), inline: true },
    { name: "Raison", value: sanction.reason.slice(0, 1024) },
    { name: "Date", value: formatDate(sanction.created_at), inline: true },
    ...(sanction.type === "timeout" ? [{ name: "Durée", value: formatDuration(sanction.duration_seconds), inline: true }, { name: "Fin", value: sanction.expires_at ? formatDate(sanction.expires_at) : "—", inline: true }] : []),
    ...extraFields,
  ] };
}

async function notifyMember(config: BotConfig, memberId: string, content: string): Promise<{ sent: boolean; error?: string }> {
  try {
    const channel = await discordRequest<{ id: string }>(config, "/users/@me/channels", { method: "POST", body: JSON.stringify({ recipient_id: memberId }) });
    await discordRequest(config, "/channels/" + channel.id + "/messages", { method: "POST", body: JSON.stringify({ content }) });
    return { sent: true };
  } catch (error) {
    return { sent: false, error: error instanceof Error ? error.message.slice(0, 500) : "Échec du message privé" };
  }
}

async function sendLog(config: BotConfig, embed: unknown): Promise<void> {
  if (!config.logChannelId) return;
  try { await discordRequest(config, "/channels/" + config.logChannelId + "/messages", { method: "POST", body: JSON.stringify({ embeds: [embed] }) }); }
  catch (error) { console.error("Could not send sanction log", error); }
}

async function requireAccess(interaction: DiscordInteraction, allowed: boolean, action: string, config: BotConfig): Promise<boolean> {
  if (allowed) return true;
  await editOriginal(interaction, { content: "Vous n'êtes pas autorisé à " + action + ".", components: [] }, config);
  return false;
}

async function handleWarn(interaction: DiscordInteraction, config: BotConfig): Promise<void> {
  const actor = actorOf(interaction); const target = targetOf(interaction); const reason = option(interaction, "raison")?.trim() || "Aucune raison précisée";
  if (!actor || !target) { await editOriginal(interaction, { content: "Ce membre n'est plus présent sur le serveur." }, config); return; }
  if (!(await requireAccess(interaction, hasRole(interaction, config.roles.warn), "attribuer un avertissement", config))) return;
  const sanction = await createSanction({ guild_id: interaction.guild_id!, member_id: target.id, member_tag: target.tag, type: "warning", reason, moderator_id: actor.id, moderator_tag: actor.username || actor.id, duration_seconds: null, expires_at: null, status: "applied" });
  const dm = await notifyMember(config, target.id, "Vous avez reçu un avertissement sur ce serveur Discord.\nRaison : " + reason + "\nRéférence : " + referenceFor(sanction));
  await updateSanction(sanction.id, { dm_sent: dm.sent, dm_error: dm.error ?? null });
  await editOriginal(interaction, { embeds: [sanctionEmbed("Avertissement ajouté", 0xf59e0b, sanction)] }, config);
  await sendLog(config, sanctionEmbed("Avertissement enregistré", 0xf59e0b, sanction, [{ name: "Message privé", value: dm.sent ? "Envoyé" : "Échec : " + (dm.error || "inconnu") }]));
}

async function handleTimeout(interaction: DiscordInteraction, config: BotConfig): Promise<void> {
  const actor = actorOf(interaction); const target = targetOf(interaction); const durationInput = option(interaction, "duree") || ""; const reason = option(interaction, "raison")?.trim() || "Aucune raison précisée"; const durationSeconds = parseDuration(durationInput);
  if (!actor || !target) { await editOriginal(interaction, { content: "Ce membre n'est plus présent sur le serveur." }, config); return; }
  if (!(await requireAccess(interaction, hasRole(interaction, config.roles.timeout), "mettre un membre en sourdine", config))) return;
  if (!durationSeconds) { await editOriginal(interaction, { content: "Durée de sourdine invalide. Utilisez une valeur comme 30m, 2h ou 1d (maximum 28 jours)." }, config); return; }
  const expiresAt = new Date(Date.now() + durationSeconds * 1000).toISOString();
  const sanction = await createSanction({ guild_id: interaction.guild_id!, member_id: target.id, member_tag: target.tag, type: "timeout", reason, moderator_id: actor.id, moderator_tag: actor.username || actor.id, duration_seconds: durationSeconds, expires_at: expiresAt, status: "pending" });
  try {
    await discordRequest(config, "/guilds/" + interaction.guild_id + "/members/" + target.id, { method: "PATCH", body: JSON.stringify({ communication_disabled_until: expiresAt }) });
    await updateSanction(sanction.id, { status: "applied" });
  } catch (error) {
    await updateSanction(sanction.id, { status: "failed", dm_error: error instanceof Error ? error.message.slice(0, 500) : "La sourdine a échoué" });
    await editOriginal(interaction, { content: "Le timeout Discord a échoué. Vérifiez ma permission Modérer les membres." }, config); return;
  }
  const dm = await notifyMember(config, target.id, "Vous avez été mis en sourdine sur ce serveur Discord.\nDurée : " + formatDuration(durationSeconds) + "\nFin : " + formatDate(expiresAt) + "\nRaison : " + reason + "\nRéférence : " + referenceFor(sanction));
  await updateSanction(sanction.id, { dm_sent: dm.sent, dm_error: dm.error ?? null });
  const appliedSanction = { ...sanction, status: "applied" as const };
  await editOriginal(interaction, { embeds: [sanctionEmbed("Sourdine appliquée", 0xef4444, appliedSanction)] }, config);
  await sendLog(config, sanctionEmbed("Sourdine enregistrée", 0xef4444, appliedSanction, [{ name: "Message privé", value: dm.sent ? "Envoyé" : "Échec : " + (dm.error || "inconnu") }]));
}

async function handleUntimeout(interaction: DiscordInteraction, config: BotConfig): Promise<void> {
  const actor = actorOf(interaction); const target = targetOf(interaction); const reason = option(interaction, "raison")?.trim() || "Retrait manuel de la sourdine";
  if (!actor || !target) { await editOriginal(interaction, { content: "Ce membre n'est plus présent sur le serveur." }, config); return; }
  if (!(await requireAccess(interaction, hasRole(interaction, config.roles.timeout), "retirer une sourdine", config))) return;
  try {
    await discordRequest(config, "/guilds/" + interaction.guild_id + "/members/" + target.id, { method: "PATCH", body: JSON.stringify({ communication_disabled_until: null }) });
    await recordEvent({ guildId: interaction.guild_id!, memberId: target.id, moderatorId: actor.id, action: "untimeout", reason });
    await removeActiveTimeouts(interaction.guild_id!, target.id, actor.id);
    await editOriginal(interaction, { content: "La sourdine de <@" + target.id + "> a été retirée." }, config);
    await sendLog(config, { title: "Sourdine retirée", color: 0x22c55e, fields: [{ name: "Membre", value: "<@" + target.id + ">", inline: true }, { name: "Modérateur", value: "<@" + actor.id + ">", inline: true }, { name: "Raison", value: reason }, { name: "Date", value: formatDate(new Date().toISOString()) }] });
  } catch (error) {
    console.error("Impossible de retirer la sourdine", error);
    await editOriginal(interaction, { content: "Le retrait de la sourdine a échoué. Vérifiez ma permission Modérer les membres." }, config);
  }
}

async function handleHistory(interaction: DiscordInteraction, config: BotConfig): Promise<void> {
  const target = targetOf(interaction);
  if (!target) { await editOriginal(interaction, { content: "Ce membre n'est plus présent sur le serveur." }, config); return; }
  if (!(await requireAccess(interaction, hasAnyModeratorAccess(interaction, config), "consulter les historiques", config))) return;
  const history = await getMemberHistory(interaction.guild_id!, target.id);
  if (history.length === 0) { await editOriginal(interaction, { content: "<@" + target.id + "> ne possède aucune sanction enregistrée." }, config); return; }
  const warnings = history.filter((sanction: Sanction) => sanction.type === "warning").length; const timeouts = history.filter((sanction: Sanction) => sanction.type === "timeout").length;
  const intro = "**Historique de " + target.tag + "**\nAvertissements : **" + warnings + "** · Sourdines : **" + timeouts + "**\n\n";
  const lines = history.map((sanction: Sanction) => { const duration = sanction.type === "timeout" ? " — " + formatDuration(sanction.duration_seconds) : ""; return referenceFor(sanction) + " **" + (sanction.type === "warning" ? "Avertissement" : "Sourdine") + "**" + duration + "\n" + sanction.reason + "\nPar <@" + sanction.moderator_id + "> · " + formatDate(sanction.created_at); });
  const chunks: string[] = []; let current = intro;
  for (const line of lines) { if (current.length + line.length + 2 > 3900) { chunks.push(current); current = ""; } current += line + "\n\n"; }
  if (current) chunks.push(current);
  await editOriginal(interaction, { content: chunks[0] }, config);
  for (const chunk of chunks.slice(1)) await followUp(interaction, { content: chunk }, config);
}

async function handleRemoveWarningCommand(interaction: DiscordInteraction, config: BotConfig): Promise<void> {
  const target = targetOf(interaction);
  if (!target) { await editOriginal(interaction, { content: "Ce membre n'est plus présent sur le serveur." }, config); return; }
  if (!(await requireAccess(interaction, hasUser(interaction, config.removeWarningUserIds), "retirer un avertissement", config))) return;
  const activeWarnings = (await getMemberHistory(interaction.guild_id!, target.id)).filter((sanction: Sanction) => sanction.type === "warning" && sanction.status === "applied");
  if (activeWarnings.length === 0) { await editOriginal(interaction, { content: "<@" + target.id + "> ne possède aucun avertissement actif à retirer." }, config); return; }
  const visibleWarnings = activeWarnings.slice(0, 125); const rows: unknown[] = [];
  for (let index = 0; index < visibleWarnings.length; index += 25) {
    const options = visibleWarnings.slice(index, index + 25).map((warning: Sanction) => ({ label: "Avertissement " + referenceFor(warning), description: formatSelectionDescription(warning), value: warning.id }));
    rows.push({ type: 1, components: [{ type: 3, custom_id: "retirer-avertissement:" + target.id, placeholder: "Choisissez un avertissement à retirer", options }] });
  }
  await editOriginal(interaction, { content: visibleWarnings.length < activeWarnings.length ? "Choisissez l'avertissement à retirer parmi les 125 plus récents :" : "Choisissez l'avertissement à retirer :", components: rows }, config);
}

async function handleRemoveWarningSelection(interaction: DiscordInteraction, config: BotConfig): Promise<void> {
  const customId = interaction.data?.custom_id || ""; const targetId = customId.split(":")[1]; const warningId = interaction.data?.values?.[0]; const actor = actorOf(interaction);
  if (!targetId || !warningId || !actor) { await editOriginal(interaction, { content: "Cette sélection n'est plus disponible.", components: [] }, config); return; }
  if (!(await requireAccess(interaction, hasUser(interaction, config.removeWarningUserIds), "retirer un avertissement", config))) return;
  const warning = (await getMemberHistory(interaction.guild_id!, targetId)).find((sanction: Sanction) => sanction.id === warningId && sanction.type === "warning" && sanction.status === "applied");
  if (!warning) { await editOriginal(interaction, { content: "Cet avertissement n'est plus disponible. Relancez la commande.", components: [] }, config); return; }
  const removed = await removeWarning(warning.id, actor.id);
  await editOriginal(interaction, { content: "L'avertissement " + referenceFor(removed) + " de <@" + targetId + "> a été retiré.", components: [] }, config);
  await sendLog(config, sanctionEmbed("Avertissement retiré", 0x22c55e, removed, [{ name: "Retiré par", value: "<@" + actor.id + ">" }]));
}

function commandNeedsEphemeral(interaction: DiscordInteraction, config: BotConfig): boolean {
  const name = interaction.data?.name;
  if (name === "retirer-avertissement") return true;
  if (name === "avertir") return !hasRole(interaction, config.roles.warn);
  if (name === "sourdine" || name === "retirer-sourdine") return !hasRole(interaction, config.roles.timeout);
  if (name === "historique") return !hasAnyModeratorAccess(interaction, config);
  return true;
}

async function processInteraction(interaction: DiscordInteraction, config: BotConfig): Promise<void> {
  if (!interaction.guild_id || !actorOf(interaction)) { await editOriginal(interaction, { content: "Cette interaction doit être utilisée dans un serveur Discord." }, config); return; }
  if (interaction.type === 3) { await handleRemoveWarningSelection(interaction, config); return; }
  switch (interaction.data?.name) {
    case "avertir": await handleWarn(interaction, config); break;
    case "sourdine": await handleTimeout(interaction, config); break;
    case "retirer-sourdine": await handleUntimeout(interaction, config); break;
    case "historique": await handleHistory(interaction, config); break;
    case "retirer-avertissement": await handleRemoveWarningCommand(interaction, config); break;
    default: await editOriginal(interaction, { content: "Commande inconnue." }, config);
  }
}

export const config = { api: { bodyParser: false } };
export const maxDuration = 60;

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== "POST") { res.setHeader("allow", "POST"); json(res, 405, { error: "Method not allowed" }); return; }
  const rawBody = await readBody(req);
  if (!verifyDiscordSignature(rawBody, req)) { json(res, 401, { error: "Invalid request signature" }); return; }
  let interaction: DiscordInteraction;
  try { interaction = JSON.parse(rawBody) as DiscordInteraction; } catch { json(res, 400, { error: "Invalid JSON" }); return; }
  if (interaction.type === 1) { json(res, 200, { type: 1 }); return; }
  if (interaction.type !== 2 && interaction.type !== 3) { json(res, 400, { error: "Unsupported interaction type" }); return; }
  const botConfig = getBotConfig();
  const ephemeral = interaction.type === 3 || commandNeedsEphemeral(interaction, botConfig);
  try { await acknowledge(interaction, interaction.type === 3 ? 6 : 5, ephemeral, botConfig); }
  catch (error) { console.error("Could not acknowledge Discord interaction", error); json(res, 500, { error: "Could not acknowledge interaction" }); return; }
  try { await processInteraction(interaction, botConfig); }
  catch (error) { console.error("Discord interaction failed", error); await editOriginal(interaction, { content: "Une erreur interne est survenue. La sanction n'a pas pu être finalisée.", components: [] }, botConfig).catch(() => undefined); }
  res.statusCode = 204;
  res.end();
}
