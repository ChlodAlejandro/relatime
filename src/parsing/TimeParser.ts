import { Temporal } from "temporal-polyfill";
import cloneRegex from "../util/cloneRegex.ts";
import combineRegex from "../util/combineRegex.ts";
import stringMatcher from "../util/convertToStringMatch.ts";
import { log } from "../util/log.ts";
import {
    DurationUnit, durationUnitFullRegexes,
    durationUnitRegexCaseInsensitive, durationUnitRegexCaseSensitive,
    durationUnitRegexes, durationUnits, durationUnitShorthandRegexes,
    getSmallestDurationUnit,
    unitCompare,
} from "./Duration.ts";
import Parser from "./Parser.ts";

type Precision = "second" | "minute" | "hour" | "day";
export interface AbsoluteTimeMatch {
    match: string;
    /** The date that represents this given absolute time */
    date: Temporal.ZonedDateTime;
    precision: Precision;
    approximated?: boolean;
    relative?: boolean;
}

export enum TimeParserMode {
    Absolute,
    Relative,
}

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
    private static readonly WEEKDAY_DETECTION_REGEXES = {
        0: /\b([Ss]unday|Sun)\b/,
        1: /\b([Mm]onday|Mon)\b/,
        2: /\b([Tt]uesday|Tue)\b/,
        3: /\b([Ww]ed?nesday|Wed)\b/,
        4: /\b([Tt]hursday|Thu)\b/,
        5: /\b([Ff]riday|Fri)\b/,
        6: /\b([Ss]aturday|Sat)\b/,
    };
    private static readonly WEEKDAY_DETECTION_REGEX = combineRegex(Object.values(TimeParser.WEEKDAY_DETECTION_REGEXES), {
        trimStart: /\\b/,
        trimEnd: /\\b/,
        prepend: "\\b",
        append: "\\b",
    });
    private static readonly PREVIOUS_REGEX = /^(last|previous|prior|precee?ding)$/i;
    private static readonly THIS_REGEX = /^(this|now|current)$/i;
    private static readonly NEXT_REGEX = /^(next|following|succeeding|(up)?coming)$/i;
    private static readonly PREPOSITIONAL_REGEX = combineRegex([
        TimeParser.PREVIOUS_REGEX, TimeParser.THIS_REGEX, TimeParser.NEXT_REGEX,
    ], {
        trimStart: /\^/,
        trimEnd: /\$/,
        prepend: "^",
        append: "$",
    });
    private static readonly BEFORE_REGEX = /^(before|prior)$/i;
    private static readonly AFTER_REGEX = /^(after|following)$/i;

    protected static readonly PREFIX_DURATION_REGEX =
        /^(?:in|after|within|give|gimme|just)$/i;
    protected static readonly PREFIX_SKIP_WORDS = {
        give: ["me", "us"],
    };
    protected static readonly POSTFIX_DURATION_REGEX =
        /^(?:ago|prior|from)$/i;
    protected static readonly POSTFIX_MATCH_WORDS = {
        from: ["now"],
    };
    protected static readonly NEGATE_DURATION_REGEX =
        /^(?:ago|prior)$/;
    protected static readonly SPELLED_DURATION_REGEX =
        /^(?:an?|one)$/;

    readonly timeZoneId: string;

    constructor(text: string, timezone: string) {
        super(text);

        this.timeZoneId = timezone;
    }

    public now(): Temporal.ZonedDateTime {
        return Temporal.Now.zonedDateTimeISO(this.timeZoneId);
    }

    public parse(modes = [TimeParserMode.Absolute, TimeParserMode.Relative]): AbsoluteTimeMatch[] {
        const matches: (AbsoluteTimeMatch | null)[] = [];

        // Go through each word and see if it matches an expression we need.
        let lastIndex = this.index;
        do {
            const startIndex = this.index;
            const word = this.consumeWord();

            if (word == null) {
                // No word ahead of us. Try consuming any trailing symbols.
                this.consumeNonWord();
                continue;
            }

            // This must be ordered from most-specific to least-specific, or else we'll match
            // too small that the patterns we want.
            if (modes.includes(TimeParserMode.Absolute)) {
                if (this.detectFirstAndLastDays(matches, word, startIndex))
                    continue;
                if (this.detectNthWeekdayOfMonth(matches, word, startIndex))
                    continue;
                if (this.detectLastWeekdayOfMonth(matches, word, startIndex))
                    continue;
                if (this.detectWeekdayAndAbsoluteTime(matches, word, startIndex))
                    continue;
                if (this.detectWeekdayAndRelativeTime(matches, word, startIndex))
                    continue;
                if (this.detectOrdinalUnit(matches, word, startIndex))
                    continue;
                if (this.detectBackAndFrontOfHour(matches, word, startIndex))
                    continue;
                if (this.detectYesterday(matches, word, startIndex))
                    continue;
                if (this.detectToday(matches, word, startIndex))
                    continue;
                if (this.detectTomorrow(matches, word, startIndex))
                    continue;
                if (this.detectMidnight(matches, word, startIndex))
                    continue;
                if (this.detectPrepositionTimeOfDay(matches, word, startIndex))
                    continue;
                if (this.detectTimeOfDay(matches, word, startIndex))
                    continue;
            }
            if (modes.includes(TimeParserMode.Relative)) {
                if (this.detectRelativeWeekdayAndAbsoluteTime(matches, word, startIndex))
                    continue;
                if (this.detectRelativeWeekday(matches, word, startIndex))
                    continue;
                if (this.detectRelativeUnit(matches, word, startIndex))
                    continue;
                if (this.detectPrefixDuration(matches, word, startIndex))
                    continue;
                if (this.detectPostfixDuration(matches, word, startIndex))
                    continue;
                if (this.detectOsuDurations(matches, word, startIndex))
                    continue;
            }

            if (lastIndex === this.index) {
                if (process.env.NODE_ENV !== "production") {
                    log.warn(
                        "Parser did not advance!",
                        { source: this.source, working: this.working, index: this.index },
                    );
                }
                // No progress made, consume a character to avoid infinite loops.
                this.consume();
            }
            lastIndex = this.index;
        } while (!this.isEmpty());

        return matches
            .filter(v => !!v);
    }

    /**
     * Consume a duration. If no duration was found, null is returned.
     *
     * @protected
     */
    public consumeDuration(): Partial<Record<DurationUnit, number>> | null {
        const currentIndex = this.index;
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
            this.seek(currentIndex);
            return null;
        }
        // Test if the word is actually a unit.
        if (
            !possibleUnitWord1.match(stringMatcher(durationUnitRegexCaseInsensitive)) &&
            !possibleUnitWord1.match(stringMatcher(durationUnitRegexCaseSensitive))
        ) {
            this.consumeWord();
            // Not a unit. Try peeking forward again.
            // This is to catch cases like "give me 5 fucking minutes".
            // Too considerate? I don't care.
            const possibleUnitWord2 = this.peekRegex(/^[a-z_]+/i);
            if (!possibleUnitWord2) {
                // End of string. No unit.
                this.seek(currentIndex);
                return null;
            }
            if (
                !possibleUnitWord2.match(stringMatcher(durationUnitRegexCaseInsensitive)) &&
                !possibleUnitWord2.match(stringMatcher(durationUnitRegexCaseSensitive))
            ) {
                // Still not a unit. Give up.
                this.seek(currentIndex);
                return null;
            }
            // Unit found. Consume the first word (which is not a unit) and continue.
        }

        // Unit found. Consume it.
        let duration: Partial<Record<DurationUnit, number>>;
        const unitWord = this.consumeRegex(/^[a-z_]+/i);
        for (const possibleUnit in durationUnits) {
            const matching =
                cloneRegex(durationUnitShorthandRegexes[possibleUnit], { prefix: "^" }).test(unitWord) ||
                cloneRegex(durationUnitFullRegexes[possibleUnit], { prefix: "^" }).test(unitWord);
            if (matching) {
                duration = { [possibleUnit as DurationUnit]: durationNumber! };
                break;
            }
        }
        if (!duration) {
            // Somehow no unit matched. Give up.
            this.seek(currentIndex);
            return null;
        }

        // We're using our own custom regex here so whitespaces won't be removed for us.
        // Remove that whitespace on our own.
        this.consumeWhitespace();

        return duration;
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

        // Get rid of possible whitespace.
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
    public consumeMonthYear(): null | { time: Temporal.ZonedDateTime, precision: "month" | "year" } {
        const startIndex = this.index;

        const exact = this.consumeExactMonthYear();
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

        const relative = this.consumeRelativeMonth();
        if (relative) {
            return { time: relative, precision: "month" };
        } else {
            this.seek(startIndex);
        }

        const afterRelative = this.consumeMonthAfterRelative();
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
    protected consumeExactMonthYear(): null | { time: Temporal.ZonedDateTime, precision: "month" | "year" } {
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
                        timeZone: this.timeZoneId,
                        year: +nextWord,
                        month: month,
                        day: 1,
                    }),
                    precision: "month",
                };
            } else {
                return {
                    time: Temporal.ZonedDateTime.from({
                        timeZone: this.timeZoneId,
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
                    timeZone: this.timeZoneId,
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
                time: this.now()
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
    protected consumeRelativeMonth(): null | Temporal.ZonedDateTime {
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

        const now = this.now();
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
    protected consumeMonthAfterRelative(): null | Temporal.ZonedDateTime {
        const word = this.consumeWord();
        if (!word) {
            return null;
        }

        let unit: "months" | "years";
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
            reference = this.now().add({ [unit]: 1 });
        } else if (TimeParser.BEFORE_REGEX.test(beforeOrAfter)) {
            reference = this.now().subtract({ [unit]: 1 });
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

    private getKeywordAndTimeDetector(
        keyword: string,
        baseTime: Temporal.ZonedDateTime,
    ): (matches: AbsoluteTimeMatch[], word: string, startIndex: number) => boolean {
        return (matches, word, startIndex) => {
            if (word.toLowerCase() !== keyword) {
                return false;
            }

            if (/^(on|at|in)$/i.test(this.peekWord())) {
                // Cut out the preposition.
                this.consumeWord();
            }

            // Check to see if this precedes a time of day.
            const timeOfDay = this.consumeTimeOfDay();
            const precision = timeOfDay ?
                (timeOfDay?.seconds != null ? "second" :
                    (timeOfDay?.minutes != null ? "minute" : "hour")) :
                "day";
            if (timeOfDay) {
                // Set to a specific time of day.
                matches.push({
                    match: this.source.substring(startIndex, this.index).trim(),
                    date: baseTime
                        .startOfDay()
                        .add(timeOfDay),
                    precision,
                });
            } else {
                // Just the keyword, so return the start of the day.
                matches.push({
                    match: this.source.substring(startIndex, this.index).trim(),
                    date: baseTime
                        .startOfDay(),
                    precision,
                });
            }

        };
    };

    protected detectYesterday(
        matches: AbsoluteTimeMatch[],
        word: string,
        startIndex: number,
    ): boolean {
        const yesterday = this.now()
            .subtract({ days: 1 });
        return this.getKeywordAndTimeDetector("yesterday", yesterday)(matches, word, startIndex);
    }

    protected detectToday(
        matches: AbsoluteTimeMatch[],
        word: string,
        startIndex: number,
    ): boolean {
        const today = this.now();
        return this.getKeywordAndTimeDetector("today", today)(matches, word, startIndex);
    }

    protected detectTomorrow(
        matches: AbsoluteTimeMatch[],
        word: string,
        startIndex: number,
    ): boolean {
        const tomorrow = this.now()
            .add({ days: 1 });
        return this.getKeywordAndTimeDetector("tomorrow", tomorrow)(matches, word, startIndex);
    }

    protected detectMidnight(
        matches: AbsoluteTimeMatch[],
        word: string,
        startIndex: number,
    ): boolean {
        if (word.toLowerCase() !== "midnight") {
            return false;
        }

        const today = this.now()
            .startOfDay();
        matches.push({
            match: this.source.substring(startIndex, this.index).trim(),
            date: today,
            precision: "minute",
        });
        return true;
    }

    protected detectPrepositionTimeOfDay(
        matches: AbsoluteTimeMatch[],
        word: string,
        startIndex: number,
    ): boolean {
        if (!/^(at|around|by|about)$/i.test(word)) {
            return false;
        }

        const timeOfDay = this.consumeTimeOfDay();
        if (!timeOfDay) {
            return false;
        }

        const today = this.now()
            .startOfDay();
        matches.push({
            match: this.source.substring(startIndex, this.index).trim(),
            date: today.add(timeOfDay),
            precision: timeOfDay?.seconds != null ? "second" : "minute",
        });
        return true;
    }

    protected detectTimeOfDay(
        matches: AbsoluteTimeMatch[],
        _word: string,
        startIndex: number,
    ): boolean {
        const currentIndex = this.index;
        // Move us back so we can consume this time of day.
        this.seek(startIndex);
        const timeOfDay = this.consumeTimeOfDay();
        if (!timeOfDay) {
            this.seek(currentIndex);
            return false;
        }

        const today = this.now()
            .startOfDay();
        matches.push({
            match: this.source.substring(startIndex, this.index).trim(),
            date: today.add(timeOfDay),
            precision: timeOfDay?.seconds != null ? "second" : "minute",
        });
        return true;
    }

    /**
     * Detect "back of <hour>", which is 15 minutes past the specified hour.
     * Thanks, PHP.
     *
     * @param matches
     * @param word
     * @param startIndex
     * @protected
     */
    protected detectBackAndFrontOfHour(
        matches: AbsoluteTimeMatch[],
        word: string,
        startIndex: number,
    ): boolean {
        let method: "add" | "subtract" = null;
        if (word === "back") {
            method = "add";
        } else if (word === "front") {
            method = "subtract";
        }
        if (method == null) {
            return false;
        }

        if (this.peekWord() !== "of") {
            // Not "of" after "back" or "front"
            return false;
        }
        this.consumeWord(); // of

        const today = this.now()
            .startOfDay();
        let time = this.consumeTimeOfDay();
        if (!time) {
            // We'll also consider normal numbers as hours.
            // Again, thanks PHP.
            // We're using a custom regex here so that we don't end up matching "12something".
            const hours = this.consumeRegex(/^\d{1,2}\b/);
            if (!hours) {
                return false;
            } else {
                time = { hours: parseInt(hours, 10), minutes: 0 };
            }
        }
        const finalTime = today
            .add(time)[method]({ minutes: 15 });
        matches.push({
            match: this.source.substring(startIndex, this.index).trim(),
            date: finalTime,
            precision: "minute",
        });
        return true;
    }

    protected detectFirstAndLastDays(
        matches: AbsoluteTimeMatch[],
        word: string,
        startIndex: number,
    ): boolean {
        const currentIndex = this.index;
        if (word !== "first" && word !== "last") {
            return false;
        }

        if (this.peekWord() !== "day" && this.peekWord(1) !== "of") {
            return false;
        }
        this.consumeWord(); // day
        this.consumeWord(); // of

        const monthYear = this.consumeMonthYear();
        if (!monthYear) {
            // Oops, this is not a valid month/year. Clean up and give up.
            this.seek(currentIndex);
            return false;
        } else {
            if (monthYear.precision === "month") {
                matches.push({
                    match: this.source.substring(startIndex, this.index).trim(),
                    date: monthYear.time
                        .with({ day: word === "first" ? 1 : monthYear.time.daysInMonth })
                        .startOfDay(),
                    precision: "day",
                });
            } else {
                matches.push({
                    match: this.source.substring(startIndex, this.index).trim(),
                    date: monthYear.time
                        .with({
                            month: word === "first" ? 1 : monthYear.time.monthsInYear,
                        })
                        .with({
                            day: word === "first" ? 1 : monthYear.time.daysInMonth,
                        })
                        .startOfDay(),
                    precision: "day",
                });
            }
            return true;
        }
    }

    protected detectNthWeekdayOfMonth(
        matches: AbsoluteTimeMatch[],
        word: string,
        startIndex: number,
    ): boolean {
        // Rapid check before we do more expensive operations.
        if (!/(st|nd|rd|th|ty)$/.test(word)) {
            return false;
        }

        const currentIndex = this.index;
        // Move us back so we can consume this ordinal number.
        this.seek(startIndex);
        const ordinal = this.consumeOrdinal(true);
        if (ordinal == null) {
            this.seek(currentIndex);
            return false;
        }

        const weekday = this.consumeWeekday();
        if (weekday == null) {
            // Not a weekday, clean up and give up.
            this.seek(currentIndex);
            return false;
        }
        if (this.peekWord() !== "of") {
            // Not "of" after the weekday, clean up and give up.
            this.seek(currentIndex);
            return false;
        }
        this.consumeWord(); // of

        const monthYear = this.consumeMonthYear();
        if (!monthYear) {
            // Oops, this is not a valid month/year. Clean up and give up.
            this.seek(currentIndex);
            return false;
        }

        // We have the month and year. Now to find the nth weekday of that month or year.
        if (monthYear.precision === "month") {
            // Getting the nth weekday of a month.
            // We'll allow arbitrary numbers of days, and it should bleed out into the following month.
            const reference = monthYear.time.with({ day: 1 });
            // Add as many days to get us to the correct weekday (the 1st of that weekday).
            const firstWeekdayOfType = reference.add({ days: (weekday + 7 - reference.dayOfWeek) % 7 });
            // Now add the number of weeks based on the ordinal.
            const finalDate = firstWeekdayOfType.add({ weeks: ordinal - 1 });

            matches.push({
                match: this.source.substring(startIndex, this.index).trim(),
                date: finalDate.startOfDay(),
                precision: "day",
                approximated: finalDate.month !== monthYear.time.month || finalDate.year !== monthYear.time.year,
            });
            return true;
        } else {
            // Getting the nth weekday of a year.
            // We'll allow arbitrary numbers of days, and it should bleed out into the following year.
            const reference = monthYear.time.with({ month: 1, day: 1 });
            // Add as many days to get us to the correct weekday (the 1st of that weekday).
            const firstWeekdayOfType = reference.add({ days: (weekday + 7 - reference.dayOfWeek) % 7 });
            // Now add the number of weeks based on the ordinal.
            const finalDate = firstWeekdayOfType.add({ weeks: ordinal - 1 });

            matches.push({
                match: this.source.substring(startIndex, this.index).trim(),
                date: finalDate.startOfDay(),
                precision: "day",
                approximated: finalDate.year !== monthYear.time.year,
            });
            return true;
        }
    }

    protected detectLastWeekdayOfMonth(
        matches: AbsoluteTimeMatch[],
        word: string,
        startIndex: number,
    ): boolean {
        if (word !== "last") {
            return false;
        }

        const currentIndex = this.index;
        const weekday = this.consumeWeekday();
        if (weekday == null) {
            // Not a weekday, clean up and give up.
            this.seek(currentIndex);
            return false;
        }
        if (this.peekWord() !== "of") {
            // Not "of" after the weekday, clean up and give up.
            this.seek(currentIndex);
            return false;
        }
        this.consumeWord(); // of

        const monthYear = this.consumeMonthYear();
        if (!monthYear) {
            // Oops, this is not a valid month/year. Clean up and give up.
            this.seek(currentIndex);
            return false;
        } else {
            // We have the month and year, now we need to find the last weekday of that month.
            const reference = monthYear.time.with({ day: 32 }, { overflow: "constrain" });
            // Subtract as many days to get us to the correct weekday (the last of that weekday).
            const lastWeekdayOfType = reference.subtract({ days: (reference.dayOfWeek + 7 - weekday) % 7 });
            matches.push({
                match: this.source.substring(startIndex, this.index).trim(),
                date: lastWeekdayOfType.startOfDay(),
                precision: "day",
            });
            return true;
        }
    }

    protected getUnit(word: string): DurationUnit | null {
        for (const possibleUnit in durationUnits) {
            const matching = durationUnitRegexes[possibleUnit].test(word);
            if (matching) {
                return possibleUnit as DurationUnit;
            }
        }
        return null;
    }

    protected detectOrdinalUnit(
        matches: AbsoluteTimeMatch[],
        word: string,
        startIndex: number,
    ): boolean {
        // Rapid check before we do more expensive operations.
        if (!/(st|nd|rd|th|ty)$/.test(word)) {
            return false;
        }

        const currentIndex = this.index;
        // Move us back so we can consume this ordinal number.
        this.seek(startIndex);
        const ordinal = this.consumeOrdinal(true);
        if (!ordinal) {
            this.seek(currentIndex);
            return false;
        }

        // Now attempt to consume the unit.
        const unit = this.consumeWord();
        if (!unit) {
            this.seek(currentIndex);
            return false;
        }

        const now = this.now();

        // Check if it's a valid unit.
        let date: Temporal.ZonedDateTime;
        let precision: Precision;
        switch (this.getUnit(unit)) {
            case "second":
                date = now.with({ second: 0 }).add({ seconds: ordinal - 1 });
                precision = "second";
                break;
            case "minute":
                date = now.with({ minute: 0, second: 0 }).add({ minutes: ordinal - 1 });
                precision = "minute";
                break;
            case "hour":
                date = now.startOfDay().add({ hours: ordinal - 1 });
                precision = "hour";
                break;
            case "day":
                if (ordinal > now.daysInMonth) {
                    // Invalid day.
                    this.seek(currentIndex);
                    return false;
                }
                date = now.startOfDay().with({ day: 1 }).add({ days: ordinal - 1 });
                precision = "day";
                break;
            case "week":
                // We're considering this as "week of the month" rather than "week of the year"
                date = now.startOfDay().with({ day: 1 }).add({ weeks: ordinal - 1 });
                precision = "day";
                break;
            case "month":
                if (ordinal > 12) {
                    // Invalid month.
                    this.seek(currentIndex);
                    return false;
                }
                date = now.startOfDay().with({ month: 1, day: 1 }).add({ months: ordinal - 1 });
                precision = "day";
                break;
            case "year":
                date = now.startOfDay().with({ month: 1, day: 1, year: ordinal });
                precision = "day";
                break;
            default:
                // Not a valid unit.
                this.seek(currentIndex);
                return false;
        }

        matches.push({
            match: this.source.substring(startIndex, this.index).trim(),
            date, precision,
        });
    }

    private getDateFromRelativeWeekday(weekday: number, relation: string): null | Temporal.ZonedDateTime {
        const now = this.now();
        if (combineRegex([TimeParser.NEXT_REGEX, TimeParser.THIS_REGEX], {
            trimStart: /\^/,
            trimEnd: /\$/,
            prepend: "^",
            append: "$",
        }).test(relation)) {
            const daysUntilWeekday = (weekday + 7 - now.dayOfWeek) % 7;
            const targetDate = now.add({ days: daysUntilWeekday === 0 ? 7 : daysUntilWeekday });
            return targetDate.startOfDay();
        } else if (TimeParser.PREVIOUS_REGEX.test(relation)) {
            const daysSinceWeekday = (now.dayOfWeek + 7 - weekday) % 7;
            const targetDate = now.subtract({ days: daysSinceWeekday === 0 ? 7 : daysSinceWeekday });
            return targetDate.startOfDay();
        } else if (TimeParser.THIS_REGEX.test(relation)) {
            const daysUntilWeekday = (weekday + 7 - now.dayOfWeek) % 7;
            const targetDate = now.add({ days: daysUntilWeekday });
            return targetDate.startOfDay();
        } else {
            return null;
        }
    }

    protected detectRelativeWeekday(
        matches: AbsoluteTimeMatch[],
        word: string,
        startIndex: number,
    ): boolean {
        if (!/^((next|(up)coming|this)|(last|previous|prior))$/i.test(word)) {
            return false;
        }

        const currentIndex = this.index;

        const weekday = this.consumeWeekday();
        if (weekday == null) {
            this.seek(currentIndex);
            return false;
        }

        const date = this.getDateFromRelativeWeekday(weekday, word);
        if (!date) {
            this.seek(currentIndex);
            return false;
        } else {
            matches.push({
                match: this.source.substring(startIndex, this.index).trim(),
                date,
                precision: "day",
                relative: true,
            });
            return true;
        }
    }

    protected detectRelativeWeekdayAndAbsoluteTime(
        matches: AbsoluteTimeMatch[],
        word: string,
        startIndex: number,
    ): boolean {
        if (!/^((next|(up)coming|this)|(last|previous|prior))$/i.test(word)) {
            return false;
        }

        const currentIndex = this.index;

        const weekday = this.consumeWeekday();
        if (weekday == null) {
            this.seek(currentIndex);
            return false;
        }

        const date = this.getDateFromRelativeWeekday(weekday, word);
        if (!date) {
            this.seek(currentIndex);
            return false;
        }

        if (/^(on|at|in)$/i.test(this.peekWord())) {
            // Cut out the preposition.
            this.consumeWord();
        }

        const timeOfDay = this.consumeTimeOfDay();
        if (!timeOfDay) {
            this.seek(currentIndex);
            return false;
        }
        matches.push({
            match: this.source.substring(startIndex, this.index).trim(),
            date: date.add(timeOfDay),
            precision: "day",
        });
        return true;
    }

    protected detectRelativeUnit(
        matches: AbsoluteTimeMatch[],
        word: string,
        startIndex: number,
    ): boolean {
        const currentIndex = this.index;
        if (!TimeParser.PREPOSITIONAL_REGEX.test(word)) {
            return false;
        }

        const unitWord = this.peekWord();
        if (!unitWord) {
            return false;
        }
        const unit = this.getUnit(unitWord);
        if (!unit) {
            return false;
        }
        // Consume the unit.
        this.consumeWord();

        const now = this.now();
        const precision = unitCompare("day", unit) < 0 ? "day" : unit as Precision;

        // Check if it's a valid unit.
        if (TimeParser.NEXT_REGEX.test(word.toLowerCase())) {
            matches.push({
                match: this.source.substring(startIndex, this.index).trim(),
                date: now.add({ [unitWord + "s"]: 1 }),
                precision: precision,
                relative: true,
            });
        } else if (TimeParser.PREVIOUS_REGEX.test(word.toLowerCase())) {
            matches.push({
                match: this.source.substring(startIndex, this.index).trim(),
                date: now.subtract({ [unitWord + "s"]: 1 }),
                precision: precision,
                relative: true,
            });
        } else if (TimeParser.THIS_REGEX.test(word.toLowerCase())) {
            // Discard.
            this.seek(currentIndex);
            return false;
        }
    }

    protected detectWeekdayAndRelativeTime(
        matches: AbsoluteTimeMatch[],
        word: string,
        startIndex: number,
    ): boolean {
        if (!TimeParser.WEEKDAY_DETECTION_REGEX.test(word)) {
            // We want to return early here to avoid matching things like normal "s" characters.
            // We only ever want to match on explicit weekdays.
            return false;
        }

        const currentIndex = this.index;
        this.seek(startIndex);
        const weekday = this.consumeWeekday();
        if (weekday == null) {
            this.seek(currentIndex);
            return false;
        }

        const relativeWord = this.peekWord();
        const date = this.getDateFromRelativeWeekday(weekday, relativeWord);
        if (!date) {
            matches.push({
                match: this.source.substring(startIndex, this.index).trim(),
                date: this.getDateFromRelativeWeekday(weekday, "next"),
                precision: "day",
            });
        } else {
            // Consume the relative word.
            this.consumeWord();
            if (this.peekWord() === "week") {
                // Also consume "week" if it's there.
                this.consumeWord();
            }
            matches.push({
                match: this.source.substring(startIndex, this.index).trim(),
                date,
                precision: "day",
            });
        }
        return true;
    }

    protected detectWeekdayAndAbsoluteTime(
        matches: AbsoluteTimeMatch[],
        word: string,
        startIndex: number,
    ): boolean {
        if (!TimeParser.WEEKDAY_DETECTION_REGEX.test(word)) {
            // We want to return early here to avoid matching things like normal "s" characters.
            // We only ever want to match on explicit weekdays.
            return false;
        }

        const currentIndex = this.index;
        this.seek(startIndex);
        const weekday = this.consumeWeekday();
        if (weekday == null) {
            this.seek(currentIndex);
            return false;
        }

        if (/^(on|at|in)$/i.test(this.peekWord())) {
            // Cut out the preposition.
            this.consumeWord();
        }

        const timeOfDay = this.consumeTimeOfDay();
        if (!timeOfDay) {
            this.seek(currentIndex);
            return false;
        }
        const date = this.getDateFromRelativeWeekday(weekday, "this");
        matches.push({
            match: this.source.substring(startIndex, this.index).trim(),
            date: date.add(timeOfDay),
            precision: "day",
        });
        return true;
    }

    protected consumeDurationChain(
        method: "add" | "subtract",
    ): { date: Temporal.ZonedDateTime, precision: Precision } | null {
        const durations = [];
        // Using a loop here allows us to detect "1h30m".
        let detectedDuration: Partial<Record<DurationUnit, number>> | null;
        do {
            detectedDuration = this.consumeDuration();
            if (detectedDuration !== null) {
                durations.push(detectedDuration);
            }
        } while (detectedDuration !== null);
        if (durations.length == 0) {
            // No duration found, discard.
            return null;
        }

        let date = this.now();
        let precision: DurationUnit;
        // Sum/subtract up the durations.
        for (const duration of durations) {
            // First need to convert duration to Temporal Duration objects.
            // The Temporal DurationLike interface requires plural nouns. We don't use those.
            const durationLike = Object.fromEntries(
                Object.entries(duration).map(([k, v]) => [k + "s", v]),
            );
            // Add/subtract to the timestamp.
            date = date[method](durationLike);
            // Update precision if needed.
            if (precision) {
                const smallestUnit = getSmallestDurationUnit(duration);
                precision = unitCompare(smallestUnit, precision) < 0 ? smallestUnit : precision;
            } else {
                precision = getSmallestDurationUnit(duration);
            }
        }
        const diffInMs =
            date.epochMilliseconds - this.now().epochMilliseconds;
        if (diffInMs < 900e3 && precision === "minute") {
            // The difference is less than 15 minutes. This is small enough where we should show seconds in
            // the precision anyway, even if they asked for minutes.
            precision = "second";
        } else if (unitCompare("day", precision) < 0) {
            // Clamp precision to "day".
            precision = "day";
        }

        return { date, precision: precision as Precision };
    }

    /**
     * Match prefix durations like "in 5 minutes" or "after 2 hours"
     *
     * @param matches
     * @param word
     * @param startIndex
     * @protected
     */
    protected detectPrefixDuration(
        matches: AbsoluteTimeMatch[],
        word: string,
        startIndex: number,
    ): boolean {
        if (!TimeParser.PREFIX_DURATION_REGEX.test(word)) {
            return false;
        }

        if (TimeParser.PREFIX_SKIP_WORDS[word]) {
            if (TimeParser.PREFIX_SKIP_WORDS[word].includes(this.peekWord())) {
                // Check for skippable words for specific prefix words.
                this.consumeWord();
            } else {
                // No skip word found, discard.
                return false;
            }
        }

        const duration = this.consumeDurationChain(
            TimeParser.NEGATE_DURATION_REGEX.test(word) ? "subtract" : "add",
        );
        if (!duration) {
            // No duration found.
            return false;
        }

        matches.push({
            match: this.source.substring(startIndex, this.index).trim(),
            date: duration.date,
            precision: duration.precision,
            relative: true,
        });

        return true;
    }

    /**
     * Match postfix durations like "5 minutes ago" or "2 hours from now"
     *
     * @param matches
     * @param word
     * @param startIndex
     * @protected
     */
    protected detectPostfixDuration(
        matches: AbsoluteTimeMatch[],
        word: string,
        startIndex: number,
    ): boolean {
        // Detect numbers for a duration. This does postfix matching.
        if (TimeParser.SPELLED_DURATION_REGEX.test(word) || /^\d+$/.test(word)) {
            // Reset the index so we can consume the whole thing as a duration.
            this.seek(startIndex);
        } else {
            // Not a postfix duration. Skip.
            return false;
        }

        // We don't know what direction we're going, so we'll just add the duration for now.
        const duration = this.consumeDurationChain("add");
        if (!duration) {
            // No duration found.
            return false;
        }

        // Check if there's a matching postfix word.
        const postfix = this.consumeWord();
        if (!TimeParser.POSTFIX_DURATION_REGEX.test(postfix)) {
            // No postfix word found, discard.
            return false;
        }

        // If the next word requires a match word, detect and consume it.
        if (TimeParser.POSTFIX_MATCH_WORDS[postfix]) {
            if (TimeParser.POSTFIX_MATCH_WORDS[postfix].includes(this.peekWord() || "")) {
                this.consumeWord();
            } else {
                // If the match word isn't found, discard.
                return false;
            }
        }

        // Negate the duration if needed.
        if (TimeParser.NEGATE_DURATION_REGEX.test(postfix)) {
            duration.date = this.now().subtract(
                { milliseconds: duration.date.epochMilliseconds - this.now().epochMilliseconds },
            );
        }

        matches.push({
            match: this.source.substring(startIndex, this.index).trim(),
            date: duration.date,
            precision: duration.precision,
            relative: true,
        });
    }

    /**
     * Detect osu! style durations like "match in 15, invites in 10". In this case,
     * minutes are implied.
     *
     * @param matches
     * @param _word
     * @param startIndex
     * @protected
     */
    protected detectOsuDurations(
        matches: AbsoluteTimeMatch[],
        _word: string,
        startIndex: number,
    ): boolean {
        const currentIndex = this.index;
        if (this.consumeWord() !== "in") {
            this.seek(currentIndex);
            return false;
        }

        const numbers1 = this.consumeNumbers();
        if (!numbers1) {
            this.seek(currentIndex);
            return false;
        }
        const numbers1EndIndex = this.index;
        const delim = this.consumePunctuation();
        if (!delim || !delim.startsWith(",")) {
            // Not a comma. Discard.
            this.seek(currentIndex);
            return false;
        }
        // Comma found, continue.
        // Allow for at least two padding words (to match "invites in" or "the invites in")
        const numbers2StartIndex = this.index;
        this.consumeWord();
        let numbers2: number | null;
        if (this.peekWord() === "in") {
            this.consumeWord();
            numbers2 = this.consumeNumbers();
        } else if (this.peekWord(1) === "in") {
            this.consumeWord();
            this.consumeWord();
            numbers2 = this.consumeNumbers();
        }

        if (numbers2 !== null) {
            const now = this.now();
            matches.push({
                match: this.source.substring(startIndex, numbers1EndIndex).trim(),
                date: now.add({ minutes: numbers1 }),
                precision: "minute",
                relative: true,
            });
            matches.push({
                match: this.source.substring(numbers2StartIndex, this.index).trim(),
                date: now.add({ minutes: numbers2 }),
                precision: "minute",
                relative: true,
            });
        } else {
            // Second part not matched
            this.seek(currentIndex);
            return false;
        }
    }

}
