import { Interaction, SlashCommandBuilder } from "discord.js";
import { ISlashCommand } from "../types";
import { absolute } from "./config/absolute";
import { relative } from "./config/relative";
import { timezone } from "./config/timezone";

export const config = <ISlashCommand>{
    builder: new SlashCommandBuilder()
        .setName("config")
        .setDescription("Set your configuration options")
        .addSubcommand(timezone.builder)
        .addSubcommand(relative.builder)
        .addSubcommand(absolute.builder),
    async execute(interaction: Interaction) {
        if (!interaction.isChatInputCommand()) return;

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === "timezone") {
            await timezone.execute(interaction);
        } else if (subcommand === "relative") {
            await relative.execute(interaction);
        } else if (subcommand === "absolute") {
            await absolute.execute(interaction);
        } else {
            await interaction.reply("Unknown subcommand.");
        }
    },
};
