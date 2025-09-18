const { Inventory } = require('./inventory.js');

async function award(interaction, target, change) {
  let log = [];
  const client = interaction.client,
    db = client.db;

  let profile = target.profile, chara = target.chara;

  try {
    if (!change.money && !change.items && !change.heat && !change.reputation) throw new Error("No changes given.")

    if ((change.money || change.items) && !profile) throw new Error("Profile not found.")

    if (change.money) {
      const oldVal = +profile.get("money") || 0,
        newVal = oldVal + change.money;

      profile.set("money", newVal)
      log.push(`> **money:** +${change.money} (${oldVal} → ${newVal})`)
    }

    if (change.items && !change.items.isEmpty()) {
      let inventory = new Inventory(profile.get("inventory")),
        permaLimit = new Inventory(profile.get("perma_limit"));

      for (let entry of change.items.entries()) {
        const name = entry[0], amount = entry[1],
          item = db.items.find(row => row.get("item_name") == name)

        if (!item) throw new Error(`Item \`${name}\` not found!`)
        limit = {
          hold: +item.get("hold_limit") || null,
          perma: +item.get("perma_limit") || null
        }

        if (limit.hold && inventory.get(name) + amount > limit.hold) {
          throw new Error(`Transaction denied: cannot give ${amount} of ${name}\nThe item's holding limit is ${limit.hold}, and the user currently holds ${inventory.get(name)}.`)
        } else if (limit.perma && permaLimit.get(name) + amount > limit.perma) {
          throw new Error(`Transaction denied: cannot give ${amount} of ${name}\nThe item's lifetime limit is ${limit.perma}, and the user has had ${permaLimit.get(name)}.`)
        }

        if (limit.perma) permaLimit.giveItem(name, amount)
      }

      profile.set("inventory", inventory.give(change.items).toString());
      profile.set("perma_limit", permaLimit.toString());

      log.push(`> **item gain:**\n` + change.items.toString().split("\n").map(x => `> - ${x}`).join("\n"))
    }

    if (change.money || change.items) await profile.save()


    if ((change.heat || change.reputation || change.statuses) && !chara) throw new Error("Character not found.")
    if (change.heat) {
      const oldVal = +chara.get("heat") || 0,
        newVal = oldVal + change.heat;
      if (newVal > client.config("heat_cap")) throw new Error(`Transaction would exceed Heat cap (${client.config("heat_cap")}).`)

      chara.set("heat", newVal)
      log.push(`> **heat:** +${change.heat} (${oldVal} → ${newVal})`)
    }

    if (change.reputation) {
      const oldVal = +chara.get("reputation") || 0,
        newVal = oldVal + change.reputation;
      if (newVal > client.config("reputation_cap")) throw new Error(`Transaction would exceed Reputation cap (${client.config("reputation_cap")}).`)

      chara.set("reputation", newVal)
      log.push(`> **reputation:** +${change.reputation} (${oldVal} → ${newVal})`)
    }

    if (change.heat || change.reputation || change.statuses) await chara.save()

    return {
      success: true,
      log
    }

  } catch (error) {
    return {
      success: false,
      error
    }
  }
}

async function deduct(interaction, target, change) {
  let log = [];
  const client = interaction.client,
    db = client.db;

  let profile = target.profile, chara = target.chara;

  try {
    if (!change.money && !change.items && !change.heat && !change.reputation) throw new Error("No changes given.")

    if ((change.money || change.items) && !profile) throw new Error("Profile not found.")

    if (change.money) {
      const oldVal = +profile.get("money"),
        newVal = oldVal - change.money;
      if (newVal < 0) throw new Error(`Not enough money to take. (User has ${oldVal}.)`)

      profile.set("money", newVal)
      log.push(`> **money:** -${change.money} (${oldVal} → ${newVal})`)
    }

    if (change.items && !change.items.isEmpty()) {
      let inventory = new Inventory(profile.get("inventory"))

      for (let entry of change.items.entries()) {
        const name = entry[0], amount = entry[1],
          item = db.items.find(row => row.get("item_name") == name)

        if (!item) throw new Error(`Item \`${name}\` not found!`)
        if (!inventory.hasItem(name, amount)) throw new Error(`Insufficient item ${name}!`)
      }

      profile.set("inventory", inventory.take(change.items).toString());

      log.push(`> **item loss:**\n` + change.items.toString().split("\n").map(x => `> - ${x}`).join("\n"))
    }

    if (change.money || change.items) await profile.save()


    if ((change.heat || change.reputation || change.statuses) && !chara) throw new Error("Character not found.")
    if (change.heat) {
      const oldVal = +chara.get("heat"),
        newVal = oldVal - change.heat;
      if (newVal < 0) throw new Error("Character doesn't have enough Heat to lose.")

      chara.set("heat", newVal)
      log.push(`> **heat:** -${change.heat} (${oldVal} → ${newVal})`)
    }
    if (change.reputation) {
      const oldVal = +chara.get("reputation"),
        newVal = oldVal - change.reputation;
      if (newVal < 0) throw new Error("Character doesn't have enough Reputation to lose.")

      chara.set("reputation", newVal)
      log.push(`> **reputation:** -${change.reputation} (${oldVal} → ${newVal})`)
    }

    if (change.heat || change.reputation || change.statuses) await chara.save()

    return {
      success: true,
      log
    }
  } catch (error) {
    return {
      success: false,
      error
    }
  }
}

async function transfer(interaction, giver, receiver, change) {
  let log = { giver: [], receiver: [] };
  const client = interaction.client,
    db = client.db;

  try {
    if (!change.money && !change.items && !change.heat && !change.reputation) throw new Error("No changes given.")

    if ((change.money || change.items) && (!giver.profile || !receiver.profile)) throw new Error("Profile not found.")

    if (change.money) {
      const give = {
        old: +giver.profile.get("money"),
      }, receive = {
        old: +receiver.profile.get("money")
      }
      give.new = give.old - change.money;
      receive.new = receive.old + change.money;

      if (give.new < 0) throw new Error("Not enough money to transfer.")

      giver.profile.set("money", give.new)
      receiver.profile.set("money", receive.new)

      log.giver.push(`> **money:** -${change.money} (${give.old} → ${give.new})`)
      log.receiver.push(`> **money:** +${change.money} (${receive.old} → ${receive.new})`)
    }

    if (change.items && !change.items.isEmpty()) {
      if (!giver.profile || !receiver.profile) throw new Error("Profile not found.")

      let giverInv = new Inventory(giver.profile.get("inventory"))
      let receiverInv = new Inventory(receiver.profile.get("inventory")),
        permaLimit = new Inventory(receiver.profile.get("perma_limit"));

      for (let entry of change.items.entries()) {
        const name = entry[0], amount = entry[1],
          item = db.items.find(row => row.get("item_name") == name)

        if (!item) throw new Error(`Item \`${name}\` not found!`)

        if (giverInv.get(name) < amount) throw new Error(`Insufficient item ${name}! The giver holds ${giverInv.get(name)}.`)

        limit = {
          hold: +item.get("hold_limit") || null,
          perma: +item.get("perma_limit") || null
        }

        if (limit.hold && receiverInv.get(name) + amount > limit.hold) {
          throw new Error(`Transaction denied: cannot transfer ${amount} of ${name}\nThe item's holding limit is ${limit.hold}, and the user currently holds ${receiverInv.get(name)}.`)
        } else if (limit.perma && permaLimit.get(name) + amount > limit.perma) {
          throw new Error(`Transaction denied: cannot transfer ${amount} of ${name}\nThe item's lifetime limit is ${limit.perma}, and the user has had ${permaLimit.get(name)}.`)
        }
      }

      giver.profile.set("inventory", giverInv.take(change.items).toString());
      receiver.profile.set("inventory", receiverInv.give(change.items).toString());
      receiver.profile.set("perma_limit", permaLimit.toString());

      log.giver.push(`> **item loss:**\n` + change.items.toString().split("\n").map(x => `> - ${x}`).join("\n"))
      log.receiver.push(`> **item gain:**\n` + change.items.toString().split("\n").map(x => `> - ${x}`).join("\n"))
    }

    if (change.money || change.items) {
      await giver.profile.save()
      await receiver.profile.save()
    }

    if (change.heat || change.reputation) await chara.save()

    return {
      success: true,
      log
    }
  } catch (error) {
    return {
      success: false,
      error
    }
  }
}

module.exports = { award, deduct, transfer }