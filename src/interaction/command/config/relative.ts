import { ChatInputCommandInteraction, MessageFlags, SlashCommandSubcommandBuilder } from "discord.js";
import { setUserConfig } from "../../../database/config.ts";
import { successEmbed } from "../../../embeds/successEmbed.ts";
import { ISlashSubcommand } from "../../types";

export const relative = <ISlashSubcommand>{
    builder: (subcommand: SlashCommandSubcommandBuilder) =>
        subcommand
            .setName("relative")
            .setDescription('Enables replying with timestamps when a relative time (e.g. "in 2 hours") is mentioned.')
            .addBooleanOption(option =>
                option
                    .setName("enable")
                    .setDescription("Set to true to enable, false to disable.")
                    .setRequired(true),
            ),
    async execute(interaction: ChatInputCommandInteraction) {
        const enabled = interaction.options.getBoolean("enable", true);

        await setUserConfig(interaction.user.id, "relative", enabled ? "true" : "false");

        await interaction.reply({
            flags: MessageFlags.Ephemeral,
            embeds: [successEmbed(
                `Relative timestamps ${enabled ? "enabled" : "disabled"}`,
                `You will ${enabled ? "now" : "no longer"} receive replies with timestamps when you mention a relative time.`,
            )],
        });
    },
};
