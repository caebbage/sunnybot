const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { color } = require("../module/helpers.js")

const { DiceRoller, DiscordRollRenderer } = require("dice-roller-parser"),
  roller = new DiceRoller(),
  renderer = new DiscordRollRenderer();

module.exports = {
  name: "roll",
  alias: ["r"],
  prefix: true,
  slash: new SlashCommandBuilder()
    .setName('roll')
    .setDescription(`Roll a die!`)
    .addStringOption(option => option
      .setName('dice')
      .setDescription("Your roll, eg. 1d100+35.")
      .setRequired(true)
    )
    .addStringOption(option => option
      .setName('comment')
      .setDescription("Add a comment.")
    )
    .addBooleanOption(option => option
      .setName("hide")
      .setDescription("If you want this command to not be visible to others.")
    ),
  async parse(interaction, message, inputs) {
    var input = {};

    if (interaction) {
      input = {
        source: interaction,
        dice: interaction.options.getString("dice"),
        comment: interaction.options.getString("comment"),
        hide: interaction.options.getBoolean("hide") ?? false
      }
    } else {
      input = {
        source: message,
        dice: /^.+?(?= # |$)/.exec(inputs)[0],
        comment: /(?<= # ).+$/s.exec(inputs)?.[0],
        hide: false
      }
    }

    return await this.execute(input.source.client, input)
  },
  async execute(client, input) {

    try {
      let roll = roller.roll(input.dice);

      let finalRoll = renderer.render(roll)
        .replace(/^(.+) = (\d+)$/m, "$1") // trims result out of final roll
        .replace(/\((.+?) = \d+\)/g, "[$1]") // replaces roll frames and removes =
      if (!finalRoll.includes("]") && input.dice.toLowerCase().includes("d")) finalRoll = `[${finalRoll}]` // adds frame if unframed + there is a roll in the input


      input.source.reply({
        embeds: [{
          title: `${client.config("decorative_symbol")} ROLLED: \`${input.dice}\``,
          description: (input.comment ? input.comment + "\n" : "")
          + `> ${finalRoll} ➜ **\`${roll.value}\`**`,
          color: color(client.config("default_color"))
        }],
        flags: (input.hide ? MessageFlags.Ephemeral : undefined)
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