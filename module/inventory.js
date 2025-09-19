module.exports = {
  Inventory: class {
    constructor(inv) {
      let res = {};
      if (inv) {
        [...inv.matchAll(/^(.+) \(x(\d+)\)$/gm)]
          .forEach(x => {
            let name = x[1].trim(), amt = parseInt(x[2])

            res[name] = (res[name] || 0) + amt
          })
      }
      this.data = res
    }

    get(name) { return this.data[name] ?? 0 }

    isEmpty() { return Object.keys(this.data).length == 0 }

    entries() { return Object.entries(this.data) }

    forEach(forEach) { return this.entries().forEach(item => forEach(item[0], item[1])) }
    find(find) { return this.entries().find(item => find(item[0], item[1])) }
    map(map) { return this.entries().map(item => map(item[0], item[1])) }

    checkLimit(monthly, perma) {
      let over = {};

      this.forEach((item, amt) => {
        let m = monthly.get(item), p = perma.get(item);

        if (amt > Math.max(m, p)) over[item] = amt - Math.max(m, p)
      })

      return over
    }

    toString() { return Object.entries(this.data).map(x => `${x[0]} (x${x[1]})`).join("\n") }

    toIcoString(client) {
      let items = client.db.items.filter(x => x.get("item_name"))

      return Object.entries(this.data).map(item => {
        let ico = items.find(i => i.get("item_name") == item[0])?.get("emoji") || client.config("default_item_emoji")

        return `${ico} ${item[0]} (x${item[1]})`
      }).join("\n")
    }

    has(find) {
      for (let [item, amt] of (find.entries?.() || find)) {
        if (this.get(item) - amt < 0) return false
      }
      return true
    }

    hasItem(item, amt = 1) {
      if (this.get(item) - amt < 0) return false
      return true
    }

    clean() {
      Object.keys(this.data).forEach(key => {
        if (this.data[key] < 1) delete this.data[key]
      })
      return this
    }
    sort() {
      this.data = Object.fromEntries(Object.entries(this.data).sort((a, b) => a[0].localeCompare(b[0])))
      return this
    }


    take(take) {
      if (this.has(take)) {
        for (let [item, amt] of (take.entries?.() || take)) {
          this.data[item] -= amt;
        }
      } else throw new Error("The requested items are not available!")

      return this.clean()
    }

    takeItem(item, amt = 1) {
      if (this.hasItem(item, amt)) {
        this.data[item] -= amt
      } else throw new Error("The requested item is not available!")

      return this.clean()
    }


    give(give) {
      for (let [item, amt] of (give.entries?.() || give)) {
        this.data[item] = (this.data[item] || 0) + amt
      }

      return this.sort()
    }

    giveItem(item, amt = 1) {
      this.data[item] = (this.data[item] || 0) + amt

      return this.sort()
    }
  }
}
