import { ClientEvents } from "discord.js";
import { getUserConfig } from "../database/config.ts";
import Relatime from "../Relatime.ts";
import handleMessage from "./util/handleMessage.ts";

export default async function onMessageCreate(...args: ClientEvents["messageCreate"]) {
    const [message] = args;

    // Ignore messages from bots
    if (message.author.bot) return;

    if (process.env.NODE_ENV !== "production")
        Relatime.getLogger("debug").debug(`Message from ${message.author.tag} (${message.author.id}): ${message.content}`);

    const userConfig = await getUserConfig(message.author.id, <const>["relative", "absolute", "timezone"]);

    if (userConfig.relative || userConfig.absolute) {
        await handleMessage(message, userConfig);
    }
}
