import { MessageFlags, SlashCommandBuilder } from "discord.js";
import { getDb } from "../../database/Database.ts";
import { errorEmbed } from "../../embeds/errorEmbed.ts";
import AbsoluteTimeParser from "../../parsing/AbsoluteTimeParser.ts";
import { DurationUnit } from "../../parsing/Duration.ts";
import { RelativeTimeParser } from "../../parsing/RelativeTimeParser.ts";
import timezoneToString from "../../util/timezoneToString.ts";
import { ISlashCommand } from "../types.ts";

/**
 * Timestamp flags to use for different precision levels. Each letter generates another timestamp, joined by commas.
 * @see https://discord.com/developers/docs/reference#message-formatting-timestamp-styles
 */
const precisionSyntaxFlags: Record<DurationUnit, string> = {
    second: "DT",
    minute: "f",
    hour: "f",
    day: "D",
    week: "D",
    month: "D",
    year: "D",
};

export const last = <ISlashCommand>{
    builder: new SlashCommandBuilder()
        .setName("last")
        .setDescription("Processes the last message and converts relative or absolute time to timestamps.")
        .addBooleanOption((option) =>
            option
                .setName("ephemeral")
                .setDescription("Whether the reply should be ephemeral (only visible to you).")
                .setRequired(false),
        ),
    async execute(interaction) {
        if (!interaction.isChatInputCommand()) return;

        const flags: ("SuppressNotifications" | "Ephemeral")[] = [];

        // Get the last message in the channel
        const messages = await interaction.channel?.messages.fetch({ limit: 10 });
        if (!messages) {
            await interaction.reply({
                flags: MessageFlags.Ephemeral,
                embeds: [errorEmbed(
                    "Error fetching messages",
                    "Could not fetch messages from this channel. Check if the bot can read the channel.",
                )],
            });
            return;
        }

        const lastMessage = messages
            .filter(m => m.id !== interaction.id)
            .filter(m => m.author.id !== m.client.user.id)
            .first();
        if (!lastMessage) {
            await interaction.reply({
                flags: MessageFlags.Ephemeral,
                embeds: [errorEmbed(
                    "No previous message",
                    "There is no previous message in this channel to process.",
                )],
            });
            return;
        }

        let usedInteractionUserTimezone = false;
        const timezone: number | string | null = await getDb()("config")
            .select("cfg_user", "cfg_value")
            .from("config")
            .whereIn("cfg_user", [interaction.user.id, lastMessage.author.id])
            .andWhere("cfg_key", "timezone")
            .then(rows => {
                if (rows.length > 0) {
                    let row = rows.find(r => r.cfg_user === lastMessage.author.id);
                    if (row == null) {
                        usedInteractionUserTimezone = true;
                        row = rows[0];
                    }

                    return row.cfg_value.startsWith("custom:") ?
                        row.cfg_value.replace(/^custom:/, "") :
                        row.cfg_value.replace(/^iana:/, "");
                } else {
                    return null;
                }
            });

        const relativeTimeMatches = new RelativeTimeParser(lastMessage.content).parse();
        const absoluteTimeMatches = new AbsoluteTimeParser(lastMessage.content, timezone).parse();

        let content = "";

        if (usedInteractionUserTimezone) {
            content += `No timezone was set for the author of the last message, so the timezone of <@${interaction.user.id}> (\`${timezoneToString(timezone)}\`) was used instead.\n\n`;
            flags.push("SuppressNotifications");
        } else if (!timezone) {
            content += "No timezone is set for the author of the last message, so times were interpreted as UTC. You can set your timezone with `/config timezone`.\n\n";
        }

        const matchStrings = [];
        const arrowRight = "\u2192";
        for (const match of relativeTimeMatches) {
            matchStrings.push(`${match.match} ${arrowRight} <t:${Math.floor((Date.now() / 1e3) + match.duration)}:F>`);
        }
        for (const match of absoluteTimeMatches) {
            const timestamps = [];
            const timeFormats = precisionSyntaxFlags[match.precision];
            for (const flag of timeFormats) {
                timestamps.push(`<t:${Math.floor(match.date.epochMilliseconds / 1e3)}:${flag}>`);
            }

            matchStrings.push(`${match.match} ${arrowRight} ${timestamps.join(", ")}${
                match.approximated ? " (approximate)" : ""
            }`);
        }

        content += matchStrings.join("\n");

        if (interaction.options.getBoolean("ephemeral")) {
            flags.push("Ephemeral");
        }

        await interaction.reply({
            flags: flags,
            content: content,
        });
    },
};
