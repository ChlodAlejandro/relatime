import { ClientEvents } from "discord.js";
import { getMessageBotReply } from "../database/trackedMessages";
import Relatime from "../Relatime";
import handleReplyDelete from "./util/handleReplyDelete";

export default async function onMessageDelete(...args: ClientEvents["messageDelete"]) {
    const [message] = args;

    // Ignore messages from bots
    if (message.author.bot) return;

    if (process.env.NODE_ENV !== "production")
        Relatime.getLogger("debug").debug(`Message delete from ${message.author.tag} (${message.author.id}): ${message.content}`);

    // Check if the message is tracked
    const botReply = await getMessageBotReply(message.id);
    if (botReply) {
        // Tracked. Let's delete the reply.
        await handleReplyDelete(message, botReply, message.channel);
    }
}
