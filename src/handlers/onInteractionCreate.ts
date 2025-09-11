import { ClientEvents, InteractionType, MessageFlags } from "discord.js";
import { errorEmbed } from "../embeds/errorEmbed";
import { loadCommands } from "../interaction/loader";
import Relatime from "../Relatime";

export default async function onInteractionCreate(...args: ClientEvents["interactionCreate"]) {
    const [interaction] = args;

    const type = InteractionType[interaction.type];
    const log = Relatime.getLogger("onInteractionCreate", {
        interaction: {
            id: interaction.id,
            user: interaction.user?.id,
            type: InteractionType[interaction.type],
            guild: interaction.guildId,
        },
    });
    log.info(`Interaction received: ${interaction.id} (${type}) from ${interaction.user.tag}`);
    if (!interaction.isChatInputCommand() && !interaction.isContextMenuCommand()) {
        log.warn(`Unsupported interaction type: ${type}`);
        return;
    }
    const matched = (await loadCommands()).get(interaction.commandName);

    if (!matched) {
        log.warn(`No command matched for interaction: ${interaction.commandName}`);
        interaction.reply({
            ephemeral: true,
            embeds: [errorEmbed(
                interaction.client,
                "Unknown command",
                "This command is not recognized by the bot. It may have been removed or is otherwise unavailable.",
            )],
        });
        return;
    }

    matched
        ?.execute(interaction)
        .catch(err => {
            log.error(`Error executing command ${interaction.commandName}:`, err);
            console.error(err);
            const embed = errorEmbed(
                interaction.client,
                "Error executing command",
                "An error occurred while executing the command. Please try again later.",
            );
            if (interaction.replied || interaction.deferred) {
                interaction.followUp({ embeds: [embed], flags: MessageFlags.Ephemeral });
            } else {
                interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            }
        });
}
