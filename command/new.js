const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { userEmbed, charaEmbed } = require("../module/helpers.js")

module.exports = {
  data:
    new SlashCommandBuilder()
      .setName('new')
      .setDescription(`Creates a new...`)
      .addSubcommand(subcommand => subcommand
        .setName('profile')
        .setDescription("Creates a new user profile.")
        .addUserOption(option => option
          .setName('user')
          .setDescription('The user.')
          .setRequired(true)
        )
      )
      .addSubcommand(subcommand => subcommand
        .setName('chara')
        .setDescription('Creates a new player character profile.')
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
        .addIntegerOption(option => option
          .setName("age")
          .setDescription("The character's age, in years.")
          .setRequired(true)
        )
        .addStringOption(option => option
          .setName("height")
          .setDescription("The character's height, in #'##\" / ###cm format.")
          .setRequired(true)
        )
        .addStringOption(option => option
          .setName("pronouns")
          .setDescription("The character's pronouns.")
          .setRequired(true)
        )
        .addStringOption(option => option
          .setName("partner")
          .setDescription("The character's partner pokemon, like [name] the [Pokemon].")
          .setRequired(true)
        )
        .addBooleanOption(option => option
          .setName("npc")
          .setDescription("If the character is an NPC or not.")
        )
        .addStringOption(option => option
          .setName("icon")
          .setDescription("A link to the character's profile icon. Perma-host sites preferred.")
        )
      ),
  async execute(interaction) {
    const db = interaction.client.db;

    try {
      if (interaction.options.getSubcommand() === "profile") {
        db.users.reload()

        if (db.users.find(row => row.get("user_id") == interaction.options.getUser("user").id)) throw new Error("This user already exists.")

        let profile = await db.users.sheet.addRow({
          user_id: interaction.options.getUser("user").id,
          display_name: interaction.options.getUser("user").displayName.toUpperCase(),
          display_icon: interaction.options.getUser("user").avatarURL(),
          pronouns: "edit to add",
          timezone: "edit to add",
          money: 0
        })
        await interaction.client.log(`**NEW PROFILE:** <@${interaction.options.getUser("user")}>`)

        return await interaction.reply({
          content: "User created!",
          embeds: [
            userEmbed(profile, interaction.options.getUser("user"))
          ]
        })
      } else if (interaction.options.getSubcommand() === "chara") {
        let profile = db.users.find(row => row.get("user_id") == interaction.options.getUser("user").id);
        if (!profile) {
          profile = await db.users.sheet.addRow({
            user_id: interaction.options.getUser("user").id,
            display_name: interaction.options.getUser("user").displayName.toUpperCase(),
            display_icon: interaction.options.getUser("user").avatarURL(),
            pronouns: "edit to add",
            timezone: "edit to add",
            money: 0
          })

          await interaction.client.log(`**NEW PROFILE:** <@${interaction.options.getUser("user")}>`)
        }

        if (db.charas.find(row => row.get("chara_name") == interaction.options.getString("chara_name").toUpperCase())) throw new Error("A character with this name already exists.")

        let res = {
          chara_name: interaction.options.getString("chara_name").toUpperCase(),
          owner: interaction.options.getUser("user").id,
          icon: interaction.options.getString("icon") ?? "",
          fullname: interaction.options.getString("fullname"),
          age: interaction.options.getInteger("age"),
          height: interaction.options.getString("height"),
          pronouns: interaction.options.getString("pronouns"),
          partner: interaction.options.getString("partner"),
          description: "Use `/profile edit` to customize this text!",
          is_npc: interaction.options.getBoolean("npc") ?? false,
          xp_points: 0,
          challenge_attempts: 0
        };

        let chara = await db.charas.sheet.addRow(res)

        await interaction.client.log(`**NEW CHARACTER:** \`${res.name}\` (<@${interaction.options.getUser("user")}>)`
          + Object.entries(res).filter(x => !["chara_name", "owner", "description", "xp_points", "challenge_attempts"]
            .includes(x[0])).map(x => `\n> **${x[0]}**: ${x[1]}`).join(""))

        return await interaction.reply({
          content: "Character added!",
          embeds: [
            userEmbed(profile, interaction.options.getUser("user")),
            charaEmbed(chara, interaction.options.getUser("user"))
          ]
        })
      }
    } catch (error) {
      console.log(error)
      return await interaction.reply({
        content: "An error occurred:\n-# `" + error.message + "`",
        flags: MessageFlags.Ephemeral
      })
    }
  }
};