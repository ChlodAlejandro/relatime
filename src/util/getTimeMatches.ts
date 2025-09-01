import { DurationUnit } from "../parsing/Duration.ts";
import TimeParser, { TimeParserMode } from "../parsing/TimeParser.ts";

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
    modes: TimeParserMode[]
}

export default function getTimeMatches(
    input: string,
    timezone: string,
    options: Partial<TimeMatchesOptions> = {},
): string | null {
    let content = "";
    const timeMatches = new TimeParser(input, timezone).parse(options.modes);

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
        if (!match.relative) notes.push(`<t:${epoch}:R>`);

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
