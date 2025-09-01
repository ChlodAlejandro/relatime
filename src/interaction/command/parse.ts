import { MessageFlags, SlashCommandBuilder } from "discord.js";
import { getDb } from "../../database/Database.ts";
import { errorEmbed } from "../../embeds/errorEmbed.ts";
import { successEmbed } from "../../embeds/successEmbed.ts";
import { ISlashCommand } from "../types.ts";
import getTimeMatches from "./_util/getTimeMatches.ts";

export const parse = <ISlashCommand>{
    builder: new SlashCommandBuilder()
        .setName("parse")
        .setDescription("Parse out times from text.")
        .addStringOption((option) =>
            option
                .setName("text")
                .setDescription("The text to parse times from.")
                .setRequired(true),
        )
        .addBooleanOption((option) =>
            option
                .setName("print")
                .setDescription("Whether to send the result in the current channel.")
                .setRequired(false),
        ),
    async execute(interaction) {
        if (!interaction.isChatInputCommand()) return;

        const timezone: number | string | null = await getDb()("config")
            .select("cfg_user", "cfg_value")
            .from("config")
            .where("cfg_user", interaction.user.id)
            .andWhere("cfg_key", "timezone")
            .then(rows => {
                if (rows.length > 0) {
                    const row = rows[0];
                    return row.cfg_value.startsWith("custom:") ?
                        row.cfg_value.replace(/^custom:/, "") :
                        row.cfg_value.replace(/^iana:/, "");
                } else {
                    return null;
                }
            });

        let content = "";

        if (!timezone) {
            content += "You do not have a timezone set, so times were interpreted as UTC. You can set your timezone with `/config timezone`.\n\n";
        }

        const printMode = interaction.options.getBoolean("print");

        const matches = getTimeMatches(interaction.options.getString("text"), timezone, {
            includeCode: !printMode,
        });
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
        content += "\n-# [view the timestamp styles reference](<https://discord.com/developers/docs/reference#message-formatting-timestamp-styles>)";

        await interaction.reply({
            flags: printMode ? undefined : MessageFlags.Ephemeral,
            ...(
                printMode ? {
                    content,
                } : {
                    embeds: [successEmbed(
                        "Parsed times",
                        content || "No times found in the provided text.",
                    )],
                }
            ),
        });
    },
};
