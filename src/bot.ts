import { Client, Events, GatewayIntentBits, REST, Routes } from "discord.js";
import * as dotenv from "dotenv";
import * as path from "node:path";
import { dbExists, getDb, setupDb } from "./database";
import onInteractionCreate from "./handlers/onInteractionCreate.ts";
import onMessageCreate from "./handlers/onMessageCreate.ts";
import onMessageUpdate from "./handlers/onMessageUpdate.ts";
import { loadSlashCommands } from "./interaction/loader";
import { getOperatorGuilds } from "./util/isOperatorGuild.ts";
import { log } from "./util/log.ts";

const cwd = process.cwd();

dotenv.config({
    path: path.join(/[\\/]src[\\/]?$/.test(cwd) ? path.join(cwd, "..") : cwd, ".env"),
    encoding: "utf8",
    override: true,
    quiet: process.env.NODE_ENV === "production",
    debug: process.env.NODE_ENV !== "production",
});

// Against all odds, we must be in UTC.
process.env.TZ = "Etc/UTC";

(async () => {
    if (!process.env.RT_DISCORD_TOKEN) {
        log.error("No Discord token found in environment variables (RT_DISCORD_TOKEN). Exiting.");
        process.exit(1);
    }
    if (!process.env.RT_DISCORD_CLIENT_ID) {
        log.error("No Discord client ID found in environment variables (RT_DISCORD_CLIENT_ID). Exiting.");
        process.exit(1);
    }

    const db = getDb();

    if (!await dbExists(db)) {
        log.info("Database not set up. Setting up now...");
        await setupDb(db);
        log.info("Database setup complete.");
    }

    // Construct and prepare an instance of the REST module
    const rest = new REST().setToken(process.env.RT_DISCORD_TOKEN);

    log.info("Registering interactions...");

    const commands = await loadSlashCommands();
    const globalCommands =
        new Map(commands.entries().filter(([,command]) => command.type === "global"));
    const debugCommands =
        new Map(commands.entries().filter(([,command]) => command.type === "debug"));

    log.info("Found " + globalCommands.size + " global slash commands.");
    await rest.put(
        Routes.applicationCommands(process.env.RT_DISCORD_CLIENT_ID!),
        { body: [...globalCommands.values().map(command => command.builder.toJSON())] },
    ).then((result) => {
        log.info("Registered global commands.", result);
    });

    log.info("Found " + debugCommands.size + " debug slash commands.");
    for (const guildId of getOperatorGuilds()) {
        await rest.put(
            Routes.applicationGuildCommands(process.env.RT_DISCORD_CLIENT_ID!, guildId),
            { body: [...debugCommands.values().map(command => command.builder.toJSON())] },
        ).then((result) => {
            log.info(`Registered debug commands for ${guildId}.`, result);
        });
    }

    const client = new Client({
        intents: [
            GatewayIntentBits.DirectMessages,
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent,
        ],
    });

    log.info("Setting event handlers...");
    client.on(Events.InteractionCreate, onInteractionCreate);
    client.on(Events.MessageCreate, onMessageCreate);
    client.on(Events.MessageUpdate, onMessageUpdate);

    client.once(Events.ClientReady, (readyClient: Client) => {
        log.info(`Ready! Logged in as ${readyClient.user.tag}`);
    });

    log.info("Logging in to Discord...");
    // Log in to Discord with your client's token
    await client.login(process.env.RT_DISCORD_TOKEN);

})();
