const { Events } = require('discord.js')

module.exports = {
  name: Events.MessageReactionRemove,
  async execute(reaction, user) {
    try {
      let reactRoles = user.client.db.reactroles.filter(x => x.get("message_id") && x.get("message_id") == reaction.message.id);

      for (let row of reactRoles) {
        if (row.get("emoji") == reaction.emoji.toString()) {
          let member = await reaction.message.guild.members.fetch(user.id);

          member.roles.remove(row.get("role_id"));
        }
      }
    } catch (error) {
      console.log(error)
    }
  }
};