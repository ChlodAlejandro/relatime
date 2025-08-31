import { MessageFlags, SlashCommandBuilder } from "discord.js";
import { getDb } from "../../database/Database.ts";
import { errorEmbed } from "../../embeds/errorEmbed.ts";
import { RelativeTimeParser } from "../../parsing/RelativeTimeParser.ts";
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

        let relativeTimeMatches = new RelativeTimeParser(lastMessage.content).parse();
        // const absoluteTimeMatches = detectAbsoluteTime(lastMessage.content, timezone);
        const absoluteTimeMatches = [];

        // Check for relative times that are less than a second.
        // Discord doesn't display seconds in timestamps, so these are useless.
        let hasSecondMatches = false;
        relativeTimeMatches = relativeTimeMatches.filter((match) => {
            if (Math.abs(match.duration) < 60) {
                hasSecondMatches = true;
                return false;
            }
            return true;
        });

        if (relativeTimeMatches.length === 0 && absoluteTimeMatches.length === 0) {
            let description = "The last message does not contain any recognizable relative or absolute time expressions.";

            if (hasSecondMatches) {
                description += "\n\nNote: Relative times of less than a minute (e.g. '30 seconds ago') are not processed since Discord timestamps do not display seconds.";
            }

            await interaction.reply({
                flags: MessageFlags.Ephemeral,
                embeds: [errorEmbed(
                    "No relative or absolute time found",
                    description,
                )],
            });
            return;
        }

        let content = "";

        if (usedInteractionUserTimezone) {
            content += `No timezone was set for the author of the last message, so the timezone of <@${interaction.user.id}> (\`${timezoneToString(timezone)}\`) was used instead.\n\n`;
            flags.push("SuppressNotifications");
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

        if (interaction.options.getBoolean("ephemeral")) {
            flags.push("Ephemeral");
        }

        await interaction.reply({
            flags: flags,
            content: content,
        });
    },
};
