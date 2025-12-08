const { SlashCommandBuilder, MessageFlags } = require('discord.js'),
  { color, money, itemEmbed, diacritic, toTitleCase } = require("../module/helpers.js"),
  { award } = require("../module/transactions.js"),
  { Inventory } = require('../module/inventory.js'),
  fuzzy = require("fuzzy");
const chara = require('./chara.js');

module.exports = {
  name: "mass-give",
  slash: new SlashCommandBuilder()
    .setName('mass-give')
    .setDescription(`Give something to all...`)
    .addSubcommandGroup(group => group.setName("charas")
      .setDescription("For character-related transactions.")
      .addSubcommand(subcommand => subcommand.setName("faction")
        .setDescription("Give rewards to a faction.")
        .addStringOption(option => option.setName("faction")
          .setDescription("The faction receiving rewards.")
          .setChoices(
            { name: "🔷 The Cartel", value: "cartel" },
            { name: "🟢 The Triad", value: "triad" }
          )
          .setRequired(true)
        )
        .addIntegerOption(option => option.setName("rep")
          .setDescription("The amount of Reputation to give.")
          .setMinValue(1)
          .setMaxValue(9999)
        )
        .addIntegerOption(option => option.setName("heat")
          .setDescription("The amount of Heat to give.")
          .setMinValue(1)
          .setMaxValue(5)
        )
        .addBooleanOption(option => option.setName("include-npcs")
          .setDescription("Include NPCs within the transaction.")
        )
      )
      .addSubcommand(subcommand => subcommand.setName("family")
        .setDescription("Give rewards to a family.")
        .addStringOption(option => option.setName("family")
          .setDescription("The family receiving rewards.")
          .setAutocomplete(true)
          .setRequired(true)
        )
        .addIntegerOption(option => option.setName("rep")
          .setDescription("The amount of Reputation to give.")
          .setMinValue(1)
          .setMaxValue(9999)
        )
        .addIntegerOption(option => option.setName("heat")
          .setDescription("The amount of Heat to give.")
          .setMinValue(1)
          .setMaxValue(5)
        )
        .addBooleanOption(option => option.setName("include-npcs")
          .setDescription("Include NPCs within the transaction.")
        )
      )
      .addSubcommand(subcommand => subcommand.setName("group")
        .setDescription("The reward_group (check sheet) receiving rewards.")
        .addStringOption(option => option.setName("group")
          .setDescription("The group receiving the money.")
          .setAutocomplete(true)
          .setRequired(true)
        )
        .addIntegerOption(option => option.setName("rep")
          .setDescription("The amount of Reputation to give.")
          .setMinValue(1)
          .setMaxValue(9999)
        )
        .addIntegerOption(option => option.setName("heat")
          .setDescription("The amount of Heat to give.")
          .setMinValue(1)
          .setMaxValue(5)
        )
      )
      .addSubcommand(subcommand => subcommand.setName("all-charas")
        .setDescription("Give rewards to all characters.")
        .addIntegerOption(option => option.setName("rep")
          .setDescription("The amount of Reputation to give.")
          .setMinValue(1)
          .setMaxValue(9999)
        )
        .addIntegerOption(option => option.setName("heat")
          .setDescription("The amount of Heat to give.")
          .setMinValue(1)
          .setMaxValue(5)
        )
        .addBooleanOption(option => option.setName("include-npcs")
          .setDescription("Include NPCs within the transaction.")
        )
      ))
    .addSubcommandGroup(group => group.setName("users")
      .setDescription("For user-related transactions.")
      .addSubcommand(subcommand => subcommand.setName("tagged")
        .setDescription("Give to all tagged users/roles.")
        .addStringOption(option => option.setName("tags")
          .setDescription("The targeted users/roles.")
          .setRequired(true)
        )
        .addIntegerOption(option => option.setName("money")
          .setDescription("The amount of Money to give.")
          .setMinValue(1)
        )
        .addStringOption(option => option.setName("item")
          .setDescription("The item to receive.")
          .setAutocomplete(true)
        )
        .addIntegerOption(option => option.setName("item-amt")
          .setDescription("The number of items to receive.")
          .setMinValue(1)
        )
        .addStringOption(option => option
          .setName("item-list")
          .setDescription("A list of multiple items to receive. Format: Item 1 (x1) | Item 2 (x2)")
        )
      )
      .addSubcommand(subcommand => subcommand.setName("all-users")
        .setDescription("Give to ALL users.")
        .addIntegerOption(option => option.setName("money")
          .setDescription("The amount of Money to give.")
          .setMinValue(1)
        )
        .addStringOption(option => option.setName("item")
          .setDescription("The item to receive.")
          .setAutocomplete(true)
        )
        .addIntegerOption(option => option.setName("item-amt")
          .setDescription("The number of items to receive.")
          .setMinValue(1)
        )

        .addStringOption(option => option
          .setName("item-list")
          .setDescription("A list of multiple items to receive. Format: Item 1 (x1) | Item 2 (x2)")
        )
      )
    )
  ,
  async parse(interaction) {
    return await this.execute(interaction.client, {
      source: interaction,
      commandGroup: interaction.options.getSubcommandGroup(),
      command: interaction.options.getSubcommand(),

      faction: interaction.options.getString("faction"),
      family: interaction.options.getString("family"),
      group: interaction.options.getString("group"),
      includeNpcs: interaction.options.getBoolean("include-npcs") || false,

      heat: interaction.options.getInteger("heat"),
      reputation: interaction.options.getInteger("rep"),

      tags: interaction.options.getString("tags"),
      money: interaction.options.getInteger("money"),
      item: interaction.options.getString("item"),
      itemAmt: interaction.options.getInteger("item-amt") || 1,
      itemList: interaction.options.getString("item-list"),
    })
  },
  async execute(client, input) {
    const db = client.db;
    let change = {
      money: input.money,
      heat: input.heat,
      reputation: input.reputation,
    }, givingTo, charas = [], users = [];

    if (input.itemList || input.item) await db.items.reload()
    if (input.itemList) {
      change.items = new Inventory(
        input.itemList.split("|").map(x => x.trim()).filter(x => x).join("\n")
        + (input.item ? `\n${input.item} (x${input.itemAmt || 1})` : "")
      ).validate(client)
    } else if (input.item) change.items = new Inventory(`${input.item} (x${input.itemAmt || 1})`);

    if (!change.money && !change.items && !change.heat && !change.reputation && !change.statuses) throw new Error("No changes given.")

    try {
      if (input.commandGroup == "charas") {
        await db.charas.reload()

        if (input.command == "all-charas") {
          charas.push(...db.charas.filter(char => char.get("chara_name")))
          givingTo = "all characters"
        }
        else if (input.command == "faction") {
          charas.push(...db.charas.filter(char => char.get("faction") == input.faction))
          givingTo = toTitleCase(input.faction) + " members"
        }
        else if (input.command == "family") {
          charas.push(...db.charas.filter(char => char.get("family") == input.family))
          givingTo = `the ${input.family} family`
        }
        else if (input.command == "group") {
          charas.push(...db.charas.filter(char => char.get("reward_group") == input.group))
          givingTo = `our ${input.group} of the night`
        }

        if (!input.includeNpcs && input.command != "group") charas = charas.filter(char => char.get("is_npc") != "TRUE")


      } else if (input.commandGroup == "users") {
        await db.users.reload()

        if (input.item) await db.items.reload()

        if (input.command == "all-users") {
          users = db.users.filter(user => user.get("user_id")) || [];

          givingTo = `all users`

        } else if (input.command == "tagged") {
          let filter = input.tags.match(/(?<=<@)\d+(?=>)/g) || []

          let roles = input.tags.match(/(?<=<@&)\d+(?=>)/g) || []
          for (let r of roles) {
            let guild = input.source.guild;
            if (!guild) throw new Error("Could not access guild roles.")

            let role = await guild.roles.fetch(r);
            if (role) filter.push(...role.members.keys())
          }

          users = db.users.filter(user => filter.includes(user.get("user_id")))
          givingTo = input.tags.replace(/  +/g, " ")
        }
      }

      if (input.source.replied) throw new Error("Transaction already processed!")

      await input.source.reply({
        embeds: [{
          description: `Granting rewards to ${givingTo}...`,
          footer: {
            text:
              ((input.commandGroup == "charas") ? "APPLICABLE CHARACTERS: " + charas.map(x => x.get("chara_name")).join(` ${client.config("decorative_symbol")} `) : "")
              + ((input.commandGroup == "users") ? "APPLICABLE USERS: " + users.map(x => x.get("display_name")).join(` ${client.config("decorative_symbol")} `) : ""),
          },
          color: color(client.config("default_color"))
        }, {
          description: `Please wait while these transactions are processed...`,
          color: color(client.config("default_color"))
        }],
        withResponse: true
      });

      let result, successCnt = 0, failed = [];

      if (input.commandGroup == "charas") {
        result = await Promise.all(charas.map(chara => award(input.source, { chara }, change, { noReplyCheck: true, toCap: true })))
      } else if (input.commandGroup == "users") {
        result = await Promise.all(users.map(user => award(input.source, { profile: user }, change, { noReplyCheck: true, toCap: true })))
      }

      for (let i = 0; i < result.length; i++) {
        if (result[i].success) {
          successCnt++;
        } else {
          if (input.commandGroup == "charas") {
            failed.push(charas[i].get("chara_name"))
          } else if (input.commandGroup == "users") {
            failed.push(users[i].get("display_name"))
          }
        }
      }

      if (successCnt == 0) {
        return await input.source.followUp({
          content: "Transactions failed! There may be an issue with Google Sheets right now."
        })
      }

      const embeds = [];

      if (change.money) {
        embeds.push({
          description: `**${money(input.money, client)}** awarded!`,
          color: color(client.config("default_color"))
        })
      }
      if (change.items) {
        let items = change.items.entries();

        if (items.length == 1) {
          let item = db.items.find(row => row.get("item_name") == items[0][0]);

          embeds.push({
            description: `**${items[0][0]} (x${items[0][1] || 1})** awarded!`,
            color: color(client.config("default_color"))
          },
            itemEmbed(item, client, true))
        } else {
          embeds.push({
            description: `Items awarded:\n`
              + change.items.toString().split("\n").map(x => `> ${x}`).join("\n"),
            color: color(client.config("default_color"))
          })
        }
      }

      if (change.heat) {
        embeds.push({
          description: `**${input.heat} Heat** gained!`,
          color: color(client.config("default_color"))
        })
      }
      if (change.reputation) {
        embeds.push({
          description: `**${input.reputation} Reputation** gained!`,
          color: color(client.config("default_color"))
        })
      }

      let endResult = (await input.source.followUp({
        content: `${successCnt}/${result.length} transactions succeeded!`
          + ((result.length > successCnt)
            ? "\n\n-# Failed for: " + failed.join(` ${client.config("decorative_symbol")} `)
            + "\n-# This may be due to an stat/item cap being hit, or Google Sheets may just be uncooperative."
            : ""),
        embeds,
        withResponse: true
      }));

      let log = {
        money: [],
        heat: [],
        rep: [],
      };

      if (input.commandGroup == "charas") {
        for (let i in result) {
          if (result[i].success) {
            for (let l of result[i].log) {
              if (l.includes("heat")) {
                log.heat.push(`> **${charas[i].get("chara_name")}**: ` + /(?<=\()(.+)(?=\))/.exec(l)[0])
              } else if (l.includes("reputation")) {
                log.rep.push(`> **${charas[i].get("chara_name")}**: ` + /(?<=\()(.+)(?=\))/.exec(l)[0])
              }
            }
          }
        }
      } else if (input.commandGroup == "users") {
        for (let i in result) {
          if (result[i].success) {
            for (let l of result[i].log) {
              if (l.includes("money")) {
                log.money.push(`> <@${users[i].get("user_id")}>: ` + /(?<=\()(.+)(?=\))/.exec(l)[0])
              }
            }
          }
        }
      }

      if (log.money.length) {
        client.log(
          `**MASS GIVE: ** money`
          + "\n" + log.money.join("\n"),
          {
            sender: input.source.user.id,
            url: endResult?.url
          }
        )
      }
      if (change.items && !change.items.isEmpty()) {
        client.log(
          `**MASS GIVE: ** item`
          + "\n" + change.items?.toString().split("\n").map(x => `> - ${x}`).join("\n")
          + "\n\n" + users.map(x => `<@${x.get("user_id")}>`).filter((v, i) => result[i].success).join(", "),
          {
            sender: input.source.user.id,
            url: endResult?.url
          }
        )
      }

      if (log.heat.length) {
        client.log(
          `**MASS GIVE: ** heat +${change.heat}`
          + "\n" + log.heat.join("\n"),
          {
            sender: input.source.user.id,
            url: endResult?.url
          }
        )
      }
      if (log.rep.length) {
        client.log(
          `**MASS GIVE: ** reputation +${change.reputation}`
          + "\n" + log.rep.join("\n"),
          {
            sender: input.source.user.id,
            url: endResult?.url
          }
        )
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
    try {
      const focused = interaction.options.getFocused(true);
      const db = interaction.client.db;

      if (focused.value.length <= 1) {
        if (focused.name == "item") db.items.reload()
        else await db.charas.reload()
      }

      if (focused.name === "family") {
        let families = {};
        db.charas.forEach(chara => {
          if (!chara.get("family")) return
          if (!families[chara.get("family")]) families[chara.get("family")] = chara.get("faction")
        })

        let filtered = fuzzy.filter(focused.value, Object.entries(families), { extract: ([fam, fac]) => diacritic(fam) })
        filtered.sort((a, b) => a.original[0].localeCompare(b.original[0]))
        if (filtered.length > 25) filtered.length = 25

        let factions = new Map([...db.factions.map(fac => [fac.get("faction_name"), fac])])

        return await interaction.respond(
          filtered.map(choice => ({
            name: `${factions.get(choice.original[1])?.get("simple_emoji") || interaction.client.config("decorative_symbol")} ${choice.original[0]}`,
            value: choice.original[0]
          }))
        )
      } else if (focused.name === "group") {
        if (focused.value.length <= 1) await db.items.reload()

        let data = [... new Set(db.charas.filter(x => x.get("reward_group")).map(x => x.get("reward_group")))].sort()
        let filtered = fuzzy.filter(focused.value, data)
        if (filtered.length > 25) filtered.length = 25

        return await interaction.respond(
          filtered.map(choice => ({ name: choice.original, value: choice.original }))
        )
      }
      else if (focused.name === "item") {
        if (focused.value.length <= 1) await db.items.reload()

        let data = db.items.filter(item => item.get("item_name") && item.get("category"))

        let filtered = fuzzy.filter(diacritic(focused.value), data, { extract: x => diacritic(x.get("item_name")) })
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