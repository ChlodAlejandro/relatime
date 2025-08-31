import { Temporal } from "temporal-polyfill";
import cloneRegex from "../util/cloneRegex.ts";
import {
    DurationUnit, durationUnitFullRegexes,
    durationUnitRegexCaseInsensitive,
    durationUnitRegexCaseSensitive, durationUnitRegexes,
    durationUnits,
    durationUnitShorthandRegexes,
} from "./Duration.ts";
import Parser from "./Parser.ts";

export default class TimeParser extends Parser {

    private static readonly TIME_REGEX = /^(\d{1,2})(:\d{1,2})?(:\d{1,2})?/;
    private static readonly MERIDIAN_REGEX = /^(a\.?m\.?|p\.?m\.?)/i;

    /**
     * Consume a duration. If no duration was found, null is returned.
     * This advances the parser's index.
     *
     * @protected
     */
    public consumeDuration(): number | null {
        let durationNumber: number | null;
        if (this.peekWord() === "a" || this.peekWord() === "an" || this.peekWord() === "one") {
            this.consumeWord();
            durationNumber = 1;
        } else {
            durationNumber = this.consumeNumbers();
        }

        // No numbers here.
        if (durationNumber === null) {
            return null;
        }

        // Now we need to find a unit.
        // A more specific regex is used here to avoid consuming durations that
        // immediately succeed this (e.g. "1h30m").
        const possibleUnitWord1 = this.peekRegex(/^[a-z_]+/i);
        if (!possibleUnitWord1) {
            // End of string. No unit.
            return null;
        }
        // Test if the word is actually a unit.
        if (
            !possibleUnitWord1.match(durationUnitRegexCaseInsensitive) &&
            !possibleUnitWord1.match(durationUnitRegexCaseSensitive)
        ) {
            // Not a unit. Try peeking forward again.
            // This is to catch cases like "give me 5 fucking minutes".
            // Too considerate? I don't care.
            const possibleUnitWord2 = this.peekRegex(/^[a-z_]+/i);
            if (!possibleUnitWord2) {
                // End of string. No unit.
                return null;
            }
            if (
                !possibleUnitWord2.match(durationUnitRegexCaseInsensitive) &&
                !possibleUnitWord2.match(durationUnitRegexCaseSensitive)
            ) {
                // Still not a unit. Give up.
                return null;
            } else {
                // Unit found. Consume the first word (which is not a unit) and continue.
                this.consumeWord();
            }

            return null;
        }

        // Unit found. Consume it.
        const unitWord = this.consumeRegex(/^[a-z_]+/i);
        let durationInSeconds: number;
        for (const unit in durationUnits) {
            const matching =
                cloneRegex(durationUnitShorthandRegexes[unit as DurationUnit], { prefix: "^" }).test(unitWord) ||
                cloneRegex(durationUnitFullRegexes[unit as DurationUnit], { prefix: "^" }).test(unitWord);
            if (matching) {
                durationInSeconds = durationNumber * durationUnits[unit as DurationUnit];
                break;
            }
        }
        if (!durationInSeconds) {
            // Somehow no unit matched. Give up.
            return null;
        }

        // We're using our own custom regex here so whitespaces won't be removed for us.
        // Remove that whitespace on our own.
        this.consumeWhitespace();

        return durationInSeconds;
    }

    /**
     * Consume a time of day, such as "1pm", "1:23", "13:45", "11:40pm" etc. If
     * no time was found, null is returned. This advances the parser's index.
     *
     * @protected
     */
    public consumeTimeOfDay(): null | { days?: number, hours: number, minutes: number, seconds?: number } {
        const startIndex = this.index;

        const exact = this.consumeExactTimeOfDay();
        if (exact) {
            return exact;
        } else {
            this.seek(startIndex);
        }

        const word = this.consumeWordTimeOfDay();
        if (word) {
            return word;
        } else {
            this.seek(startIndex);
        }

        return null;
    }

    /**
     * This does NOT reset the parser's index on failure. Use {@link consumeTimeOfDay} instead.
     * @protected
     */
    protected consumeExactTimeOfDay(): null | { days: number, hours: number, minutes: number, seconds: number } {
        const match = this.consumeRegex(TimeParser.TIME_REGEX);
        if (!match) {
            return null;
        }

        let days = 0;
        let hours = parseInt(match[1], 10);
        let minutes = match[2] ? parseInt(match[2].slice(1), 10) : 0;
        let seconds = match[3] ? parseInt(match[3].slice(1), 10) : 0;

        this.consumeWhitespace();

        // Detect meridians
        const meridian = this.peekRegex(TimeParser.MERIDIAN_REGEX);
        if (meridian) {
            this.consumeRegex(TimeParser.MERIDIAN_REGEX);
            if (meridian.toLowerCase().startsWith("p") && hours < 12) {
                hours += 12;
            } else if (meridian.toLowerCase().startsWith("a") && hours === 12) {
                hours = 0;
            }
            this.consumeWhitespace();
        } else {
            // No meridian detected. In this case, minutes is required.
            // Otherwise, we may match single numbers, like "1".
            if (match[2] == null) {
                // No minutes, discard.
                return null;
            }
        }

        // Keep second down.
        while (seconds > 59) {
            seconds -= 60;
            minutes += 1;
        }
        // Keep minute down.
        while (minutes > 59) {
            minutes -= 60;
            hours = (hours + 1) % 24;
        }
        // Keep hour down.
        // This allows us to detect "25:00". This one's for you, Akiyama Mizuki.
        while (hours > 23) {
            hours -= 24;
            days += 1;
        }

        return { days, hours, minutes, seconds };
    }

    /**
     * This does NOT reset the parser's index on failure. Use {@link consumeTimeOfDay} instead.
     * @protected
     */
    protected consumeWordTimeOfDay(): null | { hours: number, minutes: number } {
        const word = this.consumeWord();
        if (!word) {
            return null;
        }

        // Check for "noon" and "midnight"
        if (word.toLowerCase() === "noon") {
            return { hours: 12, minutes: 0 };
        } else if (word.toLowerCase() === "midnight") {
            return { hours: 0, minutes: 0 };
        } else if (word.toLowerCase() === "morning") {
            return { hours: 6, minutes: 0 };
        } else if (word.toLowerCase() === "afternoon") {
            return { hours: 15, minutes: 0 };
        } else if (word.toLowerCase() === "evening") {
            return { hours: 18, minutes: 0 };
        }

        return null;
    }

    /**
     * Consume and return a month, year, or both. Defaults to current year.
     */
    public consumeMonthYear(timeZoneId: string): null | { time: Temporal.ZonedDateTime, precision: "month" | "year" } {
        const startIndex = this.index;

        const exact = this.consumeExactMonthYear(timeZoneId);
        if (exact) {
            return exact;
        } else {
            this.seek(startIndex);
        }

        const relative = this.consumeRelativeMonthYear(timeZoneId);
        if (relative) {
            return { time: relative, precision: "month" };
        } else {
            this.seek(startIndex);
        }

        return null;
    }

    /**
     * This does NOT reset the parser's index on failure. Use {@link consumeMonthYear} instead.
     * @protected
     */
    protected consumeExactMonthYear(timeZoneId: string): null | { time: Temporal.ZonedDateTime, precision: "month" | "year" } {
        const nextWord = this.consumeWord();

        if (/^\d+$/.test(nextWord)) {
            // This is a year only.
            return {
                time: Temporal.ZonedDateTime.from({
                    timeZone: timeZoneId,
                    year: +nextWord,
                    month: 1,
                    day: 1,
                }),
                precision: "year",
            };
        } else if (/^\d+$/.test(this.peekWord())) {
            // The next word is a year. This might be a month-year pair.
            const month = nextWord;
            const year = this.consumeWord();

            if (!year) {
                return null;
            }

            // We're forced to use Date here because Temporal doesn't have month name parsing.
            // We'll immediately convert it back to Temporal afterward.
            const parsed = new Date(`${month} ${year}`);
            if (isNaN(parsed.getTime())) {
                // Not a valid month (or maybe year).
                return null;
            }

            return {
                time: Temporal.ZonedDateTime.from({
                    timeZone: timeZoneId,
                    year: parsed.getFullYear(),
                    month: parsed.getMonth() + 1,
                    day: 1,
                }),
                precision: "month",
            };
        } else {
            // This could be a month. Let's try to parse it with Date.
            // We're forced to use Date here because Temporal doesn't have month name parsing.
            // We'll immediately convert it back to Temporal afterward.
            const parsed = new Date(`${nextWord} ${new Date().getFullYear()}`);
            if (isNaN(parsed.getTime())) {
                // Not a valid month.
                return null;
            }

            return {
                time: Temporal.Now.zonedDateTimeISO(timeZoneId)
                    .with({ month: parsed.getMonth() + 1, day: 1 })
                    .startOfDay(),
                precision: "month",
            };
        }
    }

    /**
     * This does NOT reset the parser's index on failure. Use {@link consumeMonthYear} instead.
     * @protected
     */
    protected consumeRelativeMonthYear(timeZoneId: string): null | Temporal.ZonedDateTime {
        const word = this.consumeWord();
        if (!word) {
            return null;
        }

        let unit = this.consumeWord();
        if (!unit) {
            // No unit found.
            return null;
        }

        if (durationUnitRegexes.month.test(unit)) {
            unit = "months";
        } else if (durationUnitRegexes.year.test(unit)) {
            unit = "years";
        } else {
            // The word is not "month", "year", or their variants. Discard.
            return null;
        }

        const now = Temporal.Now.zonedDateTimeISO(timeZoneId);
        if (word.toLowerCase() === "next") {
            now.add({ [unit]: 1 });
        } else if (word.toLowerCase() === "last" || word.toLowerCase() === "previous") {
            now.subtract({ [unit]: 1 });
        } else if (word.toLowerCase() !== "this") {
            // No matching word.
            return null;
        }

        return now;
    }

    /**
     * Get a weekday and return its number (starting with 0 = Sunday).
     */
    public consumeWeekday(): null | number {
        const word = this.consumeWord();
        if (!word) {
            return null;
        }

        if (/^su?n?d?a?y?$/.test(word)) {
            return 0;
        } else if (/^mo?n?d?a?y?$/.test(word)) {
            return 1;
        } else if (/^tu?e?s?d?a?y?$/.test(word)) {
            return 2;
        } else if (/^we?d?n?e?s?d?a?y?$/.test(word)) {
            return 3;
        } else if (/^thu?r?s?d?a?y?$/.test(word)) {
            return 4;
        } else if (/^fr?i?d?a?y?$/.test(word)) {
            return 5;
        } else if (/^sat?u?r?d?a?y?$/.test(word)) {
            return 6;
        }

        return null;
    }

}
