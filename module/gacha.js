function drawPool(pool, amt = 1) {
  let poolSize = 0,
    result = []

  pool.forEach((item) => {
    poolSize += +item.weight
  })

  for (let i = 0; i < amt; i++) {
    let rng = Math.random() * poolSize;

    for (let item of pool) {
      if (rng < +item.weight) {
        result.push(item)
        break;
      } else rng -= +item.weight
    }
  }
  return result;
}

async function pullPool(message, customCmd, override) {
  const data = (await message.client.db.actions.get(customCmd.get("sheet_id")))?.map(row => row.toObject()).filter(row => row.weight && row.value),
    input = (override || message.content).slice(PREFIX.length + customCmd.get("command_name").length).trim()

  const configData = data.find(row => row.weight === "config")?.value,
    error = data.find(row => row.weight === "error")?.value
  var output = {
    embeds: [
      { color: color(message.client.config("default_color")) }
    ]
  },
    options = {};

  if (configData) {
    output.embeds[0] = { ...output.embeds[0], ...parseEmbed(configData.value) }
    options.multiroll = /(?<=^\*\*multiroll:\*\*) ?true$/mi.test(configData)
    options.embedFormat = /(?<=^\*\*EmbedFormat:\*\*) ?true$/mi.test(configData)
    options.tabs = /(?<=^\*\*tabs:\*\*) ?true$/mi.test(configData)
    options.buttonColor = /(?<=^\*\*ButtonColor:\*\*) ?(\d+)$/mi.exec(configData)?.[0]?.trim() || message.client.config("default_button_color")
    options.adminOnly = /(?<=^\*\*AdminOnly:\*\*) ?true$/mi.test(configData)
    options.deleteInput = /(?<=^\*\*deleteInput:\*\*) ?true$/mi.test(configData)
  }

  if (options.adminOnly && !message.member?.permissionsIn(message.channel).has("ADMINISTRATOR")) {
    throw new Error("You don't have the permissions to use this command!")
  }

  if (options.tabs && !options.multiroll) {
    let tabs = [];
    data.forEach(row => {
      row.subcommand.split(";").map(x => x.trim()).filter(x => x.toLowerCase() != "default").forEach(sub => {
        if (!tabs.includes(sub) && !/{{.+}}/.test(sub)) tabs.push(sub)
      })
    })

    tabs = tabs.filter(x => x)

    if (tabs.length) {
      output.components = arrayChunks(
        tabs.map(x => {
          return {
            custom_id: `action:${customCmd.get("command_name")}:${x}`,
            type: 2,
            style: options.buttonColor,
            label: x
          }
        }), 5).map((x) => {
          return {
            type: 1,
            components: x
          }
        })
    }
  }

  let subcommand = (options.multiroll ? /(.*?)(\d+)?$/m.exec(input)?.[1]?.trim() : input);

  let validResults = data.filter(row => (row.subcommand || "default").split(";")
    .map(x => x.toLowerCase().trim()).includes(subcommand?.toLowerCase() || "default") && !["config", "error"].includes(row.weight)),
    times = Math.min((options.multiroll ? parseInt(/\d+$/.exec(input) || 1) : 1), 10)

  if (validResults.length) {
    output.embeds = formatEmbed(
      drawPool(validResults, times).map(pull => {
        let res = pull.value.replace(/{{@USER}}/gi, `<@${message.author.id}>`)

        let fields = pull.value.match(/{{.*?}}/g);

        if (fields?.length) {
          let replacements = fields.map(field => {
            let choices = data.filter(row => (row.subcommand || "default").split(";").map(x => x.toLowerCase().trim()).includes(field.toLowerCase()))
            if (choices.length) return drawPool(choices)[0]
            return false
          })

          fields.forEach((val, i) => {
            if (replacements[i]) res = res.replace(val, replacements[i])
          })
        }

        return res
      }),
      output.embeds[0], options.embedFormat)
  } else {
    if (error) output.embeds = formatEmbed([error], output.embeds[0], options.embedFormat)
    else output.embeds = formatEmbed(["Subcommand not found... make sure you've typed your choice correctly."], output.embeds[0], options.embedFormat)
  }

  return [output, deleteInput]
}

module.exports = {
  drawPool,
  pullPool
}