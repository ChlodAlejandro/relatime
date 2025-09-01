import { Temporal } from "temporal-polyfill";
import { log } from "../util/log.ts";
import { durationUnitRegexes } from "./Duration.ts";
import TimeParser from "./TimeParser.ts";

export interface AbsoluteTimeMatch {
    match: string;
    /** The date that represents this given absolute time */
    date: Temporal.ZonedDateTime;
    precision: "second" | "minute" | "hour" | "day";
    approximated?: boolean;
}

export default class AbsoluteTimeParser extends TimeParser {

    private readonly timeZoneId: string;

    constructor(text: string, timezone: string | number) {
        super(text);

        this.timeZoneId = typeof timezone === "string" ? timezone : (
            (timezone < 0 ? "-" : "+") +
            Math.floor(Math.abs(timezone)).toString().padStart(2, "0") +
            ":" +
            (Math.round(Math.abs(timezone % 1) * 60)).toString().padStart(2, "0")
        );
    }

    public parse(): AbsoluteTimeMatch[] {
        const matches: (AbsoluteTimeMatch | null)[] = [];

        // Go through each word and see if it matches an expression we need.
        const lastIndex = this.index;
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
            if (this.detectFirstAndLastDays(matches, word, startIndex))
                continue;
            if (this.detectNthWeekdayOfMonth(matches, word, startIndex))
                continue;
            if (this.detectLastWeekdayOfMonth(matches, word, startIndex))
                continue;
            if (this.detectWeekdayAndRelativeTime(matches, word, startIndex))
                continue;
            if (this.detectRelativeWeekday(matches, word, startIndex))
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

            if (lastIndex === this.index) {
                log.warn("Parser did not advance!");
                // No progress made, consume a character to avoid infinite loops.
                this.consume();
            }
        } while (!this.isEmpty());

        return matches
            .filter(v => !!v);
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
        const yesterday = Temporal.Now.zonedDateTimeISO(this.timeZoneId)
            .subtract({ days: 1 });
        return this.getKeywordAndTimeDetector("yesterday", yesterday)(matches, word, startIndex);
    }

    protected detectToday(
        matches: AbsoluteTimeMatch[],
        word: string,
        startIndex: number,
    ): boolean {
        const today = Temporal.Now.zonedDateTimeISO(this.timeZoneId);
        return this.getKeywordAndTimeDetector("today", today)(matches, word, startIndex);
    }

    protected detectTomorrow(
        matches: AbsoluteTimeMatch[],
        word: string,
        startIndex: number,
    ): boolean {
        const tomorrow = Temporal.Now.zonedDateTimeISO(this.timeZoneId)
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

        const today = Temporal.Now.zonedDateTimeISO(this.timeZoneId)
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

        const today = Temporal.Now.zonedDateTimeISO(this.timeZoneId)
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

        const today = Temporal.Now.zonedDateTimeISO(this.timeZoneId)
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

        const today = Temporal.Now.zonedDateTimeISO(this.timeZoneId)
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

        const monthYear = this.consumeMonthYear(this.timeZoneId);
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

        const monthYear = this.consumeMonthYear(this.timeZoneId);
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

        const weekday = this.consumeWeekday();
        if (weekday == null) {
            // Not a weekday, clean up and give up.
            return false;
        }
        if (this.peekWord() !== "of") {
            // Not "of" after the weekday, clean up and give up.
            return false;
        }
        this.consumeWord(); // of

        const monthYear = this.consumeMonthYear(this.timeZoneId);
        if (!monthYear) {
            // Oops, this is not a valid month/year. Clean up and give up.
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

        const now = Temporal.Now.zonedDateTimeISO(this.timeZoneId);

        // Check if it's a valid unit.
        if (durationUnitRegexes.second.test(unit)) {
            matches.push({
                match: this.source.substring(startIndex, this.index).trim(),
                date: now.with({ second: 0 }).add({ seconds: ordinal - 1 }),
                precision: "second",
            });
        } else if (durationUnitRegexes.minute.test(unit)) {
            matches.push({
                match: this.source.substring(startIndex, this.index).trim(),
                date: now.with({ minute: 0, second: 0 }).add({ minutes: ordinal - 1 }),
                precision: "minute",
            });
        } else if (durationUnitRegexes.hour.test(unit)) {
            matches.push({
                match: this.source.substring(startIndex, this.index).trim(),
                date: now.startOfDay().add({ hours: ordinal - 1 }),
                precision: "hour",
            });
        } else if (durationUnitRegexes.day.test(unit)) {
            if (ordinal > now.daysInMonth) {
                // Invalid day.
                this.seek(currentIndex);
                return false;
            }
            matches.push({
                match: this.source.substring(startIndex, this.index).trim(),
                date: now.startOfDay().with({ day: 1 }).add({ days: ordinal - 1 }),
                precision: "day",
            });
        } else if (durationUnitRegexes.week.test(unit)) {
            // We're considering this as "week of the month" rather than "week of the year".
            matches.push({
                match: this.source.substring(startIndex, this.index).trim(),
                date: now.startOfDay().with({ day: 1 }).add({ weeks: ordinal - 1 }),
                precision: "day",
            });
        } else if (durationUnitRegexes.month.test(unit)) {
            if (ordinal > 12) {
                // Invalid month.
                this.seek(currentIndex);
                return false;
            }
            matches.push({
                match: this.source.substring(startIndex, this.index).trim(),
                date: now.startOfDay().with({ month: 1, day: 1 }).add({ months: ordinal - 1 }),
                precision: "day",
            });
        } else if (durationUnitRegexes.year.test(unit)) {
            matches.push({
                match: this.source.substring(startIndex, this.index).trim(),
                date: now.startOfDay().with({ month: 1, day: 1, year: ordinal }),
                precision: "day",
            });
        }
    }

    private getDateFromRelativeWeekday(weekday: number, relation: string): null | Temporal.ZonedDateTime {
        if (/next|(up)coming|this/i.test(relation)) {
            const now = Temporal.Now.zonedDateTimeISO(this.timeZoneId);
            const daysUntilWeekday = (weekday + 7 - now.dayOfWeek) % 7;
            const targetDate = now.add({ days: daysUntilWeekday === 0 ? 7 : daysUntilWeekday });
            return targetDate.startOfDay();
        } else if (/last|previous|prior/i.test(relation)) {
            const now = Temporal.Now.zonedDateTimeISO(this.timeZoneId);
            const daysSinceWeekday = (now.dayOfWeek + 7 - weekday) % 7;
            const targetDate = now.subtract({ days: daysSinceWeekday === 0 ? 7 : daysSinceWeekday });
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
            });
            return true;
        }
    }

    protected detectWeekdayAndRelativeTime(
        matches: AbsoluteTimeMatch[],
        _word: string,
        startIndex: number,
    ): boolean {
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
            matches.push({
                match: this.source.substring(startIndex, this.index).trim(),
                date,
                precision: "day",
            });
        }
        return true;
    }

}
