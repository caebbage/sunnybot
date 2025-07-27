const { DiceRoller, DiscordRollRenderer } = require('dice-roller-parser'),
  { color } = require("../module/helpers");
const roller = new DiceRoller(),
  renderer = new DiscordRollRenderer();

const { SlashCommandBuilder, MessageFlags } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('roll')
    .setDescription(`Roll dice.`)
    .addStringOption(option => option
      .setName("roll")
      .setDescription("The roll syntax (eg. \"1d20 + 3\"). Type \"help\" instead for more info.")
      .setRequired(true)
    )
    .addStringOption(option => option
      .setName("note")
      .setDescription("An additional note that is displayed with the result.")
    )
    .addBooleanOption(option => option
      .setName("hide")
      .setDescription("If you want this command to be hidden from others.")
    ),
  async execute(interaction) {
    try {
      let input = interaction.options.getString("roll"),
        note = interaction.options.getString("note"),
        hide = interaction.options.getBoolean("hide");

      if (input.toLowerCase() == "help") {
        return await interaction.reply({
          embeds: [{
            title: "🎲 DICE ROLL REFERENCE",
            description: "Here is a quick reference for some commonly-used dice notation in RP!\n> `1d20`: Roll a die.\n> `1d20 + 1`: Roll a die with a +1 modifier.\n> `1d20 - 1`: Roll a die with a -1 modifier.\n> \n> `2d20kh1`: Roll with advantage (\"keep highest\").\n> `2d20kl1`: Roll with disadvantage (\"keep lowest\").\n> \n> `2d20kh1 + 1` Roll with advantage, with a +1 modifier.\n> `2d20kl1 - 1` Roll with disadvantage, with a -1 modifier.\nFor more complex notation, check out [Roll 20](<https://help.roll20.net/hc/en-us/articles/360037773133-Dice-Reference>)'s dice reference!",
            color: color(interaction.client.config("default_color"))
          }],
          flags: hide ? MessageFlags.Ephemeral : undefined
        })
      } else {
        let roll = roller.roll(input)

        let eval = renderer.render(roll)
          .replace(/^(.+) = (\d+)$/m, "$1") // trims result out of eval
          .replace(/\((.+?) = \d+\)/g, "[$1]") // replaces roll frames and removes =
        if (!eval.includes("]") && input.toLowerCase().includes("d"))
          eval = `[${eval}]` // adds frame if unframed + there is a roll in the input

        // let min = (new DiceRoller(() => 0)).roll(input).value,
        //  max = (new DiceRoller(() => 1)).roll(input).value;

        return await interaction.reply({
          embeds: [{
            title: '🎲 ROLL: ' + roll.value,
            description: (note?.length ? note + "\n" : "") + `> ${input.trim()} ⇒ ${eval} ⇒ ${roll.value}`,
            color: color(interaction.client.config("default_color")),
            footer: {
              text: (interaction.member || interaction.user).displayName,
              icon_url: (interaction.member || interaction.user).displayAvatarURL()
            },
            timestamp: new Date().toISOString()
          }],
          flags: hide ? MessageFlags.Ephemeral : undefined
        })
      }
    } catch (error) {
      console.log(error);
      return await interaction.reply({
        content: "An error occurred:\n-# `" + error.message + "`",
        flags: MessageFlags.Ephemeral
      })
    }
  }
};