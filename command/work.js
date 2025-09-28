const { SlashCommandBuilder, MessageFlags } = require('discord.js')
const { randBetween, money, color } = require("../module/helpers.js")
const { drawPool } = require("../module/gacha.js")

module.exports = {
  name: "work",
  prefix: true,
  slash: new SlashCommandBuilder()
    .setName('work')
    .setDescription(`Do some work! Get paid!`)
  ,
  async parse(interaction, message) {
    var input = {};

    if (interaction) {
      input = {
        source: interaction,
        user: interaction.user.id
      }
    } else {
      input = {
        source: message,
        user: message.author.id
      }
    }

    return await this.execute(input.source.client, input)
  },
  async execute(client, input) {
    const db = client.db;

    try {
      await db.users.reload()
      let profile = db.users.find(row => row.get("user_id") == input.user);

      if (!profile) throw new Error("You couldn't be found in the system! The moderators may still need to register you.")

      await db.work.reload()
      let work = db.work.filter(x => x.get("type") && x.get("description")),
        config = {};

      [...work.find(x => x.get("type") == "config").get("description").matchAll(/(^.+?): (.+$)/gm)].forEach(param => {
        config[param[1]] = param[2]
      })

      if (config.disabled?.toLowerCase() == "true") return;

      const lastUsed = new Date(+profile.get("work_cooldown") || 0);
      const nextValid = new Date();

      if (config.cooldown.toLowerCase() != "daily") {
        nextValid.setTime(lastUsed.valueOf() + (+config.cooldown * 60000))
      } else {
        nextValid.setTime(lastUsed.valueOf())
        nextValid.setHours(0, 0, 0, 0)
        nextValid.setDate(lastUsed.getDate() + 1)
      }

      const now = new Date();

      if (now.valueOf() <= nextValid.valueOf()) {
        return await input.source.reply({
          embeds: [{
            description: `You've worked too recently! Try again in <t:${Math.floor(nextValid.valueOf() / 1000)}:R>.`,
            color: color(client.config("default_color")),
            timestamp: new Date().toISOString()
          }]
        })
      }

      const newCooldown = new Date();
      if (config.cooldown.toLowerCase() != "daily") {
        newCooldown.setTime(now.valueOf() + (+config.cooldown * 60000))
      } else {
        newCooldown.setTime(now.valueOf())
        newCooldown.setHours(0, 0, 0, 0)
        newCooldown.setDate(now.getDate() + 1)
      }

      if (randBetween(0, 100) <= +(config.success_rate.replace(/[^\d\.]/g, ""))) {
        var reward = randBetween(config.min_earned, config.max_earned);

        const oldVal = parseInt(profile.get("money") || 0),
          newVal = oldVal + reward;

        profile.set("work_cooldown", now.valueOf())
        profile.set("money", newVal)

        let result = drawPool(work.filter(x => x.get("type") == "success").map(x => x.toObject()))[0];

        if (input.source.replied) throw new Error("Transaction already processed!")
        await profile.save()

        let response = await input.source.reply({
          embeds: [{
            description: result.description.replace("{{MONEY}}", money(reward, client))
              + `\n-# You may work again in <t:${Math.floor(newCooldown.valueOf() / 1000)}:R>, resetting at midnight PST.`,
            color: color(client.config("default_color"))
          }],
          fetchReply: true
        })

        return await client.log(`**WORK:** <@${input.user}>`
          + `\n> **Result:** Success`
          + `\n> **Money:** +${reward} (${oldVal} → ${newVal})`,
          { url: response.url }
        )
      } else {
        profile.set("work_cooldown", now.valueOf())

        let result = drawPool(work.filter(x => x.get("type") == "fail").map(x => x.toObject()))[0];

        if (input.source.replied) throw new Error("Transaction already processed!")
        await profile.save()

        let response = await input.source.reply({
          embeds: [{
            description: result.description
              + `\n-# You may work again in <t:${Math.round(newCooldown.valueOf() / 1000)}:R>.`,
            color: color(client.config("default_color"))
          }],
          fetchReply: true
        })

        return await client.log(`**WORK:** <@${input.user}>`
          + `\n> **Result:** Fail`,
          { url: response.url }
        )
      }
    } catch (error) {
      console.log(error);
      return await input.source.reply({
        content: "An error occurred:\n-# `" + error.message + "`",
        flags: MessageFlags.Ephemeral
      })
    }
  }
}