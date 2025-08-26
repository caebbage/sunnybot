const { Inventory } = require('./inventory.js');
const { color, money } = require("../module/helpers.js");

async function award(interaction, profile, chara, awarded, mode = 0) {
  let embeds = [], log = [];
  const client = interaction.client,
    db = client.db;

  if (!awarded.money && !awarded.items && !awarded.heat && !awarded.reputation) throw new Error("No changes given.")

  if (awarded.money) {
    if (!profile) throw new Error("Profile not found to give money to.")

    const oldVal = parseInt(profile.get("money") || 0),
      newVal = oldVal + awarded.money;

    profile.set("money", newVal)
    log.push(`> **money:** +${awarded.money} (${oldVal} → ${newVal})`)
    embeds.push({
      description: `<@${profile.get("user_id")}> has received ${money(awarded.money, client)}!`,
      color: color(client.config("default_color"))
    })
  }
  if (awarded.items && !awarded.items.isEmpty()) {
    if (!profile) throw new Error("Profile not found to give items to.")

    let inventory = new Inventory(profile.get("inventory")),
      permaLimit = new Inventory(profile.get("perma_limit"));

    for (let entry of awarded.items.entries()) {
      const name = entry[0], amount = entry[1],
        item = db.items.find(row => row.get("item_name") == name)

      if (!item) throw new Error(`Item \`${name}\` not found!`)
      limit = {
        hold: parseInt(item.get("hold_limit")) || null,
        perma: parseInt(item.get("perma_limit")) || null
      }

      if (limit.hold && inventory.get(name) + amount > limit.hold) {
        throw new Error(`Transaction denied: cannot give ${amount} of ${name}\nThe item's holding limit is ${limit.hold}, and the user currently holds ${inventory.get(name)}.`)
      } else if (limit.perma && permaLimit.get(name) + amount > limit.perma) {
        throw new Error(`Transaction denied: cannot give ${amount} of ${name}\nThe item's lifetime limit is ${limit.perma}, and the user has had ${perma.get(name)}.`)
      }

      if (limit.perma) permaLimit.giveItem(name, amount)
    }

    profile.set("inventory", inventory.give(awarded.items).toString());
    profile.set("perma_limit", permaLimit.toString());

    log.push(`> **item gain:**\n` + awarded.items.toString().split("\n").map(x => `> - ${x}`).join("\n"))
    embeds.push({
      description: `<@${profile.get("user_id")}> has gained the following item(s):\n`
        + awarded.items.toString().split("\n").map(x => `> ${x}`).join("\n"),
      color: color(client.config("default_color"))
    })
  }

  if (awarded.money || awarded.items) await profile.save()

  if (awarded.heat) {
    if (!chara) throw new Error("Character not found to give Heat to.")

    const oldVal = parseInt(chara.get("heat") || 0),
      newVal = oldVal + awarded.heat;
    if (newVal > client.config("heat_cap")) throw new Error(`Transaction would exceed Heat cap (${client.config("heat_cap")}).`)

    chara.set("heat", newVal)
    log.push(`> **heat:** +${awarded.heat} (${oldVal} → ${newVal})`)
    embeds.push({
      description: `**${chara.get("chara_name")}** has earned ${awarded.heat} Heat!`,
      color: color(client.config("default_color"))
    })
  }
  if (awarded.reputation) {
    if (!chara) throw new Error("Character not found to give Reputation to.")

    const oldVal = parseInt(chara.get("reputation") || 0),
      newVal = oldVal + awarded.reputation;
    if (newVal > client.config("reputation_cap")) throw new Error(`Transaction would exceed Reputation cap (${client.config("reputation_cap")}).`)

    chara.set("reputation", newVal)
    log.push(`> **reputation:** +${awarded.reputation} (${oldVal} → ${newVal})`)
    embeds.push({
      description: `**${chara.get("chara_name")}** has earned ${awarded.reputation} Reputation!`,
      color: color(client.config("default_color"))
    })
  }

  if (awarded.heat || awarded.reputation) await chara.save()

  await client.log(
    `**TRANSACTION:** `
    + `<@${profile?.get("user_id") || chara?.get("owner")}>`
    + (chara ? ` (${chara.get("chara_name")})` : "")
    + "\n" + log.join("\n> \n"),
    interaction.user.id
  )

  // respond after
  if (embeds.length) {
    if (mode === 0) interaction.followUp({ embeds }) // follow-up to interaction
    else if (mode === 1) interaction.reply({ embeds }) // direct response to interaction
    else if (mode === 2) { /* no message */ }
  }
}

async function deduct(interaction, profile, chara, deducted, mode = 0) {
  let embeds = [], log = [];
  const client = interaction.client,
    db = client.db;

  if (!deducted.money && !deducted.items && !deducted.heat && !deducted.reputation) throw new Error("No changes given.")

  if (deducted.money) {
    if (!profile) throw new Error("Profile not found take money from.")

    const oldVal = parseInt(profile.get("money")),
      newVal = oldVal - deducted.money;
    if (newVal < 0) throw new Error("Not enough money to take.")

    profile.set("money", newVal)
    log.push(`> **money:** -${deducted.money} (${oldVal} → ${newVal})`)
    embeds.push({
      description: `<@${profile.get("user_id")}> has lost ${money(deducted.money, client)}.`,
      color: color(client.config("default_color"))
    })
  }

  if (deducted.items && !deducted.items.isEmpty()) {
    if (!profile) throw new Error("Profile not found to take items from.")

    let inventory = new Inventory(profile.get("inventory"))

    for (let entry of deducted.items.entries()) {
      const name = entry[0], amount = entry[1],
        item = db.items.find(row => row.get("item_name") == name)

      if (!item) throw new Error(`Item \`${name}\` not found!`)
      if (!inventory.hasItem(name, amount)) throw new Error(`Insufficient item \`${name}\`!`)
    }

    profile.set("inventory", inventory.take(deducted.items).toString());

    log.push(`> **item loss:**\n` + deducted.items.toString().split("\n").map(x => `> - ${x}`).join("\n"))

    embeds.push({
      description: `<@${profile.get("user_id")}> has lost the following item(s):\n`
        + deducted.items.toString().split("\n").map(x => `> ${x}`).join("\n"),
      color: color(client.config("default_color"))
    })
  }


  if (deducted.money || deducted.items) await profile.save()

  if (deducted.heat) {
    if (!chara) throw new Error("Character not found to take Heat from.")

    const oldVal = parseInt(chara.get("heat")),
      newVal = oldVal - deducted.heat;
    if (newVal < 0) throw new Error("Character doesn't have enough Heat to lose.")

    chara.set("heat", newVal)
    log.push(`> **heat:** -${deducted.heat} (${oldVal} → ${newVal})`)
    embeds.push({
      description: `**${chara.get("chara_name")}** has lost ${deducted.heat} Heat!`,
      color: color(client.config("default_color"))
    })
  }

  if (deducted.reputation) {
    if (!chara) throw new Error("Character not found take Reputation from.")

    const oldVal = parseInt(chara.get("reputation")),
      newVal = oldVal - deducted.reputation;
    if (newVal < 0) throw new Error("Character doesn't have enough Reputation to lose.")

    chara.set("reputation", newVal)
    log.push(`> **reputation:** -${deducted.reputation} (${oldVal} → ${newVal})`)
    embeds.push({
      description: `**${chara.get("chara_name")}** has lost ${deducted.reputation} Reputation!`,
      color: color(client.config("default_color"))
    })
  }

  if (deducted.heat || deducted.reputation) await chara.save()

  await client.log(
    `**TRANSACTION:** `
    + `<@${profile?.get("user_id") || chara?.get("owner_id")}>`
    + (chara ? ` (${chara.get("chara_name")})` : "")
    + "\n" + log.join("\n> \n"),
    interaction.user.id
  )

  // respond after
  if (embeds.length) {
    if (mode === 0) return await interaction.followUp({ embeds }) // follow-up to interaction
    else if (mode === 1) return await interaction.reply({ embeds }) // direct response to interaction
    else if (mode === 2) { /* no message */ }
  }
}

module.exports = { award, deduct }