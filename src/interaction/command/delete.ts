import {
    ApplicationCommandType,
    ContextMenuCommandBuilder, InteractionContextType,
    Message,
    MessageFlags,
    OmitPartialGroupDMChannel,
} from "discord.js";
import { errorEmbed } from "../../embeds/errorEmbed";
import { successEmbed } from "../../embeds/successEmbed";
import { ICommand } from "../types";

export const deleteReply = <ICommand>{
    type: "global",
    name: "Delete reply",
    builder: new ContextMenuCommandBuilder()
        .setName("Delete reply")
        .setContexts(
            InteractionContextType.Guild,
            InteractionContextType.BotDM,
            InteractionContextType.PrivateChannel,
        )
        .setType(ApplicationCommandType.Message),
    async execute(interaction) {
        if (!interaction.isMessageContextMenuCommand()) return;

        const message = interaction.targetMessage;
        if (!message) {
            await interaction.reply({
                embeds: [errorEmbed(
                    interaction.client,
                    "Message not found",
                    "The message you are trying to parse could not be found.",
                )],
                flags: MessageFlags.Ephemeral,
            });
            return;
        }
        if (message.author.id !== interaction.client.user.id) {
            await interaction.reply({
                embeds: [errorEmbed(
                    interaction.client,
                    "Not a bot message",
                    "You can only delete replies from the bot.",
                )],
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        // If the user has Manage Messages, just let them delete it.
        if (message.inGuild() && interaction.memberPermissions?.has("ManageMessages")) {
            await message.delete();
            await interaction.reply({
                embeds: [successEmbed(
                    interaction.client,
                    "Reply deleted",
                    "The bot reply has been deleted successfully.\n\nYou may want to simply delete the reply directly instead of using this command next time.",
                )],
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        // If this is an interaction reply, check if the interaction user is the same as the original interaction user.
        if (message.interactionMetadata) {
            if (interaction.user.id !== message.interactionMetadata.user.id) {
                await interaction.reply({
                    embeds: [errorEmbed(
                        interaction.client,
                        "Not your command",
                        "You can only delete replies from commands that you ran yourself.",
                    )],
                    flags: MessageFlags.Ephemeral,
                });
                return;
            } else {
                await message.delete();
                await interaction.reply({
                    embeds: [successEmbed(
                        interaction.client,
                        "Reply deleted",
                        "The bot reply has been deleted successfully.",
                    )],
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }
        }

        // Try to get the reply for this message.
        let reply: OmitPartialGroupDMChannel<Message>;
        try {
            reply = await message.fetchReference();
        } catch (e) {
            await interaction.reply({
                embeds: [errorEmbed(
                    interaction.client,
                    "No reply found",
                    "The bot could not find the message that it replies to. It may not have permissions to view the channel.",
                )],
                flags: MessageFlags.Ephemeral,
            });
            return;
        }
        if (reply.author.id !== interaction.client.user.id) {
            await interaction.reply({
                embeds: [errorEmbed(
                    interaction.client,
                    "Not your message",
                    "You can only delete replies of messages that you sent yourself.",
                )],
                flags: MessageFlags.Ephemeral,
            });
            return;
        } else {
            await reply.delete();
            await interaction.reply({
                embeds: [successEmbed(
                    interaction.client,
                    "Reply deleted",
                    "The bot reply has been deleted successfully.",
                )],
                flags: MessageFlags.Ephemeral,
            });
            return;
        }
    },
};
