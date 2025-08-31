import {Client, Events, GatewayIntentBits, MessageFlags, REST, Routes} from "discord.js";
import * as dotenv from "dotenv";
import * as path from "node:path";
import {dbExists, getDb, setupDb} from "./database/Database";
import {errorEmbed} from "./embeds/errorEmbed.ts";
import {loadSlashCommands} from "./interaction/loader";
import {log} from "./util/log.ts";

const cwd = process.cwd();

dotenv.config({
    path: path.join(/[\\/]src[\\/]?$/.test(cwd) ? path.join(cwd, "..") : cwd, ".env"),
    encoding: 'utf8',
    override: true,
    // quiet: true,
    debug: true
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

    const globalCommands = await loadSlashCommands();
    log.info("Found " + globalCommands.size + " slash commands.");


    await rest.put(
        Routes.applicationGuildCommands(process.env.RT_DISCORD_CLIENT_ID!, "592007175879262218"),
        { body: [] }
    ).then((result) => {
        log.info("Registered global commands.", result);
    });
    await rest.put(
        Routes.applicationCommands(process.env.RT_DISCORD_CLIENT_ID!),
        { body: [...globalCommands.values().map(command => command.builder.toJSON())] }
    ).then((result) => {
        log.info("Registered global commands.", result);
    });

    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.MessageContent
        ]
    });

    log.info("Setting event handlers...");
    client.on(Events.InteractionCreate, interaction => {
        log.info(`Interaction received: ${interaction.id} (${interaction.type}) from ${interaction.user.tag}`);
        if (interaction.isChatInputCommand()) {
            const matched = globalCommands.get(interaction.commandName)

            if (!matched) {
                log.warn(`No command matched for interaction: ${interaction.commandName}`);
                interaction.reply({
                    ephemeral: true,
                    embeds: [ errorEmbed("Unknown command", "This command is not recognized by the bot. It may have been removed or is otherwise unavailable.") ]
                });
                return;
            }

            matched
                ?.execute(interaction)
                .catch(err => {
                    log.error(`Error executing command ${interaction.commandName}:`, err);
                    console.error(err);
                    const embed = errorEmbed(
                        "Error executing command",
                        "An error occurred while executing the command. Please try again later."
                    );
                    if (interaction.replied || interaction.deferred) {
                        interaction.followUp({ embeds: [ embed ], flags: MessageFlags.Ephemeral });
                    } else {
                        interaction.reply({ embeds: [ embed ], flags: MessageFlags.Ephemeral });
                    }
                });
        }
    });

    client.once(Events.ClientReady, (readyClient: any) => {
        log.info(`Ready! Logged in as ${readyClient.user.tag}`);
    });

    log.info("Logging in to Discord...");
    // Log in to Discord with your client's token
    await client.login(process.env.RT_DISCORD_TOKEN);
})();
