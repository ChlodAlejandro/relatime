import {
    Collection,
    DiscordAPIError,
    InteractionContextType,
    Message,
    MessageFlags,
    SlashCommandBuilder,
} from "discord.js";
import { getUserConfig } from "../../database/config";
import { errorEmbed } from "../../embeds/errorEmbed";
import getTimeMatches from "../../util/getTimeMatches";
import timezoneToString from "../../util/timezoneToString";
import { ICommand } from "../types";

export const last = <ICommand>{
    type: "global",
    builder: new SlashCommandBuilder()
        .setName("last")
        .setContexts(
            InteractionContextType.Guild,
            InteractionContextType.BotDM,
            InteractionContextType.PrivateChannel,
        )
        .setDescription("Processes the last message and converts relative or absolute time to timestamps.")
        .addBooleanOption((option) =>
            option
                .setName("ephemeral")
                .setDescription("Whether the reply should be ephemeral (only visible to you).")
                .setRequired(false),
        ),
    async execute(interaction) {
        if (!interaction.isChatInputCommand()) return;

        // Get the last message in the channel
        let messages: Collection<string, Message<true>>;
        try {
            messages = await interaction.channel?.messages.fetch({ limit: 10 });
        } catch (e) {
            if (e instanceof DiscordAPIError && e.code === 50001) {
                await interaction.reply({
                    flags: MessageFlags.Ephemeral,
                    embeds: [errorEmbed(
                        interaction.client,
                        "Insufficient permissions",
                        "The bot does not have permission to read message history in this channel.",
                    )],
                });
                return;
            }
            throw e;
        }
        if (!messages) {
            await interaction.reply({
                flags: MessageFlags.Ephemeral,
                embeds: [errorEmbed(
                    interaction.client,
                    "Error fetching messages",
                    "Could not fetch messages from this channel. Check if the bot can read the channel.",
                )],
            });
            return;
        }

        const lastMessage = messages
            .filter(m => m.id !== interaction.id)
            .filter(m => m.author.id !== m.client.user.id)
            .first();
        if (!lastMessage) {
            await interaction.reply({
                flags: MessageFlags.Ephemeral,
                embeds: [errorEmbed(
                    interaction.client,
                    "No previous message",
                    "There is no previous message in this channel to process.",
                )],
            });
            return;
        }

        let usedInteractionUserTimezone = false;
        let { timezone } = await getUserConfig(lastMessage.author.id, <const>["timezone"]);
        if (!timezone) {
            ({ timezone } = await getUserConfig(interaction.user.id, <const>["timezone"]));
            if (timezone) {
                usedInteractionUserTimezone = true;
            }
        }

        let content = "";

        if (usedInteractionUserTimezone) {
            content += `No timezone was set for the author of the last message, so the timezone of <@${interaction.user.id}> (\`${timezoneToString(timezone)}\`) was used instead.\n\n`;
        } else if (!timezone) {
            content += "No timezone is set for the author of the last message, so times were interpreted as UTC. You can set your timezone with `/config timezone`.\n\n";
        }

        const matches = getTimeMatches(lastMessage.content, timezone);
        if (!matches) {
            interaction.reply({
                flags: MessageFlags.Ephemeral,
                embeds: [errorEmbed(
                    interaction.client,
                    "No times found",
                    "Could not find any relative or absolute times in the last message.",
                )],
            });
            return;
        }
        content += matches!;

        await interaction.reply({
            flags: interaction.options.getBoolean("ephemeral") ? MessageFlags.Ephemeral : undefined,
            content: content,
            allowedMentions: {
                parse: [],
            },
        });
    },
};
