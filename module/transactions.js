const { limit } = require('./helpers.js');
const { Inventory } = require('./inventory.js');

async function award(interaction, target, change, setting = {}) {
  let log = [];
  const client = interaction.client,
    db = client.db;

  let profile = target.profile, chara = target.chara;

  try {
    if (!change.money && !change.points && !change.items && !change.heat && !change.reputation && !change.statuses) throw new Error("No changes given.")

    if ((change.money || change.points || change.items) && !profile) throw new Error("Profile not found.")

    if (change.money) {
      const oldVal = +profile.get("money") || 0,
        newVal = oldVal + change.money;

      profile.set("money", newVal)
      log.push(`> **money:** +${change.money} (${oldVal} → ${newVal})`)
    }
    
    if (change.points) {
      const oldVal = +profile.get("points") || 0,
        newVal = oldVal + change.points;

      profile.set("points", newVal)
      log.push(`> **points:** +${change.points} (${oldVal} → ${newVal})`)
    }

    if (change.items && !change.items.isEmpty()) {
      let inventory = new Inventory(profile.get("inventory")),
        permaLimit = new Inventory(profile.get("perma_limit"));

      for (let [name, amount] of change.items.entries()) {
        const item = db.items.find(row => row.get("item_name") == name)

        if (!item) throw new Error(`Item \`${name}\` not found!`)
        let itemLimit = {
          hold: +item.get("hold_limit") || null,
          perma: +item.get("perma_limit") || null
        }

        if (itemLimit.hold && inventory.get(name) + amount > itemLimit.hold) {
          throw new Error(`Transaction denied: cannot give ${amount} of ${name}\nThe item's holding limit is ${itemLimit.hold}, and the user currently holds ${inventory.get(name)}.`)
        } else if (itemLimit.perma && permaLimit.get(name) + amount > itemLimit.perma) {
          throw new Error(`Transaction denied: cannot give ${amount} of ${name}\nThe item's lifetime limit is ${itemLimit.perma}, and the user has had ${permaLimit.get(name)}.`)
        }

        if (itemLimit.perma) permaLimit.giveItem(name, amount)
      }

      profile.set("inventory", inventory.give(change.items).toString());
      profile.set("perma_limit", permaLimit.toString());

      log.push(`> **item gain:**\n` + change.items.toString().split("\n").map(x => `> - ${x}`).join("\n"))
    }


    if ((change.heat || change.reputation || change.statuses) && !chara) throw new Error("Character not found.")
    if (change.heat) {
      const oldVal = +chara.get("heat") || 0;
      let newVal;
      if (setting?.toCap) {
        newVal = limit(oldVal + change.heat, 0, 5); 
      } else {
        newVal = oldVal + change.heat;
        if (newVal > 5) throw new Error(`Transaction would exceed Heat cap of 5.`)
      }

      chara.set("heat", newVal)
      log.push(`> **heat:** +${change.heat} (${oldVal} → ${newVal})`)
    }

    if (change.reputation) {
      const oldVal = +chara.get("reputation") || 0;
      let newVal = oldVal + change.reputation;
      if (setting?.toCap) {
        newVal = limit(oldVal + change.reputation, 0, 9999);
      } else {
        newVal = oldVal + change.reputation;
        if (newVal > 9999) throw new Error(`Transaction would exceed Reputation cap of 9999.`)
      }

      chara.set("reputation", newVal)
      log.push(`> **reputation:** +${change.reputation} (${oldVal} → ${newVal})`)
    }

    if (change.statuses) {
      let statuses = chara.get("statuses")?.split(", ").map(x => x.trim()) || [],
        newStatuses = change.statuses.split(", ").map(x => x.trim())

      statuses.push(...newStatuses);

      chara.set("statuses", [...new Set(statuses.filter(x => x))].join(", "))
      log.push(`> **status:** Gained ` + newStatuses.filter(x => x).map(x => `\`${x.trim()}\``).join(", "))
    }

    if (!setting?.noReplyCheck && interaction.replied) throw new Error("Transaction already processed!")
    if (change.money || change.points || change.items) await profile.save()
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
    if (!change.money && !change.points && !change.items && !change.heat && !change.reputation && !change.statuses) throw new Error("No changes given.")

    if ((change.money || change.points || change.items) && !profile) throw new Error("Profile not found.")

    if (change.money) {
      const oldVal = +profile.get("money") || 0,
        newVal = oldVal - change.money;
      if (newVal < 0) throw new Error(`Not enough money to take. (User has ${oldVal}.)`)

      profile.set("money", newVal)
      log.push(`> **money:** -${change.money} (${oldVal} → ${newVal})`)
    }
    
    if (change.points) {
      const oldVal = +profile.get("points") || 0,
        newVal = oldVal - change.points;

      profile.set("points", newVal)
      log.push(`> **points:** -${change.points} (${oldVal} → ${newVal})`)
    }

    if (change.items && !change.items.isEmpty()) {
      let inventory = new Inventory(profile.get("inventory"))

      for (let [name, amount] of change.items.entries()) {
        const item = db.items.find(row => row.get("item_name") == name)

        if (!item) throw new Error(`Item \`${name}\` not found!`)
        if (!inventory.hasItem(name, amount)) throw new Error(`Insufficient item ${name}!`)
      }

      profile.set("inventory", inventory.take(change.items).toString());

      log.push(`> **item loss:**\n` + change.items.toString().split("\n").map(x => `> - ${x}`).join("\n"))
    }

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

    if (change.statuses) {
      let statuses = chara.get("statuses")?.split(", ").map(x => x.trim()) || [],
        removeStatuses = change.statuses.split(", ").map(x => x.trim());

      statuses = statuses.filter(x => !removeStatuses.includes(x))

      chara.set("statuses", [...new Set(statuses.filter(x => x))].join(", "))
      log.push(`> **status:** Lost ` + removeStatuses.map(x => `\`${x.trim()}\``).join(", "))
    }

    if (interaction.replied) throw new Error("Transaction already processed!")
    if (change.money || change.points || change.items) await profile.save()
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

      for (let [name, amount] of change.items.entries()) {
        const item = db.items.find(row => row.get("item_name") == name)

        if (!item) throw new Error(`Item \`${name}\` not found!`)
        if (item.get("untradeable")?.toUpperCase() == "TRUE") throw new Error(`${name} is untradeable!`)
        if (giverInv.get(name) < amount) throw new Error(`Insufficient ${name}! You hold ${giverInv.get(name)}.`)

        let itemLimit = {
          hold: +item.get("hold_limit") || null,
          perma: +item.get("perma_limit") || null
        }

        if (itemLimit.hold && receiverInv.get(name) + amount > itemLimit.hold) {
          throw new Error(`Transaction denied: cannot transfer ${amount} of ${name}\nThe item's holding limit is ${itemLimit.hold}, and the user currently holds ${receiverInv.get(name)}.`)
        } else if (itemLimit.perma && permaLimit.get(name) + amount > itemLimit.perma) {
          throw new Error(`Transaction denied: cannot transfer ${amount} of ${name}\nThe item's lifetime limit is ${itemLimit.perma}, and the user has had ${permaLimit.get(name)}.`)
        }
      }

      giver.profile.set("inventory", giverInv.take(change.items).toString());
      receiver.profile.set("inventory", receiverInv.give(change.items).toString());
      receiver.profile.set("perma_limit", permaLimit.toString());

      log.giver.push(`> **item loss:**\n` + change.items.toString().split("\n").map(x => `> - ${x}`).join("\n"))
      log.receiver.push(`> **item gain:**\n` + change.items.toString().split("\n").map(x => `> - ${x}`).join("\n"))
    }

    if (interaction.replied) throw new Error("Transaction already processed!")
    if (change.money || change.items) {
      await giver.profile.save()
      await receiver.profile.save()
    }

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