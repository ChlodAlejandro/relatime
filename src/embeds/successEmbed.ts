import { EmbedBuilder } from "discord.js";
import { embed } from "./embed";

export function successEmbed(summary: string, detail: string): EmbedBuilder {
    return embed()
        .setColor(0x6ae65a)
        .setTitle(summary)
        .setDescription(detail);
}
