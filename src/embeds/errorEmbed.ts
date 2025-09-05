import { Client, EmbedBuilder } from "discord.js";
import { embed } from "./embed";

export function errorEmbed(client: Client, summary: string, detail: string): EmbedBuilder {
    return embed(client)
        .setColor(0xeb3434)
        .setTitle(summary)
        .setDescription(detail);
}
