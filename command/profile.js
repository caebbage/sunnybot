const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { Inventory } = require('../module/inventory');
const { arrayChunks, color } = require('../module/helpers');

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
      await db.items.reload()

      let profile = db.users.find(row => row.get("user_id") == input.user);
      if (!profile) profile = db.users.find(row => row.get("display_name")?.toLowerCase() == input.user);

      if (!profile) throw new Error("The specified user could not be found! They may not yet be registered in the system.")

      if (input.command !== "edit") {

        const inventory = new Inventory(profile.get("inventory"));
        let groupedInv, groups;

        if (profile.get("inventory")) {
          groupedInv = inventory.groupedInv(client);
          groups = groupedInv.keys();

          let components = arrayChunks([{
            custom_id: `profile:inv:${profile.get("user_id")}:All`,
            type: 2,
            style: 3,
            label: "All"
          },
          ...groups.map(group => ({
            custom_id: `profile:inv:${profile.get("user_id")}:${group}`,
            type: 2,
            style: 4,
            label: group
          }))], 5).map(x => ({ type: 1, components: x }));

          return await input.source.reply({
            embeds: [
              userEmbed(profile, client),
              inventoryEmbed(inventory, client, "ALL")
            ],
            components,
            flags: (input.hide ? MessageFlags.Ephemeral : undefined)
          })
        } else {
          return await input.source.reply({
            embeds: [
              userEmbed(profile, client),
              inventoryEmbed(inventory, client)
            ],
            flags: (input.hide ? MessageFlags.Ephemeral : undefined)
          })
        }

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
  async button(interaction, inputs) {

    const client = interaction.client,
      db = client.db;
    let input = inputs.shift();

    try {
      if (interaction.message.interactionMetadata) {
        if (interaction.user.id !== interaction.message.interactionMetadata.user.id)
          throw new Error("Only the original sender may utilize buttons!")
      } else {
        let replied = await interaction.message.channel.messages.fetch(interaction.message.reference.messageId);
        if (interaction.user.id !== replied.author.id) {
          throw new Error("Only the original sender may utilize buttons!")
        }
      }

      if (input === "inv") {
        await interaction.deferUpdate();

        input = inputs.shift();

        await db.users.reload()
        let profile = db.users.find(row => row.get("user_id") == input);

        if (!profile) throw new Error("The specified user could not be found!")

        const inventory = new Inventory(profile.get("inventory"));
        input = inputs.shift();

        if (input === "All") {
          return await interaction.editReply({
            embeds: [
              userEmbed(profile, client),
              inventoryEmbed(inventory, client, "ALL")
            ],
            flags: (input.hide ? MessageFlags.Ephemeral : undefined)
          })
        } else {
          let groupedInv, groups;

          if (profile.get("inventory")) {
            groupedInv = inventory.groupedInv(client);
            groups = groupedInv.keys();

            return await interaction.editReply({
              embeds: [
                userEmbed(profile, client),
                inventoryEmbed(new Inventory(groupedInv.get(input) || ""), client, input?.toUpperCase() || "ALL")
              ],
              flags: (input.hide ? MessageFlags.Ephemeral : undefined)
            })
          }
        }
      } else throw new Error("Unrecognized button!")
    } catch (error) {
      console.log(error);
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: "An error occurred:\n" + error.message.split("\n").map(x => `> -# \`${x}\``).join("\n"), flags: MessageFlags.Ephemeral });
      } else {
        await interaction.reply({ content: "An error occurred:\n" + error.message.split("\n").map(x => `> -# \`${x}\``).join("\n"), flags: MessageFlags.Ephemeral });
      }
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
      } else throw new Error("Unrecognized modal!")
    } catch (error) {
      console.log(error);
      return await interaction.reply({
        content: "An error occurred:\n-# `" + error.message + "`",
        flags: MessageFlags.Ephemeral
      })
    }
  }
};

function inventoryEmbed(inventory, client, category) {
  return {
    title: client.config("decorative_symbol") + " INVENTORY" + (category ? " ― " + category : ""),
    description: (!inventory?.isEmpty() ?
      inventory.toIcoString(client).split("\n").map(x => `> ${x}`).join("\n")
      + '\n\n-# Use `/item info` to see more about an item.'
      : "-# You appear to have no items!"),
    color: color(client.config("default_color")),
    thumbnail: {
      url: client.config("default_image")
    },
    timestamp: new Date().toISOString()
  }
}


function userEmbed(profile, client) {
  return {
    title: client.config("decorative_symbol") + " " + profile.get("display_name").toUpperCase(),
    description: "💵 ` CRED ✦ ` " + (profile.get("money") || "0")
    + (client.config("event_point_enabled")?.toUpperCase() == "TRUE"
      ? `\n${client.config("event_point_emoji")} \` ${(client.config("event_point_name") || "points").toUpperCase()} ✦ \` ${profile.get("points") || 0}`
      : ""),
    color: color(client.config("default_color")),
    footer: {
      text: "@" + client.users.resolve(profile.get("user_id"))?.username
        + " ✦ " + (profile.get("pronouns") || "N/A")
        + " ✦ " + (profile.get("timezone") || "GMT +?")
    }
  }
}