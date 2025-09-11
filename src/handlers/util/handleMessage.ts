import { Message, OmitPartialGroupDMChannel, PartialMessage } from "discord.js";
import { trackMessage } from "../../database/trackedMessages.ts";
import { TimeParserMode } from "../../lib/parsing/TimeParser.ts";
import getTimeMatches from "../../util/getTimeMatches.ts";

export type MessageType = OmitPartialGroupDMChannel<Message | PartialMessage>;

export default async function handleMessage(
    message: MessageType,
    userConfig: { relative: string; absolute: string; timezone: string | null },
    botReply?: MessageType,
) {
    const { relative, absolute, timezone } = userConfig;

    const parserFlags = [];
    if (relative === "true") parserFlags.push(TimeParserMode.Relative);
    if (absolute === "true") parserFlags.push(TimeParserMode.Absolute);

    let reply = "";
    const matched = getTimeMatches(message.content, timezone ?? "UTC", {
        modes: parserFlags,
    });
    if (!matched) {
        // No matches found.
        if (botReply) {
            // Delete if this is an existing message.
            await botReply.delete();
        }
        return;
    }
    reply += matched;

    if (!timezone) {
        reply += "\n-# You've requested relatime to respond to your messages with relative/absolute times, but you have no timezone set. UTC will be used instead. Configure this with `/config timezone`.";
    }

    if (botReply) {
        await botReply.edit({
            content: reply,
            allowedMentions: {
                repliedUser: false,
                parse: [],
            },
        });
    } else {
        const botReply = await message.reply({
            content: reply,
            allowedMentions: {
                repliedUser: false,
                parse: [],
            },
        });
        await trackMessage(message.id, botReply.id);
    }
}
