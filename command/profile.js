const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { userEmbed, charaEmbed, inventoryEmbed, arrayChunks, color } = require("../module/helpers.js")
const fuzzy = require("fuzzy")

module.exports = {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription(`View user and character information.`)
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
      .setName('chara')
      .setDescription('Grab info for a specific character.')
      .addStringOption(option => option
        .setName('chara')
        .setDescription("The character's name.")
        .setAutocomplete(true)
        .setRequired(true)
      )
      .addBooleanOption(option => option
        .setName("hide")
        .setDescription("If you want this command to not be visible to others.")
      )
    )
    .addSubcommand(subcommand => subcommand
      .setName("edit")
      .setDescription("Customize your profile or character info.")
    ),
  async execute(interaction) {
    const db = interaction.client.db;

    try {
      await db.users.reload()
      await db.charas.reload()
      let profile, chara, allChara;

      if (interaction.options.getSubcommand() === "edit") {
        profile = db.users.find(row => row.get("user_id") == interaction.user.id);
        
        if (!profile) throw new Error("Your profile could not be found! It might not yet be registered in the system.")

        allChara = db.charas.data.filter(row => row.get("owner") == profile.get("user_id"));

        // edit profile
        await interaction.reply({
          content: "Choose the profile you'd like to edit.",
          embeds: [{
            description: "Editable user profile elements:\n> `display name`, `icon image link`, `pronouns`, `timezone`"
              + (allChara.length ? "\nEditable character profile elements:\n> `app link`, `icon image link`, `trainer card image link`, `partner pokemon`, `profile text`" : "")
              + "\n\nFor any other profile elements, please contact a Moderator.",
            color: color(interaction.client.config("default_color"))
          }],
          components: buttons(profile, allChara, interaction.user, true),
          flags: MessageFlags.Ephemeral
        })
      } else {
        if (interaction.options.getSubcommand() === "self") {
          profile = db.users.find(row => row.get("user_id") == interaction.user.id);
        } else if (interaction.options.getSubcommand() === "user") {
          profile = db.users.find(row => row.get("user_id") == interaction.options.getUser("user", true).id);
        } if (interaction.options.getSubcommand() === "chara") {
          chara = db.charas.find(row => row.get("chara_name") == interaction.options.getString("chara", true));

          if (!chara) {
            return await interaction.reply({
              content: "The specified character could not be found!",
              flags: MessageFlags.Ephemeral
            })
          }

          profile = db.users.find(row => row.get("user_id") == chara.get("owner"));
        }

        if (!profile) throw new Error("The specified user could not be found! They may not yet be registered in the system.")

        allChara = db.charas.data.filter(row => row.get("owner") == profile.get("user_id"));

        return await interaction.reply({
          embeds: [
            userEmbed(profile, interaction.user),
            (chara ? charaEmbed(chara, interaction.user) : allChara.length ? charaEmbed(allChara[0], interaction.user) : inventoryEmbed(profile, interaction.user))
          ],
          components: buttons(profile, allChara, interaction.user),
          flags: (interaction.options.getBoolean("hide") ? MessageFlags.Ephemeral : undefined)
        })
      }
    } catch (error) {
      console.log(error);
      return await interaction.reply({
        content: "An error occurred:\n-# `" + error.message + "`",
        flags: MessageFlags.Ephemeral
      })
    }
  },
  async autocomplete(interaction) {
    try {
      const focused = interaction.options.getFocused(true);
      const db = interaction.client.db

      if (focused.value.length <= 1) await db.charas.reload()

      let filtered = db.charas.data?.length ? fuzzy.filter(focused.value, db.charas.data, { extract: x => (x.get("chara_name") + " / " + x.get("fullname")).normalize('NFD').replace(/\p{Diacritic}/gu, '') }) : []
      if (filtered.length > 25) filtered.length = 25

      return await interaction.respond(
        filtered.map(choice => ({ name: choice.original.get("chara_name") + " / " + choice.original.get("fullname"), value: choice.original.get("chara_name") }))
      )
    } catch (error) {
      console.log(error)
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
          display_icon: interaction.fields.getTextInputValue("display_icon"),
          pronouns: interaction.fields.getTextInputValue("pronouns"),
          timezone: interaction.fields.getTextInputValue("timezone")
        };

        await profile.assign(updates)
        await profile.save()

        await interaction.client.log(`**EDITED PROFILE:** <@${input}>`
          + Object.entries(updates).map(x => `\n> **${x[0]}**: ${x[1]}`).join(""))

        return await interaction.update({
          content: "Your profile has been updated.",
          embeds: [
            userEmbed(profile, interaction.user)
          ],
          components: []
        })

      } else if (input === "editChara") {
        input = inputs.shift();

        await db.chara.reload()
        let chara = db.chara.find(row => row.get("chara_name") == input);

        if (!chara) throw new Error("The specified character could not be found!")
        const updates = {
          app: interaction.fields.getTextInputValue("app"),
          icon: interaction.fields.getTextInputValue("icon"),
          card: interaction.fields.getTextInputValue("card"),
          partner: interaction.fields.getTextInputValue("partner"),
          description: interaction.fields.getTextInputValue("description")
        };

        await chara.assign(updates)
        await chara.save()

        await interaction.client.log(`**EDITED PROFILE:** \`${chara.get("chara_name")}\` (<@${chara.get("owner")}>)`
          + Object.entries(updates).map(x => `\n> **${x[0]}**: ${x[1] ? x[1] : "`EMPTY`"}`).join(""))

        return await interaction.update({
          content: "Your character has been updated.",
          embeds: [
            charaEmbed(chara, interaction.user)
          ],
          components: []
        })
      }
    } catch (error) {
      console.log(error);
      return await interaction.reply({
        content: "An error occurred:\n-# `" + error.message + "`",
        flags: MessageFlags.Ephemeral
      })
    }
  },
  async button(interaction, inputs) {
    const db = interaction.client.db;
    let input = inputs.shift();

    try {
      if (interaction.user.id !== interaction.message.interactionMetadata.user.id) {
        return await interaction.reply({
          content: "Only the original sender may utilize buttons!",
          flags: MessageFlags.Ephemeral
        })
      }

      if (input === "cancel") {
        return await interaction.update({
          content: "Editing cancelled.",
          embeds: [],
          components: []
        })

      } else if (input === "editProfile") {
        input = inputs.shift();

        await db.users.reload()
        let profile = db.users.find(row => row.get("user_id") == input);

        if (!profile) throw new Error("The specified user could not be found!")

        return await interaction.showModal({
          title: "Edit Profile",
          custom_id: "profile:editProfile:" + input,
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
                custom_id: "display_icon",
                label: "Icon Image Link",
                style: 1,
                min_length: 1,
                max_length: 200,
                value: profile.get("display_icon"),
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
                label: "Time Zone",
                style: 1,
                min_length: 1,
                max_length: 32,
                value: profile.get("timezone"),
                required: true
              }]
            }
          ]
        })

      } else if (input === "editChara") {
        // edit character
        input = inputs.shift();

        await db.charas.reload()
        let chara = db.charas.find(row => row.get("chara_name") == input);

        if (!chara) throw new Error("The specified character could not be found!")

        return await interaction.showModal({
          title: "Edit " + chara.get("chara_name"),
          custom_id: "profile:editChara:" + input,
          components: [
            {
              type: 1,
              components: [{
                type: 4,
                custom_id: "app",
                label: "App Link",
                style: 1,
                max_length: 200,
                value: chara.get("app") ?? "",
                required: false
              }]
            },
            {
              type: 1,
              components: [{
                type: 4,
                custom_id: "icon",
                label: "Icon Image Link",
                style: 1,
                max_length: 200,
                value: chara.get("icon") ?? "",
                required: false
              }]
            },
            {
              type: 1,
              components: [{
                type: 4,
                custom_id: "card",
                label: "Card Image Link",
                style: 1,
                max_length: 200,
                value: chara.get("card") ?? "",
                required: false
              }]
            },
            {
              type: 1,
              components: [{
                type: 4,
                custom_id: "partner",
                label: "Partner Pokemon ([NAME] the [POKEMON])",
                style: 1,
                min_length: 1,
                max_length: 100,
                value: chara.get("partner") ?? "N/A"
              }]
            },

            {
              type: 1,
              components: [{
                type: 4,
                custom_id: "description",
                label: "Profile Text",
                style: 2,
                max_length: 1024,
                value: chara.get("description") ?? "",
                required: false
              }]
            }
          ]
        })

      } else if (input === "show") {
        // show character
        input = inputs.shift();

        await db.charas.reload()
        let chara = db.charas.find(row => row.get("chara_name") == input);

        if (!chara) throw new Error("The specified character could not be found!")

        let embeds = interaction.message.embeds;
        embeds[1] = charaEmbed(chara, interaction.user);

        return await interaction.update({
          embeds
        })

      } else if (input === "inventory") {
        // show inventory
        input = inputs.shift();

        await db.users.reload()
        let profile = db.users.find(row => row.get("user_id") == input);

        if (!profile) throw new Error("The specified user could not be found!")

        let embeds = interaction.message.embeds;
        embeds[1] = inventoryEmbed(profile, interaction.user);

        return await interaction.update({
          embeds
        })
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



function buttons(profile, allChara, user, editing) {
  let buttons = [];

  if (allChara.filter(row => row.get("is_npc").toUpperCase() === "FALSE").length) {
    buttons.push(
      ...allChara.filter(row => row.get("is_npc").toUpperCase() === "FALSE").map(char => ({
        custom_id: `profile:${editing ? "editChara" : "show"}:${char.get("chara_name")}`,
        type: 2,
        style: user.client.config("default_button_color"),
        label: char.get("chara_name")
      }))
    )
  }

  if (allChara.filter(row => row.get("is_npc").toUpperCase() === "TRUE").length) {
    buttons.push(
      ...allChara.filter(row => row.get("is_npc").toUpperCase() === "TRUE").map(char => ({
        custom_id: `profile:${editing ? "editChara" : "show"}:${char.get("chara_name")}`,
        type: 2,
        style: 2,
        label: char.get("chara_name")
      }))
    )
  }

  buttons.push(...
    (editing ?
      [
        {
          custom_id: `profile:editProfile:${profile.get("user_id")}`,
          type: 2,
          style: 1,
          label: "Profile"
        },
        {
          custom_id: `profile:cancel`,
          type: 2,
          style: 4,
          label: "Cancel"
        }
      ]
      : [
        {
          custom_id: `profile:inventory:${profile.get("user_id")}`,
          type: 2,
          style: 1,
          label: "Inventory"
        }
      ]
    ),
  )

  return arrayChunks(buttons, 5).map(x => ({ type: 1, components: x }))
}