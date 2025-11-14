import * as fs from "node:fs/promises";
import * as path from "node:path";
import Relatime from "../../Relatime";

let hooks: Map<string, CallableFunction> = null;

export async function loadHooks() {
    if (!hooks) {
        hooks = new Map<string, CallableFunction>();

        const hooksPath = path.join(Relatime.rootDir, "hooks");
        const commandFiles = (await fs.readdir(hooksPath)).filter(file => /\.[tj]s$/.test(file));
        for (const file of commandFiles) {
            const filePath = path.join(hooksPath, file);
            const hook = await import(filePath);

            if (hook.default && typeof hook.default === "function") {
                const hookName = path.parse(file).name;
                hooks.set(hookName, hook.default);
            } else {
                Relatime.log.warn(`The hook at ${filePath} does not have a default export function. Skipping...`);
            }
        }
    }

    return hooks;
}
