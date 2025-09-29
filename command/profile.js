const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { userEmbed, inventoryEmbed } = require("../module/helpers.js")
const fuzzy = require("fuzzy")

module.exports = {
  name: "profile",
  alias: ["inventory", "inv", "money", "balance", "bal"],
  prefix: true,
  slash: new SlashCommandBuilder()
    .setName('profile')
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
    )
    .addSubcommand(subcommand => subcommand
      .setName('edit')
      .setDescription("Edit personal information.")
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
      } else {
        input.command = "user"
        input.user = inputs?.toLowerCase().trim()
      }
    }

    return await this.execute(input.source.client, input)
  },
  async execute(client, input) {
    const db = client.db;
    try {
      await db.users.reload()

      let profile = db.users.find(row => row.get("user_id") == input.user);
      if (!profile) profile = db.users.find(row => row.get("display_name")?.toLowerCase() == input.user);

      if (!profile) throw new Error("The specified user could not be found! They may not yet be registered in the system.")

      if (input.command !== "edit") {
        return await input.source.reply({
          embeds: [
            userEmbed(profile, client),
            inventoryEmbed(profile, client)
          ],
          flags: (input.hide ? MessageFlags.Ephemeral : undefined)
        })
      } else {
        return await input.source.showModal({
          title: "Edit Profile",
          custom_id: "profile:editProfile:" + input.user,
          components: [
            {
              type: 1,
              components: [{
                type: 4,
                custom_id: "display_name",
                label: "Display Name",
                style: 1,
                min_length: 1,
                max_length: 32,
                value: profile.get("display_name"),
                required: true
              }]
            },
            {
              type: 1,
              components: [{
                type: 4,
                custom_id: "pronouns",
                label: "Pronouns",
                style: 1,
                min_length: 1,
                max_length: 32,
                value: profile.get("pronouns"),
                required: true
              }]
            },
            {
              type: 1,
              components: [{
                type: 4,
                custom_id: "timezone",
                label: "Timezone",
                style: 1,
                min_length: 1,
                max_length: 32,
                value: profile.get("timezone"),
                required: true
              }]
            }
          ]
        })
      }
    } catch (error) {
      console.log(error);
      return await input.source.reply({
        content: "An error occurred:\n-# `" + error.message + "`",
        flags: MessageFlags.Ephemeral
      })
    }
  },
  async modal(interaction, inputs) {
    const db = interaction.client.db;
    let input = inputs.shift();

    try {
      if (input === "editProfile") {
        input = inputs.shift();

        await db.users.reload()
        let profile = db.users.find(row => row.get("user_id") == input);

        if (!profile) throw new Error("The specified user could not be found!")

        const updates = {
          display_name: interaction.fields.getTextInputValue("display_name"),
          pronouns: interaction.fields.getTextInputValue("pronouns"),
          timezone: interaction.fields.getTextInputValue("timezone")
        };
        
        await profile.assign(updates)
        await profile.save()

        await interaction.reply({
          content: "Your profile has been updated.",
          embeds: [userEmbed(profile, interaction.client)],
          flags: MessageFlags.Ephemeral
        })

        
        return await interaction.client.log(`**EDITED PROFILE:** <@${input}>`
          + Object.entries(updates).map(x => `\n> **${x[0]}**: ${x[1]}`).join(""))
      }
    } catch (error) {
      console.log(error);
      return await interaction.reply({
        content: "An error occurred:\n-# `" + error.message + "`",
        flags: MessageFlags.Ephemeral
      })
    }
  }
};