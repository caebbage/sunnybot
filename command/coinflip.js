const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { color, limit } = require("../module/helpers.js")


module.exports = {
  name: "coinflip",
  alias: ["coin", "flip", "cf"],
  prefix: true,
  slash: new SlashCommandBuilder()
    .setName('coinflip')
    .setDescription(`Flip some coins!`)
    .addStringOption(option => option
      .setName('comment')
      .setDescription("Add a comment.")
    )
    .addIntegerOption(option => option
      .setName("multi")
      .setDescription("Specify if you want multiple coins to be flipped.")
      .setMinValue(1)
      .setMaxValue(20)
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
        multi: limit((interaction.options.getInteger("multi") || 1), 1, 20),
        comment: interaction.options.getString("comment"),
        hide: interaction.options.getBoolean("hide") ?? false
      }
    } else {
      input = {
        source: message,
        multi: limit(+(/^\d+/.exec(inputs)?.[0] || 1), 1, 20),
        comment: /(?<=# ).+$/s.exec(inputs)?.[0],
        hide: false
      }
    }

    return await this.execute(input.source.client, input)
  },
  async execute(client, input) {

    try {
      let results = [];
      for (let i = 0; i < input.multi; i++) {
        let r = Math.floor(Math.random() * 2)

        if (r) results.push(client.config("coinflip_heads_emoji"))
        else results.push(client.config("coinflip_tails_emoji"))
      }
      input.source.reply({
        embeds: [{
          title: `${client.config("decorative_symbol")} COINFLIP${(input.multi > 1) ? ` x${input.multi}` : ""}`,
          description: (input.comment ? input.comment + "\n" : "")
            + ">   ➜ " + results.join(""),
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