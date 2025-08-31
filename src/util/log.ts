import * as winston from "winston";

export const log = winston.createLogger({
    level: 'debug',
    transports: [
        new winston.transports.Console({
            level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
            format: winston.format.combine(
                winston.format.errors({stack: true}),
                winston.format.colorize({ all: true }),
                winston.format.timestamp(),
                winston.format.align(),
                winston.format.printf((info) => `[${info.timestamp}] ${info.level}: ${info.message}`)
            )
        }),
        new winston.transports.File({ filename: 'relatime.log' })
    ]
});
