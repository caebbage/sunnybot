const fuzzy = require("fuzzy"),
  { Inventory } = require("../module/inventory.js");

const statNames = ["hot", "cool", "hard", "sharp"]

const money = (amt, client) => client.config("money_format").replace("{{MONEY}}", amt)

function charaEmbed(chara, client) {
  const faction = client.db.factions.find(x => x.get("faction_name") == chara.get("faction")),
    hexes = client.db.hexes.filter(x => x.get("controlled_by") == faction.get("faction_name")),
    statuses = client.db.statuses.filter(x => x.get("status_name") && chara.get("statuses")?.split(", ").includes(x.get("status_name")));


  const bonuses = {
    base: {
      hot: +chara.get("hot") || 0,
      cool: +chara.get("cool") || 0,
      hard: +chara.get("hard") || 0,
      sharp: +chara.get("sharp") || 0,
      other: []
    },
    hexes: parseBonus(hexes, "hex_id"),
    status: parseBonus(statuses, "status_name"),
    faction: parseBonus([faction], "faction_name")
  };

  let stats = sumBonus([bonuses.base, ...bonuses.hexes, ...bonuses.status, ...bonuses.faction])

  let result = {
    title: (faction.get("pin_emoji") || faction.get("simple_emoji")) + " " + chara.get("full_name").toUpperCase(),
    url: chara.get("app"),
    description: "-# " + [
      chara.get("rank").replace(/^(.+) (.+)$/, "$1 `$2`") +
      ` of the \`${chara.get("family")?.toUpperCase() || "???"}\` Family`,
      `\`${chara.get("pronouns")}\``,
      `\`${chara.get("height")}\``
    ].join(" ✦ ")

      + `\n\n> **ⓘ STATUS** ➜ \`${chara.get("status").toUpperCase()}\``
      + (chara.get("flavor_text")
        ? "\n" + chara.get("flavor_text").split("\n").map(x => `> ${x}`).join("\n")
        : "")
      + `\n\n\`   REP \` ${chara.get("reputation")}\n\`  HEAT \` ${chara.get("heat")}/5`
      + "\n\n```ansi\n"
      + colorStats(arrayChunks(
        statNames.map(stat =>
          pad(`${pad(stat.toUpperCase(), 5)} ${stats[stat] >= 0 ? "+" : ""}${stats[stat]}`, 15, " ", true)
        ), 2).map(x => x.join("")).join("\n"))
      + "```"
      + "\n> **STAT MODIFIERS:**\n" + "```ansi\n"
      + factionBonus(faction, client)
      + (bonuses.hexes?.length ? "\n\n" + hexBonus(bonuses.hexes, faction) : "")
      + (bonuses.status?.length ? "\n\n" + statusMods(bonuses.status) : "")
      + "```"
      + "\n-# Stat modifiers are already added to the stats block."
    ,
    color: color((chara.get("is_npc")?.toUpperCase() !== "TRUE" ? faction.get("main_color") : false) || client.config("default_color")),
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

  let user = client.users.resolve(chara.get("owner_id"));

  if (user) {
    let profile = client.db.users.find(x => x.get("user_id") === chara.get("owner_id"))

    result.footer = {
      text: "@" + user.username
        + " ✦ " + (profile.get("pronouns") || "N/A")
        + " ✦ " + (profile.get("timezone") || "GMT +?")
    }
  }

  return result
}

function factionEmbed(faction, client) {
  const hexes = client.db.hexes.filter(x => x.get("controlled_by") == faction.get("faction_name"));
  const bonuses = {
    hexes: parseBonus(hexes, "hex_id"),
    faction: parseBonus([faction], "faction_name")
  };

  return {
    title: (faction.get("pin_emoji") || faction.get("simple_emoji")) + " THE " + faction.get("faction_name").toUpperCase(),
    description:
      `> **ⓘ STATUS** ➜ \`${faction.get("status").toUpperCase()}\` ✦ \`TIER\` ${faction.get("tier")}`
      + `\n> Based in ${faction.get("based")}.`
      + `\n> ♔ *${faction.get("leader")}*`
      + `\n\n👤\` MEMBERS ✦ \` ${client.db.charas.filter(x => x.get("chara_name") && x.get("faction") == faction.get("faction_name")).length}`
      + `\n📍\` HEXES OWNED ✦ \` ${client.db.hexes.filter(x => x.get("controlled_by") == faction.get("faction_name")).length}/99`
      + `\n💳\` FUNDS ✦ \` ${faction.get("remaining_funds")}k`
      + `\n📈\` INCOME ✦ \` ${faction.get("weekly_funds")}k`
      + "\n\n> **FACTION & HEX BONUSES:**\n" + "```ansi\n" + factionBonus(faction)
      + (hexBonus(bonuses.hexes, faction) ? "\n\n" + hexBonus(bonuses.hexes, faction) : "")
      + "```"
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

  statNames.forEach(stat => {
    if (faction.get(stat)) res += `\n[2;37m  ‣[2;30m ❰ ${stat.toUpperCase()} +${faction.get(stat)} ❱[0m`;
  })
  if (faction.get("misc_bonus")) res += "\n" + faction.get("misc_bonus").split("\n").map(x => `[2;37m  ‣[0m` + x).join("\n")

  return res
}

function parseBonus(list, nameParam) {
  let bonuses = []

  bonuses = list.map(bonus => {
    let res = { name: bonus.get(nameParam), hot: 0, cool: 0, hard: 0, sharp: 0, other: [], original: bonus };

    if (!res.name) return false

    statNames.forEach(stat => res[stat] += +bonus.get(stat) || 0)

    if (bonus.get("misc_bonus")?.trim()) {
      res.other.push(...bonus.get("misc_bonus").split("\n").map(x => x.trim()).filter(x => x))
    }

    return res
  })

  return bonuses.filter(x => x)
}

function sumBonus(bonuses) {
  let sum = { hot: 0, cool: 0, hard: 0, sharp: 0, other: new Map() };

  bonuses.reduce((total, curr) => {
    statNames.forEach(stat => {
      total[stat] += curr[stat]
    })
    curr.other?.forEach(bonus => {
      total.other.set(bonus, (total.other.get(bonus) || 0) + 1)
    })

    return total
  }, sum)

  return sum
}

function hexBonus(bonuses, faction) {
  if (!bonuses.length) return;

  const total = sumBonus(bonuses);

  let res = `[2;37mBonuses gained from [1;${faction.get("ansi_color")}m${bonuses.length}[0m[2;37m hexes:[0m`

  if (!total.hot && !total.cool && !total.hard && !total.sharp && !total.other?.length) {
    res += `\n[2;37m  ‣[2;30m No bonuses... yet![0m`;    
    return res
  }

  statNames.forEach(stat => {
    if (total[stat]) res += `\n[2;37m  ‣[2;30m ❰ ${stat.toUpperCase()} +${total[stat]} ❱[0m`;
  })

  if (total.other.size) {
    res += "\n" + [...total.other.entries()].map(x => `[2;37m  ‣[2;30m ` + x[0] + (x[1] > 1 ? ` x${x[1]}[0m` : "")).join("\n")
  }

  return res
}

function statusEmbed(status, client) {
  let bonuses = parseBonus([status], "status_name")[0];

  let res = "";
  statNames.forEach(stat => {
    if (bonuses[stat]) res += `❰ ${stat.toUpperCase()} ${bonuses[stat] < 0 ? "" : "+"}${bonuses[stat]} ❱ `
  })

  if ((bonuses.other?.filter(x => x)?.length)) {
    res += "\n" + bonuses.other.filter(x => x).map(x => `[2;37m  ‣[2;30m ${x}[0m`).join("\n")
  }

  return {
    title: `${client.config("decorative_symbol")} ${status.get("status_name").toUpperCase()}`,
    description: (status.get("description")?.split("\n").map(x => `> ${x}`).join("\n") ?? "> *No description found.*")
      + (res ? "\n```ansi\n" + colorStats(res, false) + "```" : ""),
    color: color(client.config("default_color")),
    thumbnail: { url: client.config("default_image") }
  }
}

function hexEmbed(hex, client) {
  let bonuses = parseBonus([hex], "hex_id")[0];

  let faction = client.db.factions.find(x => x.get("faction_name") == hex.get("controlled_by"))

  let res = "";
  statNames.forEach(stat => {
    if (bonuses[stat]) res += `❰ ${stat.toUpperCase()} ${bonuses[stat] < 0 ? "" : "+"}${bonuses[stat]} ❱ `
  })

  if ((bonuses.other?.filter(x => x)?.length)) {
    res += "\n" + bonuses.other.filter(x => x).map(x => `[2;37m  ‣[2;30m ${x}[0m`).join("\n")
  }

  return {
    title: `${faction?.get("pin_emoji") ??
      client.config("decorative_symbol")
      }【${hex.get("hex_id")}】 ${hex.get("hex_name")?.toUpperCase() || ""}`,
    url: hex.get("link"),
    description:
      "` CONTROLLED BY ` " + (faction ? "The " + toTitleCase(faction.get("faction_name")) : hex.get("controlled_by"))
      + ("\n`   HOLD ` " + (hex.get("hold") || "0") + ((hex.get("is_base") == "TRUE") ? ` ${client.config("decorative_symbol")} base estabished` : ""))
      + (hex.get("description") ? "\n" + hex.get("description")?.split("\n").filter(x => x).map(x => `> ${x}`).join("\n") : "")
      + (res ? "\n```ansi\n" + colorStats(res, false) + "```" : ""),
    color: color(faction?.get("main_color") || client.config("default_color")),
    thumbnail: { url: hex.get("thumb") || faction?.get("crest_image") || client.config("default_image") }
  }
}

function statusMods(statuses) {
  let res = "";

  statuses.forEach(status => {
    let color = status.original.get("color"), ansi,
      hasMods = !!(status.hot || status.cool || status.hard || status.sharp || status.other?.length);;

    switch (color) {
      case "red": ansi = 31; break;
      case "yellow": ansi = 33; break;
      case "green": ansi = 36; break;
      case "blue": ansi = 34; break;
      case "pink": ansi = 35; break;
      default: ansi = 37; break;
    }

    res += `\n[2;37m【 [1;${ansi}m${status.name.toUpperCase()}[2;37m 】${hasMods ? ":" : ""}[0m`

    statNames.forEach(stat => {
      if (status[stat]) res += `\n[2;37m  ‣[2;30m ❰ ${stat.toUpperCase()} ${status[stat] >= 0 ? "+" : ""}${status[stat]} ❱[0m`;
    })

    res += "\n" + status.other.map(x => `[2;37m  ‣[2;30m ${x}[0m`).join("\n");
  })

  return res?.trim()
}

function hexList(client, faction) {
  let hexes = client.db.hexes.filter(x => x.get("hex_id") && x.get("hex_id") !== "blank");
  let factions = client.db.factions.filter(x => x.get("faction_name"));

  let list;
  let groups;

  if (faction == "all") {
    list = hexes.map(hex => {
      let emoji = factions.find(x => x.get("faction_name") == hex.get("controlled_by"))?.get("simple_emoji") || client.config("contested_emoji");
      let color = factions.find(x => x.get("faction_name") == hex.get("controlled_by"))?.get("asci_color") || 37;
      let base = hex.get("is_base").toUpperCase() == "TRUE"

      let result = `[2;${color}m【${hex.get("hex_id")}】${emoji}${base ? "🏠" : ""} ${hex.get("hex_name")}`.trim()

      if (hex.get("hot") || hex.get("cool") || hex.get("hard") || hex.get("sharp") || hex.get("misc_bonus"))
        result += "\n[2;37m  ‣ [2;30m";
      
      let stats = [];
      if (hex.get("hot")) stats.push("HOT +" + hex.get("hot"))
      if (hex.get("cool")) stats.push("COOL +" + hex.get("cool"))
      if (hex.get("hard")) stats.push("HARD +" + hex.get("hard"))
      if (hex.get("sharp")) stats.push("SHARP +" + hex.get("sharp"))
      if (stats.length) result += `❰ ${stats.join(", ")} ❱`

      if (hex.get("misc_bonus")) {
        if (stats.length) result += " + Effect"
        else result += hex.get("misc_bonus")
      }

      result += `[0m`

      return result
    })

    groups = arrayChunks(list, 12);
  } else {
    let color = factions.find(x => x.get("faction_name") == faction)?.get("ansi_color") || 37

    list = hexes.filter(x => x.get("controlled_by") == faction).map(hex => {
      let base = hex.get("is_base").toUpperCase() == "TRUE"

      let bonuses = sumBonus([hex]);
      let res = `[2;${color}m【${hex.get("hex_id")}】${base ? "🏠 " : ""}[0m${hex.get("hex_name") ? `[2;37m${hex.get("hex_name")}:` : ""}`

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

function itemEmbed(item, client, simple = false) {
  return {
    title: `${item.get("emoji") || client.config("default_item_emoji")} ${item.get("item_name").toUpperCase()}`,
    description: (!simple ? `**\`   CATEGORY \`** ${item.get("category")}\n**\`       COST \`** ${item.get("price") ? `${money(item.get("price"), client)}` : "N/A"
      }\n` : "")
      + (item.get("description")?.split("\n").map(x => `> ${x}`).join("\n") ?? "> *No description found.*"),
    color: color(client.config("default_color")),
    thumbnail: {
      url: item.get("item_image") || client.config("default_image")
    },
    footer: (item.get("hold_limit") || item.get("monthly_limit") || item.get("perma_limit") ? (() => {
      let limit = []
      if (item.get("hold_limit")) limit.push(`${item.get("hold_limit")} held at once`)
      if (item.get("daily_limit")) limit.push(`${item.get("daily_limit")} per day`)
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

const diacritic = (string) => string?.normalize('NFD').replace(/\p{Diacritic}/gu)

function findChar(client, search, withNPC) {
  let list = client.db.charas.map(x => ({
    name: x.get("chara_name"),
    fullname: x.get("full_name"),
    npc: x.get("is_npc")?.toLowerCase()
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
  res.content = /(?<=^\*\*Content:\*\*)(.+)$/mi.exec(src)?.[0].trim()
  res.description = /(?<=^\*\*Description:\*\*)(.+)$/smi.exec(src)?.[0].trim()

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

const randBetween = (min, max) => {
  let a = +min;
  let b = +max - +min + 1;

  return a + Math.floor(Math.random() * b);
}

const limit = (num, min, max) => {
  return Math.min(Math.max(num, min), max)
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

const toTitleCase = (str) => str.replace(/\w\S*/g, (text) => text.charAt(0).toUpperCase() + text.substring(1).toLowerCase())

module.exports = {
  money,
  charaEmbed, factionEmbed,
  itemEmbed,
  statusEmbed,
  hexEmbed, hexList,
  findChar, diacritic,
  parseEmbed, formatEmbed,
  pad, arrayChunks, removeEmpty, color,
  randBetween, limit,
  styleText, toTitleCase
}