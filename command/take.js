const { SlashCommandBuilder, MessageFlags } = require('discord.js'),
  { color, money } = require("../module/helpers.js"),
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
        .setName("money")
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
        .setName("item-amt")
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
        .setName("heat")
        .setDescription("The amount of Heat to take.")
        .setMinValue(1)
        .setMaxValue(5)
        .setRequired(true)
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
        .setName("rep")
        .setDescription("The amount of Reputation to take.")
        .setMinValue(1)
        .setMaxValue(9999)
        .setRequired(true)
      )
    )
    .addSubcommand(subcommand => subcommand
      .setName("status")
      .setDescription("Take a Status from a character.")
      .addStringOption(option => option
        .setName("chara")
        .setDescription("The character losing a status.")
        .setAutocomplete(true)
        .setRequired(true)
      )
      .addStringOption(option => option
        .setName("status")
        .setDescription("The status to take.")
        .setAutocomplete(true)
        .setRequired(true)
      )
    )
    .addSubcommand(subcommand => subcommand
      .setName("from-user")
      .setDescription("Take multiple things from a user at once.")
      .addUserOption(option => option
        .setName("user")
        .setDescription("The user losing things.")
        .setRequired(true)
      )
      .addIntegerOption(option => option
        .setName("money")
        .setDescription("The amount of Money to take.")
        .setMinValue(1)
      )
      .addStringOption(option => option
        .setName("item")
        .setDescription("The item to remove.")
        .setAutocomplete(true)
      )
      .addIntegerOption(option => option
        .setName("item-amt")
        .setDescription("How much of an item to take. (Default 1)")
        .setMinValue(1)
      )
    )
    .addSubcommand(subcommand => subcommand
      .setName("from-user-chara")
      .setDescription("Take multiple things from a character at once. (The user will be the owner of this character.)")
      .addStringOption(option => option
        .setName("chara")
        .setDescription("The character losing things.")
        .setAutocomplete(true)
        .setRequired(true)
      )
      .addIntegerOption(option => option
        .setName("money")
        .setDescription("The amount of Money to take.")
        .setMinValue(1)
      )
      .addStringOption(option => option
        .setName("item")
        .setDescription("The item to remove.")
        .setAutocomplete(true)
      )
      .addIntegerOption(option => option
        .setName("item-amt")
        .setDescription("How much of an item to take. (Default 1)")
        .setMinValue(1)
      )
      .addIntegerOption(option => option
        .setName("heat")
        .setDescription("The amount of Heat to lose.")
        .setMinValue(1)
        .setMaxValue(5)
      )
      .addIntegerOption(option => option
        .setName("rep")
        .setDescription("The amount of Reputation to lose.")
        .setMinValue(1)
        .setMaxValue(9999)
      )
      .addStringOption(option => option
        .setName("status")
        .setDescription("The status to take.")
        .setAutocomplete(true)
      )
    )
  ,
  async parse(interaction) {
    return await this.execute(interaction.client, {
      source: interaction,
      command: interaction.options.getSubcommand(),
      user: interaction.options.getUser("user")?.id,
      chara: interaction.options.getString("chara"),

      money: interaction.options.getInteger("money"),
      item: interaction.options.getString("item"),
      itemAmt: interaction.options.getInteger("item-amt") || 1,

      heat: interaction.options.getInteger("heat"),
      reputation: interaction.options.getInteger("rep"),
      status: interaction.options.getString("status")
    })
  },
  async execute(client, input) {
    const db = client.db;
    let target = {},
      change = {
        money: input.money,
        heat: input.heat,
        reputation: input.reputation,
        statuses: input.status
      };

    if (input.item) change.items = new Inventory(`${input.item} (x${input.amount || 1})`);

    try {
      if (["money", "item", "from-user"].includes(input.command)) {
        await db.users.reload()
        target.profile = profile = db.users.find(row => row.get("user_id") == input.user);

      } else if (["heat", "reputation", "status", "from-user-chara"].includes(input.command)) {
        await db.charas.reload()
        target.chara = db.charas.find(row => row.get("chara_name") == input.chara);

        if (["from-user-chara"].includes(input.command)) {
          input.user = target.chara.get("owner_id");

          await db.users.reload()
          target.profile = profile = db.users.find(row => row.get("user_id") == input.user);
        }
      }

      const result = await deduct(input.source, target, change);


      if (result.success) {
        let embeds = [];

        if (target.profile) {
          if (change.money) {
            embeds.push({
              description: `<@${profile.get("user_id")}> has lost **${money(input.money, client)}**!`,
              color: color(client.config("default_color"))
            })
          }
          if (change.items) {
            embeds.push({
              description: `<@${profile.get("user_id")}> has lost **${input.item} (x${input.itemAmt || 1})**!`,
              color: color(client.config("default_color"))
            })
          }
        }

        if (target.chara) {
          if (change.heat) {
            embeds.push({
              description: `**${input.chara}** has lost **${input.heat} Heat**!`,
              color: color(client.config("default_color"))
            })
          }
          if (change.reputation) {
            embeds.push({
              description: `**${input.chara}** has lost **${input.reputation} Reputation!**!`,
              color: color(client.config("default_color"))
            })
          }

          if (change.statuses) {
            embeds.push({
              description: `**${input.chara}** has lost **${change.statuses}!**!`,
              color: color(client.config("default_color"))
            })
          }
        }

        const response = await input.source.reply({
          embeds,
          fetchReply: true
        });

        return await client.log(
          `**TRANSACTION:** `
          + `<@${target.profile?.get("user_id") || target.chara?.get("owner_id")}>`
          + (target.chara ? ` (${target.chara.get("chara_name")})` : "")
          + "\n" + result.log.join("\n> \n"),
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

      if (focused.name === "chara") {
        if (focused.value.length <= 1) await db.charas.reload()

        let data = db.charas.filter(x => x.get("chara_name"))
        if (interaction.options.getSubcommand() == "status") data = data.filter(x => x.get("statuses"))

        let filtered = fuzzy.filter(focused.value, data, { extract: x => (x.get("chara_name") + " // " + x.get("full_name")).normalize('NFD').replace(/\p{Diacritic}/gu, '') })
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
      } else if (focused.name === "status") {
        if (focused.value.length <= 1) await db.charas.reload()

        let chara = db.charas.find(x => x.get("chara_name") == interaction.options.get("chara")?.value);

        let statuses = chara ? chara.get("statuses").split(", ").filter(x => x) : [];

        let filtered = fuzzy.filter(focused.value, statuses, { extract: x => x.normalize('NFD').replace(/\p{Diacritic}/gu, '') })
        if (filtered.length > 25) filtered.length = 25

        return await interaction.respond(
          filtered.map(choice => ({ name: choice.original, value: choice.original }))
        )
      }
    } catch (error) {
      console.log(error)
    }
  },
};