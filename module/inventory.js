const diacritic = (string) => string?.normalize('NFD').replace(/\p{Diacritic}/gu)

module.exports = {
  Inventory: class {
    constructor(inv) {
      let res = new Map();
      if (inv) {
        for (let [, name, amt] of [...inv.matchAll(/^(.+) \(x(\d+)\)$/gm)]) {
          res.set(name, (res.get(name) || 0) + +amt)
        }
      }
      this.data = res
    }

    get(name) { return this.data.get(name) || 0 }

    isEmpty() { return this.data.size == 0 }

    entries() { return [... this.data.entries()] }

    keys() { return [... this.data.keys()] }

    forEach(forEach) { return this.entries().forEach(([item, amt]) => forEach(item, amt)) }
    find(find) { return this.entries().find(([item, amt]) => find(item, amt)) }
    map(map) { return this.entries().map(([item, amt]) => map(item, amt)) }
    filter(filter) { return this.entries().filter(([item, amt]) => filter(item, amt)) }

    groupedInv(client) {
      const items = client.db.items.filter(x => x.get("item_name"));
      const inInv = new Map();
      items.filter(x => this.keys().includes(x.get("item_name"))).forEach(item => {
        inInv.set(item.get("item_name"), {
          group: item.get("category"),
          amount: this.data.get(item.get("item_name"))
        })
      })

      const groups = [...new Set([...inInv.entries()].map(x => x[1].group))];

      let result = new Map();
      groups.forEach(group => {
        result.set(group,
          [...inInv.entries().filter(([, data]) => data.group == group).map(([item, data]) => `${item} (x${data.amount})`)].join("\n")
        )
      })
      return result;
    }

    validate(client) {
      let items = new Map(client.db.items.filter(x => x.get("item_name")).map(x => ([x.get("item_name"), x])))
      let itemNames = [...items.keys()];

      this.entries().forEach(([item, amt]) => {
        if (!items.get(item)) {
          this.data.delete(item)
          let softMatch = itemNames.find(name => diacritic(name.toLowerCase()) == diacritic(item.toLowerCase()))
          if (softMatch) {
            this.data.set(softMatch, amt)
          }
        }
      })

      this.sort()

      return this
    }

    checkLimit(monthly, perma) {
      let over = {};

      this.forEach((item, amt) => {
        let m = monthly.get(item), p = perma.get(item);

        if (amt > Math.max(m, p)) over[item] = amt - Math.max(m, p)
      })

      return over
    }

    toString() { return this.entries().map(([item, amt]) => `${item} (x${amt})`).join("\n") }

    toIcoString(client) {
      let items = client.db.items.filter(x => x.get("item_name"))

      return this.entries().map(([item, amt]) => {
        let ico = items.find(i => i.get("item_name") == item)?.get("emoji") || client.config("default_item_emoji")

        return `${ico} ${item} (x${amt})`
      }).join("\n")
    }

    has(find) {
      for (let [item, amt] of (find.entries?.() || find)) {
        if (!this.hasItem(item, amt)) return false
      }
      return true
    }

    hasItem(item, amt = 1) {
      if (this.get(item) - amt < 0) return false
      return true
    }

    clean() {
      this.keys().forEach((name) => {
        if (this.data.get(name) < 1) this.data.delete(name)
      })
      return this
    }
    sort() {
      this.data = new Map(this.entries().sort((a, b) => a[0].localeCompare(b[0])));
      return this
    }

    take(take) {
      if (this.has(take)) {
        for (let [item, amt] of (take.entries?.() || take)) {
          this.data.set(item, this.data.get(item) - amt)
        }
      } else throw new Error("The requested items are not available!")

      return this.clean()
    }

    takeItem(item, amt = 1) {
      if (this.hasItem(item, amt)) {
        this.data.set(this.data.get(item) - amt)
      } else throw new Error("The requested item is not available!")

      return this.clean()
    }


    give(give) {
      for (let [item, amt] of (give.entries?.() || give)) {
        this.data.set(item, (this.data.get(item) || 0) + amt)
      }

      return this.sort()
    }

    giveItem(item, amt = 1) {
      this.data.set((this.data.get(item) || 0) + amt)

      return this.sort()
    }
  }
}
