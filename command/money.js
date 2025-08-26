const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { userEmbed, charaEmbed, inventoryEmbed, findChar, arrayChunks } = require("../module/helpers.js")
const fuzzy = require("fuzzy")

module.exports = {
  name: "money",
  alias: ["inventory", "inv"],
  prefix: true,
  slash: new SlashCommandBuilder()
    .setName('money')
    .setDescription(`View user money and inventory.`)
    .addSubcommand(subcommand => subcommand
      .setName('self')
      .setDescription('Grab info for yourself.')
      .addBooleanOption(option => option
        .setName("hide")
        .setDescription("If you want this command to not be visible to others.")
      )
    )
    .addSubcommand(subcommand => subcommand
      .setName('user')
      .setDescription("View a specific person's information.")
      .addUserOption(option => option
        .setName('user')
        .setDescription('The user.')
        .setRequired(true)
      )
      .addBooleanOption(option => option
        .setName("hide")
        .setDescription("If you want this command to not be visible to others.")
      )
    ),
  async parse(interaction, message, inputs) {
    var input = {};

    if (interaction) {
      input = {
        source: interaction,
        command: interaction.options.getSubcommand(),
        user: interaction.options.getUser("user")?.id || interaction.user.id,
        hide: interaction.options.getBoolean("hide")
      }
    } else {
      input = {
        source: message,
        hide: false
      }

      if (inputs.trim() == "") {
        input.command = "self"
        input.user = message.author.id;
      } else if (/<@!?(\d+)>/.test(inputs)) {
        input.command = "user"
        input.user = /<@!?(\d+)/.exec(inputs)[1]
      }
    }

    return await this.execute(input.source.client, input)
  },
  async execute(client, input) {
    const db = client.db;

    try {
      await db.users.reload()

      let profile;

      profile = db.users.find(row => row.get("user_id") == input.user);

      if (!profile) throw new Error("The specified user could not be found! They may not yet be registered in the system.")


      return await input.source.reply({
        embeds: [
          await userEmbed(profile, client),
          inventoryEmbed(profile, client)
        ],
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