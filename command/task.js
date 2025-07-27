const { SlashCommandBuilder, MessageFlags } = require('discord.js'),
  { color } = require("../module/helpers.js"),
  fuzzy = require("fuzzy"),
  { Inventory } = require("../module/inventory.js"),
  { award } = require("../module/transactions.js")

module.exports = {
  data:
    new SlashCommandBuilder()
      .setName('task')
      .setDescription(`Repeatable activities for rewards!`)
      .addSubcommand(subcommand => subcommand
        .setName("info")
        .setDescription("Check a task's info!")
        .addStringOption(option => option
          .setName("task")
          .setDescription("The name of the task being claimed.")
          .setAutocomplete(true)
          .setRequired(true)
        )
      )
      .addSubcommand(subcommand => subcommand
        .setName("claim")
        .setDescription("Claim a task for rewards!")
        .addStringOption(option => option
          .setName("task")
          .setDescription("The name of the task being claimed.")
          .setAutocomplete(true)
          .setRequired(true)
        )
        .addStringOption(option => option
          .setName("chara")
          .setDescription("The character completing this task.")
          .setAutocomplete(true)
          .setRequired(true)
        )
        .addStringOption(option => option
          .setName("notes")
          .setDescription("Link to proof of completion, or any other message you'd like to add for mods.")
          .setRequired(true)
        )
      )
  ,
  async execute(interaction) {
    const 
    client = interaction.client
    db = client.db;

    try {
      if (interaction.options.getSubcommand() === "info") {
        await db.tasks.reload()
        const task = db.tasks.find(row => row.get("task_id") == interaction.options.getString("task", true));
        if (!task) throw new Error("The specified task could not be found!")

        return await interaction.reply({
          embeds: [{
            title: `${client.config("poke_symbol")} ${task.get("task_id")}: ${task.get("task_name")}`,
            description: task.get("description").split("\n").map(x => `> ${x}`).join("\n") +
              "\n\n**`   REQUIREMENTS `**\n" +
              task.get("requirement").split("\n").map(x => `> ${x}`).join("\n") +
              rewards(task, client),
            color: color(client.config("default_color")),
            thumbnail: {
              url: client.config("default_image")
            }
          }]
        })
      } else if (interaction.options.getSubcommand() === "claim") {
        await db.tasks.reload()
        const task = db.tasks.find(row => row.get("task_id") == interaction.options.getString("task", true));
        if (!task) throw new Error("The specified task could not be found!")

        await db.charas.reload()
        const chara = db.charas.find(row => row.get("chara_name") == interaction.options.getString("chara", true));
        if (!chara) throw new Error("The specified character could not be found!")
        if (chara.get("owner") != interaction.user.id) throw new Error("This character does not belong to you!")


        const claimChannel = await client.channels.fetch(client.config("claim_channel"));
        const claim = await claimChannel.send({
          embeds: [{
            title: `${client.config("loading_symbol")} CLAIM FOR ${task.get("task_id")}: ${task.get("task_name")}`,
            description:
              "**`       CLAIM BY `** " + `<@${interaction.user.id}> for ${chara.get("chara_name")}\n` +
              "\n**`    CLAIM NOTES `**\n" + interaction.options.getString("notes").split("\n").map(x => `> ${x}`).join("\n") +
              "\n\n**`   REQUIREMENTS `**\n" +
              task.get("requirement").split("\n").map(x => `> ${x}`).join("\n") +
              rewards(task, client),
            color: color(client.config("default_color")),
            thumbnail: {
              url: client.config("default_image")
            },
            timestamp: new Date().toISOString()
          }],
          components: [{
            type: 1,
            components: [
              {
                custom_id: `task:approve:${task.get("task_id")}:${chara.get("chara_name")}`,
                type: 2,
                style: client.config("default_button_color"),
                label: `Approve`
              },
              {
                custom_id: `task:reject`,
                type: 2,
                style: 4,
                label: "Reject"
              }
            ]
          }]
        })

        interaction.reply({
          embeds: [{
            description: "Your claim has been submitted here! → " + claim.url,
            color: color(client.config("default_color")),
            timestamp: new Date().toISOString()
          }]
        })
      }
    } catch (error) {
      console.log(error);
      await interaction.reply({
        content: "An error occurred:\n-# `" + error.message + "`",
        flags: MessageFlags.Ephemeral
      })
    }
  },
  async autocomplete(interaction) {
    const focused = interaction.options.getFocused(true),
      db = interaction.client.db;

    try {
      if (focused.name === "chara") {
        if (focused.value.length <= 1) await db.charas.reload()

        let filtered = db.charas.data.length ? fuzzy.filter(focused.value, db.charas.filter(x => x.get("owner") == interaction.user.id), { extract: x => (x.get("chara_name") + " / " + x.get("fullname")).normalize('NFD').replace(/\p{Diacritic}/gu, '') }) : []
        if (filtered.length > 25) filtered.length = 25

        return await interaction.respond(
          filtered.map(choice => ({ name: choice.original.get("chara_name") + " / " + choice.original.get("fullname"), value: choice.original.get("chara_name") }))
        )
      } else if (focused.name === "task") {
        if (focused.value.length <= 1) await db.tasks.reload()

        let filtered = (db.tasks.data?.length ? fuzzy.filter(focused.value, db.tasks.data, { extract: x => (x.get("task_id") + " / " + x.get("task_name")).normalize('NFD').replace(/\p{Diacritic}/gu, '') ?? "" }) : [])
        if (filtered.length > 25) filtered.length = 25

        return await interaction.respond(
          filtered.map(choice => ({ name: choice.original.get("task_id") + " / " + choice.original.get("task_name"), value: choice.original.get("task_id") }))
        )
      }
    } catch (error) {
      console.log(error)
    }
  },
  async button(interaction, inputs) {
    let input = inputs.shift();
    const client = interaction.client,
      db = client.db,
      perms = interaction.member?.permissionsIn(interaction.channel)

    try {
      if (perms.has("ADMINISTRATOR") || perms.has("MODERATE_MEMBERS")) {
        if (input == "approve") {
          await db.tasks.reload()
          const task = db.tasks.find(row => row.get("task_id") == inputs[0]);
          if (!task) throw new Error("The specified task could not be found!")

          await db.charas.reload()
          const chara = db.charas.find(row => row.get("chara_name") == inputs[1]);
          if (!chara) throw new Error("The specified character could not be found!")

          await db.users.reload()
          const user = db.users.find(row => row.get("user_id") == chara.get("owner"));
          if (!user) throw new Error("The user could not be found!")
          let embed = { ...interaction.message.embeds[0].data };
          embed.title = embed.title.replace(client.config("loading_symbol"), "✅")
          delete embed.type;

          await interaction.update({
            embeds: [embed],
            components: []
          })

          await award(interaction, user, chara,
            parseInt(task.get("money") || 0),
            parseInt(task.get("xp") || 0),
            new Inventory(task.get("items")),
            undefined
          )
        } else if (input === "reject") {
          let embed = { ...interaction.message.embeds[0].data };
          embed.title = embed.title.replace(client.config("loading_symbol"), "❌");
          delete embed.type;

          await interaction.update({
            embeds: [embed],
            components: []
          })
        }
      } else {
        return await interaction.reply({
          content: "Only moderators can approve or decline task claims!",
          flags: MessageFlags.Ephemeral
        })
      }
    } catch (error) {
      console.log(error);
      await interaction.reply({
        content: "An error occurred:\n-# `" + error.message + "`",
        flags: MessageFlags.Ephemeral
      })
    }

  }
};

const rewards = (task, client) => {
  let rewardLine = [], res;
  if (task.get("money")) rewardLine.push(client.config("money_symbol") + task.get("money"))
  if (task.get("xp")) rewardLine.push(task.get("xp") + client.config("xp_symbol"))

  res = "\n**`        REWARDS `** " + rewardLine.join("　");

  if (task.get("items")) {
    res += "\n\n" + new Inventory(task.get("items")).sort().toString().replace(/^/gm, "> ")
  }

  return res;
}