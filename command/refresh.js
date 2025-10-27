const { SlashCommandBuilder, MessageFlags } = require('discord.js');

module.exports = {
  name: "refresh",
  slash: new SlashCommandBuilder()
    .setName('refresh')
    .setDescription(`Refresh bot configuration & custom commands.`)
    ,
  async parse(interaction, message, inputs) {
    var input = {};

    if (interaction) input = { source: interaction }
    else input = { source: message }

    return await this.execute(input.source.client, input)
  },
  async execute(client, input) {

    try {
      await client.sheets.config.refresh();

      client.customCommands.each(action => action.lastChecked.setTime(0))

      return await input.source.reply({
        content: "Data refreshed!",
        flags: MessageFlags.Ephemeral
      })
    } catch (error) {
      console.log(error);
      return await input.source.reply({
        content: "An error occurred:\n-# `" + error.message + "`",
        flags: MessageFlags.Ephemeral
      })
    }
  }
}