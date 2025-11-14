import { ClientEvents } from "discord.js";
import { getUserConfig } from "../database/config";
import Relatime from "../Relatime";
import handleMessage from "./util/handleMessage";
import { loadHooks } from "./util/loadHooks";

export default async function onMessageCreate(...args: ClientEvents["messageCreate"]) {
    const [message] = args;

    // Ignore messages from bots
    if (message.author.bot) return;

    if (process.env.NODE_ENV !== "production")
        Relatime.getLogger("debug").debug(`Message from ${message.author.tag} (${message.author.id}): ${message.content}`);

    const willContinue = await loadHooks()
        .then((hooks) => hooks.get("onMessageCreate")?.(...args));
    if (willContinue === false)
        return;

    const userConfig = await getUserConfig(message.author.id, <const>["relative", "absolute", "timezone"]);

    if (userConfig.relative || userConfig.absolute) {
        await handleMessage(message, userConfig);
    }
}
