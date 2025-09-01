import { MessageFlags, SlashCommandBuilder } from "discord.js";
import { getDb } from "../../database/Database.ts";
import { errorEmbed } from "../../embeds/errorEmbed.ts";
import timezoneToString from "../../util/timezoneToString.ts";
import { ISlashCommand } from "../types.ts";
import getTimeMatches from "./_util/getTimeMatches.ts";

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

        let content = "";

        if (usedInteractionUserTimezone) {
            content += `No timezone was set for the author of the last message, so the timezone of <@${interaction.user.id}> (\`${timezoneToString(timezone)}\`) was used instead.\n\n`;
            flags.push("SuppressNotifications");
        } else if (!timezone) {
            content += "No timezone is set for the author of the last message, so times were interpreted as UTC. You can set your timezone with `/config timezone`.\n\n";
        }

        const matches = getTimeMatches(lastMessage.content, timezone);
        if (!matches) {
            interaction.reply({
                flags: MessageFlags.Ephemeral,
                embeds: [errorEmbed(
                    "No times found",
                    "Could not find any relative or absolute times in the last message.",
                )],
            });
            return;
        }
        content += matches!;

        if (interaction.options.getBoolean("ephemeral")) {
            flags.push("Ephemeral");
        }

        await interaction.reply({
            flags: flags,
            content: content,
        });
    },
};
