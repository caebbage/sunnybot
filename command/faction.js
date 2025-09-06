const { SlashCommandBuilder, MessageFlags } = require('discord.js')
const { factionEmbed, hexList, color } = require("../module/helpers.js")
fuzzy = require("fuzzy");

module.exports = {
  name: "faction",
  alias: ["cartel", "triad"],
  prefix: true,
  slash: new SlashCommandBuilder()
    .setName('faction')
    .setDescription(`View faction information.`)
    .addSubcommand(subcommand => subcommand
      .setName("cartel")
      .setDescription("View The Cartel's information.")
      .addBooleanOption(option => option
        .setName("hide")
        .setDescription("If you want this command to not be visible to others.")
      )
    )
    .addSubcommand(subcommand => subcommand
      .setName("triad")
      .setDescription("View The Triad's information.")
      .addBooleanOption(option => option
        .setName("hide")
        .setDescription("If you want this command to not be visible to others.")
      )
    ),

  async parse(interaction, message, inputs) {
    var input;
    if (interaction) {
      input = {
        source: interaction,
        faction: interaction.options.getSubcommand(),
        hide: interaction.options.getBoolean("hide")
      }
    } else {
      input = { source: message, hide: false }
      if (inputs) input.faction = inputs
      else input.faction = message.content.slice(process.env.PREFIX.length).trim().toLowerCase();
    }
    return await this.execute(input.source.client, input);
  },

  async execute(client, input) {
    const db = client.db;

    try {
      await db.turf.reload()
      await db.charas.reload()
      await db.factions.reload()

      let factions = db.factions.filter(row => row.get("faction_name"));

      let faction = factions.find(fac => fac.get("faction_name") == input.faction)

      if (!faction) throw new Error("Faction not found!")

      return await input.source.reply({
        embeds: [
          factionEmbed(faction, client)
        ],
        components: buttons(faction, client),
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

      await db.factions.reload()
      await db.turf.reload()

      let factions = db.factions.filter(row => row.get("faction_name"));
      let faction = factions.find(fac => fac.get("faction_name") == input)

      if (!faction) throw new Error("Faction not found!")

      input = inputs.shift();

      if (input === "info") {
        return await interaction.update({
          embeds: [factionEmbed(faction, client)],
          components: buttons(faction, client)
        })
      } else if (input === "hexlist") {
        const page = +inputs.shift()
        const list = hexList(client, faction.get("faction_name"))

        let embed = {
          title: `📍 ${faction.get("faction_name").toUpperCase()} TERRITORY`,
          description: "```ansi\n" + list[page] + "```",
          color: color(faction.get("main_color") || client.config("default_color")),
          thumbnail: {
            url: faction.get("crest_image")
          },
          footer: {
            "text": `SUNNY CANTILADOS ${client.config("decorative_symbol")} Page ${page + 1} of ${list.length}`,
            "icon_url": client.config("default_image")
          },
        }

        return await interaction.update({
          embeds: [embed],
          components: buttons(faction, client, page)
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

function buttons(faction, client, page = -1) {
  let buttons = [];
  let list = hexList(client, faction.get("faction_name"));

  if (!list.length) return;

  buttons.push({
    custom_id: `faction:${faction.get("faction_name")}:info`,
    type: 2,
    style: faction.get("button_color"),
    label: `${faction.get("simple_emoji")} Info`
  })

  if (page == -1) {
    buttons.push({
      custom_id: `faction:${faction.get("faction_name")}:hexlist:0`,
      type: 2,
      style: client.config("default_button_color"),
      label: `📍 Territory`
    })
  } else {

    if (page > 0) {
      buttons.push({
        custom_id: `faction:${faction.get("faction_name")}:hexlist:${page - 1}`,
        type: 2,
        style: client.config("default_button_color"),
        label: `◀ Back`
      })
    }

    if (page + 1 < list.length) {
      buttons.push({
        custom_id: `faction:${faction.get("faction_name")}:hexlist:${page + 1}`,
        type: 2,
        style: client.config("default_button_color"),
        label: `▶ Next`
      })
    }
  }

  return [{ type: 1, components: buttons }]
}