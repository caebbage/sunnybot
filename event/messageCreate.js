const { Events } = require('discord.js'),
  { pullPool } = require("../module/gacha.js")

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    try {
      const PREFIX = process.env.PREFIX;

      if (message.content.indexOf(PREFIX) !== 0) return

      const actionName = (function () {
        let space = message.content.indexOf(" ");
        let newline = message.content.indexOf("\n");

        if (space != -1 && newline != -1 && space < newline) return message.content.slice(PREFIX.length, space)
        else if (space != -1 && newline != -1 && space > newline) return message.content.slice(PREFIX.length, newline)
        else if (space != -1) return message.content.slice(PREFIX.length, space)
        else if (newline != -1) return message.content.slice(PREFIX.length, newline)
        else return message.content.slice(PREFIX.length)
      })().toLowerCase().trim();

      const action = message.client.slash[actionName]

      if (action) {
        try {
          await await message.client.commands.get(action).parse(undefined, message, message.content.slice(PREFIX.length + actionName.length).trim())
        } catch (error) {
          message.author.send("An error occurred:\n`" + error.message + "`")
        }
      } else {
        const customCmd = message.client.db.actions.find(row => row.get("command_name").trim() == actionName);

        if (!customCmd) return

        let [output, deleteInput] = await pullPool(message, customCmd);

        await message.reply(output)
        if (deleteInput) await message.delete()
      }
    } catch (error) {
      console.log(error)
    }
  },
};

