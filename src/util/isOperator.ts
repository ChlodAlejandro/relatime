import { Snowflake } from "discord.js";

let operators: Snowflake[];
export default function isOperator(id: Snowflake) {
    if (!operators) {
        operators = (process.env.RT_OPERATORS ?? "")
            .split(",")
            .map(s => s.trim())
            .filter(s => s.length > 0);
    }
    return operators.includes(id);
}
