import {Interaction, SlashCommandBuilder, SlashCommandSubcommandBuilder} from "discord.js";

export interface ISlashCommand {
    builder: SlashCommandBuilder;
    execute(interaction: Interaction): Promise<void>;
}

export interface ISlashSubcommand {
    builder: (subcommand: SlashCommandSubcommandBuilder) => SlashCommandSubcommandBuilder;
    execute(interaction: Interaction): Promise<void>;
}

function isSlashCommand(obj: any, willThrow?: false): obj is ISlashCommand;
function isSlashCommand(obj: any, willThrow?: true): void;
function isSlashCommand(obj: any, willThrow = false): boolean|void {
    const isValid = obj
        && typeof obj === 'object'
        && 'builder' in obj
        && obj.builder instanceof SlashCommandBuilder
        && 'execute' in obj
        && typeof obj.execute === 'function';

    if (willThrow && !isValid) {
        throw new Error("Object is not a valid ISlashCommand");
    }

    return isValid;
}
export { isSlashCommand };
