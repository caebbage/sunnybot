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
          .setMinValue(10)
          .setRequired(true)
        )
        .addStringOption(option => option.setName("wager")
          .setDescription("The bet to play.")
          .setChoices(
            { name: "🟥 Reds (1/2 chance, 2x bet)", value: "red" },
            { name: "⬛ Blacks (1/2 chance, 2x bet)", value: "black" },
            { name: "⚪ Odds (1/2 chance, 2x bet)", value: "odd" },
            { name: "⚫ Evens (1/2 chance, 2x bet)", value: "even" },
            { name: "⬇️ Lows (1/2 chance, 2x bet)", value: "low" },
            { name: "⬆️ Highs (1/2 chance, 2x bet)", value: "high" },
            { name: "1️⃣ First Dozen (1/3 chance, 3x bet)", value: "dozen1" },
            { name: "2️⃣ Second Dozen (1/3 chance, 3x bet)", value: "dozen2" },
            { name: "3️⃣ Third Dozen (1/3 chance, 3x bet)", value: "dozen3" },
            { name: "1️⃣ First Column (1/3 chance, 3x bet)", value: "dozen1" },
            { name: "2️⃣ Second Column (1/3 chance, 3x bet)", value: "dozen2" },
            { name: "3️⃣ Third Column (1/3 chance, 3x bet)", value: "dozen3" },
          )
          .setRequired(true)
        )
      )
      .addSubcommand(subcommand => subcommand.setName("single")
        .setDescription("...a single number. (36x bet on win!)")
        .addIntegerOption(option => option.setName("bet")
          .setDescription("The number of chips you're betting.")
          .setMinValue(10)
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
        .setMinValue(10)
        .setRequired(true)
      )
    )
    .addSubcommand(subcommand => subcommand.setName("higherlower")
      .setDescription("Get a number 1-10, and guess if the next one is higher or lower!")
      .addIntegerOption(option => option.setName("bet")
        .setDescription("The number of chips you're betting.")
        .setMinValue(1)
        .setMaxValue(50)
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
    const insertChips = (text, amt) => text.replace(/{{0\}}/g, client.config("casino_chips_format").replace("{{CHIPS}}", amt))

    const db = client.db;
    const settings = new Map(db.casino.filter(row => row.get("setting"))
      .filter(row => ["global", (input.commandGroup || input.command)].includes(row.get("game")))
      .map(row => [row.get("setting"), row.get("value")]))

    try {
      let user = db.users.find(row => row.get("user_id") === input.source.user.id)

      if (!user) throw new Error("There was a problem finding your user profile! How odd.")
      if ((+user.get("chips") || 0) < input.bet) throw new Error(insertChips(settings.get("not_enough_chips"), user.get("chips")))

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
        console.log(result)

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

        embeds[0].description = insertChips(settings.get("leading_text"), input.bet)

        let reels = [...result.reels];
        for (let i = 0; i < reels.length; i++) {
          if (reels[i] == "*") {
            if (i == 0) reels[i] = symbols[Math.floor(Math.random() * symbols.length)]
            else reels[i] = symbols.filter(x => x != reels[i - 1])[Math.floor(Math.random() * (symbols.length - 1))]
          }
        }

        // intro: all reels hidden
        embeds[1].description = settings.get("reel_intro") + "\n\n"
          + `# ${placehold}${placehold}${placehold}`
        input.source.editReply({ embeds })

        // 1 reel reveal
        await new Promise(resolve => setTimeout(resolve, +(settings.get("reel_delay") || 1) * 1000))
        embeds[1].description = settings.get("reel_intro") + "\n\n"
          + `# ${reels[0]}${placehold}${placehold}`

        input.source.editReply({ embeds })

        // 2 reel reveal
        await new Promise(resolve => setTimeout(resolve, +(settings.get("reel_delay") || 1) * 1000))
        embeds[1].description = settings.get("reel_intro") + "\n\n"
          + `# ${reels[0]}${reels[1]}${placehold}`

        input.source.editReply({ embeds })

        // 3 reel reveal
        await new Promise(resolve => setTimeout(resolve, +(settings.get("reel_delay") || 1) * 1000))
        embeds[1].description = settings.get("reel_intro") + "\n\n"
          + `# ${reels[0]}${reels[1]}${reels[2]}`

        input.source.editReply({ embeds })
        // result
        await new Promise(resolve => setTimeout(resolve, +(settings.get("result_delay") || 1) * 1000))
        input.source.followUp({
          content: `<@${user.get("user_id")}>`,
          embeds: [{
            description: insertChips(
              result.payout >= 100 ? settings.get("result_win_large") :
                result.payout >= 10 ? settings.get("result_win_med") :
                  result.payout > 0 ? settings.get("result_win_small") :
                    settings.get("result_lose"),
            Math.floor(result.payout * input.bet)),
            color: color(settings.get("embed_color"))
          }]
        })

      } else if (input.command == "higherlower") {

      } else if (input.commandGroup == "roulette") {

        if (input.command == "outside") {

        } else if (input.command == "single") {

        }
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
    const wagers = [
      { "name": "🟥 1", "value": "1" },
      { "name": "⬛ 2", "value": "2" },
      { "name": "🟥 3", "value": "3" },
      { "name": "⬛ 4", "value": "4" },
      { "name": "🟥 5", "value": "5" },
      { "name": "⬛ 6", "value": "6" },
      { "name": "🟥 7", "value": "7" },
      { "name": "⬛ 8", "value": "8" },
      { "name": "🟥 9", "value": "9" },
      { "name": "⬛ 10", "value": "10" },
      { "name": "⬛ 11", "value": "11" },
      { "name": "🟥 12", "value": "12" },
      { "name": "⬛ 13", "value": "13" },
      { "name": "🟥 14", "value": "14" },
      { "name": "⬛ 15", "value": "15" },
      { "name": "🟥 16", "value": "16" },
      { "name": "⬛ 17", "value": "17" },
      { "name": "🟥 18", "value": "18" },
      { "name": "🟥 19", "value": "19" },
      { "name": "⬛ 20", "value": "20" },
      { "name": "🟥 21", "value": "21" },
      { "name": "⬛ 22", "value": "22" },
      { "name": "🟥 23", "value": "23" },
      { "name": "⬛ 24", "value": "24" },
      { "name": "🟥 25", "value": "25" },
      { "name": "⬛ 26", "value": "26" },
      { "name": "🟥 27", "value": "27" },
      { "name": "⬛ 28", "value": "28" },
      { "name": "⬛ 29", "value": "29" },
      { "name": "🟥 30", "value": "30" },
      { "name": "⬛ 31", "value": "31" },
      { "name": "🟥 32", "value": "32" },
      { "name": "⬛ 33", "value": "33" },
      { "name": "🟥 34", "value": "34" },
      { "name": "⬛ 35", "value": "35" },
      { "name": "🟥 36", "value": "36" }
    ]

    let res = fuzzy.filter(interaction.options.getFocused(true).value, wagers, { extract: x => x.get("name") })
      .map(choice => choice.original)
    if (res.length > 25) res.length = 25

    return res
  }
};

