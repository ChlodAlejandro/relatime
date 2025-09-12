import { ClientEvents } from "discord.js";
import { getMessageBotReply } from "../database/trackedMessages";
import Relatime from "../Relatime";
import handleReplyDelete from "./util/handleReplyDelete";

export default async function onMessageBulkDelete(...args: ClientEvents["messageDeleteBulk"]) {
    const [messages, channel] = args;

    if (process.env.NODE_ENV !== "production")
        Relatime.getLogger("debug").debug(`Message bulk delete from ${channel.name} (${channel.id}). Messages: ${messages.size}`);

    // Check if the messages are tracked
    for (const [messageId, message] of messages) {
        const botReply = await getMessageBotReply(messageId);
        if (botReply) {
            // Tracked. Let's delete the reply.
            await handleReplyDelete(message, botReply, channel);
        }
    }
}
