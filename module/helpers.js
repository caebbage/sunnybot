const fuzzy = require("fuzzy");

async function userEmbed(profile, client) {
  return {
    title: client.config("decorative_symbol") + " " + profile.get("display_name").toUpperCase(),
    description: "💵 ` CRED ✦ ` " + (profile.get("money") || "0"),
    color: color(client.config("default_color")),
    footer: {
      text: "@" + (await client.users.fetch(profile.get("user_id"))).username
        + " ✦ " + (profile.get("pronouns") || "N/A")
        + " ✦ " + (profile.get("timezone") || "GMT +?")
    }
  }
}

function charaEmbed(chara, client) {
  const faction = client.db.factions.find(x => x.get("faction_name") == chara.get("faction"));
  let turfs = client.db.turf.filter(x => x.get("controlled_by") == faction.get("faction_name"))

  let bonuses = sumBonus(turfs);

  let stats = {
    hot: (!isNaN(+chara.get("hot")) ? +chara.get("hot") : 0) + bonuses.hot + (!isNaN(+faction.get("hot")) ? +faction.get("hot") : 0),
    cool: (!isNaN(+chara.get("cool")) ? +chara.get("cool") : 0) + bonuses.cool + (!isNaN(+faction.get("cool")) ? +faction.get("cool") : 0),
    hard: (!isNaN(+chara.get("hard")) ? +chara.get("hard") : 0) + bonuses.hard + (!isNaN(+faction.get("hard")) ? +faction.get("hard") : 0),
    sharp: (!isNaN(+chara.get("sharp")) ? +chara.get("sharp") : 0) + bonuses.sharp + (!isNaN(+faction.get("sharp")) ? +faction.get("sharp") : 0)
  }

  return {
    title: (faction.get("pin_emoji") || faction.get("simple_emoji")) + " " + chara.get("full_name").toUpperCase(),
    url: chara.get("app"),
    description: "-# " + [
      chara.get("rank").replace(/^(.+) (.+)$/, "$1 `$2`") +
      ` of the \`${chara.get("family").toUpperCase()}\` Family`,
      `\`${chara.get("pronouns")}\``,
      `\`${chara.get("height")}\``
    ].join(" ✦ ")

      + `\n\n> **ⓘ STATUS** ➜ \`${chara.get("status").toUpperCase()}\``
      + (chara.get("flavor_text")
        ? "\n" + chara.get("flavor_text").split("\n").map(x => `> ${x}`).join("\n")
        : "")
      + `\n\n\`   REP \` ${chara.get("reputation")}\n\`  HEAT \` ${chara.get("heat")}/5`
      + "\n\n```ansi\n"
      + colorStats(arrayChunks(["hot", "cool", "hard", "sharp"].map(stat =>
        pad(`${pad(stat.toUpperCase(), 5)} ${stats[stat] >= 0 ? "+" : ""}${stats[stat]}`, 15, " ", true)
      ), 2).map(x => x.join("")).join("\n"))
      + "```"
      + "\n> **FACTION & TURF BONUSES:**\n" + "```ansi\n" + factionBonus(faction, client) + "\n\n" + turfBonus(faction, client) + "```"
      + "\n-# Stat bonuses are already added to the stats block."
    ,
    color: color(faction.get("main_color") || client.config("default_color")),
    thumbnail: {
      url: faction.get("crest_image")
    },
    image: {
      url: chara.get("card") || undefined
    },
    footer: {
      "text": "SUNNY CANTILADOS",
      "icon_url": client.config("default_image")
    },
  }
}

function factionEmbed(faction, client) {
  return {
    title: (faction.get("pin_emoji") || faction.get("simple_emoji")) + " THE " + faction.get("faction_name").toUpperCase(),
    description:
      `> **ⓘ STATUS** ➜ \`${faction.get("status").toUpperCase()}\` ✦ \`TIER\` ${faction.get("tier")}`
      + `\n> Based in ${faction.get("based")}.`
      + `\n> ♔ *${faction.get("leader")}*`
      + `\n\n👤\` MEMBERS ✦ \` ${client.db.charas.filter(x => x.get("chara_name") && x.get("faction") == faction.get("faction_name")).length}`
      + `\n📍\` HEXES OWNED ✦ \` ${client.db.turf.filter(x => x.get("controlled_by") == faction.get("faction_name")).length}/99`
      + `\n💳\` FUNDS ✦ \` ${faction.get("funds")}`
      + "\n\n> **FACTION & TURF BONUSES:**\n" + "```ansi\n" + factionBonus(faction, client) + "\n\n" + turfBonus(faction, client) + "```"
    ,
    color: color(faction.get("main_color") || client.config("default_color")),
    thumbnail: {
      url: faction.get("crest_image")
    },
    footer: {
      "text": "SUNNY CANTILADOS",
      "icon_url": client.config("default_image")
    },
  }
}

function factionBonus(faction) {
  let res = `[2;37m【 [1;${faction.get("ansi_color")}m${faction.get("faction_name").toUpperCase()} ${faction.get("simple_emoji")} [0m[2;37mTier ${faction.get("tier").toUpperCase()} 】:[0m `;

  if (faction.get("hot")) res += `\n[2;37m  ‣[2;30m ❰ HOT +${faction.get("hot")} ❱[0m`;
  if (faction.get("cool")) res += `\n[2;37m  ‣[2;30m ❰ COOL +${faction.get("cool")} ❱[0m`;
  if (faction.get("hard")) res += `\n[2;37m  ‣[2;30m ❰ HARD +${faction.get("hard")} ❱[0m`;
  if (faction.get("sharp")) res += `\n[2;37m  ‣[2;30m ❰ SHARP +${faction.get("sharp")} ❱[0m`;
  if (faction.get("misc_bonus")) res += "\n" + faction.get("misc_bonus").split("\n").map(x => `[2;37m  ‣[0m` + x).join("\n")

  return res
}

function sumBonus(turfs) {
  let bonuses = { hot: 0, cool: 0, hard: 0, sharp: 0, other: {} };
  turfs.forEach(turf => {
    ["hot", "cool", "hard", "sharp"].forEach(stat => {
      bonuses[stat] += turf.get(stat) && !isNaN(+turf.get(stat)) ? +turf.get(stat) : 0
    })

    turf.get("misc_bonus")?.split("\n").filter(x => x).forEach(bonus => {
      if (bonuses.other[bonus]) bonuses.other[bonus]++
      else bonuses.other[bonus] = 1
    })
  })
  return bonuses
}

function turfBonus(faction, client) {
  let turfs = client.db.turf.filter(x => x.get("controlled_by") == faction.get("faction_name"))

  let bonuses = sumBonus(turfs);

  let res = `[2;37mBonuses gained from [1;${faction.get("ansi_color")}m${turfs.length}[0m[2;37m turfs:[0m`

  if (bonuses.hot) res += `\n[2;37m  ‣[2;30m ❰ HOT +${bonuses.hot} ❱[0m`
  if (bonuses.cool) res += `\n[2;37m  ‣[2;30m ❰ COOL +${bonuses.cool} ❱[0m`
  if (bonuses.hard) res += `\n[2;37m  ‣[2;30m ❰ HARD +${bonuses.hard} ❱[0m`
  if (bonuses.sharp) res += `\n[2;37m  ‣[2;30m ❰ SHARP +${bonuses.sharp} ❱[0m`

  if ((Object.keys(bonuses.other).length)) {
    res += "\n" + Object.entries(bonuses.other).map(x => `[2;37m  ‣[2;30m ` + x[0] + (x[1] > 1 ? ` x${x[1]}[0m` : "")).join("\n")
  }

  return res
}

function hexList(client, faction) {
  let turfs = client.db.turf.filter(x => x.get("turf_id"));
  let factions = client.db.factions.filter(x => x.get("faction_name"));

  let list;
  let groups;

  if (faction == "all") {
    list = turfs.map(turf => {
      let emoji = factions.find(x => x.get("faction_name") == turf.get("controlled_by"))?.get("simple_emoji") || client.config("contested_emoji");
      let color = factions.find(x => x.get("faction_name") == turf.get("controlled_by"))?.get("asci_color") || 37;
      let base = turf.get("is_base").toUpperCase() == "TRUE"

      let result = `[2;${color}m【${turf.get("turf_id")}】${emoji}${base ? "🏠" : ""}[0m[2;37m ‣ [2;30m`

      let stats = [];
      if (turf.get("hot")) stats.push("HOT +" + turf.get("hot"))
      if (turf.get("cool")) stats.push("COOL +" + turf.get("cool"))
      if (turf.get("hard")) stats.push("HARD +" + turf.get("hard"))
      if (turf.get("sharp")) stats.push("SHARP +" + turf.get("sharp"))
      if (stats.length) result += `❰ ${stats.join(", ")} ❱`

      if (turf.get("misc_bonus")) {
        if (stats.length) result += " + Effect"
        else result += turf.get("misc_bonus")
      }

      result += `[0m`

      return result
    })

    groups = arrayChunks(list, 15);
  } else {
    let color = factions.find(x => x.get("faction_name") == faction)?.get("ansi_color") || 37

    list = turfs.filter(x => x.get("controlled_by") == faction).map(turf => {
      let base = turf.get("is_base").toUpperCase() == "TRUE"

      let bonuses = sumBonus([turf]);
      let res = `[2;${color}m【${turf.get("turf_id")}】${base ? "🏠 " : ""}[0m${turf.get("turf_name") ? `[2;37m${turf.get("turf_name")}:` : ""}`

      if (bonuses.hot || bonuses.cool || bonuses.hard || bonuses.sharp) res += "\n[2;37m  ‣[2;30m "
      if (bonuses.hot) res += `❰ HOT +${bonuses.hot} ❱ `
      if (bonuses.cool) res += `❰ COOL +${bonuses.cool} ❱ `
      if (bonuses.hard) res += `❰ HARD +${bonuses.hard} ❱ `
      if (bonuses.sharp) res += `❰ SHARP +${bonuses.sharp} ❱ `

      if ((Object.keys(bonuses.other).length)) {
        res += "\n" + Object.entries(bonuses.other).map(x => `[2;37m  ‣[2;30m ` + x[0] + (x[1] > 1 ? ` x${x[1]}[0m` : "")).join("\n")
      }

      return res
    })
    groups = arrayChunks(list, 10);
  }

  return groups.map(x => x.join("\n"));
}

function inventoryEmbed(profile, client) {
  return {
    title: client.config("decorative_symbol") + " INVENTORY",
    description: (profile.get("inventory") ? profile.get("inventory") : "-# You appear to have no items!"),
    color: color(client.config("default_color")),
    thumbnail: {
      url: client.config("default_image")
    },
    timestamp: new Date().toISOString()
  }
}

function itemEmbed(item, user, simple = false) {
  return {
    title: `${user.client.config("poke_symbol")} ${item.get("item_name")}`,
    description: (!simple ? `**\`   CATEGORY \`** ${item.get("category")}\n**\`       COST \`** ${item.get("price") ? `${user.client.config("money_format").replace("{{MONEY}}", item.get("price"))}` : "N/A"
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

const colorStats = (string, isBold = true) => {
  let bold = isBold ? 1 : 2;
  return string
    .replace(/HOT/g, `[${bold};31mHOT[0m`)
    .replace(/COOL/g, `[${bold};34mCOOL[0m`)
    .replace(/HARD/g, `[${bold};33mHARD[0m`)
    .replace(/SHARP/g, `[${bold};36mSHARP[0m`)
}

const diacritic = (string) => string.normalize('NFD').replace(/\p{Diacritic}/gu)

function findChar(client, search, withNPC) {
  let list = client.db.charas.map(x => ({
    name: x.get("chara_name"),
    fullname: x.get("full_name"),
    npc: x.get("is_npc").toLowerCase()
  })).filter(x => x.name)
  if (!withNPC) list = list.filter(x => !x.npc || x.npc === "true")

  let filter;

  filter = list.find(val => diacritic(val.name.toLowerCase()) == diacritic(search.toLowerCase()))
  if (filter) return filter.name;

  filter = fuzzy.filter(search, list, { extract: (x) => diacritic(x.fullname) })
  return filter?.[0]?.original.name
}

function pad(str, length = 2, pad = " ", after = false) {
  let string = "" + str;
  if (length - string.length > 0) {
    if (after) return string + pad.repeat(length - string.length)
    else return pad.repeat(length - string.length) + string
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
  userEmbed, charaEmbed, factionEmbed,
  inventoryEmbed, itemEmbed,
  hexList,
  findChar, diacritic,
  parseEmbed, formatEmbed,
  pad, arrayChunks, removeEmpty, color,
  drawPool, pullPool,
  styleText
}