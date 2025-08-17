require('dotenv').config({ silent: process.env.NODE_ENV === 'production' });

const { REST, Routes } = require('discord.js'),
  { promisify } = require("util"),
  readdir = promisify(require("fs").readdir);

// and deploy your commands!
(async () => {

  const commandFiles = (await readdir("./command/")).filter(f => f.endsWith(".js")),
    commands = [];

  commandFiles.forEach(file => {
    const command = require('./command/' + file);
    if ('slash' in command && 'execute' in command) {
      commands.push(command.slash.toJSON());
      console.log(`  [command] "${command.name}" loaded.`)
    } else {
      console.log(`  [WARN] ${file} command data incomplete.`)
    }
  });

  // Construct and prepare an instance of the REST module
  const rest = new REST().setToken(process.env.DISCORD_CLIENT_TOKEN);

  try {
    console.log(`Started refreshing ${commands.length} application (/) commands.`);

    // await rest.put(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID), { body: [] })

    // The put method is used to fully refresh all commands in the guild with the current set
    const data = await rest.put(
      Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.DISCORD_SERVER_ID),
      { body: commands },
    );

    console.log(`Successfully reloaded ${data.length} application (/) commands.`); //
  } catch (error) {
    console.error(error);
  }
})();