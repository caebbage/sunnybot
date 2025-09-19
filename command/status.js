const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { statusEmbed } = require("../module/helpers.js");

module.exports = {
  name: "status",
  slash: new SlashCommandBuilder()
    .setName('status')
    .setDescription("Check the info for a status.")
    .addStringOption(option => option
      .setName('name')
      .setDescription("The name of the status.")
      .setAutocomplete(true)
      .setRequired(true)
    )
    .addBooleanOption(option => option
      .setName("hide")
      .setDescription("If you want this command to not be visible to others.")
    ),

  async parse(interaction, message, inputs) {
    return await this.execute(interaction, {
        source: interaction,
        name: interaction.options.getString("name"),
        hide: interaction.options.getBoolean("hide") ?? false
      })
  },
  async execute(client, input) {
    const db = client.db;

    try {
      if (!input.name) throw new Error("Provide a name for the status!")

      let status = db.statuses?.find(row => row.get("status_name") == input.name);

      if (!status) throw new Error("The specified status could not be found!")

      return await input.source.reply({
        embeds: [statusEmbed(status, client)],
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
      if (focused.value.length <= 1) await db.statuses.reload()

      let data = db.statuses.filter(x => x.get("status_name"))

      let filtered = data ?
        fuzzy.filter(focused.value, data.length ? data : [], { extract: x => x.get("status_name").normalize('NFD').replace(/\p{Diacritic}/gu, '') }) : []
      if (filtered.length > 25) filtered.length = 25

      return await interaction.respond(
        filtered.map(choice => ({ name: choice.original.get("status_name"), value: choice.original.get("status_name") }))
      )
    } catch (error) {
      console.log(error)
    }
  }
}