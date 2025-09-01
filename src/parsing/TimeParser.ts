import { Temporal } from "temporal-polyfill";
import cloneRegex from "../util/cloneRegex.ts";
import combineRegex from "../util/combineRegex.ts";
import {
    DurationUnit, durationUnitFullRegexes,
    durationUnitRegexCaseInsensitive,
    durationUnitRegexCaseSensitive, durationUnitRegexes,
    durationUnits,
    durationUnitShorthandRegexes,
} from "./Duration.ts";
import Parser from "./Parser.ts";

export default class TimeParser extends Parser {

    // Matching here is somewhat strict to avoid accidentally matching ratios (e.g. "1:1", "100:1").
    // Also discards the result if there's an extra number at any point after any unit (e.g. "1:100pm").
    private static readonly TIME_REGEX = /^(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?(?!\d)/;
    private static readonly MERIDIAN_REGEX = /^(a\.?m\.?|p\.?m\.?)/i;
    private static readonly MONTH_REGEXES = {
        1: /^jan?(uary)?$/i,
        2: /^fe?b?(r?uary)?$/i,
        3: /^mar(ch)?$/i,
        4: /^apr?(il)?$/i,
        5: /^may$/i,
        6: /^june?$/i,
        7: /^july?$/i,
        8: /^aug?(ust)?$/i,
        9: /^se?p?(t?(embe?r)?)?$/i,
        10: /^oc?t?(o(be?r)?)?$/i,
        11: /^no?v?(embe?r)?$/i,
        12: /^de?c?(embe?r)?$/i,
    };
    private static readonly MONTH_REGEX = combineRegex(Object.values(TimeParser.MONTH_REGEXES), {
        trimStart: /\^/,
        trimEnd: /\$/,
        prepend: "^",
        append: "$",
    });
    private static readonly WEEKDAY_REGEXES = {
        0: /^su?n?d?a?y?$/i,
        1: /^mo?n?d?a?y?$/i,
        2: /^tu?e?s?d?a?y?$/i,
        3: /^we?d?n?e?s?d?a?y?$/i,
        4: /^thu?r?s?d?a?y?$/i,
        5: /^fr?i?d?a?y?$/i,
        6: /^sat?u?r?d?a?y?$/i,
    };
    private static readonly WEEKDAY_REGEX = combineRegex(Object.values(TimeParser.WEEKDAY_REGEXES), {
        trimStart: /\^/,
        trimEnd: /\$/,
        prepend: "^",
        append: "$",
    });
    private static readonly PREVIOUS_REGEX = /^(last|previous|prior|precee?ding)$/i;
    private static readonly THIS_REGEX = /^(this|now|current)$/i;
    private static readonly NEXT_REGEX = /^(next|following|succeeding)$/i;
    private static readonly BEFORE_REGEX = /^(before|prior)$/i;
    private static readonly AFTER_REGEX = /^(after|following)$/i;

    /**
     * Consume a duration. If no duration was found, null is returned.
     * This advances the parser's index.
     *
     * @protected
     */
    public consumeDuration(): number | null;
    public consumeDuration(withUnit: true): { durationInSeconds: number, unit: DurationUnit } | null;
    public consumeDuration(withUnit?: true): number | { durationInSeconds: number, unit: DurationUnit } | null {
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
        let unit;
        for (const possibleUnit in durationUnits) {
            const matching =
                cloneRegex(durationUnitShorthandRegexes[possibleUnit as DurationUnit], { prefix: "^" }).test(unitWord) ||
                cloneRegex(durationUnitFullRegexes[possibleUnit as DurationUnit], { prefix: "^" }).test(unitWord);
            if (matching) {
                durationInSeconds = durationNumber * durationUnits[possibleUnit as DurationUnit];
                unit = possibleUnit;
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

        if (withUnit != null) {
            return { durationInSeconds, unit };
        } else {
            return durationInSeconds;
        }
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
        const textMatch = this.consumeRegex(TimeParser.TIME_REGEX);
        if (!textMatch) {
            return null;
        }

        const match = textMatch.match(TimeParser.TIME_REGEX);
        let days = 0;
        let hours = parseInt(match[1], 10);
        let minutes = match[2] ? parseInt(match[2], 10) : 0;
        let seconds = match[3] ? parseInt(match[3], 10) : 0;

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

        // Is there a "the" here? We might want to cut it out.
        // This is to support "of the current year" or "of the next month".
        if (/^the$/.test(this.peekWord()?.toLowerCase())) {
            this.consumeWord();
        }

        const relative = this.consumeRelativeMonth(timeZoneId);
        if (relative) {
            return { time: relative, precision: "month" };
        } else {
            this.seek(startIndex);
        }

        const afterRelative = this.consumeMonthAfterRelative(timeZoneId);
        if (afterRelative) {
            return { time: afterRelative, precision: "month" };
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
            // This is a year. Check if a month succeeds it.
            if (TimeParser.MONTH_REGEX.test(this.peekWord())) {
                // This is a month-year pair, but in the wrong order.
                // First extract the month.

                const monthWord = this.consumeWord();
                let month: number;
                for (const monthNum in TimeParser.MONTH_REGEXES) {
                    if (TimeParser.MONTH_REGEXES[monthNum].test(monthWord)) {
                        // Valid month found.
                        month = +monthNum;
                        break;
                    }
                }
                if (!month) {
                    // Not a valid month.
                    return null;
                }

                return {
                    time: Temporal.ZonedDateTime.from({
                        timeZone: timeZoneId,
                        year: +nextWord,
                        month: month,
                        day: 1,
                    }),
                    precision: "month",
                };
            } else {
                return {
                    time: Temporal.ZonedDateTime.from({
                        timeZone: timeZoneId,
                        year: +nextWord,
                        month: 1,
                        day: 1,
                    }),
                    precision: "year",
                };
            }
        } else if (/^\d+(?!,\s*\d+)$/.test(this.peekWord())) {
            // This regex has a negative lookahead to avoid matching full dates (August 1, 2025).
            // The next word is a year. This might be a month-year pair.
            const monthWord = nextWord;
            const year = this.consumeWord();

            if (!year) {
                return null;
            }

            let month: number;
            for (const monthNum in TimeParser.MONTH_REGEXES) {
                if (TimeParser.MONTH_REGEXES[monthNum].test(monthWord)) {
                    // Valid month found.
                    month = +monthNum;
                    break;
                }
            }
            if (!month) {
                // Not a valid month.
                return null;
            }

            return {
                time: Temporal.ZonedDateTime.from({
                    timeZone: timeZoneId,
                    year: parseInt(year, 10),
                    month: month,
                    day: 1,
                }),
                precision: "month",
            };
        } else {
            // This could be a month. Test it with a quick RegEx.
            if (!TimeParser.MONTH_REGEX.test(nextWord)) {
                return null;
            }

            // This is a month. Let's find out which month exactly.
            let month: number;
            for (const monthNum in TimeParser.MONTH_REGEXES) {
                if (TimeParser.MONTH_REGEXES[monthNum].test(nextWord)) {
                    // Valid month found.
                    month = +monthNum;
                    break;
                }
            }
            if (!month) {
                // Not a valid month.
                return null;
            }

            return {
                time: Temporal.Now.zonedDateTimeISO(timeZoneId)
                    .with({ month, day: 1 })
                    .startOfDay(),
                precision: "month",
            };
        }
    }

    /**
     * This does NOT reset the parser's index on failure. Use {@link consumeMonthYear} instead.
     * @protected
     */
    protected consumeRelativeMonth(timeZoneId: string): null | Temporal.ZonedDateTime {
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
        if (TimeParser.NEXT_REGEX.test(word.toLowerCase())) {
            return now.add({ [unit]: 1 });
        } else if (TimeParser.PREVIOUS_REGEX.test(word.toLowerCase())) {
            return now.subtract({ [unit]: 1 });
        } else if (TimeParser.THIS_REGEX.test(word.toLowerCase())) {
            // Just return as-is.
            return now;
        }
        return null;
    }

    /**
     * This does NOT reset the parser's index on failure. Use {@link consumeMonthYear} instead.
     * @protected
     */
    protected consumeMonthAfterRelative(timeZoneId: string): null | Temporal.ZonedDateTime {
        const word = this.consumeWord();
        if (!word) {
            return null;
        }

        let unit;
        if (durationUnitRegexes.month.test(word)) {
            unit = "months";
        } else if (durationUnitRegexes.year.test(word)) {
            unit = "years";
        } else {
            // The word is not "month", "year", or their variants. Discard.
            return null;
        }

        // Not a "month after now" expression.
        const beforeOrAfter = this.consumeWord();
        if (!beforeOrAfter) {
            return null;
        }

        let reference: Temporal.ZonedDateTime;
        if (TimeParser.AFTER_REGEX.test(beforeOrAfter)) {
            reference = Temporal.Now.zonedDateTimeISO(timeZoneId)
                .add({ [unit]: 1 });
        } else if (TimeParser.BEFORE_REGEX.test(beforeOrAfter)) {
            reference = Temporal.Now.zonedDateTimeISO(timeZoneId)
                .subtract({ [unit]: 1 });
        }

        const relText = this.consumeWord();
        if (!relText) {
            return null;
        }
        if (TimeParser.NEXT_REGEX.test(relText)) {
            return reference.add({ [unit]: 1 });
        } else if (TimeParser.PREVIOUS_REGEX.test(relText)) {
            return reference.subtract({ [unit]: 1 });
        } else if (TimeParser.THIS_REGEX.test(relText)) {
            // Just return as-is.
            return reference;
        }
        return null;
    }

    /**
     * Get a weekday and return its number (starting with 0 = Sunday).
     */
    public consumeWeekday(): null | number {
        const word = this.consumeWord();
        if (!word) {
            return null;
        }

        // Check if this is a weekday.
        if (!TimeParser.WEEKDAY_REGEX.test(word)) {
            return null;
        }
        // Determine which weekday it is.
        for (const dayNum in TimeParser.WEEKDAY_REGEXES) {
            if (TimeParser.WEEKDAY_REGEXES[dayNum].test(word)) {
                return +dayNum;
            }
        }
        return null;
    }

}
