const { SlashCommandBuilder, MessageFlags } = require('discord.js')
const { randBetween, money, color } = require("../module/helpers.js")
const { drawPool } = require("../module/gacha.js")

module.exports = {
  name: "crime",
  prefix: true,
  slash: new SlashCommandBuilder()
    .setName('crime')
    .setDescription(`Be gay, do crime!`)
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

      await db.crime.reload()
      let crime = db.crime.filter(x => x.get("type") && x.get("description")),
        config = {};

      [...crime.find(x => x.get("type") == "config").get("description").matchAll(/(^.+?): (.+$)/gm)].forEach(param => {
        config[param[1]] = param[2]
      })

      const lastUsed = new Date(+profile.get("crime_cooldown") || 0);
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
            description: `Woah, slow down there! Try again in <t:${Math.floor(nextValid.valueOf() / 1000)}:R>.`,
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

        profile.set("crime_cooldown", now.valueOf())
        profile.set("money", newVal)

        let result = drawPool(crime.filter(x => x.get("type") == "success").map(x => x.toObject()))[0];

        await client.log(`**CRIME:** <@${input.user}>`
          + `\n> **Result:** Success`
          + `\n> **Money:** +${reward} (${oldVal} → ${newVal})`
        )

        await profile.save()

        return await input.source.reply({
          embeds: [{
            description: result.description.replace("{{MONEY}}", money(reward, client))
              + `\n-# You may do more crime in <t:${Math.floor(newCooldown.valueOf() / 1000)}:R>.`,
            color: color(client.config("default_color"))
          }]
        })
      } else {
        var fine = randBetween(config.min_lost, config.max_lost);

        const oldVal = parseInt(profile.get("money") || 0),
          newVal = oldVal - fine;

        profile.set("crime_cooldown", now.valueOf())
        profile.set("money", newVal)

        let result = drawPool(crime.filter(x => x.get("type") == "fail").map(x => x.toObject()))[0];

        await client.log(`**CRIME:** <@${input.user}>`
          + `\n> **Result:** Fail`
          + `\n> **Money:** -${fine} (${oldVal} → ${newVal})`
        )

        await profile.save()

        return await input.source.reply({
          embeds: [{
            description: result.description.replace("{{MONEY}}", money(fine, client))
              + `\n-# You may do more crime in <t:${Math.round(newCooldown.valueOf() / 1000)}:R>.`,
            color: color(client.config("default_color"))
          }]
        })
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