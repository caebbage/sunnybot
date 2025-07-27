function userEmbed(profile, user) {
  return {
    title: user.client.config("poke_symbol") + " " + profile.get("display_name"),
    description: "**`    PRONOUNS `** " + profile.get("pronouns")
      + "\n**`    TIMEZONE `** " + profile.get("timezone")
      + "\n**`       MONEY `** " + user.client.config("money_symbol") + profile.get("money"),
    thumbnail: {
      url: profile.get("display_icon")
    },
    color: color(user.client.config("default_color")),
    footer: {
      text: "@" + user.username
    }
  }
}

function charaEmbed(chara, user) {
  return {
    title: user.client.config("poke_symbol") + " " + chara.get("chara_name"),
    url: chara.get("app"),
    description: "**`   FULL NAME `** " + chara.get("fullname")
      + "\n**`         AGE `** " + chara.get("age")
      + "\n**`      HEIGHT `** " + chara.get("height")
      + "\n**`    PRONOUNS `** " + chara.get("pronouns")
      + "\n**`     PARTNER `** " + chara.get("partner")

      + `\n\n${chara.get("description").split("\n").map(x => `> ${x}`).join("\n")}\n\n`

      + (chara.get("is_npc").toLowerCase() !== "true" ?
        "**`       LEVEL `** " + `${level(chara.get("xp_points"))} (${chara.get("xp_points")}${user.client.config("xp_symbol")})`
        + (chara.get("challenge_completed") ? "\n# " +
          user.client.db.challenges.data.filter((chal) =>
            chara.get("challenge_completed").split(", ").includes(chal.get("challenge_id")) && chal.get("badge")
          ).map(chal => chal.get("badge"))
          : "")
        : ""),

    color: color(user.client.config("default_color")),
    thumbnail: {
      url: chara.get("icon") || user.client.config("default_image")
    },
    image: {
      url: chara.get("card") || undefined
    }
  }
}

function inventoryEmbed(profile, user) {
  return {
    title: user.client.config("poke_symbol") + " INVENTORY",
    description: (profile.get("inventory") ? profile.get("inventory") : "-# You appear to have no items!"),
    color: color(user.client.config("default_color")),
    thumbnail: {
      url: user.client.config("default_image")
    },
    timestamp: new Date().toISOString()
  }
}

function itemEmbed(item, user, simple = false) {
  return {
    title: `${user.client.config("poke_symbol")} ${item.get("item_name")}`,
    description: (!simple ? `**\`   CATEGORY \`** ${item.get("category")}\n**\`       COST \`** ${item.get("price") ? `${user.client.config("money_symbol")}${item.get("price")}` : "N/A"
      }\n` : "")
      + (item.get("description")?.split("\n").map(x => `> ${x}`).join("\n") ?? "> *No description found.*"),
    color: color(user.client.config("default_color")),
    thumbnail: {
      url: item.get("item_image") || user.client.config("default_image")
    },
    footer: (item.get("hold_limit") || item.get("monthly_limit") || item.get("perma_limit") ? (() => {
      let limit = []
      if (item.get("hold_limit")) limit.push(`${item.get("hold_limit")} held at once`)
      if (item.get("monthly_limit")) limit.push(`${item.get("monthly_limit")} per month`)
      if (item.get("perma_limit")) limit.push(`${item.get("perma_limit")} per lifetime`)

      return { text: "limit " + limit.join(", ") }
    })() : undefined)
  }
}

function pad(str, length = 2, pad = "0") {
  let string = "" + str;
  if (length - string.length > 0) {
    return pad.repeat(length - string.length) + string
  } else return string
}

const styleText = {
  charSets: {
    "bold": "𝐀𝐁𝐂𝐃𝐄𝐅𝐆𝐇𝐈𝐉𝐊𝐋𝐌𝐍𝐎𝐏𝐐𝐑𝐒𝐓𝐔𝐕𝐖𝐗𝐘𝐙𝐚𝐛𝐜𝐝𝐞𝐟𝐠𝐡𝐢𝐣𝐤𝐥𝐦𝐧𝐨𝐩𝐪𝐫𝐬𝐭𝐮𝐯𝐰𝐱𝐲𝐳𝟏𝟐𝟑𝟒𝟓𝟔𝟕𝟖𝟗𝟎",
    "smallcaps": "ABCDEFGHIJKLMNOPQRSTUVWXYZᴀʙᴄᴅᴇғɢʜɪᴊᴋʟᴍɴᴏᴘǫʀsᴛᴜᴠᴡxʏᴢ",
    "superscript": "ᴬᴮᶜᴰᴱᶠᴳᴴᴵᴶᴷᴸᴹᴺᴼᴾᵠᴿˢᵀᵁⱽᵂˣʸᶻᵃᵇᶜᵈᵉᶠᵍʰᶦʲᵏˡᵐⁿᵒᵖᵠʳˢᵗᵘᵛʷˣʸᶻ¹²³⁴⁵⁶⁷⁸⁹⁰",
    "typewriter": "𝙰𝙱𝙲𝙳𝙴𝙵𝙶𝙷𝙸𝙹𝙺𝙻𝙼𝙽𝙾𝙿𝚀𝚁𝚂𝚃𝚄𝚅𝚆𝚇𝚈𝚉𝚊𝚋𝚌𝚍𝚎𝚏𝚐𝚑𝚒𝚓𝚔𝚕𝚖𝚗𝚘𝚙𝚚𝚛𝚜𝚝𝚞𝚟𝚠𝚡𝚢𝚣𝟷𝟸𝟹𝟺𝟻𝟼𝟽𝟾𝟿𝟶",
    "double": "𝔸𝔹ℂ𝔻𝔼𝔽𝔾ℍ𝕀𝕁𝕂𝕃𝕄ℕ𝕆ℙℚℝ𝕊𝕋𝕌𝕍𝕎𝕏𝕐ℤ𝕒𝕓𝕔𝕕𝕖𝕗𝕘𝕙𝕚𝕛𝕜𝕝𝕞𝕟𝕠𝕡𝕢𝕣𝕤𝕥𝕦𝕧𝕨𝕩𝕪𝕫𝟙𝟚𝟛𝟜𝟝𝟞𝟟𝟠𝟡𝟘",
    "cursive": "𝒜𝐵𝒞𝒟𝐸𝐹𝒢𝐻𝐼𝒥𝒦𝐿𝑀𝒩𝒪𝒫𝒬𝑅𝒮𝒯𝒰𝒱𝒲𝒳𝒴𝒵𝒶𝒷𝒸𝒹𝑒𝒻𝑔𝒽𝒾𝒿𝓀𝓁𝓂𝓃𝑜𝓅𝓆𝓇𝓈𝓉𝓊𝓋𝓌𝓍𝓎𝓏",
    "cursbold": "𝓐𝓑𝓒𝓓𝓔𝓕𝓖𝓗𝓘𝓙𝓚𝓛𝓜𝓝𝓞𝓟𝓠𝓡𝓢𝓣𝓤𝓥𝓦𝓧𝓨𝓩𝓪𝓫𝓬𝓭𝓮𝓯𝓰𝓱𝓲𝓳𝓴𝓵𝓶𝓷𝓸𝓹𝓺𝓻𝓼𝓽𝓾𝓿𝔀𝔁𝔂𝔃",
    "gothic": "𝔄𝔅ℭ𝔇𝔈𝔉𝔊ℌℑ𝔍𝔎𝔏𝔐𝔑𝔒𝔓𝔔ℜ𝔖𝔗𝔘𝔙𝔚𝔛𝔜ℨ𝔞𝔟𝔠𝔡𝔢𝔣𝔤𝔥𝔦𝔧𝔨𝔩𝔪𝔫𝔬𝔭𝔮𝔯𝔰𝔱𝔲𝔳𝔴𝔵𝔶𝔷",
    "gothbold": "𝕬𝕭𝕮𝕯𝕰𝕱𝕲𝕳𝕴𝕵𝕶𝕷𝕸𝕹𝕺𝕻𝕼𝕽𝕾𝕿𝖀𝖁𝖂𝖃𝖄𝖅𝖆𝖇𝖈𝖉𝖊𝖋𝖌𝖍𝖎𝖏𝖐𝖑𝖒𝖓𝖔𝖕𝖖𝖗𝖘𝖙𝖚𝖛𝖜𝖝𝖞𝖟",
    "wide": "ＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺａｂｃｄｅｆｇｈｉｊｋｌｍｎｏｐｑｒｓｔｕｖｗｘｙｚ１２３４５６７８９０．！？＠＃＄％^＆＊（）－_＝＋；：／~"
  },
  format(style, str) {
    var oldSet = Array.from("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz1234567890.!?@#$%^&*()-_=+;:/~");
    var newSet = Array.from(this.charSets[style]);

    var input = Array.from(str);
    var result = '';

    input.forEach((val) => {
      if (oldSet.includes(val) && newSet[oldSet.findIndex((ele) => ele == val)]) {
        result += newSet[oldSet.findIndex((ele) => ele == val)]
      } else {
        result += val;
      }
    })

    return result
  }
}

function level(xp) {
  let level = 0, curr = 0;
  let breakpoints = [
    [5, 5],
    [20, 10],
    [30, 13],
    [50, 16],
    [70, 24],
    [84, 30],
    [90, 40],
    [93, 60],
    [100, 80]
  ]

  do {
    level++;
    curr += breakpoints.find(x => x[0] > level)?.[1] ?? 1000
    if (level === 100) break
  } while (curr <= xp)

  return level
}

const color = (col) => parseInt(/#?(.+)/.exec(col)?.[1], 16)

function parseEmbed(src) {
  let res = {};
  res.title = /(?<=^\*\*Title:\*\*)(.+)$/mi.exec(src)?.[0]?.trim()
  res.color = color(/(?<=^\*\*Color:\*\*)(.+)$/mi.exec(src)?.[0]?.trim())
  res.description = /(?<=^\*\*Description:\*\*)((.*\n)*.*)/mi.exec(src)?.[0].trim()

  let author = {
    icon_url: /(?<=^\*\*AuthorPic:\*\*)(.+)$/mi.exec(src)?.[0]?.trim()?.replace(/[<>]/g, ""),
    name: /(?<=^\*\*Author:\*\*)(.+)$/mi.exec(src)?.[0]?.trim()
  };
  if (author.url || author.name) res.author = author

  let thumbnail = {
    url: /(?<=^\*\*Thumbnail:\*\*)(.+)$/mi.exec(src)?.[0]?.trim()?.replace(/[<>]/g, "")
  }
  if (thumbnail.url) res.thumbnail = thumbnail;

  let image = {
    url: /(?<=^\*\*Image:\*\*)(.+)$/mi.exec(src)?.[0]?.trim()?.replace(/[<>]/g, "")
  }
  if (image.url) res.image = image;

  return removeEmpty(res);
}

function formatEmbed(src, format, parse = false) {
  return src.map(val => {
    let embed = { ...format }
    if (parse) {
      embed = { ...embed, ...parseEmbed(val) }
    } else {
      embed.description = val
    }
    if (embed.color && typeof embed.color == "string") embed.color = color(embed.color)
    return embed
  })
}

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
        result.push(item.value)
        break;
      } else rng -= +item.weight
    }
  }
  return result;
}

async function pullPool(message, customCmd, override) {
  const data = (await message.client.db.actions.get(customCmd.get("sheet_id")))?.map(row => row.toObject()).filter(row => row.weight && row.value),
    input = (override || message.content).slice(2 + customCmd.get("command_name").length).trim()

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
      drawPool(validResults, times).map(val => {
        let res = val.replace(/{{@USER}}/gi, `<@${message.author.id}>`)

        let fields = val.match(/{{.*?}}/g);

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

  return output
}

const arrayChunks = (array, chunk_size) => Array(Math.ceil(array.length / chunk_size)).fill().map((_, index) => index * chunk_size).map(begin => array.slice(begin, begin + chunk_size))
const removeEmpty = (obj) => {
  let newObj = {};
  Object.keys(obj).forEach((key) => {
    if (obj[key] === Object(obj[key])) newObj[key] = removeEmpty(obj[key]);
    else if (obj[key]) newObj[key] = obj[key];
  });
  return newObj;
};

module.exports = {
  userEmbed, charaEmbed, inventoryEmbed, itemEmbed,
  parseEmbed, formatEmbed,
  level,
  pad, arrayChunks, removeEmpty, color,
  drawPool, pullPool,
  styleText
}