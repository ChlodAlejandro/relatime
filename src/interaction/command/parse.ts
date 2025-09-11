import { MessageFlags, SlashCommandBuilder } from "discord.js";
import { getUserConfig } from "../../database/config.ts";
import { errorEmbed } from "../../embeds/errorEmbed.ts";
import { successEmbed } from "../../embeds/successEmbed.ts";
import getTimeMatches from "../../util/getTimeMatches.ts";
import { ICommand } from "../types.ts";

export const parse = <ICommand>{
    type: "global",
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
        )
        .addBooleanOption((option) =>
            option
                .setName("exact")
                .setDescription("Whether to send exact relative timestamps, which only apply at the time the message is sent.")
                .setRequired(false),
        ),
    async execute(interaction) {
        if (!interaction.isChatInputCommand()) return;

        const { timezone } = await getUserConfig(interaction.user.id, <const>["timezone"]);

        let content = "";

        if (!timezone) {
            content += "You do not have a timezone set, so times were interpreted as UTC. You can set your timezone with `/config timezone`.\n\n";
        }

        const printMode = interaction.options.getBoolean("print");

        const matches = getTimeMatches(interaction.options.getString("text"), timezone, {
            includeExactRelative: interaction.options.getBoolean("exact") ?? false,
            includeCode: !printMode,
        });
        if (!matches) {
            interaction.reply({
                flags: MessageFlags.Ephemeral,
                embeds: [errorEmbed(
                    interaction.client,
                    "No times found",
                    "Could not find any relative or absolute times in the last message.",
                )],
            });
            return;
        }
        content += matches!;
        if (!printMode) {
            content += "\n-# [view the timestamp styles reference](<https://discord.com/developers/docs/reference#message-formatting-timestamp-styles>)";
        }

        await interaction.reply({
            flags: printMode ? undefined : MessageFlags.Ephemeral,
            ...(
                printMode ? {
                    content,
                } : {
                    embeds: [successEmbed(
                        interaction.client,
                        "Parsed times",
                        content || "No times found in the provided text.",
                    )],
                }
            ),
        });
    },
};
