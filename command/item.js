const { SlashCommandBuilder, MessageFlags } = require('discord.js'),
  fuzzy = require("fuzzy"),
  { itemEmbed, drawPool, color, money } = require("../module/helpers.js"),
  { Inventory } = require("../module/inventory.js");

module.exports = {
  name: "item",
  slash: new SlashCommandBuilder()
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
        .setName("item")
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
      .addIntegerOption(option => option
        .setName("amount")
        .setDescription("The amount to use of the item.")
        .setMinValue(1)
        .setMaxValue(100)
      )
    ),
  async parse(interaction) {
    return await this.execute(interaction.client, {
      source: interaction,
      user: interaction.user.id,
      command: interaction.options.getSubcommand(),
      item: interaction.options.getString("item"),
      buy: interaction.options.getString("buy"),
      use: interaction.options.getString("use"),
      amount: interaction.options.getInteger("amount"),
      hide: interaction.options.getBoolean("hide") ?? false
    })
  },
  async execute(client, input) {
    const db = client.db,
      config = client.config;

    try {
      await db.items.reload()

      if (input.command === "info") {
        let item = db.items.data.length ? db.items.find(row => row.get("item_name") == input.item) : []

        if (!item) throw new Error("The specified item could not be found!")

        return await input.source.reply({
          embeds: [itemEmbed(item, client)],
          flags: input.hide ? MessageFlags.Ephemeral : undefined
        })

      } else if (input.command === "shop") {
        const stock = db.items.filter(row => row.get("in_shop") == "TRUE"),
          shop = [...new Set(stock.map(item => item.get("category")))].map(
            cat => [cat, stock.filter(item => item.get("category") == cat).map(item => item.toObject())]);

        input.source.reply({
          embeds: [{
            title: `${config("decorative_symbol")} SHOP`,
            thumbnail: {
              url: config("default_image")
            },
            description:
              "Use `/item info` to see an item's information,\nand `/item buy` to purchase!\n" +
              shop.map(
                val => `### ${val[0]}\n` + val[1].map(
                  item => `> \` ${item.item_name} \`   ${item.price ? money(item.price, client) : "Unmarked"}`
                    + (item.shop_stock ? ` (${item.shop_stock} in stock)` : "")).join("\n")
              ).join("\n"),
            color: color(config("default_color")),
            timestamp: new Date().toISOString()
          }]
        })

      } else if (input.command === "buy") {
        let item = db.items.data.length ? db.items.find(row => row.get("item_name") == input.buy) : []

        if (!item) throw new Error("The specified item could not be found!")

        await db.users.reload()
        let profile = db.users.find(row => row.get("user_id") == input.user)
        if (!profile) throw new Error("Your user profile could not be found!")

        const name = item.get("item_name"),
          amount = input.amount ?? 1;

        if (item.get("shop_stock") === "0") {
          throw new Error(`Purchase denied: cannot buy ${amount} of ${name}\nThere is not enough stock.`)

        } else if (!item.get("price") || item.get("in_shop") !== "TRUE") {
          throw new Error(`Purchase denied: cannot buy ${amount} of ${name}\nThe item is unpurchaseable.`)

        } else if (parseInt(item.get("price")) * amount > parseInt(profile.get("money"))) {
          throw new Error(`Purchase denied: cannot buy ${amount} of ${name}\nInsufficient funds. This costs ${money(parseInt(item.get("price")) * amount, client)}, and you have ${money(profile.get("money"), client)}.`)

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
          throw new Error(`Purchase denied: cannot buy ${amount} of ${name}\nThe item's holding limit is ${limit.hold}, and you are holding ${inventory.get(name)}.`)

        } else if (limit.monthly && monthly.get(name) + amount > limit.monthly) {
          throw new Error(`Purchase denied: cannot buy ${amount} of ${name}\nThe item's monthly limit is ${limit.monthly}, and you have bought ${monthly.get(name)}.`)

        } else if (limit.perma && perma.get(name) + amount > limit.perma) {
          throw new Error(`Purchase denied: cannot buy ${amount} of ${name}\nThe item's lifetime limit is ${limit.perma}, and you have had ${perma.get(name)}.`)

        }

        if (item.get("shop_stock")) {
          item.set("shop_stock", parseInt(item.get("shop_stock")) - amount)
          await item.save()
        }
        profile.set("inventory", inventory.giveItem(name, amount).toString())
        if (limit.monthly) profile.set("monthly_limit", monthly.giveItem(name, amount).toString())
        if (limit.perma) profile.set("perma_limit", perma.giveItem(name, amount).toString())
        await profile.save()


        await client.log(
          `**ITEM BOUGHT:** ${name} x${amount} by <@${profile.get("user_id")}>`,

        )

        return await input.source.reply({
          content: `Bought ${name} (x${amount})!`,
          embeds: [itemEmbed(item, client, true)]
        })

      } else if (input.command === "use") {
        let item = db.items.data.length ? db.items.find(row => row.get("item_name") == input.use) : []

        if (!item) throw new Error("The specified item could not be found!")

        await db.users.reload()
        let profile = db.users.find(row => row.get("user_id") == input.user)
        if (!profile) throw new Error("Your user profile could not be found!")

        const name = input.use,
          amount = input.amount ?? 1;

        const inventory = new Inventory(profile.get("inventory")),
          perma = new Inventory(profile.get("perma_limit"));

        try {
          inventory.takeItem(name, amount)
        } catch (error) {
          console.log(error)
          throw new Error(`Transaction denied: cannot take ${amount} of ${name}\nThe user does not possess enough of such item.`)
        }

        if (item.get("category") == "Gacha") {
          let src = client.sheets.config.src;
          if (!src.sheetsById[item.get("gacha_src")]) src.loadInfo()

          let gacha = (await src.sheetsById[item.get("gacha_src")].getRows())
            ?.filter((row) => row.get("weight") && row.get("type") && row.get("value")).map(x => x.toObject());

          if (!gacha.length) throw new Error("Gacha pool could not be found.")

          let res = {
            money: 0,
            items: new Inventory()
          },
            list = [];

          const getGacha = {
            money(val) {
              res.money += parseInt(val)
              list.push(money(val, client))
            },
            item(val) {
              let gachaItem = db.items.find(row => row.get("item_name") == val)

              if (gachaItem) {
                let limit = {
                  hold: parseInt(gachaItem.get("hold_limit") || 0),
                  perma: parseInt(gachaItem.get("perma_limit") || 0)
                }

                if ((limit.hold && inventory.get(val) + 1 > limit.hold) || (limit.perma && perma.get(val) + 1 > limit.perma)) {
                  res.money += parseInt(gachaItem.get("price"))
                  list.push(`~~${val}~~ → ${money(gachaItem.get("price"), client)}`)
                } else {
                  inventory.giveItem(val)
                  res.items.giveItem(val)
                  if (gachaItem.get("perma_limit")) perma.giveItem(val)
                  list.push(`${val} (x1)\n`
                    + gachaItem.get("description").split("\n").map(x => `> ${x}`).join("\n"))
                }
              } else {
                list.push(`~~${val}~~`)
              }
            },
            other(val) {
              list.push([val])
            }
          }

          drawPool(gacha, amount).forEach(res => {
            getGacha[res.type]?.(res.value)
          })

          oldValue = profile.get("money");

          await profile.assign({
            money: +oldValue + res.money,
            inventory: inventory.toString(),
            perma_limit: perma.toString()
          })
          await profile.save();

          await client.log(
            `**GACHA USED:** ${name} (x${amount}) by <@${profile.get("user_id")}>\n`
            + `> **money:** ${res.money >= 0 ? "+" : ""}${res.money} (${oldValue} → ${profile.get("money")})\n`
            + (!res.items.isEmpty() ? res.items.toString().split("\n").map(x => `> ${x}`).join("\n") : "")
          )

          return await input.source.reply({
            content: `${name} (x${amount}) used!`,
            embeds: [itemEmbed(item, client, true),
            {
              title: `${config("decorative_symbol")} ${item.get("gacha_intro") || name}`.toUpperCase(),
              description: list.join("\n\n"),
              footer: {
                text: item.get("gacha_outro")
              },
              color: color(config("default_color")),
              timestamp: new Date().toISOString()
            }]
          })
        } else {
          profile.set("inventory", inventory.toString())
          await profile.save()

          await client.log(
            `**ITEM USED:** ${name} (x${amount}) by <@${profile.get("user_id")}>`
          )

          return await input.source.reply({
            content: `${name} (x${amount}) used!`,
            embeds: [itemEmbed(item, interaction.user, true)]
          })
        }
      }
    } catch (error) {
      console.log(error);
      return await input.source.reply({
        content: "An error occurred:\n" + error.message.split("\n").map(x => `> -# ${x}`).join("\n"),
        // flags: MessageFlags.Ephemeral
      })
    }
  },
  async autocomplete(interaction) {
    const focused = interaction.options.getFocused(true);
    const db = interaction.client.db;

    // item = all items
    // buy = purchaseable items
    // use = owned items

    try {
      if (focused.value.length <= 1) await db.items.reload()

      if (focused.name === "item") {
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
        if (profile) filtered = filtered.filter(item => new Inventory(profile.get("inventory")).hasItem(item.original.get("item_name")))
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