import { inspect } from "util";
import * as winston from "winston";

const splatSymbol = Symbol.for("splat");
const log = winston.createLogger({
    level: "debug",
    transports: [
        new winston.transports.Console({
            level: process.env.NODE_ENV === "production" ? "info" : "debug",
            format: winston.format.combine(
                winston.format.errors({ stack: true }),
                winston.format.colorize({ all: true }),
                winston.format.timestamp(),
                winston.format.align(),
                winston.format.printf((info) => `[${info.timestamp}] ${info.level}: ${info.message}${
                    info[splatSymbol] ? ` ${inspect(info[splatSymbol], true, 5, true)}` : ""
                }`),
            ),
        }),
        new winston.transports.File({ filename: process.env.RT_LOG_PATH || "./data/relatime.log" }),
    ],
});

export function getLogger(module: string) {
    return log.child({ module });
}
