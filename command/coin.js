const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data:
  new SlashCommandBuilder()
    .setName('coin')
    .setDescription(`Flips a coin.`)
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