import {
    ApplicationIntegrationType,
    InteractionContextType,
    MessageFlags,
    Routes,
    SlashCommandBuilder,
} from "discord.js";
import { getUserConfig } from "../../database/config";
import { embed } from "../../embeds/embed";
import Relatime from "../../Relatime";
import { ICommand } from "../types";

export const help = <ICommand>{
    type: "global",
    builder: new SlashCommandBuilder()
        .setName("help")
        .setIntegrationTypes(
            ApplicationIntegrationType.UserInstall,
            ApplicationIntegrationType.GuildInstall,
        )
        .setContexts(
            InteractionContextType.Guild,
            InteractionContextType.BotDM,
            InteractionContextType.PrivateChannel,
        )
        .setDescription("Shows the bot setup guide.")
        .addBooleanOption((option) =>
            option
                .setName("ephemeral")
                .setDescription("Whether the reply should be ephemeral (only visible to you). True by default.")
                .setRequired(false),
        ),
    async execute(interaction) {
        if (!interaction.isChatInputCommand()) return;

        const commands = await Relatime.rest.get(Routes.applicationCommands(process.env.RT_DISCORD_CLIENT_ID!))
            .then((data: { id: string; name: string; }[]) => data.map(cmd => [cmd.name, cmd.id] as const))
            .then((entries) => new Map(entries));

        let userSpecific = interaction.options.getBoolean("ephemeral", false) ?? true;

        if (commands.get("config") === undefined) {
            // config command not registered???
            // Fall back to non-user specific instructions.
            userSpecific = false;
        }
        const configCommandId = commands.get("config");
        const lastCommandId = commands.get("last");

        const { timezone, relative, absolute } =
            await getUserConfig(interaction.user.id, <const>["timezone", "relative", "absolute"]);

        const setupSteps = [
            [true, "Invite the bot to your server ([link](https://discord.com/oauth2/authorize?client_id=1405466156063522937)).", [
                [null, "You can also install relatime as a user app, to be able to parse times from any server with the right-click menu."],
            ]],
            [timezone != null, "Configure the bot for yourself.", [
                [timezone != null, "Configure your timezone with </config timezone:" + configCommandId + ">."],
                [relative === "true", "(optional) Enable replies when relative times are mentioned with </config relative:" + configCommandId + ">."],
                [absolute === "true", "(optional) Enable replies when absolute times are mentioned with </config absolute:" + configCommandId + ">."],
            ]],
            [timezone != null, "Start using the bot!", [
                [null, 'You can right-click or long-tap a message, then select "Apps > Parse times" to parse times in a message.'],
                [null, "You can also use </last:" + lastCommandId + "> to parse the last message sent in the channel."],
                (!userSpecific || relative === "true") && [null, `You can send a relative time (like "in 4 hours" or "next Friday at 5 pm") and${
                    userSpecific ? "" : ", if enabled,"
                } the bot will reply with the corresponding absolute time.`],
                (!userSpecific || absolute === "true") && [null, `You can send an absolute time (like "October 10" or "4:40 p.m.") and${
                    userSpecific ? "" : ", if enabled,"
                } the bot will reply with the corresponding relative time and that date and time converted for other users.`],
            ] as ([null, string] | false)[]],
        ] as const;

        let setupText = "";
        let i = 1;
        for (const [condition, step, substeps] of setupSteps) {
            if (userSpecific) {
                setupText += condition ? `${i++}. :white_check_mark: **${step}**\n` : `:x: **${step}**\n`;
                if (substeps) {
                    for (const substep of substeps) {
                        if (substep === false) continue;

                        const [subcondition, substepText] =  substep;
                        if (subcondition === null) {
                            setupText += `  * ${substepText}\n`;
                        } else {
                            setupText += subcondition ? `  * :white_check_mark: ${substepText}\n` : (
                                substepText.startsWith("(optional)") ? `  * ${substepText}\n` : `  * :x: ${substepText}\n`
                            );
                        }
                    }
                }
            } else {
                setupText += `${i++}. **${step}**\n`;
                if (substeps) {
                    for (const substep of substeps) {
                        if (substep === false) continue;

                        const [, substepText] =  substep;
                        setupText += `  * ${substepText}\n`;
                    }
                }
            }
        }

        let description = `
            relatime is a bot that converts time in chat to Discord timestamps based on the user's
            timezone. Use it to plan gaming sessions, meetings, or any other events, without ever having
            to copy timestamps or do mental math again!
            
            relatime supports a wide variety of relative and absolute time expressions in English. If you
            have an expression that you expected to work but doesn't, or you get a false positive match,
            please file an issue on [GitHub](https://github.com/ChlodAlejandro/relatime/issues).
        `
            .replace(/\n\s*\n/, "<LF>")
            .replace(/\s+/g, " ").trim()
            .replace(/<LF>/g, "\n\n");

        description += "\n## Setup\n" + setupText;

        await interaction.reply({
            flags: (interaction.options.getBoolean("ephemeral") ?? true) ? MessageFlags.Ephemeral : undefined,
            embeds: [
                embed(interaction.client)
                    .setTitle("relatime setup guide")
                    .setDescription(description),
            ],
        });
    },
};
