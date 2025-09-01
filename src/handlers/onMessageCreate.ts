import { ClientEvents } from "discord.js";
import { getUserConfig } from "../database/config.ts";
import { TimeParserMode } from "../parsing/TimeParser.ts";
import getTimeMatches from "../util/getTimeMatches.ts";
import { log } from "../util/log.ts";

export default async function onMessageCreate(...args: ClientEvents["messageCreate"]) {
    const [message] = args;

    // Ignore messages from bots
    if (message.author.bot) return;

    log.debug(`Message from ${message.author.tag} (${message.author.id}): ${message.content}`);

    const { relative, absolute, timezone } = await getUserConfig(message.author.id, <const>["relative", "absolute", "timezone"]);

    if (relative || absolute) {
        const parserFlags = [];
        if (relative) parserFlags.push(TimeParserMode.Relative);
        if (absolute) parserFlags.push(TimeParserMode.Absolute);

        let reply = "";
        const matched = getTimeMatches(message.content, timezone ?? "UTC", {
            modes: parserFlags,
        });
        if (!matched) {
            return;
        }
        reply += matched;

        if (!timezone) {
            reply += "\n-# You've requested relatime to respond to your messages with relative/absolute times, but you have no timezone set. UTC will be used instead. Configure this with `/config timezone`.";
        }

        await message.reply({
            content: reply,
            allowedMentions: {
                repliedUser: false,
                parse: [],
            },
        });
    }
}
