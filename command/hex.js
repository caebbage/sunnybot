const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { hexEmbed, diacritic } = require("../module/helpers.js");

module.exports = {
  name: "hex",
  slash: new SlashCommandBuilder()
    .setName('hex')
    .setDescription("Check the info for a map hex.")
    .addStringOption(option => option
      .setName('hex')
      .setDescription("The hex to look up.")
      .setAutocomplete(true)
      .setRequired(true)
    )
    .addBooleanOption(option => option
      .setName("hide")
      .setDescription("If you want this command to not be visible to others.")
    ),

  async parse(interaction, message, inputs) {
    return await this.execute(interaction.client, {
      source: interaction,
      hex: interaction.options.getString("hex"),
      hide: interaction.options.getBoolean("hide") || false
    })
  },
  async execute(client, input) {
    const db = client.db;

    try {
      if (!input.hex) throw new Error("Provide the hex's ID!")

      await db.hexes.reload();
      let hex = db.hexes?.find(row => row.get("hex_id") == input.hex);

      if (!hex) throw new Error("The specified hex could not be found!")

      return await input.source.reply({
        embeds: [hexEmbed(hex, client)],
        flags: input.hide ? MessageFlags.Ephemeral : undefined
      })
    } catch (error) {
      console.log(error);
      return await input.source.reply({
        content: "An error occurred:\n-# `" + error.message + "`",
        flags: MessageFlags.Ephemeral
      })
    }
  },
  async autocomplete(interaction) {
    const client = interaction.client;
    const focused = interaction.options.getFocused(true);
    const db = client.db;
    try {
      if (focused.value.length <= 1) await db.hexes.reload()

      let data = db.hexes.filter(x => x.get("hex_id") && x.get("hex_id") !== "blank")

      let filtered = fuzzy.filter(focused.value, data, { extract: x => `${x.get("hex_id")} // ${diacritic(x.get("hex_name"))}` })
      if (filtered.length > 25) filtered.length = 25

      return await interaction.respond(filtered.map(choice => {
        let hex = choice.original, symbol;
        if (["cartel", "triad"].includes(hex.get("controlled_by"))) {
          symbol = db.factions.find(f => f.get("faction_name") == hex.get("controlled_by"))?.get("simple_emoji")
        } else { symbol = client.config("contested_emoji") }

        return {
          name: `${hex.get("hex_id")} ${symbol} ${hex.get("hex_name")}`.trim(),
          value: hex.get("hex_id")
        }
      }))
    } catch (error) {
      console.log(error)
    }
  }
}