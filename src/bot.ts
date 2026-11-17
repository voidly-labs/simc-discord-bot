import "dotenv/config";
import Simmit, {
  isTerminal,
  JobUnsuccessfulError,
  type JobStatusResponse,
} from "@simmit/sdk";
import {
  Client,
  EmbedBuilder,
  GatewayIntentBits,
  type ChatInputCommandInteraction,
} from "discord.js";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`missing required env var ${name}`);
  return value;
}

const DISCORD_TOKEN = requireEnv("DISCORD_TOKEN");
const SIMMIT_SECRET_KEY = requireEnv("SIMMIT_SECRET_KEY");
const BNET_CLIENT_ID = requireEnv("BNET_CLIENT_ID");
const BNET_CLIENT_SECRET = requireEnv("BNET_CLIENT_SECRET");

const COLOR_PROGRESS = 0x5865f2;
const COLOR_SUCCESS = 0x57f287;
const COLOR_FAILURE = 0xed4245;

type Field = { name: string; value: string; inline?: boolean };

const simmit = new Simmit({ secretKey: SIMMIT_SECRET_KEY });
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("clientReady", (c) => {
  console.log(`logged in as ${c.user.tag}`);
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== "sim") return;
  await handleSim(interaction);
});

async function handleSim(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  const region = interaction.options.getString("region", true);
  const realm = interaction.options.getString("realm", true);
  const character = interaction.options.getString("character", true);
  const profileText = `target_error=0.05
armory=${region},${realm},${character}
`;
  const show = (color: number, fields: Field[]) =>
    interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setTitle(`${character} · ${realm} (${region})`)
          .setColor(color)
          .addFields(fields),
      ],
    });

  let id = "";
  try {
    const job = await simmit.jobs.createAndWait(
      {
        build: { channel: "latest" },
        profile: { text: profileText },
        credentials: {
          bnetClientId: BNET_CLIENT_ID,
          bnetClientSecret: BNET_CLIENT_SECRET,
        },
      },
      {
        onCreated: (created) => {
          id = created.id;
          console.log(`[sim] submitted ${id}`);
        },
        onPoll: (status) => {
          if (isTerminal(status.status)) return;
          show(COLOR_PROGRESS, statusFields(id, status)).catch(console.error);
        },
      },
    );
    console.log(`[sim] ${id} ${job.status}`);

    const { result } = await simmit.jobs.getResult(id);
    const actor = result.summary?.mainActor;
    if (!actor) throw new Error("no DPS in the result");
    await show(COLOR_SUCCESS, [
      {
        name: "DPS",
        value: Math.round(actor.mean).toLocaleString("en-US"),
        inline: true,
      },
      { name: "Job", value: `\`${id}\``, inline: true },
      { name: "SimC Report", value: `[View report](${job.links.share})` },
    ]);
  } catch (err) {
    console.error("[sim] error:", err);
    if (err instanceof JobUnsuccessfulError) {
      await show(COLOR_FAILURE, [
        { name: "Status", value: err.job.status, inline: true },
        { name: "Job", value: `\`${id}\``, inline: true },
        { name: "SimC Log", value: `[View sim](${err.job.links.share})` },
      ]);
      return;
    }
    const message = err instanceof Error ? err.message : String(err);
    await show(COLOR_FAILURE, [
      { name: "Error", value: message.slice(0, 1024) },
    ]);
  }
}

function statusFields(id: string, status: JobStatusResponse): Field[] {
  const fields: Field[] = [
    { name: "Status", value: status.status, inline: true },
  ];
  const eta = status.queue?.estimatedStartSeconds;
  const percent = status.progress.percent;
  if (status.status === "queued" && eta != null) {
    fields.push({ name: "ETA", value: `~${Math.round(eta)}s`, inline: true });
  } else if (status.status === "running" && percent != null) {
    fields.push({
      name: "Progress",
      value: `${Math.round(percent)}%`,
      inline: true,
    });
  }
  fields.push({ name: "Job", value: `\`${id}\``, inline: true });
  return fields;
}

await client.login(DISCORD_TOKEN);
