# RNGdle

Roll a six digit number, collect badges, and beat your friends. Accounts, rolls, the shop, the daily wheel and Higher or Lower all run on the server, so nobody can fake a score.

## Put it online with Railway

You need a free GitHub account and your Railway account.

1. **Put the code on GitHub.** Unzip this folder. On github.com, make a new repository called `rngdle`, then use **Add file → Upload files** and pick all the files from the unzipped folder. Commit.
2. **Make the app on Railway.** Start a new project and choose to deploy from your GitHub repo. Pick `rngdle`. Railway sees `package.json` and runs `npm start` by itself.
3. **Add the database.** In the same project, add a **PostgreSQL** database.
4. **Connect them.** Open the `rngdle` service, go to **Variables**, and add a variable named `DATABASE_URL`. For its value, reference the Postgres one: `${{Postgres.DATABASE_URL}}`. Railway redeploys.
5. **Get a link.** In the `rngdle` service settings, under networking, generate a public domain. That's the link you send your friends.

Without step 4 the game still runs, but it saves accounts in a file that gets wiped every time Railway redeploys. So do step 4.

If the server log ever says it can't connect to the database because of SSL, add one more variable: `PGSSL` = `true`.

## Run it on a computer

You need Node.js 18 or newer.

```
npm install
npm start
```

Then open http://localhost:3000. Accounts are saved in `data.json` in this folder.

## Where things are

| File | What it does |
|---|---|
| `server.js` | Accounts, logins and the web routes |
| `game.js` | All the game rules: rolling, scoring, shop prices, wheel prizes, Higher or Lower |
| `store.js` | Saves accounts to Postgres, or to `data.json` when there's no database |
| `index.html` | The page your friends see |
| `badges.js` | The badge list and how each one is checked |
| `probs.json` | The exact odds of every badge, used for multipliers |

To change prices, wait times, wheel prizes or charms, edit the lists near the top of `game.js`.
