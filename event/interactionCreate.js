const { Events, MessageFlags } = require('discord.js');
const { pullPool } = require("../module/gacha.js")

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    const client = interaction.client;
    const PREFIX = process.env.PREFIX;

    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);

      if (!command) return console.error(`No command matching ${interaction.commandName} was found.`);

      if (!command.slash) return console.error(`${interaction.commandName} does not have an associated slash command.`)

      try {
        await command.parse(interaction);
      } catch (error) {
        console.error(error);
        try {
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: "An error occurred:\n" + error.message.split("\n").map(x => `> -# \`${x}\``).join("\n"), flags: MessageFlags.Ephemeral });
          } else {
            await interaction.reply({ content: "An error occurred:\n" + error.message.split("\n").map(x => `> -# \`${x}\``).join("\n"), flags: MessageFlags.Ephemeral });
          }
        } catch (err) { console.log("  Interaction no longer exists!") }
      }
    } else if (interaction.isAutocomplete()) {
      const command = client.commands.get(interaction.commandName);

      if (!command) return console.error(`No command matching ${interaction.commandName} was found.`)

      try {
        await command.autocomplete(interaction);
      } catch (error) {
        console.error(error);
      }
    } else if (interaction.isButton()) {
      const commandChain = interaction.customId.split(":");
      const commandName = commandChain.shift();
      const command = client.commands.get(commandName);


      try {
        if (commandName == "action") {

          const customCmd = await client.db.actions.get(commandChain[0]),
            src = await interaction.message.channel.messages.fetch(interaction.message.reference.messageId);

          if (!customCmd) return await interaction.reply({ content: 'The button was not recognized!', flags: MessageFlags.Ephemeral });
          if (interaction.user.id !== src?.author.id) throw 'Only the original sender can use these buttons!';
          await interaction.update((await pullPool(interaction.message, commandChain[0], customCmd, PREFIX + commandChain.join(" ")))[0])

        } else if (!command) throw new Error('The button was not recognized!')
        else await command.button(interaction, commandChain);

      } catch (error) {
        console.error(error);
        try {
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: "An error occurred:\n" + error.message.split("\n").map(x => `> -# \`${x}\``).join("\n"), flags: MessageFlags.Ephemeral });
          } else {
            await interaction.reply({ content: "An error occurred:\n" + error.message.split("\n").map(x => `> -# \`${x}\``).join("\n"), flags: MessageFlags.Ephemeral });
          }
        } catch (err) { console.log("  Interaction no longer exists!") }
      }
    } else if (interaction.isModalSubmit()) {
      const commandChain = interaction.customId.split(":");
      const commandName = commandChain.shift();
      const command = client.commands.get(commandName);

      try {
        if (!command) throw new Error('The modal was not recognized!')

        else await command.modal(interaction, commandChain)

      } catch (error) {
        console.error(error);
        try {
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: "An error occurred:\n" + error.message.split("\n").map(x => `> -# \`${x}\``).join("\n"), flags: MessageFlags.Ephemeral });
          } else {
            await interaction.reply({ content: "An error occurred:\n" + error.message.split("\n").map(x => `> -# \`${x}\``).join("\n"), flags: MessageFlags.Ephemeral });
          }
        } catch (err) { console.log("  Interaction no longer exists!") }
      }
    }
  },
};