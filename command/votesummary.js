const { SlashCommandBuilder, MessageFlags } = require('discord.js')
const { color } = require("../module/helpers.js")

module.exports = {
  name: "votesummary",
  slash: new SlashCommandBuilder().setName('votesummary')
    .setDescription(`Shows the current vote state for the week.`)
    .addBooleanOption(option => option.setName("hide")
      .setDescription("If you want this command to not be visible to others.")
    )
  ,
  async parse(interaction) {
    return await this.execute(interaction.client, {
      source: interaction,
      hide: interaction.options.getBoolean("hide")
    })
  },
  async execute(client, input) {
    const db = client.db;
    try {
      await input.source.deferReply({ flags: (input.hide ? MessageFlags.Ephemeral : undefined) })

      await db.users.reload()
      let allVotes = db.users.filter(x => x.get("voted"))

      let dl = { atk: new Date(), vote: new Date() }
      dl.atk.setHours(12, 0, 0, 0)
      dl.atk.setDate(dl.atk.getDate() + (6 - dl.atk.getDay()))

      dl.vote.setHours(12, 0, 0, 0)
      dl.vote.setDate(dl.vote.getDate() + (7 - dl.vote.getDay()))


      const map = (await client.db.actions.get("mapimage"))
        ?.map(row => row.toObject())
        .filter(row => row.weight && !isNaN(row.weight) && row.value).map(x => x.value)?.[0]
        .match(/https:.+/)?.[0]
        || undefined;

      if (!allVotes.length) {
        return await input.source.editReply({
          embeds: [{
            title: "✦ `VOTE SUMMARY`",
            description: "**` VOTE DEADLINES `**" +
              `\n> \`  ATTACK ${client.config("decorative_symbol")} \` <t:${Math.floor(dl.atk.getTime() / 1000)}:f> (<t:${Math.floor(dl.atk.getTime() / 1000)}:R>)` +
              `\n> \` GENERAL ${client.config("decorative_symbol")} \` <t:${Math.floor(dl.vote.getTime() / 1000)}:f> (<t:${Math.floor(dl.vote.getTime() / 1000)}:R>)` +
              "\n-# No votes have been cast yet!",
            color: color(client.config("default_color")),
            image: { url: map },
            thumbnail: { url: client.config("default_image") }
          }]
        })
      }

      let votedHexes = [... new Set(allVotes.map(x => x.get("voted")))]

      await db.hexes.reload()
      let hexes = db.hexes.filter(x => votedHexes.includes(x.get("hex_id")))

      const factions = new Map(
        db.factions.filter(x => x.get("status"))
          .map(f => [f.get("faction_name"), {
            name: `${f.get("pin_emoji")} \`${f.get("faction_name").toUpperCase()}\``,
            value: [],
            inline: true
          }])
      )

      allVotes.forEach(vote => {
        let member = input.source.guild.members.resolve(vote.get("user_id")),
         faction;

        if (member.roles.cache.get(client.config("cartel_role"))) faction = "cartel";
        else if (member.roles.cache.get(client.config("triad_role"))) faction = "triad";

        vote.set("faction", faction)
      })

      console.log(allVotes)

      hexes.forEach(hex => {
        let votes = allVotes.filter(x => x.get("voted") == hex.get("hex_id")),
          cartel = votes.filter(v => v.get("faction") === "cartel").length,
          triad = votes.filter(v => v.get("faction") === "triad").length,
          owner = hex.get("controlled_by")

        if (cartel) factions.get("cartel").value.push([(owner == "cartel" ? "🛡️" : "⚔️"), hex.get("hex_id"), cartel])
        if (triad) factions.get("triad").value.push([(owner == "triad" ? "🛡️" : "⚔️"), hex.get("hex_id"), triad])
      })

      const fields = [...factions.values()].map(fac => {
        fac.value = fac.value.sort((a, b) => b[2] - a[2]).map(x => `${x[0]} ${x[1]} (${x[2]})`).join("\n")
        if (!fac.value) fac.value = "-# None yet..."
        return fac
      })

      if (client.config("city_hex_votes")) fields.push({
        name: `${client.config("city_emoji")} \`CITY\``,
        value: client.config("city_hex_votes"),
        inline: true
      })

      return await input.source.editReply({
        embeds: [{
          title: "✦ `VOTE SUMMARY`",
          description:
            "**` VOTE DEADLINES `**" +
            `\n> \`  ATTACK ${client.config("decorative_symbol")} \` <t:${Math.floor(dl.atk.getTime() / 1000)}:f> (<t:${Math.floor(dl.atk.getTime() / 1000)}:R>)` +
            `\n> \` GENERAL ${client.config("decorative_symbol")} \` <t:${Math.floor(dl.vote.getTime() / 1000)}:f> (<t:${Math.floor(dl.vote.getTime() / 1000)}:R>)`,
          color: color(client.config("default_color")),
          fields,
          image: { url: map },
          thumbnail: { url: client.config("default_image") }
        }]
      })

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
  }
}