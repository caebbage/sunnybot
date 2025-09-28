const { SlashCommandBuilder, MessageFlags } = require('discord.js'),
  { color, money, itemEmbed, statusEmbed } = require("../module/helpers.js"),
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
        .setName("money")
        .setDescription("The amount of Cred to receive.")
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
        .setName("item-amt")
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
        .setName("heat")
        .setDescription("The amount of Heat to give.")
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
        .setDescription("The character gaining Reputation.")
        .setAutocomplete(true)
        .setRequired(true)
      )
      .addIntegerOption(option => option
        .setName("rep")
        .setDescription("The amount of Reputation to give.")
        .setMinValue(1)
        .setMaxValue(9999)
        .setRequired(true)
      )
    )
    .addSubcommand(subcommand => subcommand
      .setName("status")
      .setDescription("Give a Status to a character.")
      .addStringOption(option => option
        .setName("chara")
        .setDescription("The character gaining a status.")
        .setAutocomplete(true)
        .setRequired(true)
      )
      .addStringOption(option => option
        .setName("status")
        .setDescription("The status to give.")
        .setAutocomplete(true)
        .setRequired(true)
      )
    )
    .addSubcommand(subcommand => subcommand
      .setName("to-user")
      .setDescription("Give multiple things to a user at once.")
      .addUserOption(option => option
        .setName("user")
        .setDescription("The user receiving things.")
        .setRequired(true)
      )
      .addIntegerOption(option => option
        .setName("money")
        .setDescription("The amount of Money to give.")
        .setMinValue(1)
      )
      .addStringOption(option => option
        .setName("item")
        .setDescription("The item to receive.")
        .setAutocomplete(true)
      )
      .addIntegerOption(option => option
        .setName("item-amt")
        .setDescription("How much of an item to give. (Default 1)")
        .setMinValue(1)
      )
    )
    .addSubcommand(subcommand => subcommand
      .setName("to-user-chara")
      .setDescription("Give multiple things to a user and character at once.")
      .addStringOption(option => option
        .setName("chara")
        .setDescription("The character gaining things. (The user will be the owner of this character.)")
        .setAutocomplete(true)
        .setRequired(true)
      )

      .addIntegerOption(option => option
        .setName("money")
        .setDescription("The amount of Money to give.")
        .setMinValue(1)
      )
      .addStringOption(option => option
        .setName("item")
        .setDescription("The item to receive.")
        .setAutocomplete(true)
      )
      .addIntegerOption(option => option
        .setName("item-amt")
        .setDescription("How much of an item to give. (Default 1)")
        .setMinValue(1)
      )
      .addIntegerOption(option => option
        .setName("heat")
        .setDescription("The amount of Heat to give.")
        .setMinValue(1)
        .setMaxValue(5)
      )
      .addIntegerOption(option => option
        .setName("rep")
        .setDescription("The amount of Reputation to give.")
        .setMinValue(1)
        .setMaxValue(9999)
      )
      .addStringOption(option => option
        .setName("status")
        .setDescription("The status to give.")
        .setAutocomplete(true)
      )
    ),
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

    if (input.item) change.items = new Inventory(`${input.item} (x${input.itemAmt || 1})`);

    let response = await input.source.deferReply({ fetchReply: true });
    
    try {
      if (["money", "item", "to-user"].includes(input.command)) {
        await db.users.reload()
        target.profile = profile = db.users.find(row => row.get("user_id") == input.user);

      } else if (["heat", "reputation", "status", "to-user-chara"].includes(input.command)) {
        await db.charas.reload()
        target.chara = db.charas.find(row => row.get("chara_name") == input.chara);

        if (["to-user-chara"].includes(input.command)) {
          input.user = target.chara.get("owner_id");

          await db.users.reload()
          target.profile = profile = db.users.find(row => row.get("user_id") == input.user);
        }
      }

      const result = await award(input.source, target, change);


      if (result.success) {
        let embeds = [];

        if (target.profile) {
          if (change.money) {
            embeds.push({
              description: `<@${profile.get("user_id")}> has gained **${money(input.money, client)}**!`,
              color: color(client.config("default_color"))
            })
          }
          if (change.items) {
            let item = db.items.find(row => row.get("item_name") == input.item);

            embeds.push({
              description: `<@${profile.get("user_id")}> has gained **${input.item} (x${input.itemAmt || 1})**!`,
              color: color(client.config("default_color"))
            },
              itemEmbed(item, client, true))
          }
        }

        if (target.chara) {
          if (change.heat) {
            embeds.push({
              description: `**${input.chara}** has gained **${input.heat} Heat**!`,
              color: color(client.config("default_color"))
            })
          }
          if (change.reputation) {
            embeds.push({
              description: `**${input.chara}** has gained **${input.reputation} Reputation!**!`,
              color: color(client.config("default_color"))
            })
          }
        }

        if (change.statuses) {
          let status = db.statuses.find(x => x.get("status_name") == change.statuses)

          embeds.push({
            description: `**${input.chara}** has gained **${change.statuses}**!`,
            color: color(client.config("default_color"))
          }, statusEmbed(status, client))
        }

        await input.source.editReply({
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
        return await input.source.editReply({
          content: "Transaction failed:\n-# `" + result.error.message + "`",
          flags: MessageFlags.Ephemeral
        })
      }
    } catch (error) {
      console.log(error);
      return await input.source.followUp({
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

        let filtered = db.charas.data?.length ? fuzzy.filter(focused.value, db.charas.data, { extract: x => (x.get("chara_name") + " // " + x.get("full_name")).normalize('NFD').replace(/\p{Diacritic}/gu, '') }) : []
        if (filtered.length > 25) filtered.length = 25

        return await interaction.respond(
          filtered.map(choice => ({ name: choice.original.get("full_name"), value: choice.original.get("chara_name") }))
        )
      } else if (focused.name === "item") {
        if (focused.value.length <= 1) await db.items.reload()

        let filtered = db.items.data?.length ? fuzzy.filter(focused.value, db.items.data.filter(x => x.get("item_name")), { extract: x => x.get("item_name").normalize('NFD').replace(/\p{Diacritic}/gu, '') ?? " " }) : []
        if (filtered.length > 25) filtered.length = 25

        return await interaction.respond(
          filtered.map(choice => ({ name: choice.original.get("item_name"), value: choice.original.get("item_name") }))
        )
      } else if (focused.name === "status") {
        if (focused.value.length <= 1) await db.statuses.reload()
        let data = db.statuses.filter(x => x.get("status_name"))

        let filtered = fuzzy.filter(focused.value, data, { extract: x => x.get("status_name").normalize('NFD').replace(/\p{Diacritic}/gu, '') })
        if (filtered.length > 25) filtered.length = 25

        return await interaction.respond(
          filtered.map(choice => ({ name: choice.original.get("status_name"), value: choice.original.get("status_name") }))
        )
      }
    } catch (error) {
      console.log(error)
    }
  },
};