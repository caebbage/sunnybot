const { SlashCommandBuilder, MessageFlags } = require('discord.js')
const { arrayChunks, color } = require("../module/helpers.js")

module.exports = {
  name: "leaderboard",
  alias: ["lb", "rankings"],
  prefix: true,
  slash: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription(`View Reputation leaderboard.`)
    .addBooleanOption(option => option
      .setName("hide")
      .setDescription("If you want this command to not be visible to others.")
    ),

  async parse(interaction, message, inputs) {
    var input;
    if (interaction) {
      input = {
        source: interaction,
        hide: interaction.options.getBoolean("hide")
      }
    } else {
      input = { source: message, hide: false }
    }
    return await this.execute(input.source.client, input);
  },

  async execute(client, input) {
    const db = client.db;

    try {
      await db.charas.reload()
      const list = leaderboard(client)

      return await input.source.reply({
        embeds: [
          {
            title: `👑 LEADERBOARD`,
            description: "```ansi\n" + list[0] + "```",
            color: color(client.config("default_color")),
            footer: {
            "text": `SUNNY CANTILADOS ${client.config("decorative_symbol")} Page 1 of ${list.length}`,
              "icon_url": client.config("default_image")
            },
          }
        ],
        components: buttons(client, 0),
        flags: (input.hide ? MessageFlags.Ephemeral : undefined)
      })

    } catch (error) {
      console.log(error);
      return await input.source.reply({
        content: "An error occurred:\n-# `" + error.message + "`",
        flags: MessageFlags.Ephemeral
      })
    }
  },

  async button(interaction, inputs) {
    const client = interaction.client;
    const db = client.db;
    let input = inputs.shift();

    try {
      if (interaction.message.interactionMetadata) {
        if (interaction.user.id !== interaction.message.interactionMetadata.user.id)
          throw new Error("Only the original sender may utilize buttons!")
      } else {
        let replied = await interaction.message.channel.messages.fetch(interaction.message.reference.messageId);
        if (interaction.user.id !== replied.author.id) {
          throw new Error("Only the original sender may utilize buttons!")
        }
      }

      await db.charas.reload()

      if (input === "page") {
        const page = +inputs.shift()
        const list = leaderboard(client)

        let embed = {
          title: `👑 LEADERBOARD`,
          description: "```ansi\n" + list[page] + "```",
          color: color(client.config("default_color")),
          footer: {
            "text": `SUNNY CANTILADOS ${client.config("decorative_symbol")} Page ${page + 1} of ${list.length}`,
            "icon_url": client.config("default_image")
          },
        }

        return await interaction.update({
          embeds: [embed],
          components: buttons(client, page)
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

function leaderboard(client) {
  let charas = client.db.charas.filter(x => x.get("chara_name")),
    factions = client.db.factions.filter(x => x.get("faction_name"));

  let list = charas
    .sort((a, b) => a.get("last_first_name").localeCompare(b.get("last_first_name")))
    .sort((a, b) => +b.get("reputation") - +a.get("reputation"))
    .map((chara, index) => {
      let color = factions.find(x => x.get("faction_name") == chara.get("faction"))?.get("ansi_color") || 37

      let res = `[1;37m${index + 1}. [1;${color}m${chara.get("last_first_name")} [2;37m${chara.get("rank").split(" ")[0]}[0m`
      res += `\n[2;37m  ‣[2;30m ${chara.get("reputation")} reputation | ${chara.get("heat")} heat[0m`
      return res
    })

  return arrayChunks(list, 10).map(x => x.join("\n"))
}


function buttons(client, page = -1) {
  let buttons = [];
  let list = leaderboard(client);

  if (page > 0) {
    buttons.push({
      custom_id: `leaderboard:page:${page - 1}`,
      type: 2,
      style: client.config("default_button_color"),
      label: `◀ Back`
    })
  }

  if (page + 1 < list.length) {
    buttons.push({
      custom_id: `leaderboard:page:${page + 1}`,
      type: 2,
      style: client.config("default_button_color"),
      label: `▶ Next`
    })
  }

  if (buttons.length > 0) return [{ type: 1, components: buttons }]
  else return undefined
}