const { Inventory } = require('./inventory.js');
const { level, color } = require("../module/helpers.js");

async function award(interaction, profile, chara, money, xp, items, challenge, mode = 0) {
  let embeds = [], log = [];
  const client = interaction.client,
    db = client.db;

  if (!money && !xp && !items && !challenge) throw new Error("No changes given.")

  if (challenge) {
    if (!chara) throw new Error("Character not found to complete challenge with.")

    chara.set("challenge_completed", (() => {
      let completed = chara.get("challenge_completed") ? chara.get("challenge_completed").split(", ") : []
      completed.push(challenge.get("challenge_id"))
      // sorts completed by sort order in challenges
      completed = db.challenges.data.filter(row => completed.includes(row.get("challenge_id"))).map(x => x.get("challenge_id"))
      return completed.join(", ")
    })())

    log.push(`> **CHALLENGE COMPLETED:** ${challenge.get("challenge_id")}`)
    if (challenge.get("badge")) {
      embeds.push({
        description: `You've earned the ${challenge.get("badge")} badge!`,
        color: color(client.config("default_color"))
      })
    }
  }

  if (money) {
    if (!profile) throw new Error("Profile not found to give money to.")

    const oldVal = parseInt(profile.get("money")),
      newVal = oldVal + money;

    profile.set("money", newVal)
    log.push(`> **money:** +${money} (${oldVal} → ${newVal})`)
    embeds.push({
      description: `<@${profile.get("user_id")}> has received ${client.config("money_symbol")}${money}!`,
      color: color(client.config("default_color"))
    })
  }

  if (xp) {
    if (!chara) throw new Error("Character not found to give xp to.")

    const oldVal = parseInt(chara.get("xp_points")),
      newVal = oldVal + xp;

    chara.set("xp_points", newVal)
    log.push(`> **xp:** +${xp} (${oldVal} → ${newVal})`)
    embeds.push({
      description: `**${chara.get("chara_name")}** has received ${xp}${client.config("xp_symbol")}!`
        + (level(newVal) > level(oldVal) ? `\n**${chara.get("chara_name")}** is now **Level ${level(newVal)}**!` : ""),
      color: color(client.config("default_color"))
    })
  }

  if (items && items.hasContents()) {
    if (!profile) throw new Error("Profile not found to give items to.")

    let inventory = new Inventory(profile.get("inventory")),
      permaLimit = new Inventory(profile.get("perma_limit"));

    for (let entry of items.toArray()) {
      const name = entry[0], amount = entry[1],
        item = db.items.find(row => row.get("item_name") == name)

      if (!item) throw new Error(`Item \`${name}\` not found!`)
      limit = {
        hold: parseInt(item.get("hold_limit")) || null,
        monthly: parseInt(item.get("monthly_limit")) || null,
        perma: parseInt(item.get("perma_limit")) || null
      }

      if (limit.hold && inventory.get(name) + amount > limit.hold) {
        throw new Error(`Transaction denied: cannot give ${amount} of ${name}\nThe item's holding limit is ${limit.hold}, and the user currently holds ${inventory.get(name)}.`)
      } else if (limit.perma && permaLimit.get(name) + amount > limit.perma) {
        throw new Error(`Transaction denied: cannot give ${amount} of ${name}\nThe item's lifetime limit is ${limit.perma}, and the user has had ${perma.get(name)}.`)
      }

      if (limit.perma) permaLimit.give({}, name, amount)
    }

    profile.set("inventory", inventory.give(items).toString());
    profile.set("perma_limit", permaLimit.toString());

    log.push(`> **item gain:**\n` + items.toString().split("\n").map(x => `> - ${x}`).join("\n"))
    embeds.push({
      description: (items.toArray().length > 1
        ? `<@${profile.get("user_id")}> has gained the following items:\n`
        + items.toString().split("\n").map(x => `> ${x}`).join("\n")
        : `<@${profile.get("user_id")}> has gained \` ${items.toArray()[0][0]} \` x${items.toArray()[0][1]}!`),
      color: color(interaction.client.config("default_color"))
    })
  }

  if (profile) await profile.save()
  if (chara) await chara.save()

  await client.log(
    `**TRANSACTION:** `
    + `<@${profile?.get("user_id") || chara?.get("owner")}>`
    + (chara ? ` (${chara.get("chara_name")})` : "")
    + "\n" + log.join("\n> \n")
  )

  // respond after
  if (embeds.length) {
    if (mode === 0) interaction.followUp({ embeds }) // follow-up to interaction
    else if (mode === 1) interaction.reply({ embeds }) // direct response to interaction
    else if (mode === 2) { /* no message */ }
  }
  
  if (xp || challenge) {
    const alerts = checkAlerts(chara, {
      xp: xp,
      challenges: (challenge ? [challenge.get("challenge_id")] : undefined)
    }, interaction.client);
    if (alerts?.length) sendAlerts(chara, alerts, interaction.client);
  }
}

async function deduct(interaction, profile, chara, money, xp, items, challenge, mode = 0) {
  let embeds = [], log = [];
  const client = interaction.client,
    db = client.db;

  if (!money && !xp && !items && !challenge) throw new Error("No changes given.")

  if (money) {
    if (!profile) throw new Error("Profile not found to give money to.")

    const oldVal = parseInt(profile.get("money")),
      newVal = oldVal - money;
    if (newVal < 0) throw new Error("Not enough money to take.")

    profile.set("money", newVal)
    log.push(`> **money:** -${money} (${oldVal} → ${newVal})`)
    embeds.push({
      description: `<@${profile.get("user_id")}> has lost ${client.config("money_symbol")}${money}.`,
      color: color(client.config("default_color"))
    })
  }

  if (xp) {
    if (!chara) throw new Error("Character not found to give xp to.")

    const oldVal = parseInt(chara.get("xp_points")),
      newVal = oldVal - xp;
    if (newVal < 0) throw new Error("Not enough XP to take.")

    chara.set("xp_points", newVal)
    log.push(`> **xp:** -${xp} (${oldVal} → ${newVal})`)
    embeds.push({
      description: `**${chara.get("chara_name")}** has lost ${xp}${client.config("xp_symbol")}.`
        + (level(newVal) > level(oldVal) ? `\n**${chara.get("chara_name")}** is now **Level ${level(newVal)}**!` : ""),
      color: color(client.config("default_color"))
    })
  }

  if (items && items.hasContents()) {
    if (!profile) throw new Error("Profile not found to give items to.")

    let inventory = new Inventory(profile.get("inventory"))

    for (let entry of items.toArray()) {
      const name = entry[0], amount = entry[1],
        item = db.items.find(row => row.get("item_name") == name)

      if (!item) throw new Error(`Item \`${name}\` not found!`)
      if (!inventory.checkHas({}, name, amount)) throw new Error(`Insufficient item \`${name}\`!`)
    }

    profile.set("inventory", inventory.take(items).toString());

    log.push(`> **item loss:**\n` + items.toString().split("\n").map(x => `> - ${x}`).join("\n"))

    embeds.push({
      description: (items.toArray().length > 1
        ? `<@${profile.get("user_id")}> has lost the following items:\n`
        + items.toString().split("\n").map(x => `> ${x}`).join("\n")
        : `<@${profile.get("user_id")}> has lost \` ${items.toArray()[0][0]} \` x${items.toArray()[0][1]}!`),
      color: color(interaction.client.config("default_color"))
    })
  }

  if (profile) await profile.save()
  if (chara) await chara.save()

  await client.log(
    `**TRANSACTION:** `
    + `<@${profile?.get("user_id") || chara?.get("owner")}>`
    + (chara ? ` (${chara.get("chara_name")})` : "")
    + "\n" + log.join("\n> \n")
  )

  // respond after
  if (embeds.length) {
    if (mode === 0) interaction.followUp({ embeds }) // follow-up to interaction
    else if (mode === 1) interaction.reply({ embeds }) // direct response to interaction
    else if (mode === 2) { /* no message */ }
  }
}

function checkAlerts(chara, diff, client) {
  // chara: character in question
  // diff: XP/challenge differences in transaction
  // {xp: #, challenges: [array]}
  // client: client access
  // return array of challenge IDs

  const credentials = {
    xp: parseInt(chara.get("xp_points") ?? 0),
    challenges: chara.get("challenge_completed").split(", ")
  }

  // just the challenges eligible
  let challenges = client.db.challenges.filter(chal => {
    if (parseInt(chal.get("xp_min")) > credentials.xp) return false
    if (chal.get("complete_req")) {
      chal.get("complete_req").split(", ")
      for (let req of (chal.get("complete_req").split(", "))) {
        if (!credentials.challenges.includes(req)) return false
      }
    }
    return true
  })

  // check for if eligibility is lost without new credentials
  let alerts = challenges.map(x => x.toObject()).filter(chal => {
    if (parseInt(chal.xp_min) > credentials.xp - diff.xp) return true
    if (chal.complete_req) {
      for (let req of chal.complete_req.split(", ")) {
        if (diff.challenges?.includes(req)) return true
      }
    }
    else return false
  })

  return alerts;
}

async function sendAlerts(chara, challenges, client) {
  try {
    const notif = await client.channels.fetch(client.config("notif_channel"));

    await notif.send({
      content: `✉️ <@${chara.get("owner")}> new alert! You're now skilled enough to try the following challenge(s):`,
      embeds: challenges.map(chal => ({
        title: `${chal.badge || client.config("poke_symbol")} ${chal.challenge_id}: ${chal.challenge_name}`,
        description: chal.description.split("\n").map(x => `> ${x}`).join("\n"),
        color: color(client.config("default_color")),
        thumbnail: {
          url: chal.icon || client.config("default_image")
        }
      }))
    })
  } catch (error) {
    console.log("Error sending alert:\n" + error.message)
  }
}

module.exports = { award, deduct, checkAlerts, sendAlerts }