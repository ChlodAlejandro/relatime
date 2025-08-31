import { MessageFlags, SlashCommandBuilder, time } from "discord.js";
import { getDb } from "../../database/Database.ts";
import { errorEmbed } from "../../embeds/errorEmbed.ts";
import { RelativeTimeParser } from "../../parsing/RelativeTimeParser.ts";
import detectAbsoluteTime from "../../time/detectAbsoluteTime.ts";
import detectRelativeTime from "../../time/detectRelativeTime.ts";
import timezoneToString from "../../util/timezoneToString.ts";
import { ISlashCommand } from "../types.ts";

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

        const lastMessage = messages.filter(m => m.id !== interaction.id).first();
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
        const absoluteTimeMatches = detectAbsoluteTime(lastMessage.content, timezone);
        if (relativeTimeMatches.length === 0 && absoluteTimeMatches.length === 0) {
            await interaction.reply({
                flags: MessageFlags.Ephemeral,
                embeds: [errorEmbed(
                    "No relative or absolute time found",
                    "The last message does not contain any recognizable relative or absolute time expressions.",
                )],
            });
            return;
        }

        let content = "";

        if (usedInteractionUserTimezone) {
            content += `No timezone was set for the author of the last message, so the timezone of <@${interaction.user.id}> (${timezoneToString(timezone)}) was used instead.\n\n`;
        } else if (!timezone) {
            content += "No timezone is set for the author of the last message, so times were interpreted as UTC. You can set your timezone with `/config timezone`.\n\n";
        }

        const matchStrings = [];
        for (const match of relativeTimeMatches) {
            matchStrings.push(`${match.match} \u2192 <t:${Math.floor((Date.now() / 1e3) + match.duration)}:F>`);
        }
        for (const match of absoluteTimeMatches) {
            matchStrings.push(`${match.match[0]} \u2192 <t:${Math.floor(match.date.epochMilliseconds / 1e3)}:F>`);
        }

        content += matchStrings.join("\n");

        await interaction.reply({
            flags: interaction.options.getBoolean("ephemeral") ? MessageFlags.Ephemeral : undefined,
            content: content,
        });
    },
};
