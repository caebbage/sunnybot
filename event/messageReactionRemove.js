const { Events } = require('discord.js')

module.exports = {
  name: Events.MessageReactionRemove,
  async execute(reaction, user) {
    try {
      let reactRoles = user.client.db.reactroles.toObjects();

      if (reactRoles.map(x => x.message_id).includes(reaction.message.id)) {
        for (let row of reactRoles.filter(x => x.message_id == reaction.message.id)) {
          if (row.emoji == reaction.emoji.toString()) {
            let member = await reaction.message.guild.members.fetch(user.id);

            member.roles.remove(row.role_id);
          }
        }
      }
    } catch (error) {
      console.log(error)
    }
  },
};

