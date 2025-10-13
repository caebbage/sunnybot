const { SlashCommandBuilder, MessageFlags } = require('discord.js')
const { hexList, color, formatEmbed } = require("../module/helpers.js")
fuzzy = require("fuzzy");

module.exports = {
  name: "map",
  prefix: true,
  slash: new SlashCommandBuilder().setName('map')
    .setDescription(`View the current map state.`)
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
    try {
      let embed = await getMap(client);

      return await input.source.reply({
        embeds: [ embed ],
        components: buttons(client),
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
    const client = interaction.client,
      db = client.db;

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

      await db.hexes.reload()

      let input = inputs.shift();

      if (input === "info") {
        return await interaction.update({
          embeds: [ await getMap(client) ],
          components: buttons(client)
        })
      } else if (input === "hexlist") {
        const page = +inputs.shift()
        const list = hexList(client, "all")

        let embed = {
          title: "`📍 HEXES IN PLAY`",
          description: "```ansi\n" + list[page] + "```\n-# Use `/hex hex:id` to view info on a specific hex.",
          color: color(client.config("default_color")),
          thumbnail: {
            url: client.config("default_image")
          },
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

async function getMap(client) {
  const map = await client.db.actions.get("mapimage");

  if (!map) throw new Error("An issue occurred while grabbing the map! (Try again later!)");

  const data = map.map(row => row.toObject()).filter(row => row.weight && !isNaN(row.weight) && row.value).map(x => x.value);

  return formatEmbed(data, { color: color(client.config("default_color")) }, true)[0]
}

function buttons(client, page = -1) {
  let buttons = [];
  let list = hexList(client, "all");

  if (!list.length) return;

  buttons.push({
    custom_id: `map:info`,
    type: 2,
    style: 4,
    label: `${client.config("decorative_symbol")} Map`
  })

  if (page == -1) {
    buttons.push({
      custom_id: `map:hexlist:0`,
      type: 2, style: 2,
      label: `📍 Hexes`
    })
  } else {

    if (page > 0) {
      buttons.push({
        custom_id: `map:hexlist:${page - 1}`,
        type: 2, style: 2,
        label: `◀ Back`
      })
    }

    if (page + 1 < list.length) {
      buttons.push({
        custom_id: `map:hexlist:${page + 1}`,
        type: 2, style: 2,
        label: `▶ Next`
      })
    }
  }

  return [{ type: 1, components: buttons }]
}