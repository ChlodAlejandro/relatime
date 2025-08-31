import { EmbedBuilder } from "discord.js";

export function embed(): EmbedBuilder {
    return new EmbedBuilder()
        .setColor(0x3492eb)
        .setFooter({
            text: "relatime",
            iconURL: "https://cdn.discordapp.com/app-icons/1405466156063522937/a51d86268668c5fd8d07d4e9bb444043.png?size=256",
        });
}
