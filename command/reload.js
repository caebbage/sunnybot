const { SlashCommandBuilder, MessageFlags } = require('discord.js');

module.exports = {
  category: 'utility',
  data: new SlashCommandBuilder()
    .setName('reload')
    .setDescription('Reloads aspects of the bot.')
    .addSubcommand(subcommand => subcommand
      .setName("command")
      .setDescription("Reloads a specific command.")
      .addStringOption(option =>
        option.setName('command')
          .setDescription('The command to reload.')
          .setRequired(true))
    )
    .addSubcommand(subcommand => subcommand
      .setName("sheets")
      .setDescription("Refreshes bot gsheets.")
    ),
  async execute(interaction) {
    if (interaction.options.getSubcommand() === "command") {
      const commandName = interaction.options.getString('command', true).toLowerCase();
      const command = interaction.client.commands.get(commandName);

      if (!command) {
        return interaction.reply({
          content: `There is no command with name \`${commandName}\`!`,
          flags: MessageFlags.Ephemeral
        });
      }

      delete require.cache[require.resolve(`./${command.data.name}.js`)];

      try {
        const newCommand = require(`./${command.data.name}.js`);
        await interaction.reply({
          content: `Command \`${newCommand.data.name}\` was reloaded!`,
          flags: MessageFlags.Ephemeral
        })
      } catch (error) {
        console.error(error);
        await interaction.reply({
          content: `There was an error while reloading a command \`${command.data.name}\`:\n-# \`${error.message}\``,
          flags: MessageFlags.Ephemeral
        })
      }
    } else if (interaction.options.getSubcommand() === "sheets") {
      try {
        await interaction.client.sheets.config.refresh();
        await interaction.client.sheets.commands.refresh();
        await interaction.client.db.actions.refresh();
        await interaction.reply({
          content: `Sheet refresh successful.`,
          flags: MessageFlags.Ephemeral
        })
      } catch (error) {
        console.log(error);
        await interaction.reply({
          content: `Sheet refresh failed:\n-# \`${error.message}\``,
          flags: MessageFlags.Ephemeral
        })
      }
    }
  }
};