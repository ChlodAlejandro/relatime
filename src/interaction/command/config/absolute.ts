import { ChatInputCommandInteraction, MessageFlags, SlashCommandSubcommandBuilder } from "discord.js";
import { getUserConfig, setUserConfig } from "../../../database/config";
import { successEmbed } from "../../../embeds/successEmbed";
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
                    .setRequired(false),
            ),
    async execute(interaction: ChatInputCommandInteraction) {
        const enabled = interaction.options.getBoolean("enable");
        if (enabled == null) {
            const currentValue = await getUserConfig(interaction.user.id, <const>["absolute"]);
            const value = currentValue.absolute == null ?
                "unset (disabled by default)" :
                (currentValue.absolute === "true" ? "enabled" : "disabled");

            await interaction.reply({
                flags: MessageFlags.Ephemeral,
                embeds: [successEmbed(
                    interaction.client,
                    "Absolute timestamps configuration",
                    'Enables replying with timestamps when an absolute time (e.g. "9pm", "Monday at 5pm") is mentioned.',
                ).addFields({
                    name: "Current value",
                    value: value,
                })],
            });
            return;
        }

        await setUserConfig(interaction.user.id, "absolute", enabled ? "true" : "false");

        await interaction.reply({
            flags: MessageFlags.Ephemeral,
            embeds: [successEmbed(
                interaction.client,
                `Absolute timestamps ${enabled ? "enabled" : "disabled"}`,
                `You will ${enabled ? "now" : "no longer"} receive replies with timestamps when you mention an absolute time.`,
            )],
        });
    },
};
