const { SlashCommandBuilder, MessageFlags } = require('discord.js'),
  { color, money, itemEmbed, diacritic, toTitleCase } = require("../module/helpers.js"),
  { drawPool } = require("../module/gacha.js"),
  { award } = require("../module/transactions.js"),
  { Inventory } = require('../module/inventory.js'),
  fuzzy = require("fuzzy");

module.exports = {
  name: "casino",
  slash: new SlashCommandBuilder()
    .setName('casino')
    .setDescription(`Play in the casino!`)
    .addSubcommandGroup(group => group.setName("roulette")
      .setDescription("Spin the roulette. Gamble on...")
      .addSubcommand(subcommand => subcommand.setName("outside")
        .setDescription("...An outside bet. (Higher probability, lower reward.)")
        .addIntegerOption(option => option.setName("bet")
          .setDescription("The number of chips you're betting.")
          .setMinValue(100)
          .setRequired(true)
        )
        .addStringOption(option => option.setName("wager")
          .setDescription("The bet to play.")
          .setChoices(
            { name: "🟥 Reds (1/2 chance, 2x bet)", value: "reds" },
            { name: "⬛ Blacks (1/2 chance, 2x bet)", value: "blacks" },
            { name: "⚪ Odds (1/2 chance, 2x bet)", value: "odds" },
            { name: "⚫ Evens (1/2 chance, 2x bet)", value: "evens" },
            { name: "⬇️ Lows (1/2 chance, 2x bet)", value: "lows" },
            { name: "⬆️ Highs (1/2 chance, 2x bet)", value: "highs" },
            { name: "1️⃣ First Dozen (1/3 chance, 3x bet)", value: "1st dozen" },
            { name: "2️⃣ Second Dozen (1/3 chance, 3x bet)", value: "2nd dozen" },
            { name: "3️⃣ Third Dozen (1/3 chance, 3x bet)", value: "3rd dozen" },
            { name: "1️⃣ First Column (1/3 chance, 3x bet)", value: "1st column" },
            { name: "2️⃣ Second Column (1/3 chance, 3x bet)", value: "2nd column" },
            { name: "3️⃣ Third Column (1/3 chance, 3x bet)", value: "3rd column" },
          )
          .setRequired(true)
        )
      )
      .addSubcommand(subcommand => subcommand.setName("single")
        .setDescription("...a single number. (36x bet on win!)")
        .addIntegerOption(option => option.setName("bet")
          .setDescription("The number of chips you're betting.")
          .setMinValue(100)
          .setRequired(true)
        )
        .addStringOption(option => option.setName("wager")
          .setDescription("The bet to play.")
          .setAutocomplete(true)
          .setRequired(true)
        )
      )
    )
    .addSubcommand(subcommand => subcommand.setName("slots")
      .setDescription("Single-line LTR slots. Let's go gambling!")
      .addIntegerOption(option => option.setName("bet")
        .setDescription("The number of chips you're betting.")
        .setMinValue(100)
        .setRequired(true)
      )
    )
    .addSubcommand(subcommand => subcommand.setName("higherlower")
      .setDescription("Get a number 1-10, and guess if the next one is higher or lower!")
      .addIntegerOption(option => option.setName("bet")
        .setDescription("The number of chips you're betting.")
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(true)
      )
    )
  ,
  async parse(interaction) {
    return await this.execute(interaction.client, {
      source: interaction,
      commandGroup: interaction.options.getSubcommandGroup(),
      command: interaction.options.getSubcommand(),

      bet: interaction.options.getInteger("bet"),
      wager: interaction.options.getString("wager")
    })
  },
  async execute(client, input) {
    const db = client.db;
    const settings = new Map(db.casino.filter(row => row.get("setting"))
      .filter(row => ["global", (input.commandGroup || input.command)].includes(row.get("game")))
      .map(row => [row.get("setting"), row.get("value")]))

    try {
      await db.users.reload()
      let user = db.users.find(row => row.get("user_id") === input.source.user.id)

      if (!user) throw new Error("There was a problem finding your user profile! How odd.")
      if ((+user.get("chips") || 0) < input.bet) throw new Error(insertChips(settings.get("not_enough_chips"), user.get("chips"), client))

      const response = (await input.source.deferReply({ withResponse: true }))?.resource?.message;

      const embeds = [{
        title: "✦ ` CASINO: ",
        color: color(settings.get("embed_color"))
      }, {
        color: color(settings.get("embed_color"))
      }]

      if (input.command == "slots") {
        embeds[0].title += "SLOTS `"
        const symbols = settings.get("slot_symbols").split(";").map(x => x.trim()),
          placehold = settings.get("slot_placehold").trim(),
          result = drawPool(settings.get("slot_rates").split("\n").map(row =>
            row.split("; ")).map(data => ({
              reels: [data[0], data[1], data[2]],
              weight: parseFloat(data[3]) || 0,
              payout: +data[4]
            })))[0];

        if (input.source.replied) return // stops command here if it was already replied to

        let old = +user.get("chips");
        let diff = 0 - input.bet + Math.floor(result.payout * input.bet);
        user.set("chips", old + (diff || 0));
        await user.save();
        client.log(
          `**CASINO / SLOTS:** <@${user.get("user_id")}>\n`
          + `> **reel:** ${result.reels.join("").replace(/\*/g, "x")}\n`
          + `> **chips:** ${diff >= 0 ? "+" : ""}${diff} (${old} → ${old + diff})`,
          { sender: input.source.user.id, url: response.url }
        )

        embeds[0].description = insertChips(settings.get("bet_paid"), input.bet, client)

        let reels = [...result.reels];
        for (let i = 0; i < reels.length; i++) {
          if (reels[i] == "*") {
            if (i == 0) reels[i] = symbols[Math.floor(Math.random() * symbols.length)]
            else reels[i] = symbols.filter(x => x != reels[i - 1])[Math.floor(Math.random() * (symbols.length - 1))]
          }
        }

        // intro: all reels hidden
        embeds[1].description = settings.get("intro") + "\n\n"
          + `# ${placehold}${placehold}${placehold}`
        input.source.editReply({ embeds })

        // 1 reel reveal
        await new Promise(resolve => setTimeout(resolve, +(settings.get("display_delay") || 1) * 1000))
        embeds[1].description = settings.get("intro") + "\n\n"
          + `# ${reels[0]}${placehold}${placehold}`

        input.source.editReply({ embeds })

        // 2 reel reveal
        await new Promise(resolve => setTimeout(resolve, +(settings.get("display_delay") || 1) * 1000))
        embeds[1].description = settings.get("intro") + "\n\n"
          + `# ${reels[0]}${reels[1]}${placehold}`

        input.source.editReply({ embeds })

        // 3 reel reveal
        await new Promise(resolve => setTimeout(resolve, +(settings.get("display_delay") || 1) * 1000))
        embeds[1].description = settings.get("intro") + "\n\n"
          + `# ${reels[0]}${reels[1]}${reels[2]}`

        input.source.editReply({ embeds })
        // result
        await new Promise(resolve => setTimeout(resolve, +(settings.get("result_delay") || 1) * 1000))

        let ping_mod = result.payout >= (+settings.get("mod_ping_threshold") || 10) 
        input.source.channel.send({
          content: `<@${user.get("user_id")}>` + (ping_mod ? ` <@&${client.config("moderator_role")}>`: ""),
          embeds: [{
            description: insertChips(
              result.payout >= 100 ? settings.get("result_win_large") :
                result.payout >= 10 ? settings.get("result_win_med") :
                  result.payout > 0 ? settings.get("result_win_small") :
                    settings.get("result_lose"),
              Math.floor(result.payout * input.bet), client),
            color: color(settings.get("embed_color"))
          }]
        })

      } else if (input.command == "higherlower") {
        embeds[0].title += "HIGHER OR LOWER `"
        const numbers = settings.get("numbers").split(";");

        embeds[0].description = insertChips(settings.get("bet_paid"), input.bet, client);

        let n = Math.floor(Math.random() * 10) + 1;

        embeds[1].description = `> ## ${numbers[n - 1]} vs ${settings.get("placehold")}\n`
          + settings.get("intro");

        let components = [{
          type: 1, components: [
            {
              custom_id: `casino:higherlower:${input.bet}:${n}:higher`,
              type: 2,
              style: 1,
              label: `⬆️ Higher`
            },
            {
              custom_id: `casino:higherlower:${input.bet}:${n}:lower`,
              type: 2,
              style: 4,
              label: `⬇️ Lower`
            }]
        }]

        input.source.editReply({ embeds, components })

      } else if (input.commandGroup == "roulette") {
        embeds[0].title += "ROULETTE `"
        const win = [];
        if (input.source.replied) return // stops command here if it was already replied to
        if (input.command == "outside") {
          switch (input.wager) {
            case "reds": win.push(1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36); break;
            case "blacks": win.push(2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35); break;
            case "odds": win.push(1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31, 33, 35); break;
            case "evens": win.push(2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36); break;
            case "lows": win.push(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18); break;
            case "highs": win.push(19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36); break;
            case "1st dozen": win.push(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12); break;
            case "2nd dozen": win.push(13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24); break;
            case "3rd dozen": win.push(25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36); break;
            case "1st column": win.push(1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34); break;
            case "2nd column": win.push(2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35); break;
            case "3rd column": win.push(3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36); break;
            default: throw new Error("Wager not recognized!");
          }
        } else if (input.command == "single") {
          if (isNaN(+input.wager)) throw new Error("Wager not recognized!")
          win.push(+input.wager)
        }

        let result = { value: Math.floor(Math.random() * (35 + +settings.get("zero_count"))) + 1 };
        result.win = win.includes(result.value);
        result.payout = 36 / win.length;

        let old = +user.get("chips");
        let diff = 0 - input.bet + Math.floor(result.win * result.payout * input.bet);
        user.set("chips", old + (diff || 0));
        await user.save();

        client.log(
          `**CASINO / ROULETTE:** <@${user.get("user_id")}>\n`
          + `> **wager:** ${input.wager} (${win.join(", ")})\n`
          + `> **result:** ${result.value}\n`
          + `> **chips:** ${diff >= 0 ? "+" : ""}${diff} (${old} → ${old + diff})`,
          { sender: input.source.user.id, url: response.url }
        )


        embeds[0].description = insertChips(settings.get("bet_paid"), input.bet, client)

        embeds[1].description = settings.get("intro")
          + "\n\nYou've bet on: `" + input.wager + "`"
          + (win.length > 1 ? `\n> *Possible wins:* ` + win.join(" ") : "");

        embeds[1].thumbnail = { url: settings.get("thumbnail") }
        input.source.editReply({ embeds })

        // display reveal
        await new Promise(resolve => setTimeout(resolve, +(settings.get("display_delay") || 1) * 1000))
        embeds[1].description += "\n\n> ## `RESULT`: "
        input.source.editReply({ embeds })

        // roll reveal
        await new Promise(resolve => setTimeout(resolve, +(settings.get("display_delay") || 1) * 1000))
        embeds[1].description += rouletteWagers
          .find(x => x.value == (result.value > 36 ? "0".repeat(result.value - 36) : result.value.toString()))
          .name
        input.source.editReply({ embeds })

        // result
        await new Promise(resolve => setTimeout(resolve, +(settings.get("result_delay") || 1) * 1000))
        input.source.channel.send({
          content: `<@${user.get("user_id")}>`,
          embeds: [{
            description: insertChips(
              result.win > 0 ? settings.get("result_win") :
                settings.get("result_lose"),
              Math.floor(result.payout * input.bet), client),
            color: color(settings.get("embed_color"))
          }]
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
  async button(interaction, inputs) {
    const client = interaction.client,
      db = client.db,
      game = inputs.shift(),
      settings = new Map(db.casino.filter(row => row.get("setting"))
        .filter(row => ["global", game].includes(row.get("game")))
        .map(row => [row.get("setting"), row.get("value")]));


    try {
      if (interaction.user.id !== interaction.message.interactionMetadata.user.id)
        throw new Error("Only the original sender may utilize buttons!")

      await db.users.reload()
      let user = db.users.find(row => row.get("user_id") === interaction.user.id),
        bet = +inputs.shift(),
        mult = +(settings.get("win_mult")) || 1,
        match = +(settings.get("match_mult")) || 0

      if ((+user.get("chips") || 0) < bet) throw new Error(insertChips(settings.get("not_enough_chips"), user.get("chips"), client))

      if (game === "higherlower") {
        let x = +inputs.shift(),
          y = Math.floor(Math.random() * 10 + 1),
          wager = inputs.shift();

        await interaction.update({ components: [] })
        const numbers = settings.get("numbers").split(";");

        let embeds = interaction.message.embeds,
          payout = 0;

        if (y == x) payout = match
        else {
          if (wager == "higher") {
            if (y > x) payout = mult
            else payout = 0
          } else if (wager == "lower") {
            if (y < x) payout = mult
            else payout = 0
          }
        }

        let old = +user.get("chips");
        let diff = 0 - bet + Math.floor(payout * bet);
        user.set("chips", old + (diff || 0));
        await user.save();

        client.log(
          `**CASINO / HIGHER LOWER:** <@${user.get("user_id")}>\n`
          + `> **wager:** ${x}; bet ${wager}\n`
          + `> **result:** ${x} vs ${y}\n`
          + `> **chips:** ${diff >= 0 ? "+" : ""}${diff} (${old} → ${old + diff})`,
          { sender: interaction.user.id, url: interaction.message.url }
        )

        await new Promise(resolve => setTimeout(resolve, +(settings.get("reveal_delay") || 1) * 1000))


        embeds[1] = {
          description: `> ## ${numbers[x - 1]} vs ${numbers[y - 1]}`,
          color: color(settings.get("embed_color"))
        }
        interaction.message.edit({ embeds })

        await new Promise(resolve => setTimeout(resolve, +(settings.get("result_delay") || 1) * 1000))
        return interaction.channel.send({
          content: `<@${user.get("user_id")}>`,
          embeds: [{
            description: insertChips(
              payout == 1 ? settings.get("result_refund") :
              payout > 0 ? settings.get("result_win") :
                settings.get("result_lose"),
              Math.floor(payout * bet), client),
            color: color(settings.get("embed_color"))
          }]
        })
      }
    } catch (error) {
      console.log(error);
      return await interaction.followUp({
        content: "An error occurred:\n" + error.message.split("\n").map(x => `> -# ${x}`).join("\n"),
        flags: MessageFlags.Ephemeral
      })
    }
  },
  async autocomplete(interaction) {
    const focused = interaction.options.getFocused(true);

    let wagers = [...rouletteWagers]; wagers.length = 36;

    let res = fuzzy.filter(focused.value, wagers, { extract: x => x.name + " / " + x.alt })
      .map(choice => choice.original)
    if (res.length > 25) res.length = 25

    return await interaction.respond(res)
  }
};

const insertChips = (text, amt, client) => text.replace(/{{0\}}/g, client.config("casino_chips_format").replace("{{CHIPS}}", amt))

const rouletteWagers = [
  { "name": "🟥 1", "value": "1", "alt": "one" },
  { "name": "⬛ 2", "value": "2", "alt": "two" },
  { "name": "🟥 3", "value": "3", "alt": "three" },
  { "name": "⬛ 4", "value": "4", "alt": "four" },
  { "name": "🟥 5", "value": "5", "alt": "five" },
  { "name": "⬛ 6", "value": "6", "alt": "six" },
  { "name": "🟥 7", "value": "7", "alt": "seven" },
  { "name": "⬛ 8", "value": "8", "alt": "eight" },
  { "name": "🟥 9", "value": "9", "alt": "nine" },
  { "name": "⬛ 10", "value": "10", "alt": "ten" },
  { "name": "⬛ 11", "value": "11", "alt": "eleven" },
  { "name": "🟥 12", "value": "12", "alt": "twelve" },
  { "name": "⬛ 13", "value": "13", "alt": "thirteen" },
  { "name": "🟥 14", "value": "14", "alt": "fourteen" },
  { "name": "⬛ 15", "value": "15", "alt": "fifteen" },
  { "name": "🟥 16", "value": "16", "alt": "sixteen" },
  { "name": "⬛ 17", "value": "17", "alt": "seventeen" },
  { "name": "🟥 18", "value": "18", "alt": "eighteen" },
  { "name": "🟥 19", "value": "19", "alt": "nineteen" },
  { "name": "⬛ 20", "value": "20", "alt": "twenty" },
  { "name": "🟥 21", "value": "21", "alt": "twenty-one" },
  { "name": "⬛ 22", "value": "22", "alt": "twenty-two" },
  { "name": "🟥 23", "value": "23", "alt": "twenty-three" },
  { "name": "⬛ 24", "value": "24", "alt": "twenty-four" },
  { "name": "🟥 25", "value": "25", "alt": "twenty-five" },
  { "name": "⬛ 26", "value": "26", "alt": "twenty-six" },
  { "name": "🟥 27", "value": "27", "alt": "twenty-seven" },
  { "name": "⬛ 28", "value": "28", "alt": "twenty-eight" },
  { "name": "⬛ 29", "value": "29", "alt": "twenty-nine" },
  { "name": "🟥 30", "value": "30", "alt": "thirty" },
  { "name": "⬛ 31", "value": "31", "alt": "thirty-one" },
  { "name": "🟥 32", "value": "32", "alt": "thirty-two" },
  { "name": "⬛ 33", "value": "33", "alt": "thirty-three" },
  { "name": "🟥 34", "value": "34", "alt": "thirty-four" },
  { "name": "⬛ 35", "value": "35", "alt": "thirty-five" },
  { "name": "🟥 36", "value": "36", "alt": "thirty-six" },
  { "name": "🟩 0", "value": "0", "alt": "zero" },
  { "name": "🟩 00", "value": "00", "alt": "zero zero / double zero" },
  { "name": "🟩 000", "value": "000", "alt": "zero zero zero / triple zero" }
]
