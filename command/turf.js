const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { turfEmbed, diacritic } = require("../module/helpers.js");

module.exports = {
  name: "turf",
  slash: new SlashCommandBuilder()
    .setName('turf')
    .setDescription("Check the info for a turf.")
    .addStringOption(option => option
      .setName('hex')
      .setDescription("The turf to look up.")
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
      id: interaction.options.getString("id"),
      hide: interaction.options.getBoolean("hide") ?? false
    })
  },
  async execute(client, input) {
    const db = client.db;

    try {
      if (!input.id) throw new Error("Provide a name for the turf!")

      await db.turf.reload();
      let turf = db.turf?.find(row => row.get("turf_id") == input.id);

      if (!turf) throw new Error("The specified turf could not be found!")

      return await input.source.reply({
        embeds: [turfEmbed(turf, client)],
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
    const focused = interaction.options.getFocused(true);
    const db = interaction.client.db
    try {
      if (focused.value.length <= 1) await db.turf.reload()

      let data = db.turf.filter(x => x.get("turf_id"))

      let filtered = fuzzy.filter(focused.value, data, { extract: x => `${x.get("turf_id")} // ${diacritic(x.get("turf_name"))}` })
      if (filtered.length > 25) filtered.length = 25

      return await interaction.respond(filtered.map(choice => {
        let hex = choice.original, symbol;
        if (["cartel", "triad"].includes(hex.get("controlled_by"))) {
          symbol = db.factions.find(f => f.get("faction_name") == hex.get("controlled_by"))?.get("simple_emoji")
        } else { symbol = client.config("contested_emoji") }

        return {
          name: `${hex.get("turf_id")} ${symbol} ${hex.get("turf_name")}`.trim(),
          value: hex.get("turf_id")
        }
      }))
    } catch (error) {
      console.log(error)
    }
  }
}