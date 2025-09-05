import { Client, EmbedBuilder } from "discord.js";
import { embed } from "./embed";

export function successEmbed(client: Client, summary: string, detail: string): EmbedBuilder {
    return embed(client)
        .setColor(0x6ae65a)
        .setTitle(summary)
        .setDescription(detail);
}
