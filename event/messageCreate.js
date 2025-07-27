const { Events } = require('discord.js'),
  { pullPool } = require("../module/helpers.js")

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    try {
      if (message.content.indexOf("p!") !== 0) return

      const actionName = (function () {
        let space = message.content.indexOf(" ");
        let newline = message.content.indexOf("\n");

        if (space != -1 && newline != -1 && space < newline) return message.content.slice(2, space)
        else if (space != -1 && newline != -1 && space > newline) return message.content.slice(2, newline)
        else if (space != -1) return message.content.slice(2, space)
        else if (newline != -1) return message.content.slice(2, newline)
        else return message.content.slice(2)
      })().toLowerCase().trim();

      const action = message.client.orders.get(actionName)

      if (action) {
        try {
          await action.execute(message, message.content.slice(2 + actionName.length).trim())
        } catch (error) {
          message.author.send("An error occurred:\n`" + error.message + "`")
        }
      } else {
        const customCmd = message.client.db.actions.find(row => row.get("command_name").trim() == actionName);

        if (!customCmd) return

        let output = await pullPool(message, customCmd);

        message.reply(output)
      }
    } catch (error) {
      console.log(error)
    }
  },
};

