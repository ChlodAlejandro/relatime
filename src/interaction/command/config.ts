import { Interaction, InteractionContextType, SlashCommandBuilder } from "discord.js";
import { ICommand } from "../types";
import { absolute } from "./config/absolute";
import { relative } from "./config/relative";
import { timezone } from "./config/timezone";

export const config = <ICommand>{
    type: "global",
    builder: new SlashCommandBuilder()
        .setName("config")
        .setContexts(
            InteractionContextType.Guild,
            InteractionContextType.BotDM,
            InteractionContextType.PrivateChannel,
        )
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
