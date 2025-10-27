
require('dotenv').config({ silent: process.env.NODE_ENV === 'production' });


const Discord = require("discord.js"),
  client = new Discord.Client({
    intents: 46595,
    makeCache: Discord.Options.cacheWithLimits({
      ...Discord.Options.DefaultMakeCacheSettings,
      ReactionManager: {
        maxSize: 0,
        keepOverLimit: (react) => reactionCheck(react)
      },
      MessageManager: {
        maxSize: 0,
        keepOverLimit: (msg) => reactRoleCheck(msg)
      },
    }),
    partials: ['MESSAGE', 'CHANNEL', 'REACTION']
  }),
  { promisify } = require("util"),
  readdir = promisify(require("fs").readdir);

client.commands = new Discord.Collection();
client.slash = {};
client.customCommands = new Discord.Collection();

function reactionCheck(react) {
  let db = client.db?.reactroles;
  if (!db) return true
  else {
    if (client.db.reactroles.find(row => row.get("message_id") == react.message.id && row.get("emoji") == react.emoji)) return true
    return false
  }
}

function reactRoleCheck(message) {
  let db = client.db?.reactroles;
  if (!db) return true
  else {
    if (client.db.reactroles.find(row => row.get("message_id") == message.id)) return true
    return false
  }
}

require("./module/sheets.js")(client);

const init = async () => {
  // load events
  const eventFiles = await readdir("./event/");
  console.log(`Loading a total of ${eventFiles.length} events.`);
  eventFiles.forEach(file => {
    const event = require(`./event/${file}`);
    console.log(`  [event] ${event.name}`);
    // Bind the client to any event, before the existing arguments
    // provided by the discord.js event. 
    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args));
    } else {
      client.on(event.name, (...args) => event.execute(...args));
    }
  });

  // register commands
  const commandFiles = (await readdir("./command/")).filter(f => f.endsWith(".js"));
  console.log(`Loading a total of ${commandFiles.length} commands.`)
  commandFiles.forEach(file => {
    const command = require('./command/' + file);
    if ('parse' in command) {
      client.commands.set(command.name, command);
      if (command.prefix) {
        client.slash[command.name] = command.name;
        if (command.alias) command.alias.forEach((a) => client.slash[a] = command.name)
      }

      console.log(`  [command] ${command.name}`)
    } else {
      console.log(`  [WARN] ${file} command data incomplete.`)
    }
  });


  client.login(process.env.DISCORD_CLIENT_TOKEN);
};

init();