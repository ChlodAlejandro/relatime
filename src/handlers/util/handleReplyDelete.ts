import { DiscordAPIError, Message, OmitPartialGroupDMChannel, PartialMessage, Snowflake } from "discord.js";
import Relatime from "../../Relatime";

export default async function handleReplyDelete(
    message: OmitPartialGroupDMChannel<Message | PartialMessage>,
    botReplyId: Snowflake,
    channel?: Message["channel"],
) {
    channel = channel ?? (typeof message !== "string" ? message.channel : undefined);
    if (!channel) {
        Relatime.getLogger("handleReplyDelete").warn("Could not delete bot reply message, channel is undefined.", {
            message: {
                id: message.id,
                content: typeof message !== "string" ? message.content : null,
            },
        });
    }

    let botReplyMessage: Message;
    try {
        botReplyMessage = await channel.messages.fetch(botReplyId);
        await botReplyMessage.delete();
    } catch (e) {
        if (e instanceof DiscordAPIError && e.code == 10008) {
            // Unknown Message, the bot's reply message is gone?
            // Guess we don't need to do anything.
            return;
        } else if (e instanceof DiscordAPIError && e.code == 50001) {
            // Missing Access, the bot can't access the channel?
            // Leave it up to the server moderators.
            Relatime.getLogger("messageDelete").warn("Could not delete bot reply message, missing access to channel.", {
                message: {
                    id: message.id,
                    content: message.content,
                    author: {
                        id: message.author,
                        name: message.author.username,
                    },
                },
                channel: {
                    id: channel.id,
                    name: "name" in channel ? channel.name : null,
                },
                guild: {
                    id: message.guild?.id,
                    name: message.guild?.name,
                },
            });
            return;
        }
        throw e;
    }
}
