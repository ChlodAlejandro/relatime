import { Client, Events, GatewayIntentBits, REST, Routes } from "discord.js";
import * as dotenv from "dotenv";
import { Knex } from "knex";
import * as path from "node:path";
import { inspect } from "util";
import * as winston from "winston";
import { Logger } from "winston";
import { dbExists, getDb, setupDb } from "./database";
import onInteractionCreate from "./handlers/onInteractionCreate";
import onMessageCreate from "./handlers/onMessageCreate";
import onMessageDelete from "./handlers/onMessageDelete";
import onMessageBulkDelete from "./handlers/onMessageBulkDelete";
import onMessageUpdate from "./handlers/onMessageUpdate";
import { loadCommands } from "./interaction/loader";
import RelatimeClient from "./RelatimeClient";
import { getOperatorGuilds } from "./util/isOperatorGuild";

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

const splatSymbol = Symbol.for("splat");

class Relatime {

    // Singleton pattern

    private static _singleton: Relatime;

    static get i() {
        return Relatime._singleton ??
            (Relatime._singleton = new Relatime());
    }

    constructor() {
        this.preStart();
    }

    // Properties
    public log: Logger;
    public db: Knex;
    public rest: REST;
    public client: RelatimeClient;

    // Helper methods

    private onUncaughtException(err: Error) {
        try {
            this.log.error("Uncaught exception: " + err.message, err);
        } catch (e) {
            console.error(err);
            console.error("Another error occurred while trying to log the first error:", e);
        }
    }

    private onUnhandledRejection(err: Error) {
        try {
            this.log.error("Unhandled rejection.", err);
        } catch (e) {
            console.error(err);
            console.error("Another error occurred while trying to log the first error:", e);
        }
    }

    private onExitSignal() {
        // noinspection JSIgnoredPromiseFromCall
        Relatime.i.stop();
    }

    public getLogger(module: string, options?: Record<string, unknown>) {
        return this.log.child(
            Object.assign({}, options ?? {}, { module, client: this.client.id }),
        );
    }

    // Lifecycle methods

    protected preStart() {
        this.log = winston.createLogger({
            level: "debug",
            transports: [
                new winston.transports.Console({
                    level: process.env.NODE_ENV === "production" ? "info" : "debug",
                    format: winston.format.combine(
                        winston.format.errors({ stack: true }),
                        winston.format.colorize({ all: true }),
                        winston.format.timestamp(),
                        winston.format.align(),
                        winston.format.printf((info) => `[${info.timestamp}] ${info.level}: ${info.message}${
                            info[splatSymbol] ? ` ${inspect(info[splatSymbol], true, 5, true)}` : ""
                        }`),
                    ),
                }),
                new winston.transports.File({ filename: process.env.RT_LOG_PATH || "./data/relatime.log" }),
            ],
        });

        if (!process.env.RT_DISCORD_TOKEN) {
            this.log.error("No Discord token found in environment variables (RT_DISCORD_TOKEN). Exiting.");
            process.exit(1);
        }
        if (!process.env.RT_DISCORD_CLIENT_ID) {
            this.log.error("No Discord client ID found in environment variables (RT_DISCORD_CLIENT_ID). Exiting.");
            process.exit(1);
        }

        process.once("SIGINT", this.onExitSignal);
        process.once("SIGTERM", this.onExitSignal);
    }

    protected async checkDatabase() {
        this.db = getDb();
        if (!await dbExists(this.db)) {
            this.log.info("Database not set up. Setting up now...");
            await setupDb(this.db);
            this.log.info("Database setup complete.");
        }
    }

    protected setupDiscord() {
        // Construct and prepare an instance of the REST module
        this.rest = new REST().setToken(process.env.RT_DISCORD_TOKEN!);

        // Construct and prepare the gateway client
        this.client = new RelatimeClient({
            intents: [
                GatewayIntentBits.DirectMessages,
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
            ],
        });
    }

    protected async setupCommands() {
        this.log.info("Registering interactions...");

        const commands = await loadCommands();
        const globalCommands =
            new Map(commands.entries().filter(([, command]) => command.type === "global"));
        const debugCommands =
            new Map(commands.entries().filter(([, command]) => command.type === "debug"));

        this.log.info("Found " + debugCommands.size + " debug slash commands.");
        for (const guildId of getOperatorGuilds()) {
            await this.rest.put(
                Routes.applicationGuildCommands(process.env.RT_DISCORD_CLIENT_ID!, guildId),
                { body: [...commands.values().map(command => command.builder.toJSON())] },
            ).then((result) => {
                this.log.info(`Registered debug commands for ${guildId}.`, { result });
            });
        }
        this.log.info("Found " + globalCommands.size + " global slash commands.");
        await this.rest.put(
            Routes.applicationCommands(process.env.RT_DISCORD_CLIENT_ID!),
            { body: [...globalCommands.values().map(command => command.builder.toJSON())] },
        ).then((result) => {
            this.log.info("Registered global commands.", { result });
        });
    }

    protected setupGatewayHandlers() {
        this.log.info("Setting event handlers...");
        this.client.on(Events.InteractionCreate, onInteractionCreate);
        this.client.on(Events.MessageCreate, onMessageCreate);
        this.client.on(Events.MessageUpdate, onMessageUpdate);
        this.client.on(Events.MessageDelete, onMessageDelete);
        this.client.on(Events.MessageBulkDelete, onMessageBulkDelete);
        this.client.once(Events.ClientReady, (readyClient: Client) => {
            this.log.info(`Ready! Logged in as ${readyClient.user.tag}`);

            // Absorb unhandled exceptions and rejections.
            // This helps keep the bot alive, but these are serious issues that
            // could jeopardize stability, so we need to log them.
            process.on("uncaughtException", this.onUncaughtException);
            process.on("unhandledRejection", this.onUnhandledRejection);
        });
    }

    protected loginDiscord() {
        this.log.info("Logging in to Discord...");
        // Log in to Discord with your client's token
        return this.client.login(process.env.RT_DISCORD_TOKEN);
    }

    public async start() {
        await this.checkDatabase();
        this.setupDiscord();
        // TODO: Move this to sharding manager, when we get big enough.
        await this.setupCommands();
        this.setupGatewayHandlers();
        await this.loginDiscord();
    }

    public async stop() {
        this.log.info("Exit signal received, shutting down...");

        // Disconnect the uncaught exception/unhandled rejection handlers.
        process.off("uncaughtException", this.onUncaughtException);
        process.off("unhandledRejection", this.onUnhandledRejection);

        await this.client?.destroy()
            .then(() => this.log.info("Discord client destroyed."));
        await this.db?.destroy()
            .then(() => this.log.info("Database connection closed."));
        this.log.info("Shutdown complete, exiting.");
        process.exit(0);
    }
}

export default Relatime.i;
