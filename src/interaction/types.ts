import { ContextMenuCommandBuilder, Interaction, SlashCommandBuilder, SlashCommandSubcommandBuilder } from "discord.js";

export interface ICommand {
    type: "global" | "debug";
    name?: string;
    builder: SlashCommandBuilder | ContextMenuCommandBuilder;
    execute(interaction: Interaction): Promise<void>;
}

export interface ISlashSubcommand {
    builder: (subcommand: SlashCommandSubcommandBuilder) => SlashCommandSubcommandBuilder;
    execute(interaction: Interaction): Promise<void>;
}

function isCommand(obj: unknown, willThrow?: false): obj is ICommand;
function isCommand(obj: unknown, willThrow?: true): void;
function isCommand(obj: unknown, willThrow = false): boolean | void {
    const isValid = obj
        && typeof obj === "object"
        && "builder" in obj
        && (
            obj.builder instanceof SlashCommandBuilder
            || obj.builder instanceof ContextMenuCommandBuilder
        )
        && "execute" in obj
        && typeof obj.execute === "function";

    if (willThrow && !isValid) {
        throw new Error("Object is not a valid ISlashCommand");
    }

    return isValid;
}
export { isCommand };
