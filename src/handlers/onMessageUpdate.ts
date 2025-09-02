import { ClientEvents, Message } from "discord.js";
import { getUserConfig } from "../database/config.ts";
import { getMessageBotReply } from "../database/trackedMessages.ts";
import { log } from "../util/log.ts";
import handleMessage, { MessageType } from "./util/handleMessage.ts";

export default async function onMessageUpdate(...args: ClientEvents["messageUpdate"]) {
    const [, message] = args;

    // Ignore messages from bots
    if (message.author.bot) return;

    if (process.env.NODE_ENV !== "production")
        log.debug(`Message edit from ${message.author.tag} (${message.author.id}): ${message.content}`);

    const userConfig = await getUserConfig(message.author.id, <const>["relative", "absolute", "timezone"]);

    // Check if the message is tracked
    const botReply = await getMessageBotReply(message.id);
    if (!botReply) {
        // Not tracked. Process it if the user has the config enabled and if it's in the last 10 messages.
        if (userConfig.relative || userConfig.absolute) {
            if (!message.channel || !message.channel.isTextBased()) {
                return;
            }
            const messages = await message.channel.messages.fetch({ limit: 10 });
            const found = messages.find(m => m.id === message.id);
            if (!found) {
                // Not in the last 10 messages, we don't process it.
                return;
            }

            await handleMessage(message, userConfig);
        }
    } else {
        // Tracked. We process it nonetheless. If the user has already disabled the config, we do nothing.
        if (userConfig.relative || userConfig.absolute) {
            let botReplyMessage: Message;
            try {
                botReplyMessage = await message.channel.messages.fetch(botReply);
            } catch (e) {
                if (e.code == 10008) {
                    // Unknown Message, the bot's reply message is gone?
                    // Resend it.
                    await handleMessage(message, userConfig);
                    return;
                }
                throw e;
            }
            await handleMessage(message, userConfig, botReplyMessage as MessageType);
        } else {
            return;
        }
    }

}
