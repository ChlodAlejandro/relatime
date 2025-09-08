import * as fs from "node:fs/promises";
import * as path from "node:path";
import { ICommand, isCommand } from "./types";

let commands: Map<string, ICommand> = null;

export async function loadCommands() {
    if (!commands) {
        commands = new Map<string, ICommand>();

        const commandsPath = path.join(__dirname, "command");
        const commandFiles = (await fs.readdir(commandsPath)).filter(file => file.endsWith(".ts"));
        for (const file of commandFiles) {
            const filePath = path.join(commandsPath, file);
            const command = await import(filePath);
            const exportName = Object.keys(command)[0];
            const commandName = (command as Record<string, ICommand>)?.[exportName]?.name ?? exportName;
            const commandExport = command[exportName];
            if (isCommand(commandExport)) {
                commands.set(commandName, commandExport);
            } else {
                console.log(`[WARNING] The command at ${filePath} is not a valid slash command file.`);
            }
        }
    }

    return commands;
}
