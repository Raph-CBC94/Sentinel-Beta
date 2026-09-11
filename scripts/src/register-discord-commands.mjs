const commandDefinitions = [
  { name: "avertir", description: "Attribuer un avertissement à un membre", options: [
    { type: 6, name: "membre", description: "Membre à avertir", required: true },
    { type: 4, name: "niveau", description: "Niveau de l'avertissement (1 à 5)", min_value: 1, max_value: 5, required: true },
    { type: 3, name: "raison", description: "Raison de l'avertissement", max_length: 500, required: true },
  ] },
  { name: "sourdine", description: "Mettre un membre en sourdine", options: [
    { type: 6, name: "membre", description: "Membre à mettre en sourdine", required: true },
    { type: 3, name: "duree", description: "Durée de la sourdine : 30m, 2h ou 1d", max_length: 10, required: true },
    { type: 3, name: "raison", description: "Raison de la mise en sourdine", max_length: 500, required: true },
  ] },
  { name: "retirer-sourdine", description: "Retirer la sourdine d'un membre", options: [
    { type: 6, name: "membre", description: "Membre à libérer", required: true },
    { type: 3, name: "raison", description: "Raison du retrait", max_length: 500, required: false },
  ] },
  { name: "historique", description: "Consulter l'historique des sanctions", options: [{ type: 6, name: "membre", description: "Membre à consulter", required: true }] },
  { name: "retirer-avertissement", description: "Choisir l'avertissement à retirer", options: [{ type: 6, name: "membre", description: "Membre concerné", required: true }] },
  { name: "say", description: "Faire parler le bot dans ce salon", options: [
    { type: 3, name: "message", description: "Message à envoyer", max_length: 2000, required: true },
  ] },
  { name: "avis-ia", description: "Analyser les 50 derniers messages pour aider la modération" },
];

const required = ["DISCORD_TOKEN", "DISCORD_CLIENT_ID", "DISCORD_GUILD_ID"];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) throw new Error("Variables manquantes : " + missing.join(", "));
const response = await fetch("https://discord.com/api/v10/applications/" + process.env.DISCORD_CLIENT_ID + "/guilds/" + process.env.DISCORD_GUILD_ID + "/commands", {
  method: "PUT",
  headers: { authorization: "Bot " + process.env.DISCORD_TOKEN, "content-type": "application/json" },
  body: JSON.stringify(commandDefinitions),
});
if (!response.ok) throw new Error("Discord " + response.status + ": " + await response.text());
console.log("Commandes Discord enregistrées pour le serveur " + process.env.DISCORD_GUILD_ID);
