const { SlashCommandBuilder, MessageFlags } = require('discord.js')
const { color, diacritic, hexEmbed, toTitleCase } = require("../module/helpers.js")
const fuzzy = require("fuzzy")

const { DiceRoller, DiscordRollRenderer } = require("dice-roller-parser"),
  roller = new DiceRoller(),
  renderer = new DiscordRollRenderer();

module.exports = {
  name: "capture",
  slash: new SlashCommandBuilder().setName('capture')
    .setDescription(`Capture a hex!`)
    .addStringOption(option => option.setName("faction")
      .setDescription("The faction attempting the capture.")
      .setChoices(
        { name: "🔷 The Cartel", value: "cartel" },
        { name: "🟢 The Triad", value: "triad" }
      )
      .setRequired(true)
    )
    .addStringOption(option => option.setName("hex")
      .setDescription("The hex to capture.")
      .setAutocomplete(true)
      .setRequired(true)
    )
  ,
  async parse(interaction, message, inputs) {
    return await this.execute(interaction.client, {
      source: interaction,
      faction: interaction.options.getString("faction"),
      hex: interaction.options.getString("hex"),
      sender: interaction.user.id
    })
  },
  async execute(client, input) {
    const db = client.db;

    try {
      const faction = db.factions.find(x => x.get("faction_name") == input.faction);
      if (!faction) throw new Error("The faction specified is invalid!")

      await db.hexes.reload()
      const hex = db.hexes.find(hex => hex.get("hex_id") == input.hex)
      if (!hex) throw new Error("The hex requested could not be found!")
      if (hex.get("controlled_by") == input.faction) throw new Error("This hex is already under your control!")
      if (hex.get("is_base") == "TRUE") throw new Error("This hex has base development and is uncapturable!")

      let response = (await input.source.deferReply({ withResponse: true })).resource?.message;

      await new Promise(r => setTimeout(r, 2000));

      let hold = +(hex.get("hold") || 0);

      if (hold <= 0 || hex.get("controlled_by") == "open") {
        response = await input.source.editReply({
          embeds: [{
            title: `${faction.get("pin_emoji") || faction.get("simple_emoji")} CAPTURING ${input.hex}`,
            description: `Hex \`${input.hex}\` is currently unprotected! You capture it with ease!`,
            color: color(faction.get("main_color"))
          }]
        })

        hex.set("hold", 1)
        hex.set("controlled_by", input.faction)
        await hex.save()

        await new Promise(r => setTimeout(r, 2000));

        await input.source.followUp({
          embeds: [hexEmbed(hex, client)]
        })

        return await client.log(
          `**HEX CLAIMED:** ${input.hex}`
          + `\n> **controlled_by:** ${input.faction}`
          + `\n> **hold:** 1`,
          {
            sender: input.source.user.id,
            url: response.url
          }
        )
      } else {
        let diceRolled;
        switch (hold) {
          case 1: diceRolled = "1d100"; break;
          case 2: diceRolled = "2d100kl1"; break;
          case 3: diceRolled = "3d100kl1"; break;
        }

        await input.source.editReply({
          embeds: [{
            title: `${faction.get("pin_emoji") || faction.get("simple_emoji")} CAPTURING ${input.hex}`,
            description: `Hex \`${input.hex}\` is currently occupied by \`The ${toTitleCase(hex.get("controlled_by"))}\`!`
              + `\n> HOLD ${hold} ➜ \`${diceRolled}\``
              + "\n\n Attacking momentarily...",
            color: color(faction.get("main_color"))
          }]
        })

        await new Promise(r => setTimeout(r, 3000));

        let roll = roller.roll(diceRolled);

        let finalRoll = renderer.render(roll)
          .replace(/^(.+) = (\d+)$/m, "$1") // trims result out of finalRoll
          .replace(/\((.+?) = \d+\)/g, "[$1]") // replaces roll frames and removes =
        finalRoll = `[${finalRoll}]` // adds frame

        input.source.followUp({
          embeds: [{
            title: `${faction.get("pin_emoji") || faction.get("simple_emoji")} ATTACKING ${input.hex}: \`HOLD ${hold}\``,
            description: `HOLD ${hold} ➜ \`${diceRolled}\`\n> ➜ ${finalRoll} ➜ **\`${roll.value}\`**`
            + "\n\nRespond with `/defend`!",
            color: color(faction.get("main_color") || client.config("default_color")),
            thumbnail: {
              url: faction.get("crest_image")
            }
          }],
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
      const focused = interaction.options.getFocused(true),
        client = interaction.client,
        db = client.db;

      if (focused.value.length <= 1) await db.hexes.reload()

      let faction = interaction.options.get("faction")?.value || "none",
        data = db.hexes.filter(hex => hex.get("hex_id") && hex.get("hex_id") !== "blank" && hex.get("controlled_by") != faction && hex.get("is_base") != "TRUE");

      let filtered = fuzzy.filter(focused.value, data, { extract: hex => `${hex.get("hex_id")} // ${diacritic(hex.get("hex_name"))}` });
      if (filtered.length > 25) filtered.length = 25

      return await interaction.respond(filtered.map(choice => {
        let hex = choice.original, symbol;
        if (["cartel", "triad"].includes(hex.get("controlled_by"))) {
          symbol = db.factions.find(f => f.get("faction_name") == hex.get("controlled_by"))?.get("simple_emoji")
        } else { symbol = client.config("contested_emoji") }

        return {
          name: `${hex.get("hex_id")} ${symbol} ${hex.get("hex_name")}`.trim(),
          value: hex.get("hex_id")
        }
      }))
    } catch (error) {
      console.log(error)
    }
  }
}