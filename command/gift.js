const { SlashCommandBuilder, MessageFlags } = require('discord.js'),
  { color, money, itemEmbed } = require("../module/helpers.js"),
  { transfer } = require("../module/transactions.js"),
  { Inventory } = require('../module/inventory.js'),
  fuzzy = require("fuzzy");

module.exports = {
  name: "gift",
  slash: new SlashCommandBuilder()
    .setName('gift')
    .setDescription(`Gift something to another player.`)
    .addSubcommand(subcommand => subcommand
      .setName("money")
      .setDescription("Gift money to a user.")
      .addUserOption(option => option
        .setName("user")
        .setDescription("The user receiving the money.")
        .setRequired(true)
      )
      .addIntegerOption(option => option
        .setName("money")
        .setDescription("The amount of Cred to gift.")
        .setMinValue(1)
        .setRequired(true)
      )
    )
    .addSubcommand(subcommand => subcommand
      .setName("item")
      .setDescription("Gift an item to a user.")
      .addUserOption(option => option
        .setName("user")
        .setDescription("The user receiving the item.")
        .setRequired(true)
      )
      .addStringOption(option => option
        .setName("item")
        .setDescription("The item to gift.")
        .setAutocomplete(true)
        .setRequired(true)
      )
      .addIntegerOption(option => option
        .setName("item-amt")
        .setDescription("The amount of the item to gift.")
        .setMinValue(1)
      )
    ),
  async parse(interaction) {
    return await this.execute(interaction.client, {
      source: interaction,
      command: interaction.options.getSubcommand(),
      giver: interaction.user.id,
      receiver: interaction.options.getUser("user")?.id,
      money: interaction.options.getInteger("money"),
      item: interaction.options.getString("item"),
      itemAmt: interaction.options.getInteger("item-amt") ?? 1
    })
  },
  async execute(client, input) {
    const db = client.db;


    try {
      let giver = {}, receiver = {},
        change = {
          money: input.money
        };

      if (input.item) change.items = new Inventory(`${input.item} (x${input.itemAmt || 1})`);

      if (["money", "item", "to-user"].includes(input.command)) {
        await db.users.reload()
        giver.profile = db.users.find(row => row.get("user_id") == input.giver)
        receiver.profile = db.users.find(row => row.get("user_id") == input.receiver);
      }

      const result = await transfer(input.source, giver, receiver, change);

      if (result.success) {
        let embeds = [];

        if (change.money) {
          embeds.push({
            description: `<@${input.giver}> has gifted **${money(input.money, client)}** to <@${input.receiver}>!`,
            color: color(client.config("default_color"))
          })
        }
        if (change.items) {
          let item = db.items.find(row => row.get("item_name") == input.item);

          embeds.push({
            description: `<@${input.giver}> has gifted **${input.item} (x${input.itemAmt || 1})** to <@${input.receiver}>!`,
            color: color(client.config("default_color"))
          },
            itemEmbed(item, client, true))
        }

        const response = (await input.source.reply({
          content: `<@${input.receiver}>`, embeds,
          withResponse: true
        }))?.resource?.message;

        return await client.log(
          `**GIFTING:** `
          + `<@${input.giver}>`
          + "\n" + result.log.giver.join("\n> \n")
          + `\n\n**RECEIVING:** `
          + `<@${input.receiver}>`
          + "\n" + result.log.receiver.join("\n> \n"),
          {
            sender: input.source.user.id,
            url: response.url
          }
        )
      } else {
        return await input.source.reply({
          content: "Transaction failed:\n-# `" + result.error.message + "`",
          flags: MessageFlags.Ephemeral
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
      const db = interaction.client.db;

      if (focused.name === "item") {
        if (focused.value.length <= 1) await db.users.reload()

        const inventory = new Inventory(db.users.find(x => x.get("user_id") == interaction.user.id ?? "").get("inventory")) || [];

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