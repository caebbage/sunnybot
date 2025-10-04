const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { charaEmbed, findChar, arrayChunks, diacritic } = require("../module/helpers.js")
const fuzzy = require("fuzzy")

module.exports = {
  name: "chara",
  alias: ["char", "charas"],
  prefix: true,
  slash: new SlashCommandBuilder()
    .setName('chara')
    .setDescription(`View character information.`)
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
      .setDescription("View a specific person's characters.")
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
      .setName('name')
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
      .setName('edit')
      .setDescription("Edit character information.")
      .addStringOption(option => option
        .setName('oc')
        .setDescription("The character's name.")
        .setAutocomplete(true)
        .setRequired(true)
      )
    ),
  async parse(interaction, message, inputs) {
    var input = {};

    if (interaction) {
      input = {
        source: interaction,
        command: interaction.options.getSubcommand(),
        user: interaction.options.getUser("user")?.id,
        chara: interaction.options.getString("chara"),
        hide: interaction.options.getBoolean("hide"),
        edit: interaction.options.getString("oc"),
        sender: interaction.user.id
      }
    } else {
      input = {
        source: message,
        hide: false,
        sender: message.author.id
      }

      if (inputs.trim() == "") {
        input.command = "self"
        input.user = message.author.id;
      } else if (/<@!?(\d+)>/.test(inputs)) {
        input.command = "user"
        input.user = /<@!?(\d+)/.exec(inputs)[1]
      } else {
        input.command = "name"
        input.chara = inputs
      }
    }

    return await this.execute(input.source.client, input)
  },
  async execute(client, input) {
    const db = client.db;

    try {
      await db.users.reload()
      await db.charas.reload()
      await db.factions.reload()

      let profile, chara, allChara;

      if (input.command !== "edit") {
        if (["self", "user"].includes(input.command)) {
          profile = db.users.find(row => row.get("user_id") == (input.user || input.sender));

          if (!profile) throw new Error("The specified user could not be found! They may not yet be registered in the system.")

          allChara = db.charas.filter(row => row.get("owner_id") == profile.get("user_id"));
        } if (input.command === "name") {
          let search = findChar(client, input.chara, true);
          if (!search) throw new Error("The specified character could not be found!")

          chara = db.charas.find(row => row.get("chara_name") == search);
          if (!chara) throw new Error("The specified character could not be found!")

          profile = db.users.find(row => row.get("user_id") == chara.get("owner_id"));
        }

        if (!profile) throw new Error("The specified user could not be found! They may not yet be registered in the system.")


        return await input.source.reply({
          embeds: [
            chara ? charaEmbed(chara, client) : allChara?.length ? charaEmbed(allChara[0], client) : {
              description: "Character(s) not found! Let Teru know if this is an error.",
              color: color(client.config("default_color")),
              footer: {
                "text": "SUNNY CANTILADOS",
                "icon_url": client.config("default_image")
              },
            }
          ],
          components: buttons(allChara, db.factions.data, client),
          flags: (input.hide ? MessageFlags.Ephemeral : undefined)
        })
      } else {
        const chara = db.charas.find(row => row.get("owner_id") == input.sender && row.get("chara_name") == input.edit)
        if (!chara) throw new Error("This character does not exist, or is not editable! Let Teru know if this is an error.")

        return await input.source.showModal({
          title: "Edit " + chara.get("chara_name"),
          custom_id: "chara:editChara:" + chara.get("chara_name"),
          components: [
            {
              type: 1,
              components: [{
                type: 4,
                custom_id: "pronouns",
                label: "pronouns",
                style: 1,
                min_length: 1,
                max_length: 50,
                value: chara.get("pronouns") ?? "N/A"
              }]
            },
            {
              type: 1,
              components: [{
                type: 4,
                custom_id: "flavor_text",
                label: "Profile Description",
                style: 2,
                max_length: 256,
                value: chara.get("flavor_text") ?? "",
                required: false
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
  async autocomplete(interaction) {
    try {
      const focused = interaction.options.getFocused(true);
      const db = interaction.client.db

      if (focused.value.length <= 1) await db.charas.reload()

      let data = db.charas.sort((a, b) => a.get("last_first_name").localeCompare(b.get("last_first_name")));
      data = [...data.filter(row => row.get("is_npc")?.toUpperCase() !== "TRUE"), ...data.filter(row => row.get("is_npc")?.toUpperCase() === "TRUE")]

      if (focused.name === "chara") {
        let filtered = fuzzy.filter(diacritic(focused.value), data, { extract: x => diacritic(x.get("chara_name") + " // " + x.get("full_name")) })
        if (filtered.length > 25) filtered.length = 25

        return await interaction.respond(
          filtered.map(choice => ({ name: choice.original.get("full_name"), value: choice.original.get("chara_name") }))
        )
      } else if (focused.name === "oc") {
        data = data.filter(row => row.get("owner_id") === interaction.user.id)

        let filtered = fuzzy.filter(diacritic(focused.value), data, { extract: x => diacritic(x.get("chara_name") + " // " + x.get("full_name"))})
        if (filtered.length > 25) filtered.length = 25

        return await interaction.respond(
          filtered.map(choice => ({ name: choice.original.get("full_name"), value: choice.original.get("chara_name") }))
        )
      }
    } catch (error) {
      console.log(error)
    }
  },
  async button(interaction, inputs) {
    const db = interaction.client.db;
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

      if (input === "show") {
        // show character
        input = inputs.shift();

        await db.charas.reload()
        let chara = db.charas.find(row => row.get("chara_name") == input);

        if (!chara) throw new Error("The specified character could not be found!")

        let embeds = interaction.message.embeds;
        embeds[0] = charaEmbed(chara, interaction.client);

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
  },
  async modal(interaction, inputs) {
    const db = interaction.client.db;
    let input = inputs.shift();

    try {
      if (input === "editChara") {
        input = inputs.shift();

        await db.charas.reload()
        let chara = db.charas.find(row => row.get("chara_name") === input);

        if (!chara) throw new Error("The specified character could not be found!")
        const updates = {
          pronouns: interaction.fields.getTextInputValue("pronouns"),
          flavor_text: interaction.fields.getTextInputValue("flavor_text")
        };

        await chara.assign(updates)
        await chara.save()

        await interaction.client.log(`**EDITED PROFILE:** \`${chara.get("chara_name")}\` (<@${chara.get("owner_id")}>)`
          + Object.entries(updates).map(x => `\n> **${x[0]}**: ${x[1] ? x[1] : "`EMPTY`"}`).join(""))

        return await interaction.reply({
          content: "Your character has been updated.",
          embeds: [charaEmbed(chara, interaction.client)],
          flags: MessageFlags.Ephemeral
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



function buttons(allChara, factions, client) {
  let buttons = [];
  const fac = Object.fromEntries(factions.filter(x => x.get("faction_name")).map(x => [x.get("faction_name"), x.toObject()]))

  if (allChara?.length > 1) {
    if (allChara.filter(row => row.get("is_npc")?.toUpperCase() !== "TRUE").length) {
      buttons.push(
        ...allChara.filter(row => row.get("is_npc")?.toUpperCase() !== "TRUE")
          .sort((a, b) => a.get("last_first_name").localeCompare(b.get("last_first_name")))
          .map(char => ({
            custom_id: `chara:show:${char.get("chara_name")}`,
            type: 2,
            style: fac[char.get("faction")].button_color,
            label: `${fac[char.get("faction")].simple_emoji} ${char.get("full_name")}`
          }))
      )
    }

    if (allChara.filter(row => row.get("is_npc")?.toUpperCase() === "TRUE").length) {
      buttons.push(
        ...allChara.filter(row => row.get("is_npc")?.toUpperCase() === "TRUE")
          .sort((a, b) => a.get("last_first_name").localeCompare(b.get("last_first_name")))
          .map(char => ({
            custom_id: `chara:show:${char.get("chara_name")}`,
            type: 2,
            style: client.config("default_button_color"),
            label: `${fac[char.get("faction")].simple_emoji} ${char.get("full_name")}`
          }))
      )
    }
  }

  return arrayChunks(buttons, 5).map(x => ({ type: 1, components: x }))
}