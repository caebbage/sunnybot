const { PermissionsBitField } = require("discord.js")
const { parseEmbed } = require("../module/helpers.js")

module.exports = {
  name: "embed",
  prefix: true,
  async parse(interaction, message, inputs) {
    return await this.execute(message.client, message)
  },
  async execute(client, message) {
    try {
      if (!message.member?.permissionsIn(message.channel).has(PermissionsBitField.Flags.Administrator)) { return message.react("❌") }
      let result = {};

      let link = /https:\/\/discord\.com\/channels\/(?<guild>.+)\/(?<channel>\d+)\/(?<message>\d+)/.exec(message.content);
      if (!link) throw new Error("Specify a link for your embed contents.")

      let source = await (await client.channels.fetch(link.groups.channel))?.messages.fetch(link.groups.message);
      if (!source) throw new Error("Linked embed post not found.");

      let embed = parseEmbed(source.content);

      result.embeds = [embed];

      if (embed.content) result.content = embed.content;

      if (message.reference?.messageId) { // if message is a reply to something
        let replied = await message.channel.messages.fetch(message.reference.messageId);

        if (!replied.editable) throw new Error("Message replied to not editable.")
        replied.edit(result)
        message.delete()
      } else {
        message.channel.send(result)
        message.delete()
      }
    } catch (error) {
      console.log(error)
      return message.react("❌")
    }
  }
};