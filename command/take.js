const { SlashCommandBuilder, MessageFlags } = require('discord.js'),
  { deduct } = require("../module/transactions.js"),
  { Inventory } = require('../module/inventory.js'),
  fuzzy = require("fuzzy");


module.exports = {
  name: "take",
  slash: new SlashCommandBuilder()
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
        .setDescription("The amount of Cred to take.")
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
    )
    .addSubcommand(subcommand => subcommand
      .setName("heat")
      .setDescription("Take Heat from a character.")
      .addStringOption(option => option
        .setName("chara")
        .setDescription("The character losing Heat.")
        .setAutocomplete(true)
        .setRequired(true)
      )
      .addIntegerOption(option => option
        .setName("amount")
        .setDescription("The amount of Heat to take.")
        .setMinValue(1)
        .setMaxValue(5)
      )
    )
    .addSubcommand(subcommand => subcommand
      .setName("reputation")
      .setDescription("Give Reputation to a character.")
      .addStringOption(option => option
        .setName("chara")
        .setDescription("The character losing Reputation.")
        .setAutocomplete(true)
        .setRequired(true)
      )
      .addIntegerOption(option => option
        .setName("amount")
        .setDescription("The amount of Reputation to take.")
        .setMinValue(1)
        .setMaxValue(9999)
        .setRequired(true)
      )
    ),
  async parse(interaction) {
    return await this.execute(interaction.client, {
      source: interaction,
      command: interaction.options.getSubcommand(),
      user: interaction.options.getUser("user")?.id,
      chara: interaction.options.getString("chara"),
      item: interaction.options.getString("item"),
      amount: interaction.options.getInteger("amount") ?? 1
    })
  },
  async execute(client, input) {
    const db = client.db

    try {
      if (input.command === "money") {
        await db.users.reload()
        const profile = db.users.find(row => row.get("user_id") == input.user);

        return await deduct(input.source, profile, undefined, { money: input.amount }, 1)

      } else if (input.command === "item") {
        await db.users.reload()
        await db.items.reload()
        const profile = db.users.find(row => row.get("user_id") == input.user);

        return await deduct(input.source, profile, undefined, { items: new Inventory(`${input.item} (x${input.amount || 1})`) }, 1)

      } else if (input.command === "heat") {
        await db.charas.reload()
        let chara = db.charas.find(row => row.get("chara_name") == input.chara);

        return await deduct(input.source, undefined, chara, { heat: input.amount }, 1)

      } else if (input.command === "reputation") {
        await db.charas.reload()
        let chara = db.charas.find(row => row.get("chara_name") == input.chara);

        return await deduct(input.source, undefined, chara, { reputation: input.amount }, 1)
      }
    } catch (error) {
      console.log(error);
      await input.source.reply({
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

        let filtered = db.charas.data?.length ? fuzzy.filter(focused.value, db.charas.data, { extract: x => (x.get("chara_name") + " // " + x.get("full_name")).normalize('NFD').replace(/\p{Diacritic}/gu, '') }) : []
        if (filtered.length > 25) filtered.length = 25

        return await interaction.respond(
          filtered.map(choice => ({ name: choice.original.get("full_name"), value: choice.original.get("chara_name") }))
        )
      } else if (focused.name === "item") {
        if (focused.value.length <= 1) await db.users.reload()
        const inventory = new Inventory(db.users.find(x => x.get("user_id") == interaction.options.get("user")?.value ?? "").get("inventory")) || [];

        let filtered = !inventory.isEmpty() ? fuzzy.filter(focused.value, inventory.entries(), { extract: x => x[0].normalize('NFD').replace(/\p{Diacritic}/gu, '') }) : []
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