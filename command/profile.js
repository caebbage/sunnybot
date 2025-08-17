const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { userEmbed, charaEmbed, inventoryEmbed, findChar, arrayChunks } = require("../module/helpers.js")
const fuzzy = require("fuzzy")

module.exports = {
  name: "profile",
  alias: ["chara"],
  prefix: true,
  slash: new SlashCommandBuilder()
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
    ),
  async parse(interaction, message, inputs) {
    var input = {};

    if (interaction) {
      input = {
        source: interaction,
        command: interaction.options.getSubcommand(),
        user: interaction.options.getUser("user")?.id || interaction.user.id,
        chara: interaction.options.getString("chara"),
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
        input.command = "chara"
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

      if (["self", "user"].includes(input.command)) {
        profile = db.users.find(row => row.get("user_id") == input.user);

      } if (input.command === "chara") {
        let search = findChar(client, input.chara, true);
        if (!search) throw new Error("The specified character could not be found!")

        chara = db.charas.find(row => row.get("chara_name") == search);
        if (!chara) throw new Error("The specified character could not be found!")

        profile = db.users.find(row => row.get("user_id") == chara.get("owner_id"));
      }

      if (!profile) throw new Error("The specified user could not be found! They may not yet be registered in the system.")

      allChara = db.charas.data.filter(row => row.get("owner_id") == profile.get("user_id"));

      return await input.source.reply({
        embeds: [
          await userEmbed(profile, client),
          (chara ? charaEmbed(chara, client) : allChara.length ? charaEmbed(allChara[0], client) : inventoryEmbed(profile, client))
        ],
        components: buttons(profile, allChara, db.factions.data, client),
        flags: (input.hide ? MessageFlags.Ephemeral : undefined)
      })
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

      let filtered = db.charas.data?.length ? fuzzy.filter(focused.value, db.charas.data, { extract: x => (x.get("chara_name") + " // " + x.get("fullname")).normalize('NFD').replace(/\p{Diacritic}/gu, '') }) : []
      if (filtered.length > 25) filtered.length = 25

      return await interaction.respond(
        filtered.map(choice => ({ name: choice.original.get("full_name"), value: choice.original.get("chara_name") }))
      )
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
        embeds[1] = charaEmbed(chara, interaction.client);

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
        embeds[1] = inventoryEmbed(profile, interaction.client);

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



function buttons(profile, allChara, factions, client) {
  let buttons = [];
  const fac = Object.fromEntries(factions.filter(x => x.get("faction_name")).map(x => [x.get("faction_name"), x.toObject()]))

  if (allChara.filter(row => row.get("is_npc").toUpperCase() === "FALSE").length) {
    buttons.push(
      ...allChara.filter(row => row.get("is_npc").toUpperCase() === "FALSE").map(char => ({
        custom_id: `profile:show:${char.get("chara_name")}`,
        type: 2,
        style: fac[char.get("faction")].button_color,
        label: `${fac[char.get("faction")].simple_emoji} ${char.get("full_name")}`
      }))
    )
  }

  if (allChara.filter(row => row.get("is_npc").toUpperCase() === "TRUE").length) {
    buttons.push(
      ...allChara.filter(row => row.get("is_npc").toUpperCase() === "TRUE").map(char => ({
        custom_id: `profile:show:${char.get("chara_name")}`,
        type: 2,
        style: client.config("default_button_color"),
        label: `${fac[char.get("faction")].simple_emoji} ${char.get("full_name")}`
      }))
    )
  }

  buttons.push({
    custom_id: `profile:inventory:${profile.get("user_id")}`,
    type: 2,
    style: 2,
    label: "🧰 Inventory"
  })

  return arrayChunks(buttons, 5).map(x => ({ type: 1, components: x }))
}