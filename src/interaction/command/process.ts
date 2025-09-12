import { ApplicationCommandType, ContextMenuCommandBuilder, InteractionContextType, MessageFlags } from "discord.js";
import { getUserConfig } from "../../database/config";
import { errorEmbed } from "../../embeds/errorEmbed";
import getTimeMatches from "../../util/getTimeMatches";
import timezoneToString from "../../util/timezoneToString";
import { ICommand } from "../types";

export const parseTimes = <ICommand>{
    type: "global",
    name: "Parse times",
    builder: new ContextMenuCommandBuilder()
        .setName("Parse times")
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
                ephemeral: true,
            });
            return;
        }

        let usedInteractionUserTimezone = false;
        let { timezone } = await getUserConfig(message.author.id, <const>["timezone"]);
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

        const matches = getTimeMatches(message.content, timezone);
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
            content: content,
            allowedMentions: {
                parse: [],
            },
        });
    },
};
