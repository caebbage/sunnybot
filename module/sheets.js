module.exports = async (client) => {
  const { GoogleSpreadsheet } = require('google-spreadsheet');
  const { JWT } = require('google-auth-library');

  // Initialize auth - see https://theoephraim.github.io/node-google-spreadsheet/#/guides/authentication

  const auth = {
    master: new JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    }),
    user: new JWT({
      email: process.env.GOOGLE_EMAIL_USER,
      key: process.env.GOOGLE_PRIVATE_USER.replace(/\\n/g, "\n"),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    }),
    item: new JWT({
    email: process.env.GOOGLE_EMAIL_ITEM,
    key: process.env.GOOGLE_PRIVATE_ITEM.replace(/\\n/g, "\n"),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
  }

  client.sheets = {};

  // ---------- CONFIGURATION ------------ //

  client.sheets.config = {};
  client.sheets.config.master = new GoogleSpreadsheet(process.env.SHEET_CONFIG, auth.master);
  client.sheets.config.user = new GoogleSpreadsheet(process.env.SHEET_CONFIG, auth.user);
  client.sheets.config.item = new GoogleSpreadsheet(process.env.SHEET_CONFIG, auth.item);


  client.sheets.src = {};
  client.sheets.config.refresh = async function () {
    await client.sheets.config.master.loadInfo()
    client.sheets.src.master = (await client.sheets.config.master.sheetsById[0].getRows())[0]
    console.log(`[REFRESH] Master instance loaded`)

    await client.sheets.config.user.loadInfo()
    await client.sheets.config.item.loadInfo()
    console.log(`[REFRESH] User & Item instances loaded`)
  }

  client.config = function (data) { return client.sheets.src.master.get(data) }

  await client.sheets.config.refresh();

  // ----------- DATABASE ------------ //

  client.db = {};

  async function setup(sheetId, type = "master") {
    let res = {
      sheet: client.sheets.config[type].sheetsById[sheetId],
      async reload() {
        await this.sheet?.loadHeaderRow()

        this.data = await this.sheet?.getRows({
          limit: 500
        }) ?? this.data()
      },
      data: [],
      find(...args) { return this.data.find(...args) },
      sort(...args) { return this.data.sort(...args) },
      filter(...args) { return this.data.filter(...args) },
      forEach(...args) { return this.data.forEach(...args) },
      map(...args) { return this.data.map(...args) },
      toObjects() { return this.data.map(x => x.toObject()) }
    }
    await res.reload();

    return res
  }

  client.resetData = async function () {
    for (let sheet of ["users", "charas", "factions", "hexes", "items", "tasks", "work", "crime", "reactroles", "statuses"]) {
      let type = "master"

      if (["users", "charas"].includes(sheet)) type = "user"
      if (["items"].includes(sheet)) type = "item"
      client.db[sheet] = await setup(client.config(`${sheet}_sheet`), type)
    }
    console.log("[REFRESH] Data loaded")
  }

  await client.resetData();

  for (let row of client.db.reactroles.filter(row => row.get("message_id"))) {
    try {
      await (await client.channels.fetch(row.get("message_channel"))).messages.fetch(row.get("message_id"))
    } catch (err) {
      row.delete()
    }
  }

  client.log = async function (description, extra) {
    try {
      const log = await client.channels.fetch(client.config("log_channel"));

      let extras = [];
      if (extra?.sender) extras.push(`Executed by <@${extra.sender}>`)
      if (extra?.url) extras.push(`${extra.url}`)

      log.send({
        embeds: [{
          description: description.trim()
            + (extras.length ? ('\n\n-# ' + extras.join(" | ")) : ""),
          timestamp: new Date().toISOString()
        }]
      })
    } catch (error) {
      console.log("Logging error:\n" + error.message)
    }
  }

  // --------- CUSTOM COMMANDS --------- //

  client.sheets.commands = {}; // sheet for custom commands
  client.sheets.commands.src = new GoogleSpreadsheet(process.env.SHEET_COMMANDS, auth.master);

  client.sheets.commands.refresh = async function () {
    await client.sheets.commands.src.loadInfo()
    console.log(`[REFRESH] Commands`)
  }

  await client.sheets.commands.refresh();

  client.db.actions = await (async () => {
    let res = {
      sheet: client.sheets.commands.src.sheetsById[0],
      async reload() {
        this.data = (await this.sheet?.getRows({
          limit: 500
        }))?.filter(x => x.get("command_name")) ?? this.data()
      },
      data: [],
      list: client.sheets.commands.src,
      find(...args) { return this.data.find(...args) },
      filter(...args) { return this.data.filter(...args) },
      map(...args) { return this.data.map(...args) },
      async get(name) {
        try {
          let action = client.customCommands.get(name);

          if (!action || (new Date()).getTime() - action.lastChecked.getTime() >= 60 * 1000) {
            let id = this.data.find(x => x.get("command_name") === name)?.get("sheet_id")
            if (!id) {
              await this.reload()
              id = this.data.find(x => x.get("command_name") === name)?.get("sheet_id")
              if (!id) return

              await this.list.loadInfo()
            }

            let sheet = await this.list.sheetsById[id];
            if (!sheet) return

            await sheet.loadHeaderRow();
            let data = (await sheet.getRows({ limit: 500 })).filter(x => x.get("weight"));
            if (!data?.length) return

            data.lastChecked = new Date();

            client.customCommands.set(name, data);
          }

          return client.customCommands.get(name);
        } catch (error) {
          console.log(error)
          return
        }
      }
    }
    await res.reload();

    return res
  })()
}