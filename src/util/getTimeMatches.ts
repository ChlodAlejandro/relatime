import { Temporal } from "temporal-polyfill";
import { Logger } from "winston";
import { DurationUnit } from "../lib/parsing/Duration";
import TimeParser, { TimeParserMode } from "../lib/parsing/TimeParser";
import Relatime from "../Relatime";

/**
 * Timestamp flags to use for different precision levels. Each letter generates another timestamp, joined by commas.
 * @see https://discord.com/developers/docs/reference#message-formatting-timestamp-styles
 */
const precisionSyntaxFlags: Record<DurationUnit, string> = {
    second: "DT",
    minute: "f",
    hour: "f",
    day: "D",
    week: "D",
    month: "D",
    year: "D",
};

interface TimeMatchesOptions {
    includeCode: boolean;
    includeExactRelative: boolean;
    modes: TimeParserMode[];
    log: Logger;
}

export default function getTimeMatches(
    input: string,
    timezone: string,
    options: Partial<TimeMatchesOptions> = {},
): string | null {
    let content = "";
    const parser = new TimeParser(input, timezone, {
        defaultMode: options.modes,
    });
    parser.onWarning.subscribe((event) => {
        const message = event.message;
        delete event.message;
        (options.log?.child({ module: "TimeParser" }) ?? Relatime.getLogger("TimeParser"))
            .warn(message, event);
    });
    const timeMatches = parser.parse();

    if (timeMatches.length === 0) {
        return null;
    }

    const matchStrings = [];
    const arrowRight = "\u2192";
    for (const match of timeMatches) {
        const timestamps = [];
        const timeFormats = precisionSyntaxFlags[match.precision];
        const epoch = Math.floor(match.date.epochMilliseconds / 1e3);
        for (const flag of timeFormats) {
            timestamps.push(`<t:${epoch}:${flag}>`);
        }

        const notes = [];
        if (match.approximated) notes.push("approximated");
        if (!match.relative) {
            notes.push(
                match.precision === "day" ?
                    `<t:${epoch}:R> until midnight` : `<t:${epoch}:R>`,
            );
        }

        if (!match.relative && options.includeExactRelative) {
            const now = Temporal.Now.zonedDateTimeISO();
            const since = now.since(match.date);
            // Bad type.
            // https://github.com/fullcalendar/temporal-polyfill/issues/59
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-expect-error
            const duration = since.round({ smallestUnit: "second" }).toLocaleString("en", { style: "narrow" });
            notes.push(since.sign === -1 ? `in ${duration}` : `${duration} ago`);
        }
        if (options.includeCode) {
            notes.push(`\`<t:${epoch}:f>\``);
        }

        matchStrings.push(`${match.match} ${arrowRight} ${timestamps.join(", ")}${
            notes.length > 0 ? ` (${notes.join("; ")})` : ""
        }`);
    }

    content += matchStrings.join("\n");
    return content;
}
