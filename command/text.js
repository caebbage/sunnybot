const { SlashCommandBuilder } = require('discord.js'),
  { styleText } = require("../module/helpers.js");

module.exports = {
  data:
    new SlashCommandBuilder()
      .setName('text')
      .setDescription(`Formats text`)
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
  async execute(interaction) {
    // interaction.user is the object representing the User who ran the command
    // interaction.member is the GuildMember object, which represents the user in the specific guild
  }
};