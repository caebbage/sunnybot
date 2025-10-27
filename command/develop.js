const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { hexEmbed, diacritic } = require("../module/helpers.js");

module.exports = {
  name: "develop",
  slash: new SlashCommandBuilder().setName('develop')
    .setDescription(`Develop a hex!`)
    .addStringOption(option => option.setName("faction")
      .setDescription("The faction developing a hex.")
      .setChoices(
        { name: "🔷 The Cartel", value: "cartel" },
        { name: "🟢 The Triad", value: "triad" }
      )
      .setRequired(true)
    )
    .addStringOption(option => option.setName("hex")
      .setDescription("The hex to develop.")
      .setAutocomplete(true)
      .setRequired(true)
    ),
  async parse(interaction, message, inputs) {
    return await this.execute(interaction.client, {
      source: interaction,
      faction: interaction.options.getString("faction"),
      hex: interaction.options.getString("hex")
    })
  },
  async execute(client, input) {
    const db = client.db;

    try {
      if (!input.hex) throw new Error("Provide the hex's ID!")

      await db.hexes.reload();
      const hex = db.hexes?.find(row => row.get("hex_id") == input.hex);

      if (!hex) throw new Error("The specified hex could not be found!")

      if (hex.get("controlled_by") != input.faction)
        throw new Error("The hex does not belong to this faction!")

      return await input.source.showModal({
        title: hex.get("is_base") != "TRUE"
          ? `Upgrading ${input.hex} to Hold ${+(hex.get("hold") || 0) + 1}`
          : `Developing on ${input.hex}`,
        custom_id: "develop:" + input.hex,
        components: [
          {
            type: 1, components: [{
              type: 4, custom_id: "hex_name",
              label: "Territory (Hex) Name", style: 1,
              max_length: 32,
              value: hex.get("hex_name"),
              required: false
            }]
          },
          {
            type: 1, components: [{
              type: 4, custom_id: "description",
              label: "Hex Description", style: 2,
              max_length: 256,
              value: hex.get("description"),
              required: false
            }]
          },
          {
            type: 1, components: [{
              type: 4, custom_id: "bonus_stats",
              label: "Stat Bonuses (hot/cool/hard/sharp order)", style: 1,
              min_length: 1, max_length: 32,
              value: `${hex.get("hot") || 0} / ${hex.get("cool") || 0} / ${hex.get("hard") || 0} / ${hex.get("sharp") || 0}`,
              required: true
            }]
          },
          {
            type: 1, components: [{
              type: 4, custom_id: "misc_bonus",
              label: "Extra Bonuses (eg. extra rolls or income)", style: 2,
              max_length: 256,
              value: hex.get("misc_bonus"),
              required: false
            }]
          }
        ]
      })
    } catch (error) {
      console.log(error);
      return await input.source.reply({
        content: "An error occurred:\n-# `" + error.message + "`",
        flags: MessageFlags.Ephemeral
      })
    }
  },
  async autocomplete(interaction) {
    const focused = interaction.options.getFocused(true);
    const db = interaction.client.db
    try {
      if (focused.value.length <= 1) await db.hexes.reload()

      let faction = interaction.options.get("faction")?.value || "none",
        data = db.hexes.filter(hex => hex.get("hex_id") && hex.get("hex_id") !== "blank"
          && hex.get("controlled_by") == faction);

      let filtered = fuzzy.filter(focused.value, data, { extract: x => `${x.get("hex_id")} // ${diacritic(x.get("hex_name"))}` })
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
  },
  async modal(interaction, inputs) {
    const db = interaction.client.db;
    let input = inputs.shift();

    try {
      await db.hexes.reload()
      const hex = db.hexes.find(row => row.get("hex_id") === input),
        faction = db.factions.find(x => x.get("faction_name") == hex.get("controlled_by"));

      if (!hex) throw new Error("The specified character could not be found!")

      let updates = {
        hex_name: interaction.fields.getTextInputValue("hex_name"),
        description: interaction.fields.getTextInputValue("description"),
        misc_bonus: interaction.fields.getTextInputValue("misc_bonus")
      };

      if (+(hex.get("hold") || 0) < 2) updates.hold = +(hex.get("hold") || 0) + 1;
      else if (hex.get("is_base") != "TRUE") updates.is_base = "TRUE"
      
      updates.color = (hex.get("is_base") == "TRUE" || updates.is_base) ? faction.get("base_hex_color_name") : faction.get("strong_hex_color_name")

      let stats = /(?<hot>[\+\-0-9]+) *\/ *(?<cool>[\+\-0-9]+) *\/ *(?<hard>[\+\-0-9]+) *\/ *(?<sharp>[\+\-0-9]+)/
        .exec(interaction.fields.getTextInputValue("bonus_stats"))?.groups;

      if (!stats) throw new Error("Stats input appears malformed (`" + interaction.fields.getTextInputValue("bonus_stats") + "`). Please retry command!")

      for (let stat of Object.keys(stats)) {
        if (isNaN(+stats[stat])) throw new Error("Stats input appears malformed (" + interaction.fields.getTextInputValue("bonus_stats") + "). Please retry command!")
        updates[stat] = stats[stat].trim()
        if (updates[stat] == 0) updates[stat] == ""
      }

      let response = (await interaction.deferReply({ withResponse: true }))?.resource?.message;

      await hex.assign(updates)
      await hex.save()

      await interaction.editReply({
        content: `${input} has been upgraded!`,
        embeds: [hexEmbed(hex, interaction.client)],
        flags: MessageFlags.Ephemeral
      })

      return await interaction.client.log(
        `**HEX DEVELOPED:** ${input.hex}`
        + "\n" + Object.entries(updates).map(([key, val]) => `> **${key}:** ${val}`).join("\n"),
        { sender: interaction.user.id, url: response.url }
      )
    } catch (error) {
      console.log(error);
      if (interaction.replied || interaction.deferred) {
        return await interaction.followUp({
          content: "An error occurred:\n" + error.message.split("\n").map(x => `> -# ${x}`).join("\n"),
          flags: MessageFlags.Ephemeral
        })
      }
      return await interaction.reply({
        content: "An error occurred:\n" + error.message.split("\n").map(x => `> -# ${x}`).join("\n"),
        flags: MessageFlags.Ephemeral
      })
    }
  }
}