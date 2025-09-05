import { Client, EmbedBuilder } from "discord.js";
import { version } from "../version.ts";

export function embed(client: Client): EmbedBuilder {
    return new EmbedBuilder()
        .setColor(0x3492eb)
        .setFooter({
            text: `relatime ${
                version ?
                    `v${version}${process.env.NODE_ENV !== "production" ? "-dev" : ""}` :
                    "unknown version"
            } | \u{1F6E0} \u{fe0f}\u{2764} @chlod`,
            iconURL: client.user.avatarURL({ size: 64, forceStatic: true }),
        });
}
