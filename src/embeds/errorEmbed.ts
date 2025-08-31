import { EmbedBuilder } from "discord.js";
import { embed } from "./embed";

export function errorEmbed(summary: string, detail: string): EmbedBuilder {
    return embed()
        .setColor(0xeb3434)
        .setTitle(summary)
        .setDescription(detail);
}
