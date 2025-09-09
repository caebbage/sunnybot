const { SlashCommandBuilder, MessageFlags } = require('discord.js'),
  { styleText } = require("../module/helpers.js");

module.exports = {
  name: "text",
  alias: ["t"],
  prefix: true,
  slash: new SlashCommandBuilder()
    .setName('text')
    .setDescription(`Formats text.`)
    .addStringOption(option => option
      .setName("style")
      .setDescription("Which style the text will be formatted in.")
      .addChoices(...Object.keys(styleText.charSets).map(val => {
        return {
          name: styleText.format(val, val),
          value: val
        }
      }))
      .setRequired(true)
    )
    .addStringOption(option => option
      .setName("text")
      .setDescription("The text string to be formatted.")
      .setRequired(true)
    )
    .addBooleanOption(option => option
      .setName("hide")
      .setDescription("If you want this command to not be visible to others.")
    ),
  async parse(interaction, message, inputs) {
    var input = {};

    if (interaction) {
      input = {
        source: interaction,
        style: interaction.options.getString("style").toLowerCase(),
        text: interaction.options.getString("text"),
        hide: interaction.options.getBoolean("hide") ?? false
      }
    } else {
      let params = inputs.split(" ");
      input = {
        source: message,
        style: params.shift().toLowerCase(),
        text: params,
        hide: false
      }
    }

    return await this.execute(input.source.client, input)
  },
  async execute(client, input) {
    try {
      if (!Object.keys(styleText.charSets).includes(input.style)) return new Error("Text style doesn't exist!")
      if (!input.text) return new Error("Please specify text to be formatted!")

      input.source.reply({
        content: styleText.format(input.style, input.text),
        flags: (input.hide ? MessageFlags.Ephemeral : undefined)
      })
    } catch (error) {
      console.log(error);
      return await input.source.reply({
        content: "An error occurred:\n-# `" + error.message + "`",
        flags: MessageFlags.Ephemeral
      })
    }
  }
};