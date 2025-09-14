const { SlashCommandBuilder, MessageFlags } = require('discord.js'),
  { color, money } = require("../module/helpers.js"),
  fuzzy = require("fuzzy"),
  { Inventory } = require("../module/inventory.js")

module.exports = {
  name: "task",
  slash: new SlashCommandBuilder()
    .setName('task')
    .setDescription(`Repeatable activities for rewards!`)
    .addSubcommand(subcommand => subcommand
      .setName("info")
      .setDescription("Check a task's info!")
      .addStringOption(option => option
        .setName("task")
        .setDescription("The name of the task.")
        .setAutocomplete(true)
        .setRequired(true)
      )
      .addBooleanOption(option => option
        .setName("hide")
        .setDescription("If you want this command to not be visible to others.")
      )
    )
  ,
  async parse(interaction) {
    return await this.execute(interaction.client, {
      source: interaction,
      command: interaction.options.getSubcommand(),
      task: interaction.options.getString("task"),
      hide: interaction.options.getBoolean("hide") || false
    })
  },
  async execute(client, input) {
    const db = client.db;

    try {
      if (input.command === "info") {
        await db.tasks.reload()
        const task = db.tasks.find(row => row.get("task_name") == input.task);
        if (!task) throw new Error("The specified task could not be found!")

        return await input.source.reply({
          "embeds": [{
            title: `${client.config("decorative_symbol")} ${task.get("task_name").toUpperCase()} ${task.get("difficulty")}`,
            "description": task.get("description").trim().split("\n").map(x => `> ${x}`).join("\n")
              + `\n\n**\`  NOTES \`**\n` + task.get("notes").trim().split("\n").map(x => `> ${x}`).join("\n"),
            "fields": [
              {
                "name": "` REWARDS `",
                "value":
                  rewards(task, client),
                "inline": true
              },
              {
                "name": "` METHODS `",
                "value": task.get("method").split("\n").map(x => `> ${x}`).join("\n"),
                "inline": true
              }
            ],
            image: { url: task.get("task_icon") || undefined },
            footer: {
              "text": "SUNNY CANTILADOS",
              "icon_url": client.config("default_image")
            },
            color: color(client.config("default_color")),
          }],
          flags: (input.hide ? MessageFlags.Ephemeral : undefined)
        })
      } else if (input.command === "claim") {
        // await db.tasks.reload()
        // const task = db.tasks.find(row => row.get("task_id") == interaction.options.getString("task", true));
        // if (!task) throw new Error("The specified task could not be found!")

        // await db.charas.reload()
        // const chara = db.charas.find(row => row.get("chara_name") == interaction.options.getString("chara", true));
        // if (!chara) throw new Error("The specified character could not be found!")
        // if (chara.get("owner") != interaction.user.id) throw new Error("This character does not belong to you!")

        // const claimChannel = await client.channels.fetch(client.config("claim_channel"));
        // const claim = await claimChannel.send({
        //   embeds: [{
        //     title: `${client.config("loading_symbol")} CLAIM FOR ${task.get("task_id")}: ${task.get("task_name")}`,
        //     description:
        //       "**`       CLAIM BY `** " + `<@${interaction.user.id}> for ${chara.get("chara_name")}\n` +
        //       "\n**`    CLAIM NOTES `**\n" + interaction.options.getString("notes").split("\n").map(x => `> ${x}`).join("\n") +
        //       "\n\n**`   REQUIREMENTS `**\n" +
        //       task.get("requirement").split("\n").map(x => `> ${x}`).join("\n") +
        //       rewards(task, client),
        //     color: color(client.config("default_color")),
        //     thumbnail: {
        //       url: client.config("default_image")
        //     },
        //     timestamp: new Date().toISOString()
        //   }],
        //   components: [{
        //     type: 1,
        //     components: [
        //       {
        //         custom_id: `task:approve:${task.get("task_id")}:${chara.get("chara_name")}`,
        //         type: 2,
        //         style: client.config("default_button_color"),
        //         label: `Approve`
        //       },
        //       {
        //         custom_id: `task:reject`,
        //         type: 2,
        //         style: 4,
        //         label: "Reject"
        //       }
        //     ]
        //   }]
        // })

        // interaction.reply({
        //   embeds: [{
        //     description: "Your claim has been submitted here! → " + claim.url,
        //     color: color(client.config("default_color")),
        //     timestamp: new Date().toISOString()
        //   }]
        // })
      }
    } catch (error) {
      console.log(error);
      await input.source.reply({
        content: "An error occurred:\n-# `" + error.message + "`",
        flags: MessageFlags.Ephemeral
      })
    }
  },
  async autocomplete(interaction) {
    const focused = interaction.options.getFocused(true),
      db = interaction.client.db;

    try {
      if (focused.value.length <= 1) await db.tasks.reload()

      let data = db.tasks.data?.filter(x => x.get("task_name"));

      let filtered = (data.length ? fuzzy.filter(focused.value, data, { extract: x => x.get("task_name")?.normalize('NFD').replace(/\p{Diacritic}/gu, '') ?? "" }) : [])
      if (filtered.length > 25) filtered.length = 25
      
      return await interaction.respond(
        filtered.map(choice => ({ name: choice.original.get("task_name"), value: choice.original.get("task_name") }))
      )
    } catch (error) {
      console.log(error)
    }
  },
  // async button(interaction, inputs) {
  //   let input = inputs.shift();
  //   const client = interaction.client,
  //     db = client.db,
  //     perms = interaction.member?.permissionsIn(interaction.channel)

  //   try {
  //     if (perms.has("ADMINISTRATOR") || perms.has("MODERATE_MEMBERS")) {
  //       if (input == "approve") {
  //         await db.tasks.reload()
  //         const task = db.tasks.find(row => row.get("task_id") == inputs[0]);
  //         if (!task) throw new Error("The specified task could not be found!")

  //         await db.charas.reload()
  //         const chara = db.charas.find(row => row.get("chara_name") == inputs[1]);
  //         if (!chara) throw new Error("The specified character could not be found!")

  //         await db.users.reload()
  //         const user = db.users.find(row => row.get("user_id") == chara.get("owner"));
  //         if (!user) throw new Error("The user could not be found!")
  //         let embed = { ...interaction.message.embeds[0].data };
  //         embed.title = embed.title.replace(client.config("loading_symbol"), "✅")
  //         delete embed.type;

  //         await interaction.update({
  //           embeds: [embed],
  //           components: []
  //         })

  //         await award(interaction, user, chara,
  //           parseInt(task.get("money") || 0),
  //           parseInt(task.get("xp") || 0),
  //           new Inventory(task.get("items")),
  //           undefined
  //         )
  //       } else if (input === "reject") {
  //         let embed = { ...interaction.message.embeds[0].data };
  //         embed.title = embed.title.replace(client.config("loading_symbol"), "❌");
  //         delete embed.type;

  //         await interaction.update({
  //           embeds: [embed],
  //           components: []
  //         })
  //       }
  //     } else {
  //       return await interaction.reply({
  //         content: "Only moderators can approve or decline task claims!",
  //         flags: MessageFlags.Ephemeral
  //       })
  //     }
  //   } catch (error) {
  //     console.log(error);
  //     await interaction.reply({
  //       content: "An error occurred:\n-# `" + error.message + "`",
  //       flags: MessageFlags.Ephemeral
  //     })
  //   }

  // }
};

const rewards = (task, client) => {
  let rewardLine = [];
  if (task.get("reward_text")) rewardLine.push(...task.get("reward_text").split("\n"))
  if (task.get("money")) rewardLine.push(money(task.get("money"), client))
  if (task.get("items")) rewardLine.push(...task.get("items").split("\n"))

  return rewardLine.map(x => `> ${x}`).join("\n");
}