const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { color } = require("../module/helpers.js");
const { drawPool } = require("../module/gacha.js");

module.exports = {
  name: "8ball",
  prefix: true,
  slash: new SlashCommandBuilder()
    .setName('8ball')
    .setDescription(`Consult the magic 8 ball!`)
    .addStringOption(option => option
      .setName('query')
      .setDescription("Your question...")
      .setRequired(true)
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
        query: interaction.options.getString("query"),
        hide: interaction.options.getBoolean("hide") ?? false
      }
    } else {
      input = {
        source: message,
        query: inputs?.trim(),
        hide: false
      }
    }

    return await this.execute(input.source.client, input)
  },
  async execute(client, input) {

    try {
      const choices = await client.db.actions.get("8ballchooser");

      if (!choices) throw new Error("An issue occurred while grabbing the choices! (Try again later!)");

      const data = choices.map(row => row.toObject()).filter(row => row.weight && !isNaN(row.weight) && row.value);
      const result = drawPool(data);

      input.source.reply({
        embeds: [{
          title: `${client.config("decorative_symbol")} EIGHT BALL`,
          description: (input.comment ? input.comment + "\n" : "")
          + input.query.split("\n").map(x => `> ${x}`).join("\n")
          + `\n> ➜ **\`${result[0].value}\`**`,

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