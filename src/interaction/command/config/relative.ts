import { ChatInputCommandInteraction, MessageFlags, SlashCommandSubcommandBuilder } from "discord.js";
import { getDb } from "../../../database/Database.ts";
import { successEmbed } from "../../../embeds/successEmbed.ts";
import { log } from "../../../util/log.ts";
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

        await getDb()("config")
            .insert({
                cfg_user: interaction.user.id,
                cfg_key: "relative",
                cfg_value: enabled ? "true" : "false",
            })
            .onConflict(["cfg_user", "cfg_key"])
            .merge()
            .then()
            .catch(log.error);

        await interaction.reply({
            flags: MessageFlags.Ephemeral,
            embeds: [successEmbed(
                `Relative timestamps ${enabled ? "enabled" : "disabled"}`,
                `You will ${enabled ? "now" : "no longer"} receive replies with timestamps when you mention a relative time.`,
            )],
        });
    },
};
