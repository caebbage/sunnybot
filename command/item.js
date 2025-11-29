const { SlashCommandBuilder, MessageFlags } = require('discord.js'),
  fuzzy = require("fuzzy"),
  { itemEmbed, color, money, diacritic, randBetween } = require("../module/helpers.js"),
  { drawPool } = require("../module/gacha.js"),
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
        .setName("item")
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
        .setName("item")
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
              (!shop.length ? "\n-# Nothing here yet! Check back later!" : "") +
              shop.map(
                val => `### ${val[0]}\n` + val[1].map(
                  item => `> \` ${item.item_name} \` ― ${money(item.price || "???", client)}`
                    + (item.shop_stock ? ` (${item.shop_stock} in stock)` : "")).join("\n")
              ).join("\n"),
            color: color(config("default_color")),
            timestamp: new Date().toISOString()
          }],
          flags: (input.hide ? MessageFlags.Ephemeral : undefined)
        })

      } else if (input.command === "buy") {
        let item = db.items.data.length ? db.items.find(row => row.get("item_name") == input.item) : []

        if (!item) throw new Error("The specified item could not be found!")

        await db.users.reload()
        let profile = db.users.find(row => row.get("user_id") == input.user)
        if (!profile) throw new Error("Your user profile could not be found!")

        const name = item.get("item_name"),
          amount = input.amount ?? 1;

        let moneyChange = {};

        moneyChange.old = +(profile.get("money") || 0)
        moneyChange.deduct = amount * item.get("price")
        moneyChange.new = moneyChange.old - moneyChange.deduct

        if (item.get("shop_stock") === "0" || (item.get("shop_stock") && +item.get("shop_stock") - amount < 0)) {
          throw new Error(`Purchase denied: cannot buy ${amount} of ${name}\nThere is not enough stock.`)

        } else if (!item.get("price") || isNaN(item.get("price")) || item.get("in_shop") !== "TRUE") {
          throw new Error(`Purchase denied: cannot buy ${name}\nThe item is unpurchaseable.`)

        } else if (moneyChange.new < 0) {
          throw new Error(`Purchase denied: cannot buy ${amount} of ${name}\nInsufficient funds. `
            + `This costs ${money(moneyChange.deduct, client)}, and you have ${money(moneyChange.old, client)}.`)

        }

        let inventory = new Inventory(profile.get("inventory")),
          limit = {
            hold: parseInt(item.get("hold_limit")) || null,
            daily: parseInt(item.get("daily_limit")) || null,
            monthly: parseInt(item.get("monthly_limit")) || null,
            perma: parseInt(item.get("perma_limit")) || null
          },
          daily = new Inventory(profile.get("daily_limit")),
          monthly = new Inventory(profile.get("monthly_limit")),
          perma = new Inventory(profile.get("perma_limit"));

        if (limit.hold && inventory.get(name) + amount > limit.hold) {
          throw new Error(`Purchase denied: cannot buy ${amount} of ${name}\nThe item's holding limit is ${limit.hold}, and you are holding ${inventory.get(name)}.`)

        } else if (limit.daily && daily.get(name) + amount > limit.daily) {
          throw new Error(`Purchase denied: cannot buy ${amount} of ${name}\nThe item's daily limit is ${limit.daily}, and you have bought ${daily.get(name)}.`)

        } else if (limit.monthly && monthly.get(name) + amount > limit.monthly) {
          throw new Error(`Purchase denied: cannot buy ${amount} of ${name}\nThe item's monthly limit is ${limit.monthly}, and you have bought ${monthly.get(name)}.`)

        } else if (limit.perma && perma.get(name) + amount > limit.perma) {
          throw new Error(`Purchase denied: cannot buy ${amount} of ${name}\nThe item's lifetime limit is ${limit.perma}, and you have had ${perma.get(name)}.`)

        }

        if (item.get("shop_stock")) {
          if (input.source.replied) throw new Error("Transaction already processed!")
          item.set("shop_stock", parseInt(item.get("shop_stock")) - amount)
          await item.save()
        }

        profile.set("money", moneyChange.new)
        profile.set("inventory", inventory.giveItem(name, amount).toString())
        if (limit.daily) profile.set("daily_limit", daily.giveItem(name, amount).toString())
        if (limit.monthly) profile.set("monthly_limit", monthly.giveItem(name, amount).toString())
        if (limit.perma) profile.set("perma_limit", perma.giveItem(name, amount).toString())

        if (input.source.replied) throw new Error("Transaction already processed!")
        await profile.save()

        let response = (await input.source.reply({
          content: `Bought **${name} (x${amount}) for ${money(moneyChange.deduct, client)}**!`,
          embeds: [itemEmbed(item, client, true)],
          withResponse: true
        }))?.resource?.message

        return await client.log(
          `**ITEM BOUGHT:** ${name} x${amount} by <@${profile.get("user_id")}>`
          + `\n> **money:** -${moneyChange.deduct} (${moneyChange.old} → ${moneyChange.new})`,
          { url: response.url }
        )

      } else if (input.command === "use") {
        let response = (await input.source.deferReply({ withResponse: true }))?.resource?.message,
          embeds = [];

        let item = db.items.data.length ? db.items.find(row => row.get("item_name") == input.item) : []

        if (!item) throw new Error("The specified item could not be found!")

        if (item.get("protected")?.toUpperCase() === "TRUE") throw new Error("This item is unusable; ping mods if you'd like to toss it!")

        await db.users.reload()
        let profile = db.users.find(row => row.get("user_id") == input.user)
        if (!profile) throw new Error("Your user profile could not be found!")

        const name = input.item,
          amount = input.amount ?? 1;

        if (item.get("use_cap") && amount > +item.get("use_cap") || amount > 10) throw new Error(`You may only use ${item.get("use_cap" || 10)} ${input.item} at a time!`)

        const inventory = new Inventory(profile.get("inventory")),
          perma = new Inventory(profile.get("perma_limit"));

        try {
          inventory.takeItem(name, amount)
        } catch (error) {
          console.log(error)
          throw new Error(`Transaction denied: cannot use ${amount} of ${name}\nYou don't have that many!`)
        }

        embeds.push(itemEmbed(item, client, true))

        if (item.get("use_text")) {
          let text = item.get("use_text");
          let repl = text.match(/\{\{.+?\}\}/g);

          if (repl) {
            repl.forEach(match => {
            if (match.includes("RANGE")) {
              let params = /RANGE: ?(?<min>-?[0-9.]+) TO (?<max>-?[0-9.]+)(?: ROUNDTO (?<decimals>\d+))?/i.exec(match)?.groups;
              params.min = +(params.min)
              params.max = +(params.max)
              if (!params.min || !params.max) return
              if (params.decimals) params.decimals = +params.decimals

              text = text.replace(match, randBetween(params.min, params.max, params.decimals || 0))
            }
          })
          }

          embeds.push({
            description: text,
            color: color(config("default_color"))
          })
        }

        if (!item.get("gacha_src")) {
          profile.set("inventory", inventory.toString())

          if (input.source.replied) throw new Error("Transaction already processed!")
          await profile.save()

          await client.log(
            `**ITEM USED:** ${name} (x${amount}) by <@${profile.get("user_id")}>`,
            { url: response.url }
          )
        } else {
          let src = client.sheets.config.src;
          if (!src.sheetsById[item.get("gacha_src")]) src.loadInfo()

          let gacha = (await src.sheetsById[item.get("gacha_src")].getRows())
            ?.filter((row) => row.get("weight") && row.get("type") && row.get("value")).map(x => x.toObject());

          if (!gacha.length) throw new Error("Gacha pool could not be found.")

          let res = {
            money: 0,
            items: new Inventory()
          },
            list = [],
            mult = (+item.get("gacha_amount") || 1);

          const getGacha = {
            money(val) {
              res.money += parseInt(val)
              list.push(money(val, client) + "\n> Yay, money!")
            },
            item(val) {
              let gachaItem = db.items.find(row => row.get("item_name") == val)

              if (gachaItem) {
                let ico = gachaItem.get("emoji") || client.config("default_item_emoji")

                let limit = {
                  hold: parseInt(gachaItem.get("hold_limit") || 0),
                  perma: parseInt(gachaItem.get("perma_limit") || 0)
                }

                if ((limit.hold && inventory.get(val) + 1 > limit.hold) || (limit.perma && perma.get(val) + 1 > limit.perma)) {
                  res.money += parseInt(gachaItem.get("price"))
                  list.push(`~~${ico} ${val}~~ → **${money(gachaItem.get("price") || 0, client)}**`)
                } else {
                  inventory.giveItem(val)
                  res.items.giveItem(val)
                  if (gachaItem.get("perma_limit")) perma.giveItem(val)
                  list.push(`${ico} ${val} (x1)\n`
                    + ((mult == 1) ? gachaItem.get("description").split("\n").map(x => `> ${x}`).join("\n") : "")
                  )
                }
              } else {
                list.push(`~~${val}~~`)
              }
            },
            other(val) {
              let text = val;
              let repl = text.match(/\{\{.+?\}\}/g);

              if (repl) {
                repl.forEach(match => {
                  if (match.includes("RANGE")) {
                    let params = /RANGE: ?(?<min>-?[0-9.]+) TO (?<max>-?[0-9.]+)(?: ROUNDTO (?<decimals>\d+))?/i.exec(match)?.groups;
                    params.min = +(params.min)
                    params.max = +(params.max)
                    if (!params.min || !params.max) return
                    if (params.decimals) params.decimals = +params.decimals

                    text = text.replace(match, randBetween(params.min, params.max, params.decimals || 0))
                  }
                })
              }

              list.push([text])
            }
          }

          drawPool(gacha, amount * mult).forEach(res => {
            getGacha[res.type]?.(res.value)
          })

          oldValue = profile.get("money");

          if (input.source.replied) throw new Error("Transaction already processed!")
          await profile.assign({
            money: +oldValue + res.money,
            inventory: inventory.toString(),
            perma_limit: perma.toString()
          })

          embeds.push({
            title: `${config("decorative_symbol")} ${item.get("gacha_intro") || name}`.toUpperCase(),
            description: list.map(x => `### ${x}`).join("\n"),
            footer: {
              text: item.get("gacha_outro")
            },
            color: color(config("default_color")),
            timestamp: new Date().toISOString()
          })

          await profile.save();

          await client.log(
            `**GACHA USED:** ${name} (x${amount}) by <@${profile.get("user_id")}>\n`
            + (res.money != 0 ? `> **money:** ${res.money > 0 ? "+" : ""}${res.money} (${oldValue} → ${profile.get("money")})\n` : "")
            + (!res.items.isEmpty() ? res.items.toString().split("\n").map(x => `> ${x}`).join("\n") : ""),
            { url: response.url }
          )
        }

        return await input.source.editReply({
          content: `**${name} (x${amount})** used!`,
          embeds
        })
      }
    } catch (error) {
      console.log(error);
      if (input.source.replied || input.source.deferred) {
        return await input.source.followUp({
          content: "An error occurred:\n" + error.message.split("\n").map(x => `> -# ${x}`).join("\n"),
          flags: MessageFlags.Ephemeral
        })
      }
      return await input.source.reply({
        content: "An error occurred:\n" + error.message.split("\n").map(x => `> -# ${x}`).join("\n"),
        flags: MessageFlags.Ephemeral
      })
    }
  },
  async autocomplete(interaction) {
    const options = interaction.options,
      focused = options.getFocused(true),
      db = interaction.client.db;

    // item = all items
    // buy = purchaseable items
    // use = owned items

    try {
      if (focused.value.length <= 1) await db.items.reload()

      if (options.getSubcommand() === "info") {
        let data = db.items.filter(item => item.get("item_name") && item.get("category"))
        let filtered = fuzzy.filter(diacritic(focused.value), data, { extract: x => diacritic(x.get("item_name")) })

        if (filtered.length > 25) filtered.length = 25

        return await interaction.respond(
          filtered.map(choice => ({ name: choice.original.get("item_name"), value: choice.original.get("item_name") }))
        )
      } else if (options.getSubcommand() === "buy") {

        let data = db.items.filter(item => item.get("item_name") && item.get("category")
          && item.get("in_shop")?.toUpperCase() == "TRUE" && item.get("price") && !isNaN(item.get("price")) && item.get("shop_stock") !== "0")

        let filtered = fuzzy.filter(diacritic(focused.value), data, { extract: x => diacritic(x.get("item_name")) })
        if (filtered.length > 25) filtered.length = 25

        return await interaction.respond(
          filtered.map(choice => ({ name: choice.original.get("item_name"), value: choice.original.get("item_name") }))
        )
      } else if (options.getSubcommand() === "use") {
        if (focused.value.length <= 1) await db.users.reload()

        let profile = db.users.find(row => row.get("user_id") == interaction.user.id),
          inventory = new Inventory(profile?.get("inventory"));

        let data = db.items.data.filter(x => x.get("item_name") && x.get("protected")?.toUpperCase() !== "TRUE")
        if (profile) data = data.filter(item => inventory.hasItem(item.get("item_name")))

        let filtered = fuzzy.filter(diacritic(focused.value), data, { extract: x => diacritic(x.get("item_name")) })
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