const { SlashCommandBuilder, MessageFlags } = require('discord.js'),
  { award, deduct } = require("../module/transactions.js"),
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
        .setName("amount")
        .setDescription("The amount of Cred to receive.")
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
        .setDescription("The item to receive.")
        .setAutocomplete(true)
        .setRequired(true)
      )
      .addIntegerOption(option => option
        .setName("amount")
        .setDescription("The number of items to receive.")
        .setMinValue(1)
      )
    ),
  async parse(interaction) {
    return await this.execute(interaction.client, {
      source: interaction,
      command: interaction.options.getSubcommand(),
      giver: interaction.user.id,
      receiver: interaction.options.getUser("user")?.id,
      item: interaction.options.getString("item"),
      amount: interaction.options.getInteger("amount") ?? 1
    })
  },
  async execute(client, input) {
    const db = client.db;

    try {
      if (input.command === "money") {
        await db.users.reload()
        const giver = db.users.find(row => row.get("user_id") == input.giver);
        const receiver = db.users.find(row => row.get("user_id") == input.receiver);

        if (!giver) throw new Error("You don't have a profile to be gifting from!")
        if (!receiver) throw new Error("The user you're giving to doesn't yet exist! They may need to be registered by mods.")
        if (input.giver === input.receiver) throw new Error("You're trying to gift things to yourself!")

        if (+giver.get("money") < input.amount) throw new Error("You don't have that much money to give!")

        await deduct(input.source, giver, undefined, { money: input.amount }, 1)
        await award(input.source, receiver, undefined, { money: input.amount }, 0, true)

      } else if (input.command === "item") {
        await db.users.reload()
        await db.items.reload()
        const giver = db.users.find(row => row.get("user_id") == input.giver);
        const receiver = db.users.find(row => row.get("user_id") == input.receiver);

        if (!giver) throw new Error("You don't have an inventory to be gifting from!")
        if (!receiver) throw new Error("The user you're giving to doesn't yet exist! They may need to be registered by mods.")

        const name = input.item, amount = input.amount || 1,
          item = db.items.find(row => row.get("item_name") == name)
        if (!item) throw new Error(`Item \`${name}\` not found!`)

        let giverInv = new Inventory(giver.get("inventory"));
        if (giverInv.get(name) < amount) throw new Error("You do not have enough of the specified item to be gifting!")

        let receiverInv = new Inventory(receiver.get("inventory")),
          permaLimit = new Inventory(receiver.get("perma_limit"));

        let limit = {
          hold: parseInt(item.get("hold_limit")) || null,
          perma: parseInt(item.get("perma_limit")) || null
        }

        if (limit.hold && receiverInv.get(name) + amount > limit.hold) {
          throw new Error(`Transaction denied: cannot give ${amount} of ${name}\nThe item's holding limit is ${limit.hold}, and the user currently holds ${receiverInv.get(name)}.`)
        } else if (limit.perma && permaLimit.get(name) + amount > limit.perma) {
          throw new Error(`Transaction denied: cannot give ${amount} of ${name}\nThe item's lifetime limit is ${limit.perma}, and the user has had ${perma.get(name)}.`)
        }

        await deduct(input.source, giver, undefined, { items: new Inventory(`${input.item} (x${input.amount || 1})`) }, 1)
        await award(input.source, receiver, undefined, { items: new Inventory(`${input.item} (x${input.amount || 1})`) }, 0, true)
      }
    } catch (error) {
      console.log(error);
      if (input.source.replied || input.source.deferred) {
        await input.source.followUp({ content: "An error occurred:\n" + error.message.split("\n").map(x => `> -# \`${x}\``).join("\n"), flags: MessageFlags.Ephemeral });
      } else {
        await input.source.reply({ content: "An error occurred:\n" + error.message.split("\n").map(x => `> -# \`${x}\``).join("\n"), flags: MessageFlags.Ephemeral });
      }
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