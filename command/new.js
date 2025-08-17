const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { userEmbed, charaEmbed } = require("../module/helpers.js")

module.exports = {
  name: "new",
  slash: new SlashCommandBuilder()
    .setName('new')
    .setDescription(`Creates a new...`)
    .addSubcommand(subcommand => subcommand
      .setName('profile')
      .setDescription("Creates a new user profile, without a character.")
      .addUserOption(option => option
        .setName('user')
        .setDescription('The user.')
        .setRequired(true)
      )
    )
    .addSubcommand(subcommand => subcommand
      .setName('chara')
      .setDescription('Creates a new character profile.')
      .addUserOption(option => option
        .setName('user')
        .setDescription('The user who owns the character.')
        .setRequired(true)
      )
      .addStringOption(option => option
        .setName('name')
        .setDescription("The character's (short) name.")
        .setRequired(true)
      )
      .addStringOption(option => option
        .setName('fullname')
        .setDescription("The character's full name.")
        .setRequired(true)
      )
      .addStringOption(option => option
        .setName('faction')
        .setDescription("The character's faction.")
        .setRequired(true)
      )
      .addBooleanOption(option => option
        .setName("npc")
        .setDescription("If the character is an NPC or not.")
      )
    ),
  async parse(interaction) {
    return await this.execute(interaction.client, {
      source: interaction,
      command: interaction.options.getSubcommand(),
      user: interaction.options.getUser("user"),
      name: interaction.options.getString("name"),
      fullname: interaction.options.getString("fullname"),
      faction: interaction.options.getString("faction"),
      npc: interaction.options.getBoolean("npc") || false
    })
  },
  async execute(client, input) {
    const db = client.db;

    try {
      if (input.command === "profile") {
        db.users.reload()

        if (db.users.find(row => row.get("user_id") == input.user)) throw new Error("This user already exists.")

        let profile = await db.users.sheet.addRow({
          user_id: input.user.id,
          display_name: input.user.username,
          pronouns: "tba",
          timezone: "GMT +?",
          money: 0
        })
        await client.log(`**NEW PROFILE:** ${input.user}`, input.source.user.id)

        return await input.source.reply({
          content: "User created! Please edit info within Sheets database.",
          embeds: [
            await userEmbed(profile, client)
          ]
        })
      } else if (input.command === "chara") {
        let profile = db.users.find(row => row.get("user_id") == input.user);

        if (!profile) {
          profile = await db.users.sheet.addRow({
            user_id: input.user,
            display_name: (await client.users.fetch(input.user)).username
          })
          await client.log(`**NEW PROFILE:** ${input.user}`, input.source.user.id)
        }

        if (db.charas.find(row => row.get("chara_name").toUpperCase() == input.name)) throw new Error("A character with this name already exists.")

        let res = {
          chara_name: input.name,
          owner_id: input.user.id,
          full_name: input.fullname,
          faction: input.faction,
          reputation: 1000,
          is_NPC: input.npc
        };

        let chara = await db.charas.sheet.addRow(res)

        await client.log(`**NEW CHARACTER:** \`${res.chara_name}\` (${res.full_name}) (${input.user})`, input.source.user.id)

        return await input.source.reply({
          content: "Character added! Please edit info within Sheets database.",
          embeds: [
            await userEmbed(profile, client),
            charaEmbed(chara, client)
          ]
        })
      }
    } catch (error) {
      console.log(error)
      return await input.source.reply({
        content: "An error occurred:\n-# `" + error.message + "`",
        flags: MessageFlags.Ephemeral
      })
    }
  }
};