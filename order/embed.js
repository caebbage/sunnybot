const { parseEmbed, color } = require("../module/helpers.js")

module.exports = {
  name: "embed",
  async execute(message) {
    const client = message.client;

    if (!message.member?.permissionsIn(message.channel).has("ADMINISTRATOR")) {
      return message.react("❌")
    }

    let link = /https:\/\/discord\.com\/channels\/(?<guild>.+)\/(?<channel>\d+)\/(?<message>\d+)/.exec(message.content);
    if (!link) throw new Error("Specify a link for your embed contents.")

    let source = await (await client.channels.fetch(link.groups.channel))?.messages.fetch(link.groups.message);
    if (!source) throw new Error("Linked embed post not found.");

    let embed = parseEmbed(source.content);

    if (message.reference?.messageId) { // if message is a reply to something
      let replied = await message.channel.messages.fetch(message.reference.messageId);

      if (!replied.editable) throw new Error("Message replied to not editable.")
      replied.edit({
        embeds: [embed]
      })
      message.delete()
    } else {
      message.channel.send({
        embeds: [embed]
      })
      message.delete()
    }
  }
}