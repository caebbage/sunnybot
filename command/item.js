const { SlashCommandBuilder, MessageFlags } = require('discord.js'),
  fuzzy = require("fuzzy"),
  { itemEmbed, color } = require("../module/helpers.js"),
  { Inventory } = require("../module/inventory.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName('item')
    .setDescription(`Item information, purchasing, and use! For inventory, try /profile instead.`)
    .addSubcommand(subcommand => subcommand
      .setName("shop")
      .setDescription("See what's available for purchase.")
      .addBooleanOption(option => option
        .setName("hide")
        .setDescription("If you want this command to not be visible to others.")
      )
    )
    .addSubcommand(subcommand => subcommand
      .setName("info")
      .setDescription("See information about a specific item.")
      .addStringOption(option => option
        .setName("name")
        .setDescription("The name of the item.")
        .setAutocomplete(true)
        .setRequired(true)
      )
      .addBooleanOption(option => option
        .setName("hide")
        .setDescription("If you want this command to not be visible to others.")
      )
    )
    .addSubcommand(subcommand => subcommand
      .setName("buy")
      .setDescription("Buy an item.")
      .addStringOption(option => option
        .setName("buy")
        .setDescription("The item being bought.")
        .setAutocomplete(true)
        .setRequired(true)
      )
      .addIntegerOption(option => option
        .setName("amount")
        .setDescription("The amount to use of the item.")
        .setMinValue(1)
        .setMaxValue(100)
      )
    )
    .addSubcommand(subcommand => subcommand
      .setName("use")
      .setDescription("Use an item, displaying its info and displaying results if gacha.")
      .addStringOption(option => option
        .setName("use")
        .setDescription("The item being used.")
        .setAutocomplete(true)
        .setRequired(true)
      )
      .addStringOption(option => option
        .setName("chara")
        .setDescription("The character using the item.")
        .setAutocomplete(true)
        .setRequired(true)
      )
      .addIntegerOption(option => option
        .setName("amount")
        .setDescription("The amount to use of the item.")
        .setMinValue(1)
        .setMaxValue(100)
      )
    ),
  async execute(interaction) {
    const db = interaction.client.db,
      config = interaction.client.config;

    try {
      await db.items.reload()

      if (interaction.options.getSubcommand() === "info") {
        let item = db.items.data.length ? db.items.find(row => row.get("item_name") == interaction.options.getString("name")) : []

        if (!item) throw new Error("The specified item could not be found!")

        return await interaction.reply({
          embeds: [itemEmbed(item, interaction.user)],
          flags: interaction.options.getBoolean("hide") ? MessageFlags.Ephemeral : undefined
        })
      } else if (interaction.options.getSubcommand() === "shop") {
        const stock = db.items.filter(row => row.get("in_shop") == "TRUE"),
          shop = [...new Set(stock.map(item => item.get("category")))].map(
            cat => [cat, stock.filter(item => item.get("category") == cat).map(item => item.toObject())]);

        interaction.reply({
          embeds: [{
            title: `${config("poke_symbol")} SHOP`,
            thumbnail: {
              url: config("default_image")
            },
            description: 
            "Use `/item info` to see an item's information,\nand `/item buy` to purchase!\n" +
            shop.map(
              val => `### ${val[0]}\n` + val[1].map(
                item => `> \` ${item.item_name} \`   ${item.price ? config("money_symbol") + item.price : "Unmarked"}`
                  + (item.shop_stock ? ` (${item.shop_stock} in stock)` : "")).join("\n")
            ).join("\n"),
            color: color(config("default_color")),
            timestamp: new Date().toISOString()
          }]
        })

      } else if (interaction.options.getSubcommand() === "buy") {
        let item = db.items.data.length ? db.items.find(row => row.get("item_name") == interaction.options.getString("buy")) : []

        if (!item) throw new Error("The specified item could not be found!")

        await db.users.reload()
        let profile = db.users.find(row => row.get("user_id") == interaction.user.id)
        if (!profile) throw new Error("Your user profile could not be found!")

        const name = item.get("item_name"),
          amount = interaction.options.getInteger("amount") ?? 1;

        if (item.get("shop_stock") === "0") {
          return await interaction.reply({
            content: `Purchase denied: cannot buy ${amount} of ${name}\nThere is not enough stock.`,
            flags: MessageFlags.Ephemeral
          })
        } else if (!item.get("price") || item.get("in_shop") !== "TRUE") {
          return await interaction.reply({
            content: `Purchase denied: cannot buy ${amount} of ${name}\nThe item is unpurchaseable.`,
            flags: MessageFlags.Ephemeral
          })
        } else if (parseInt(item.get("price")) * amount > parseInt(profile.get("money"))) {
          return await interaction.reply({
            content: `Purchase denied: cannot buy ${amount} of ${name}\nInsufficient funds. This costs ${config("money_symbol")}${parseInt(item.get("price")) * amount}, and you have ${config("money_symbol")}${profile.get("money")}.`,
            flags: MessageFlags.Ephemeral
          })
        }

        let inventory = new Inventory(profile.get("inventory")),
          limit = {
            hold: parseInt(item.get("hold_limit")) || null,
            monthly: parseInt(item.get("monthly_limit")) || null,
            perma: parseInt(item.get("perma_limit")) || null
          },
          monthly = new Inventory(profile.get("monthly_limit")),
          perma = new Inventory(profile.get("perma_limit"));

        if (limit.hold && inventory.get(name) + amount > limit.hold) {
          return await interaction.reply({
            content: `Purchase denied: cannot buy ${amount} of ${name}\nThe item's holding limit is ${limit.hold}, and you are holding ${inventory.get(name)}.`,
            flags: MessageFlags.Ephemeral
          })
        } else if (limit.monthly && monthly.get(name) + amount > limit.monthly) {
          return await interaction.reply({
            content: `Purchase denied: cannot buy ${amount} of ${name}\nThe item's monthly limit is ${limit.monthly}, and you have bought ${monthly.get(name)}.`,
            flags: MessageFlags.Ephemeral
          })
        } else if (limit.perma && perma.get(name) + amount > limit.perma) {
          return await interaction.reply({
            content: `Purchase denied: cannot buy ${amount} of ${name}\nThe item's lifetime limit is ${limit.perma}, and you have had ${perma.get(name)}.`,
            flags: MessageFlags.Ephemeral
          })
        }

        if (item.get("shop_stock")) {
          item.set("shop_stock", parseInt(item.get("shop_stock")) - amount)
          await item.save()
        }
        profile.set("inventory", inventory.give({}, name, amount).toString())
        if (limit.monthly) profile.set("monthly_limit", monthly.give({}, name, amount))
        if (limit.perma) profile.set("perma_limit", perma.give({}, name, amount))
        await profile.save()


        await interaction.client.log(
          `**ITEM BOUGHT:** \` ${name} \` x${amount} by <@${profile.get("user_id")}>`
        )

        return await interaction.reply({
          content: `Bought \` ${name} \` x${amount}!`,
          embeds: [itemEmbed(item, interaction.user, true)]
        })

      } else if (interaction.options.getSubcommand() === "use") {
        let item = db.items.data.length ? db.items.find(row => row.get("item_name") == interaction.options.getString("use")) : []

        if (!item) throw new Error("The specified item could not be found!")

        await db.users.reload()
        let profile = db.users.find(row => row.get("user_id") == interaction.user.id)
        if (!profile) throw new Error("Your user profile could not be found!")

        await db.charas.reload()
        let chara = db.charas.find(row => row.get("chara_name") == interaction.options.getString("chara"))
        if (!chara) throw new Error("The specified character could not be found!")
        if (chara.get("owner") != interaction.user.id) throw new Error("This character does not belong to you!")

        const name = interaction.options.getString("use"),
          amount = interaction.options.getInteger("amount") ?? 1;

        const inventory = new Inventory(profile.get("inventory")),
          perma = new Inventory(profile.get("perma_limit"));

        try {
          inventory.take({}, name, amount)
        } catch (error) {
          console.log(error)
          return await interaction.reply({
            content: `Transaction denied: cannot take ${amount} of ${name}\nThe user does not possess enough of such item.`,
            flags: MessageFlags.Ephemeral
          })
        }

        if (item.get("category") == "Gacha") {
          let src = interaction.client.sheets.config.src;
          if (!src.sheetsById[item.get("gacha_src")]) src.loadInfo()

          let gacha = (await src.sheetsById[item.get("gacha_src")].getRows())
            ?.filter((row) => row.get("type") && row.get("reward"));

          if (!gacha.length) throw new Error("Gacha pool could not be found.")

          let res = {
            money: 0,
            xp: 0,
            items: new Inventory()
          },
            list = [];

          const getGacha = {
            money(rng, val) {
              res.money += parseInt(val)
              list.push([rng + 1, `${config("money_symbol")}${val}`])
            },
            xp(rng, val) {
              res.xp += parseInt(val)
              list.push([rng + 1, `${val}${config("xp_symbol")}`])
            },
            item(rng, val) {
              let gachaItem = db.items.find(row => row.get("item_name") == val)

              if (gachaItem) {
                let limit = {
                  hold: parseInt(gachaItem.get("hold_limit") || 0),
                  perma: parseInt(gachaItem.get("perma_limit") || 0)
                }

                if ((limit.hold && inventory.get(val) + 1 > limit.hold) || (limit.perma && perma.get(val) + 1 > limit.perma)) {
                  res.money += parseInt(gachaItem.get("price"))
                  list.push = [rng, `~~\` ${val} \`~~ ${config("money_symbol")}${gachaItem.get("price")}`]
                } else {
                  inventory.give({}, val)
                  res.items.give({}, val)
                  if (gachaItem.get("perma_limit")) perma.give({}, val)
                  list.push([rng, `\` ${val} \` x1\n`
                    + gachaItem.get("description").split("\n").map(x => `> ${x}`).join("\n")])
                }
              } else {
                list.push([rng + 1, `~~${val}~~`])
              }
            },
            other(rng, val) {
              list.push([rng + 1, val])
            }
          }

          for (let i = 0; i < amount; i++) {
            let rng = Math.floor(Math.random() * gacha.length);
            getGacha[gacha[rng].get("type")]?.(rng, gacha[rng].get("reward"))
          }

          await profile.assign({
            money: parseInt(profile.get("money")) + res.money,
            inventory: inventory.toString(),
            perma_limit: perma.toString()
          })
          await profile.save();
          chara.set("xp_points", parseInt(chara.get("xp_points")) + res.xp)
          await chara.save()

          await interaction.client.log(
            `**GACHA USED:** \` ${name} \` x${amount} by <@${profile.get("user_id")}> (for ${chara.get("chara_name")})\n`
            + `> **money:** ${res.money} (${profile.get("money")})\n> **xp:** ${res.xp} (${chara.get("xp_points")})\n`
            + (res.items.hasContents() ? res.items.toString().split("\n").map(x => `> ${x}`).join("\n") : "")
          )

          return await interaction.reply({
            content: `\` ${name} \` x${amount} used!`,
            embeds: [itemEmbed(item, interaction.user, true),
            {
              title: `${config("poke_symbol")} ${item.get("gacha_intro") || name}`,
              description: list.map(x => `\`${x[0]}\`: ${x[1]}`).join("\n"),
              footer: {
                text: item.get("gacha_outro")
              },
              color: color(config("default_color")),
              timestamp: new Date().getTime()
            }]
          })
        } else {
          profile.set("inventory", inventory.toString())
          await profile.save()

          await interaction.client.log(
            `**ITEM USED:** \` ${name} \` x${amount} by <@${profile.get("user_id")}> (for ${chara.get("chara_name")})`
          )

          return await interaction.reply({
            content: `\` ${name} \` x${amount} used!`,
            embeds: [itemEmbed(item, interaction.user, true)]
          })
        }
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
    const focused = interaction.options.getFocused(true);
    const db = interaction.client.db;

    // name = all items
    // buy = purchaseable items
    // use = owned items

    try {
      if (focused.value.length <= 1) await db.items.reload()

      if (focused.name === "chara") {
        if (focused.value.length <= 1) await db.charas.reload()

        let filtered = db.charas.data.length ? fuzzy.filter(focused.value, db.charas.filter(x => x.get("owner") == interaction.user.id), { extract: x => (x.get("chara_name") + " / " + x.get("fullname")).normalize('NFD').replace(/\p{Diacritic}/gu, '') }) : []
        if (filtered.length > 25) filtered.length = 25

        return await interaction.respond(
          filtered.map(choice => ({ name: choice.original.get("chara_name") + " / " + choice.original.get("fullname"), value: choice.original.get("chara_name") }))
        )
      } else if (focused.name === "name") {
        let filtered = db.items.data.length ? fuzzy.filter(focused.value, db.items.data.filter(x => x.get("item_name")), { extract: x => x.get("item_name")?.normalize('NFD').replace(/\p{Diacritic}/gu, '') }) : []
        if (filtered.length > 25) filtered.length = 25

        return await interaction.respond(
          filtered.map(choice => ({ name: choice.original.get("item_name"), value: choice.original.get("item_name") }))
        )
      } else if (focused.name === "buy") {

        let filtered = db.items.data.length ? fuzzy.filter(focused.value, db.items.data.filter(x => x.get("item_name")), { extract: x => x.get("item_name")?.normalize('NFD').replace(/\p{Diacritic}/gu, '') }) : []
        filtered = filtered.filter(x => x.original.get("in_shop") == "TRUE")
        if (filtered.length > 25) filtered.length = 25

        return await interaction.respond(
          filtered.map(choice => ({ name: choice.original.get("item_name"), value: choice.original.get("item_name") }))
        )
      } else if (focused.name === "use") {
        let profile;
        if (focused.value.length <= 1) await db.users.reload()

        profile = db.users.find(row => row.get("user_id") == interaction.user.id) ?? null;

        let filtered = db.items.data.length ? fuzzy.filter(focused.value, db.items.data.filter(x => x.get("item_name")), { extract: x => x.get("item_name")?.normalize('NFD').replace(/\p{Diacritic}/gu, '') }) : []
        if (profile) filtered = filtered.filter(item => new Inventory(profile.get("inventory")).checkHas({}, item.original.get("item_name")))
        if (filtered.length > 25) filtered.length = 25

        return await interaction.respond(
          filtered.map(choice => ({ name: choice.original.get("item_name"), value: choice.original.get("item_name") }))
        )
      }
    } catch (error) {
      console.log(error)
    }
  }
};