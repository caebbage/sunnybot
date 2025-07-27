const { SlashCommandBuilder, MessageFlags } = require('discord.js'),
  { award } = require("../module/transactions.js"),
  { Inventory } = require('../module/inventory.js'),
  fuzzy = require("fuzzy");

module.exports = {
  name: "give",
  slash: new SlashCommandBuilder()
    .setName('give')
    .setDescription(`Give something to...`)
    .addSubcommand(subcommand => subcommand
      .setName("money")
      .setDescription("Give money to a user.")
      .addUserOption(option => option
        .setName("user")
        .setDescription("The user receiving the money.")
        .setRequired(true)
      )
      .addIntegerOption(option => option
        .setName("amount")
        .setDescription("The amount of Pokedollars to receive.")
        .setMinValue(1)
        .setRequired(true)
      )
    )
    .addSubcommand(subcommand => subcommand
      .setName("item")
      .setDescription("Give an item to a user.")
      .addUserOption(option => option
        .setName("user")
        .setDescription("The user receiving the item.")
        .setRequired(true)
      )
      .addStringOption(option => option
        .setName("item")
        .setDescription("The item to receive.")
        .setAutocomplete(true)
        .setRequired(true)
      )
      .addIntegerOption(option => option
        .setName("amount")
        .setDescription("The number of items to receive.")
        .setMinValue(1)
      )
    )
    .addSubcommand(subcommand => subcommand
      .setName("heat")
      .setDescription("Give Heat to a character.")
      .addStringOption(option => option
        .setName("chara")
        .setDescription("The character gaining Heat.")
        .setAutocomplete(true)
        .setRequired(true)
      )
      .addIntegerOption(option => option
        .setName("amount")
        .setDescription("The amount of Heat to give.")
        .setMinValue(1)
        .setMaxValue(5)
      )
    )
    .addSubcommand(subcommand => subcommand
      .setName("reputation")
      .setDescription("Give Reputation to a character.")
      .addStringOption(option => option
        .setName("chara")
        .setDescription("The character gaining Reputation.")
        .setAutocomplete(true)
        .setRequired(true)
      )
      .addIntegerOption(option => option
        .setName("amount")
        .setDescription("The amount of Reputation to give.")
        .setMinValue(1)
        .setMaxValue(10000)
      )
    ),
  
  parse(interaction, message) {
    var input = {};
    if (interaction) {
      input.source = interaction
      input.command = interaction.options.getSubcommand()
      input.user = interaction.options.getUser("user")?.id
      input.chara = interaction.options.getString("chara")
      input.item = interaction.options.getString("item")
      input.amount = interaction.options.getInteger("amount")
    }

    this.execute(
      interaction.client || message.client,
      input
    )
  },
  async execute(client, input) {
    const db = client.db;

    try {
      if (input.command === "money") {
        await db.users.reload()
        const profile = db.users.find(row => row.get("user_id") == input.user);

        return await award(interaction, profile, undefined, { money: input.amount }, 1)
        
      } else if (input.command === "item") {
        await db.users.reload()
        await db.items.reload()
        const profile = db.users.find(row => row.get("user_id") == input.user);

        return await award(interaction, profile, undefined, { items: new Inventory(`${input.item} (x${input.amount || 1})`) }, 1)

      } else if (input.command === "heat") {
        await db.charas.reload()
        let chara = db.charas.find(row => row.get("chara_name") == input.chara);

        return await award(interaction, undefined, chara, {heat: input.amount}, 1)

      } else if (input.command === "reputation") {
        await db.charas.reload()
        let chara = db.charas.find(row => row.get("chara_name") == input.chara);

        return await award(interaction, undefined, chara, {reputation: input.amount}, 1)
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
      const db = interaction.client.db;

      if (focused.name === "chara") {
        if (focused.value.length <= 1) await db.charas.reload() // refresh db upon starting input

        let filtered = db.charas.data?.length ? fuzzy.filter(focused.value, db.charas.data, { extract: x => (x.get("chara_name") + " / " + x.get("fullname")).normalize('NFD').replace(/\p{Diacritic}/gu, '') }) : []
        if (filtered.length > 25) filtered.length = 25

        return await interaction.respond(
          filtered.map(choice => ({ name: choice.original.get("chara_name") + " / " + choice.original.get("fullname"), value: choice.original.get("chara_name") }))
        )
      } else if (focused.name === "item") {
        if (focused.value.length <= 1) db.items.reload()

        let filtered = db.items.data?.length ? fuzzy.filter(focused.value, db.items.data.filter(x => x.get("item_name")), { extract: x => x.get("item_name").normalize('NFD').replace(/\p{Diacritic}/gu, '') ?? " " }) : []
        if (filtered.length > 25) filtered.length = 25

        return await interaction.respond(
          filtered.map(choice => ({ name: choice.original.get("item_name"), value: choice.original.get("item_name") }))
        )
      }
    } catch (error) {
      console.log(error)
    }
  },
};