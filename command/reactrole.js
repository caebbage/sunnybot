const { PermissionsBitField } = require("discord.js")

module.exports = {
  name: "reactrole",
  prefix: true,
  async parse(interaction, message, input) {
    return await this.execute(message.client, message, input)
  },
  async execute(client, message, input) {
    const db = client.db;
    let inputs = input?.replace(/ +/g, " ").split(" ");

    try {
      if (!message.member?.permissionsIn(message.channel).has(PermissionsBitField.Flags.Administrator)) { return message.react("❌") }
      
      if (inputs[0] === "add") {
        if (!inputs[1] || !/(?<=<@&)\d+(?=>)/.test(inputs[2])) return message.react("❌")
        await db.reactroles.sheet.addRow({
          message_id: message.reference.messageId,
          message_channel: message.channel.id,
          emoji: inputs[1],
          role_id: inputs[2].match(/(?<=<@&)\d+(?=>)/)[0]
        })

        await db.reactroles.reload()

        const target = await message.channel.messages.fetch(message.reference.messageId)
        await target.react(inputs[1])
        client.log(`**REACT ROLE ADDED:** ${target.url || message.reference.messageId} (${inputs[1]} for ${inputs[2]})`)
        message.react("✅")
      } else if (inputs[0] === "remove") {
        if (!inputs[2]) return message.react("❌")

        let target = /https:\/\/discord\.com\/channels\/(?<guild>.+?)\/(?<channel>\d+)\/(?<message>\d+)/.exec(inputs[2])?.groups;
        if (!target) return message.react("❌")

        const reactMessage = await (await client.channels.fetch(target.channel)).messages.fetch(target.message)


        const userReactions = reactMessage.reactions.cache.filter(reaction => reaction.users.cache.has(client.user.id));
        if (inputs[1] == "all") {
          let reactions = db.reactroles.filter(row => row.get("message_id") == target.message),
            reacts = reactions.map(x => x.get("emoji"));

          for (let row of reactions) await row.delete()
          for (const reaction of userReactions.values()) await reaction.users.remove(client.user.id);

          await client.log(`**REACT ROLES REMOVED:** ${reactMessage.url || target.message} (${reacts.join("")})`)
        } else {
          for (const reaction of userReactions.values()) {
            if (reaction.emoji.toString() == inputs[1]) {
              await db.reactroles.find(row => row.get("message_id") == target.message && row.get("emoji") == inputs[1]).delete()
              await reaction.users.remove(client.user.id);

              await client.log(`**REACT ROLE REMOVED:** ${reactMessage.url || target.message} (${inputs[1]})`)
            }
          }
        }
        await db.reactroles.reload()

        message.react("✅")
      }
    } catch (error) {
      console.log(error)
      message.react("❌")
    }
  }
};