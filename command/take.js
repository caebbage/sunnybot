const { SlashCommandBuilder, MessageFlags } = require('discord.js'),
  { deduct } = require("../module/transactions.js"),
  { Inventory } = require('../module/inventory.js'),
  fuzzy = require("fuzzy");


module.exports = {
  data: new SlashCommandBuilder()
    .setName('take')
    .setDescription(`Take something from...`)
    .addSubcommand(subcommand => subcommand
      .setName("money")
      .setDescription("Take money from a user.")
      .addUserOption(option => option
        .setName("user")
        .setDescription("The user losing the money.")
        .setRequired(true)
      )
      .addIntegerOption(option => option
        .setName("amount")
        .setDescription("The amount of Pokedollars to take.")
        .setMinValue(1)
        .setRequired(true)
      )
    )
    .addSubcommand(subcommand => subcommand
      .setName("xp")
      .setDescription("Take XP from a character.")
      .addStringOption(option => option
        .setName("chara")
        .setDescription("The character losing the XP.")
        .setAutocomplete(true)
        .setRequired(true)
      )
      .addIntegerOption(option => option
        .setName("amount")
        .setDescription("The amount of XP to take.")
        .setMinValue(1)
        .setRequired(true)
      )
    )
    .addSubcommand(subcommand => subcommand
      .setName("item")
      .setDescription("Take an item from a user.")
      .addUserOption(option => option
        .setName("user")
        .setDescription("The user losing the item.")
        .setRequired(true)
      )
      .addStringOption(option => option
        .setName("item")
        .setDescription("The item to take.")
        .setAutocomplete(true)
        .setRequired(true)
      )
      .addIntegerOption(option => option
        .setName("amount")
        .setDescription("The number of items to take.")
        .setMinValue(1)
      )
    ),
  async execute(interaction) {
    const db = interaction.client.db

    try {
      if (interaction.options.getSubcommand() === "money") {
        await db.users.reload()

        let profile = db.users.find(row => row.get("user_id") == interaction.options.getUser("user").id);

        return await deduct(interaction, profile, undefined,
          interaction.options.getInteger("amount"), undefined, undefined, undefined,
          mode = 1
        )

      } else if (interaction.options.getSubcommand() === "xp") {
        await db.charas.reload()

        let chara = db.charas.find(row => row.get("chara_name") == interaction.options.getString("chara"));

        return await deduct(interaction, undefined, chara,
          undefined, interaction.options.getInteger("amount"), undefined, undefined,
          mode = 1
        )
      } else if (interaction.options.getSubcommand() === "item") {
        await db.users.reload()
        await db.items.reload()

        const profile = db.users.find(row => row.get("user_id") == interaction.options.getUser("user").id);
        
        return await deduct(interaction, profile, undefined,
          undefined, undefined, new Inventory(`\` ${interaction.options.getString("item")} \` x${interaction.options.getInteger("amount") || 1}`), undefined,
          mode = 1
        )
      }
    } catch (error) {
      console.log(error);
      await interaction.reply({
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
        if (focused.value.length <= 1) await db.charas.reload()

        let filtered = db.charas.data?.length ? fuzzy.filter(focused.value, db.charas.data, { extract: x => (x.get("chara_name") + " / " + x.get("fullname")).normalize('NFD').replace(/\p{Diacritic}/gu, '') }) : []
        if (filtered.length > 25) filtered.length = 25

        return await interaction.respond(
          filtered.map(choice => ({ name: choice.original.get("chara_name") + " / " + choice.original.get("fullname"), value: choice.original.get("chara_name") }))
        )
      } else if (focused.name === "item") {
        if (focused.value.length <= 1) await db.users.reload()
        const inventory = new Inventory(db.users.find(x => x.get("user_id") == interaction.options.get("user")?.value ?? "").get("inventory")) || [];

        let filtered = inventory.hasContents() ? fuzzy.filter(focused.value, inventory.toArray(), { extract: x => x[0].normalize('NFD').replace(/\p{Diacritic}/gu, '') }) : []
        if (filtered.length > 25) filtered.length = 25

        return await interaction.respond(
          filtered.map(choice => ({ name: choice.original[0], value: choice.original[0] }))
        )
      }
    } catch (error) {
      console.log(error)
    }
  },
};