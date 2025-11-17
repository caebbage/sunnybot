const { SlashCommandBuilder, MessageFlags } = require('discord.js')
const { color, diacritic } = require("../module/helpers.js")
const fuzzy = require("fuzzy")

module.exports = {
  name: "vote",
  slash: new SlashCommandBuilder().setName('vote')
    .setDescription(`Vote on a hex for the Map Game.`)
    .addStringOption(option => option.setName("hex")
      .setDescription("The hex to vote for.")
      .setAutocomplete(true)
      .setRequired(true)
    )
  ,
  async parse(interaction, message, inputs) {
    return await this.execute(interaction.client, {
      source: interaction,
      hex: interaction.options.getString("hex"),
      sender: interaction.user.id
    })
  },
  async execute(client, input) {
    const db = client.db;

    try {
      const member = await input.source.guild.members.fetch(input.sender);

      await db.users.reload()
      const user = db.users.find(u => u.get("user_id") == input.sender)
      if (!user) throw new Error("Your profile could not be found!")
      if (user.get("voted")) throw new Error("You've already voted in this voting period!")

      await db.hexes.reload()
      const hex = db.hexes.find(hex => hex.get("hex_id") == input.hex)
      if (!hex) throw new Error("The hex requested could not be found!")
      
      let faction;
      if (member.roles.cache.get(client.config("cartel_role"))) faction = "cartel";
      else if (member.roles.cache.get(client.config("triad_role"))) faction = "triad";

      if (!faction) throw new Error("We could not identify which faction you belong to!")
      faction = db.factions.find(f => f.get("faction_name") == faction)

      await input.source.deferReply({ flags: MessageFlags.Ephemeral })
      
      const hold = hex.get("hold") || "0",
        voteType = hex.get("controlled_by") == faction.get("faction_name") ?  "🛡️" : "⚔️";

      await input.source.channel.send({
        embeds: [{
          title: `<a:loading:1437277804818464788>${ voteType } VOTE CAST FOR ${input.hex}: \`HOLD ${hold}\``,
          description: `\`${input.hex}${hex.get("hex_name") ? ": " + hex.get("hex_name") : ""}\` is ` +
            (hex.get("controlled_by") == "unoccupied" ? "currently unoccupied." :
          `currently occupied by \`THE ${hex.get("controlled_by").toUpperCase()}\`.`),
          thumbnail: { url: faction?.get("crest_image") || client.config("default_image") },
          color: color(faction.get("main_color"))
        }]
      })

      let log = await client.channels.fetch(client.config("vote_channel"));
      
      user.set("voted", input.hex)
      await user.save()

      await log.send(`${faction.get("simple_emoji")} ${voteType} ${input.hex} (${member.toString()})`)

      return await input.source.editReply("Vote cast!")
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

      let data = db.hexes.filter(hex => hex.get("hex_id") && hex.get("hex_id") !== "blank");

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