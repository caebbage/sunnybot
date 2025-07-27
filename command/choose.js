const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data:
  new SlashCommandBuilder()
    .setName('choose')
    .setDescription(`Choose from a selection of options.`)
    .addStringOption(option => option
      .setName("choices")
      .setDescription("Your choices, divided by \"|\". Ex: one|two|three")
      .setRequired(true)
    )
    .addStringOption(option => option
      .setName("note")
      .setDescription("An additional note that is displayed with the result.")
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