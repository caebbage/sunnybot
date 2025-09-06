const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { color } = require("../module/helpers.js")

const { DiceRoller, DiscordRollRenderer } = require("dice-roller-parser"),
  roller = new DiceRoller(),
  renderer = new DiscordRollRenderer();

module.exports = {
  name: "tier",
  prefix: true,
  slash: new SlashCommandBuilder()
    .setName('tier')
    .setDescription(`Roll your loot!`)
    .addStringOption(option => option
      .setName('faction')
      .setDescription("Your character's faction.")
      .addChoices(
        { name: 'Cartel', value: 'cartel' },
        { name: 'Triad', value: 'triad' }
      )
      .setRequired(true)
    )
  ,
  async parse(interaction, message, inputs) {
    var input = {};

    if (interaction) {
      input = {
        source: interaction,
        faction: interaction.options.getString("faction"),
        sender: interaction.user.id
      }
    } else {
      input = {
        source: message,
        faction: inputs?.toLowerCase().trim(),
        sender: message.author.id
      }
    }

    return await this.execute(input.source.client, input)
  },
  async execute(client, input) {
    const db = client.db;

    try {

      if (!input.faction) throw new Error("Please specify a faction!")
      if (!['cartel', 'triad'].includes(input.faction)) throw new Error("The faction specified is invalid!")

      const faction = client.db.factions.find(x => x.get("faction_name") == input.faction);

      await db.factions.reload()

      let roll = roller.roll(faction.get("loot_roll"));

      let eval = renderer.render(roll)
        .replace(/^(.+) = (\d+)$/m, "$1") // trims result out of eval
        .replace(/\((.+?) = \d+\)/g, "[$1]") // replaces roll frames and removes =
      if (!eval.includes("]") && faction.get("loot_roll").toLowerCase().includes("d")) eval = `[${eval}]` // adds frame if unframed + there is a roll in the input


      input.source.reply({
        embeds: [{
          title: `${faction.get("pin_emoji") || faction.get("simple_emoji")} ${faction.get("faction_name").toUpperCase()} TIER ${faction.get("tier")} LOOT: \`${faction.get("loot_roll")}\``,
          description: `> ${eval} ➜ **\`${roll.value}\`**`,
          color: color(faction.get("main_color") || client.config("default_color")),

          footer: {
            text: "@" + (await client.users.fetch(input.sender)).username
          },
          timestamp: new Date().toISOString()
        }],
      })
    } catch (error) {
      console.log(error);
      return await input.source.reply({
        content: "An error occurred:\n-# `" + error.message + "`",
        flags: MessageFlags.Ephemeral
      })
    }
  }
}