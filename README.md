# SimC Discord bot example

Discord bot example for the [Simmit](https://simmit.com) API. Type `/sim` with a region, realm, and character; the bot submits a SimulationCraft job through the official [@simmit/sdk](https://www.npmjs.com/package/@simmit/sdk), waits for it to finish, and replies with the DPS and a link to the full SimC report.

## Setup

Requires Node 20+. You'll need:

- A Simmit secret key from [simmit.com/keys](https://simmit.com/keys).
- A Discord application from [discord.com/developers/applications](https://discord.com/developers/applications). Copy the App ID and bot token. Invite the bot with the `bot` and `applications.commands` scopes plus `Send Messages` permission.
- A Blizzard API client from [develop.battle.net/access/clients](https://develop.battle.net/access/clients). Copy the Client ID and Secret. Simmit forwards these to SimC for the armory lookup on each job and discards them after the run.

Then:

```
cp .env.example .env       # fill in the five values
npm install
npm run register           # one-time; rerun when the command shape changes
npm start
```

Set `DISCORD_DEV_GUILD_ID` for instant registration in your test server. Leave unset to register globally (propagates within an hour).

## Try it

```
/sim region:us realm:area-52 character:voidly
```

The bot builds and submits:

```
target_error=0.05
armory=us,area-52,voidly
```

The reply is a single embed that edits in place as the job progresses. Blurple while running, green on success, red on failure.

<table>
<tr>
<td><img src="docs/sim-running.png" alt="Discord embed while the job is running, blurple bar with status, progress, and job ID." width="100%"></td>
<td><img src="docs/sim-completed.png" alt="Discord embed after completion, green bar with DPS, job ID, and a SimC report link." width="100%"></td>
</tr>
</table>

Failed runs link to the sim on Simmit, where the SimC log shows what the lookup hit.

## How it works

The non-obvious bit is `deferReply()`. Discord requires a response within three seconds; `deferReply()` extends that to fifteen minutes. The handler calls it before any network I/O.

The rest is in [src/bot.ts](src/bot.ts): `jobs.createAndWait` submits the profile text with your Battle.net credentials and resolves when the sim completes, calling `onPoll` after each status check so the embed can show the queue estimate and progress. `jobs.getResult` then returns `summary.mainActor.mean`, and the job's `links.share` is the report link. A sim that fails makes `createAndWait` throw an error that carries the job, so the reply links to it instead.

Every `/sim` runs on your Simmit plan, at full speed until the plan's daily sim time is used and at reduced speed after that. See [the plans docs](https://docs.simmit.com/api/plans-and-limits).

## Going further

- **Custom profiles and addon exports.** Replace the armory directive with raw SimC text or accept the in-game addon export as a paste or attachment.
- **More SimC options.** Add slash command options and append them as profile lines (`calculate_scale_factors=1`, `desired_targets`, `fight_length`, `iterations`).
- **Webhooks instead of polling.** Register a `job.terminal` webhook, swap `createAndWait` for `jobs.create`, and verify the callback with the SDK's `unwrapWebhook`. See [the webhooks docs](https://docs.simmit.com/api-advanced/webhooks).
- **Running 24/7.** Deploy to any always-on Node host. Discord bots are long-lived processes, not serverless workloads.

## Upstream

[SimulationCraft](https://simulationcraft.org) is an independent open-source project. This example and the Simmit API are not affiliated with or endorsed by SimulationCraft. Simmit executes unmodified upstream SimC binaries.

## License

MIT. See [LICENSE](LICENSE).
