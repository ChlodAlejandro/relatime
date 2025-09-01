import { ChatInputCommandInteraction, MessageFlags, SlashCommandSubcommandBuilder } from "discord.js";
import { setUserConfig } from "../../../database/config.ts";
import { successEmbed } from "../../../embeds/successEmbed.ts";
import { ISlashSubcommand } from "../../types";

export const absolute = <ISlashSubcommand>{
    builder: (subcommand: SlashCommandSubcommandBuilder) =>
        subcommand
            .setName("absolute")
            .setDescription('Enables replying with timestamps when an absolute time (e.g. "9pm", "Monday at 5pm") is mentioned.')
            .addBooleanOption(option =>
                option
                    .setName("enable")
                    .setDescription("Set to true to enable, false to disable.")
                    .setRequired(true),
            ),
    async execute(interaction: ChatInputCommandInteraction) {
        const enabled = interaction.options.getBoolean("enable", true);

        await setUserConfig(interaction.user.id, "absolute", enabled ? "true" : "false");

        await interaction.reply({
            flags: MessageFlags.Ephemeral,
            embeds: [successEmbed(
                `Absolute timestamps ${enabled ? "enabled" : "disabled"}`,
                `You will ${enabled ? "now" : "no longer"} receive replies with timestamps when you mention an absolute time.`,
            )],
        });
    },
};
