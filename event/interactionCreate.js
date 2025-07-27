const { Events, MessageFlags } = require('discord.js');
const { pullPool } = require("../module/helpers.js")

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    if (interaction.isChatInputCommand()) {
      const command = interaction.client.commands.get(interaction.commandName);

      if (!command) {
        console.error(`No command matching ${interaction.commandName} was found.`);
        return;
      }

      try {
        await command.execute(interaction);
      } catch (error) {
        console.error(error);
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: "An error occurred:\n`" + error.message + "`", flags: MessageFlags.Ephemeral });
        } else {
          await interaction.reply({ content: "An error occurred:\n`" + error.message + "`", flags: MessageFlags.Ephemeral });
        }
      }
    } else if (interaction.isAutocomplete()) {
      const command = interaction.client.commands.get(interaction.commandName);

      if (!command) {
        console.error(`No command matching ${interaction.commandName} was found.`);
        return;
      }

      try {
        await command.autocomplete(interaction);
      } catch (error) {
        console.error(error);
      }
    } else if (interaction.isButton()) {
      const commandChain = interaction.customId.split(":");
      const commandName = commandChain.shift();
      const command = interaction.client.commands.get(commandName);

      if (commandName == "action") {

        const customCmd = interaction.client.db.actions.find(row => row.get("command_name").trim() == commandChain[0]),
          src = await interaction.message.channel.messages.fetch(interaction.message.reference.messageId);
        if (!customCmd) return await interaction.reply({ content: 'The button was not recognized!', flags: MessageFlags.Ephemeral });
        if (interaction.user.id !== src.author.id) return await interaction.reply({ content: 'Only the original sender can use these buttons!', flags: MessageFlags.Ephemeral });

        try {
          await interaction.update(await pullPool(interaction.message, customCmd, "p!" + commandChain.join(" ")))
        } catch (error) {
          console.error(error);
          await interaction.reply({ content: "An error occurred:\n`" + error.message + "`", flags: MessageFlags.Ephemeral });
        }
      } else if (!command) {
        await interaction.reply({ content: 'The button was not recognized!', flags: MessageFlags.Ephemeral });
      } else {
        try {
          await command.button(interaction, commandChain);
        } catch (error) {
          console.error(error);
          await interaction.reply({ content: "An error occurred:\n`" + error.message + "`", flags: MessageFlags.Ephemeral });
        }
      }
    } else if (interaction.isModalSubmit()) {
      const commandChain = interaction.customId.split(":");
      const commandName = commandChain.shift();
      const command = interaction.client.commands.get(commandName);

      if (!command) {
        await interaction.reply({ content: 'The modal was not recognized!', flags: MessageFlags.Ephemeral });
      } else {
        try {
          await command.modal(interaction, commandChain);
        } catch (error) {
          console.error(error);
          await interaction.reply({ content: "An error occurred:\n`" + error.message + "`", flags: MessageFlags.Ephemeral });
        }
      }
    }
  },
};