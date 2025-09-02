import { EmbedBuilder } from "discord.js";
import { version } from "../version.ts";

export function embed(): EmbedBuilder {
    return new EmbedBuilder()
        .setColor(0x3492eb)
        .setFooter({
            text: `relatime ${
                version ?
                    `v${version}${process.env.NODE_ENV === "development" ? "-dev" : ""}` :
                    "unknown version"
            } | \u{1F6E0} \u{fe0f}\u{2764} @chlod`,
            iconURL: "https://cdn.discordapp.com/app-icons/1405466156063522937/a51d86268668c5fd8d07d4e9bb444043.png?size=256",
        });
}
