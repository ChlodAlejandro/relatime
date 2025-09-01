import * as fs from "node:fs/promises";
import * as path from "node:path";
import { ISlashCommand, isSlashCommand } from "./types";

let slashCommands: Map<string, ISlashCommand> = null;

export async function loadSlashCommands() {
    if (!slashCommands) {
        slashCommands = new Map<string, ISlashCommand>();

        const commandsPath = path.join(__dirname, "command");
        const commandFiles = (await fs.readdir(commandsPath)).filter(file => file.endsWith(".ts"));
        for (const file of commandFiles) {
            const filePath = path.join(commandsPath, file);
            const command = await import(filePath);
            const commandName = Object.keys(command)[0];
            const commandExport = command[commandName];
            if (isSlashCommand(commandExport)) {
                slashCommands.set(commandName, commandExport);
            } else {
                console.log(`[WARNING] The command at ${filePath} is not a valid slash command file.`);
            }
        }
    }

    return slashCommands;
}
