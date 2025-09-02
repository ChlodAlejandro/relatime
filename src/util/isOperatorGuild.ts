import { Snowflake } from "discord.js";

let operatorServers: Snowflake[];

export function getOperatorGuilds(): Snowflake[] {
    if (!operatorServers) {
        operatorServers = (process.env.RT_OPERATOR_SERVERS ?? "")
            .split(",")
            .map(s => s.trim())
            .filter(s => s.length > 0);
    }
    return operatorServers;
}

export default function isOperatorGuild(id: Snowflake) {
    if (!operatorServers) {
        getOperatorGuilds();
    }
    return operatorServers.includes(id);
}
