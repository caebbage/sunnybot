const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { color } = require("../module/helpers.js")


module.exports = {
  name: "choose",
  alias: ["ch"],
  prefix: true,
  slash: new SlashCommandBuilder()
    .setName('choose')
    .setDescription(`Choose from a list of options!`)
    .addStringOption(option => option
      .setName('choices')
      .setDescription("Your choices, separated by |, eg. one|two|three")
      .setRequired(true)
    )
    .addStringOption(option => option
      .setName('comment')
      .setDescription("Add a comment.")
    )
    .addIntegerOption(option => option
      .setName("multi")
      .setDescription("Specify if you want multiple (nonrepeating) options to be pulled.")
      .setMinValue(1)
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
        choices: interaction.options.getString("choices"),
        multi: Math.max(interaction.options.getInteger("multi"), 1),
        comment: interaction.options.getString("comment"),
        hide: interaction.options.getBoolean("hide") ?? false
      }
    } else {
      let parse = /^(\(x(?<times>\d+)\))?(?<choices>.+?)(?= # |$)/s.exec(inputs)

      input = {
        source: message,
        multi: Math.max(+(parse.groups.times || 1), 1),
        choices: parse.groups.choices,
        comment: /(?<= # ).+$/s.exec(inputs)?.[0],
        hide: false
      }
    }

    return await this.execute(input.source.client, input)
  },
  async execute(client, input) {

    try {
      let choices = input.choices.split("|").map(x => x.trim()).filter(x => x)
      let remaining = [...choices]
      let results = [];
      for (let i = 0; i < input.multi; i++) {
        let r = Math.floor(Math.random() * remaining.length)

        results.push(`\n>   ➜ **${remaining[r]}**`)
        remaining.splice(r, 1)
      }
      input.source.reply({
        embeds: [{
          title: `${client.config("decorative_symbol")} CHOOSE`,
          description: (input.comment ? input.comment + "\n" : "")
          + `> ${choices.join(" | ")}`
          + results.join(""),

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