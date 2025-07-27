const { Events } = require('discord.js');

module.exports = {
  name: Events.ClientReady,
  once: true,
  execute(client) {
    
    
    client.user.setPresence({
      activities: [{
        name: 'Good day~',
        type: 4
      }],
      status: 'online'
    })

    client.guilds.cache.each(guild => {
      guild.members.fetch()
    })

    console.log(`${client.user.tag}, ready to serve.`);
  },
};