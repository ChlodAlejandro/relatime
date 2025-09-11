import { SlashCommandBuilder } from "discord.js";
import { ICommand } from "../types.ts";

export const crash = <ICommand>{
    type: "debug",
    builder: new SlashCommandBuilder()
        .setName("crash")
        .setDescription("I wonder what this command does..."),
    async execute() {
        throw new Error("Intentional crash triggered by /crash command");
    },
};
