import { Temporal } from "temporal-polyfill";
import TimeParser from "../../src/parsing/TimeParser.ts";

describe("TimeParser", () => {

    const simpleTests: Record<string, (now: Temporal.ZonedDateTime) => Temporal.ZonedDateTime> = {
        // Absolute time
        "yesterday":
            (now) => now.subtract({ days: 1 }).startOfDay(),
        "yesterday 14:00":
            (now) => now.subtract({ days: 1 }).startOfDay().add({ hours: 14 }),
        "yesterday noon":
            (now) => now.subtract({ days: 1 }).startOfDay().add({ hours: 12 }),
        "today":
            (now) => now.startOfDay(),
        "today 4pm":
            (now) => now.startOfDay().add({ hours: 16 }),
        "tomorrow":
            (now) => now.add({ days: 1 }).startOfDay(),
        "tomorrow 12p.m.":
            (now) => now.add({ days: 1 }).startOfDay().add({ hours: 12 }),
        "midnight":
            (now) => now.startOfDay(),
        "noon":
            (now) => now.startOfDay().add({ hours: 12 }),
        "morning":
            (now) => now.startOfDay().add({ hours: 6 }),
        "afternoon":
            (now) => now.startOfDay().add({ hours: 15 }),
        "evening":
            (now) => now.startOfDay().add({ hours: 18 }),
        "back of 7am":
            (now) => now.startOfDay().add({ hours: 7, minutes: 15 }),
        "back of 15":
            (now) => now.startOfDay().add({ hours: 15, minutes: 15 }),
        "front of 5am":
            (now) => now.startOfDay().add({ hours: 5 }).subtract({ minutes: 15 }),
        "front of 23":
            (now) => now.startOfDay().add({ hours: 23 }).subtract({ minutes: 15 }),
        "first day of February 2008":
            () => Temporal.ZonedDateTime.from({ year: 2008, month: 2, day: 1, timeZone: timezone }),
        "first day of 2008":
            () => Temporal.ZonedDateTime.from({ year: 2008, month: 1, day: 1, timeZone: timezone }),
        "first day of next month":
            (now) => now.add({ months: 1 }).with({ day: 1 }).startOfDay(),
        "first day of last month":
            (now) => now.subtract({ months: 1 }).with({ day: 1 }).startOfDay(),
        "first day of previous month":
            (now) => now.subtract({ months: 1 }).with({ day: 1 }).startOfDay(),
        "first day of this month":
            (now) => now.with({ day: 1 }).startOfDay(),
        "last day of February 2008":
            () => {
                const feb2008 = Temporal.ZonedDateTime.from({ year: 2008, month: 2, day: 1, timeZone: timezone });
                return feb2008.with({ day: feb2008.daysInMonth }).startOfDay();
            },
        "last day of 2008":
            () => Temporal.ZonedDateTime.from({ year: 2008, month: 12, day: 31, timeZone: timezone }),
        "last day of next month":
            (now) => {
                const nextMonth = now.add({ months: 1 });
                return nextMonth.with({ day: nextMonth.daysInMonth }).startOfDay();
            },
        "last day of last month":
            (now) => {
                const lastMonth = now.subtract({ months: 1 });
                return lastMonth.with({ day: lastMonth.daysInMonth }).startOfDay();
            },
        "last day of previous month":
            (now) => {
                const prevMonth = now.subtract({ months: 1 });
                return prevMonth.with({ day: prevMonth.daysInMonth }).startOfDay();
            },
        "last day of this month":
            (now) => now.with({ day: now.daysInMonth }).startOfDay(),
        "first sun of July 2008":
            () => {
                const july2008 = Temporal.ZonedDateTime.from({ year: 2008, month: 7, day: 1, timeZone: timezone });
                const daysToSunday = (7 - july2008.dayOfWeek) % 7;
                return july2008.add({ days: daysToSunday }).startOfDay();
            },
        "first sun of last month":
            (now) => {
                const lastMonth = now.subtract({ months: 1 }).with({ day: 1 });
                const daysToSunday = (7 - lastMonth.dayOfWeek) % 7;
                return lastMonth.add({ days: daysToSunday }).startOfDay();
            },
        "last sun of July 2008":
            () => {
                const july2008End = Temporal.ZonedDateTime.from({ year: 2008, month: 7, day: 31, timeZone: timezone });
                const daysFromSunday = (july2008End.dayOfWeek) % 7;
                return july2008End.subtract({ days: daysFromSunday }).startOfDay();
            },
        "last sun of last month":
            (now) => {
                const lastMonth = now.subtract({ months: 1 });
                const lastDayOfMonth = lastMonth.with({ day: lastMonth.daysInMonth });
                const daysFromSunday = (lastDayOfMonth.dayOfWeek) % 7;
                return lastDayOfMonth.subtract({ days: daysFromSunday }).startOfDay();
            },
        "fifth day":
            (now) => now.with({ day: 5 }).startOfDay(),
        "second month":
            (now) => now.with({ month: 2, day: 1 }).startOfDay(),
        "last day":
            (now) => now.subtract({ days: 1 }),
        "previous year":
            (now) => now.subtract({ years: 1 }),
        "Monday":
            (now) => {
                const daysUntilMonday = (1 + 7 - now.dayOfWeek) % 7;
                return now.add({ days: daysUntilMonday === 0 ? 7 : daysUntilMonday }).startOfDay();
            },
        "Monday next week":
            (now) => {
                const daysUntilMonday = (1 + 7 - now.dayOfWeek) % 7;
                const targetDate = now.add({ days: daysUntilMonday === 0 ? 7 : daysUntilMonday });
                return targetDate.startOfDay();
            },
        "Monday at 5 pm":
            (now) => {
                const daysUntilMonday = (1 + 7 - now.dayOfWeek) % 7;
                return now.add({ days: daysUntilMonday === 0 ? 7 : daysUntilMonday }).startOfDay().add({ hours: 17 });
            },
        "next Monday at 5 pm":
            (now) => {
                const daysUntilMonday = (1 + 7 - now.dayOfWeek) % 7;
                return now.add({ days: daysUntilMonday === 0 ? 7 : daysUntilMonday }).startOfDay().add({ hours: 17 });
            },
        "Monday 5 pm":
            (now) => {
                const daysUntilMonday = (1 + 7 - now.dayOfWeek) % 7;
                return now.add({ days: daysUntilMonday === 0 ? 7 : daysUntilMonday }).startOfDay().add({ hours: 17 });
            },
        "2 a.m.":
            (now) => now.startOfDay().add({ hours: 2 }),
        "11 p.m.":
            (now) => now.startOfDay().add({ hours: 23 }),
        "5pm":
            (now) => now.startOfDay().add({ hours: 17 }),
        "9 pm":
            (now) => now.startOfDay().add({ hours: 21 }),
        "12am":
            (now) => now.startOfDay(),
        "12pm":
            (now) => now.startOfDay().add({ hours: 12 }),
        // Relative time
        "in 4 hours":
            (now) => now.add({ hours: 4 }),
        "after 1 week":
            (now) => now.add({ weeks: 1 }),
        "within 2 days":
            (now) => now.add({ days: 2 }),
        "give me 10 minutes":
            (now) => now.add({ minutes: 10 }),
        "gimme 1 hour":
            (now) => now.add({ hours: 1 }),
        "just 30 seconds":
            (now) => now.add({ seconds: 30 }),
        "5 minutes ago":
            (now) => now.subtract({ minutes: 5 }),
        "2 hours prior":
            (now) => now.subtract({ hours: 2 }),
        "3 hours from now":
            (now) => now.add({ hours: 3 }),
        "in 45s":
            (now) => now.add({ seconds: 45 }),
        "in 300 sec":
            (now) => now.add({ seconds: 300 }),
        "in 20m":
            (now) => now.add({ minutes: 20 }),
        "in 15 min":
            (now) => now.add({ minutes: 15 }),
        "in 12h":
            (now) => now.add({ hours: 12 }),
        "in 6 hr":
            (now) => now.add({ hours: 6 }),
        "in 3d":
            (now) => now.add({ days: 3 }),
        "in 2w":
            (now) => now.add({ weeks: 2 }),
        "in 1 wk":
            (now) => now.add({ weeks: 1 }),
        "in 4mo":
            (now) => now.add({ months: 4 }),
        "in 2 mon":
            (now) => now.add({ months: 2 }),
        "in 1y":
            (now) => now.add({ years: 1 }),
        "in 3 yr":
            (now) => now.add({ years: 3 }),
        "in 1h 30m":
            (now) => now.add({ hours: 1, minutes: 30 }),
        "in 2d4h15m":
            (now) => now.add({ days: 2, hours: 4, minutes: 15 }),
        "in 2 hours 30 minutes":
            (now) => now.add({ hours: 2, minutes: 30 }),
        // Long text
        "just 1 asdkjashfakjsfhadfsklasjdkljasdlkj hour":
            (now) => now.add({ hours: 1 }),
    };

    const timezone = "America/New_York";
    const stringifyOptions = <const>{ timeZone: "UTC", smallestUnit: "second" };
    const now = Temporal.Now.zonedDateTimeISO(timezone);

    jest.spyOn(TimeParser.prototype, "now").mockImplementation(function (this: TimeParser) {
        return this.timeZoneId === timezone ? now : now.withTimeZone(this.timeZoneId);
    });

    test.each(Object.keys(simpleTests))("should parse '%s' correctly", (input) => {
        const parser = new TimeParser(input, timezone);
        const results = parser.parse();

        expect(results).toHaveLength(1);

        const expectedDate = simpleTests[input](now);
        const actualDate = results[0].date;

        expect(actualDate.toInstant().toString(stringifyOptions))
            .toBe(expectedDate.toInstant().toString(stringifyOptions));
    });

    test("concatenated test (simples)", () => {
        const concatenated = Object.keys(simpleTests).join(", ");
        const matches = new TimeParser(concatenated, timezone).parse();
        expect(matches).toHaveLength(Object.keys(simpleTests).length);
        matches.forEach((match, i) => {
            const input = Object.keys(simpleTests)[i];
            const expectedDate = simpleTests[input](now);

            expect(match.date.toInstant().toString(stringifyOptions))
                .toBe(expectedDate.toInstant().toString(stringifyOptions));
        });
    });

    test("inside of misc. text (absolute)", () => {
        const text = "strinova at 9pm?";
        const matches = new TimeParser(text, timezone).parse();
        expect(matches).toHaveLength(1);
        expect(matches[0].match).toBe("at 9pm");
        expect(matches[0].date.toInstant().toString(stringifyOptions))
            .toBe(now.startOfDay().add({ hours: 21 }).toInstant().toString(stringifyOptions));
    });

    test("inside of misc. text (relative)", () => {
        const text = "Let's meet in 2 hours, or maybe after 30 minutes. I don't want to wait more than 1 day.";
        const matches = new TimeParser(text, timezone).parse();
        expect(matches).toHaveLength(2);
        expect(matches[0].match).toBe("in 2 hours");
        expect(matches[0].date.toInstant().toString(stringifyOptions))
            .toBe(now.add({ hours: 2 }).toInstant().toString(stringifyOptions));
        expect(matches[1].match).toBe("after 30 minutes");
        expect(matches[1].date.toInstant().toString(stringifyOptions))
            .toBe(now.add({ minutes: 30 }).toInstant().toString(stringifyOptions));
    });

    it("parses a valid duration with shorthand unit", () => {
        const parser = new TimeParser("5h", timezone);
        expect(parser.consumeDuration()).toEqual({ hour: 5 });
    });

    it("parses a valid duration with full unit", () => {
        const parser = new TimeParser("2 hours", timezone);
        expect(parser.consumeDuration()).toEqual({ hour: 2 });
    });

    it("returns null for invalid duration", () => {
        const parser = new TimeParser("durf hours", timezone);
        expect(parser.consumeDuration()).toBeNull();
    });

    it("parses a valid time of day with meridian", () => {
        const parser = new TimeParser("1:30pm", timezone);
        expect(parser.consumeTimeOfDay()).toEqual({ days: 0, hours: 13, minutes: 30, seconds: 0 });
    });

    it("parses a valid time of day without meridian", () => {
        const parser = new TimeParser("13:45", timezone);
        expect(parser.consumeTimeOfDay()).toEqual({ days: 0, hours: 13, minutes: 45, seconds: 0 });
    });

    it("parses a non-normal time of day", () => {
        const parser = new TimeParser("25:00", timezone);
        expect(parser.consumeTimeOfDay()).toEqual({ days: 1, hours: 1, minutes: 0, seconds: 0 });
    });

    it("returns null for invalid time of day", () => {
        // 1:00 is supported, of course.
        expect(new TimeParser("100:1", timezone).consumeTimeOfDay()).toEqual(null);
        expect(new TimeParser("16:9", timezone).consumeTimeOfDay()).toEqual(null);
        expect(new TimeParser("4:3", timezone).consumeTimeOfDay()).toEqual(null);
        expect(new TimeParser("100:00", timezone).consumeTimeOfDay()).toEqual(null);
        expect(new TimeParser("00:100", timezone).consumeTimeOfDay()).toEqual(null);
    });

    it("parses a valid month and year", () => {
        const parser = new TimeParser("September 2023", timezone);
        const result = parser.consumeMonthYear();
        expect(result?.time.toInstant().toString(stringifyOptions))
            .toBe(
                Temporal.ZonedDateTime
                    .from({ year: 2023, month: 9, day: 1, timeZone: timezone })
                    .toInstant()
                    .toString(stringifyOptions),
            );
        expect(result?.precision).toBe("month");
    });

    it("parses a valid year and month", () => {
        const parser = new TimeParser("2023 September", timezone);
        const result = parser.consumeMonthYear();
        expect(result?.time.toInstant().toString(stringifyOptions))
            .toBe(
                Temporal.ZonedDateTime
                    .from({ year: 2023, month: 9, day: 1, timeZone: timezone })
                    .toInstant()
                    .toString(stringifyOptions),
            );
        expect(result?.precision).toBe("month");
    });

    it("parses a valid year only", () => {
        const parser = new TimeParser("2025", timezone);
        const result = parser.consumeMonthYear();
        expect(result?.time.toInstant().toString(stringifyOptions))
            .toBe(
                Temporal.ZonedDateTime
                    .from({ year: 2025, month: 1, day: 1, timeZone: timezone })
                    .toInstant()
                    .toString(stringifyOptions),
            );
        expect(result?.precision).toBe("year");
    });

    it("parses a month only", () => {
        const parser = new TimeParser("September", timezone);
        const result = parser.consumeMonthYear();
        expect(result?.time.toInstant().toString(stringifyOptions))
            .toBe(
                Temporal.Now.zonedDateTimeISO(timezone)
                    .with({ month: 9, day: 1 })
                    .startOfDay()
                    .toInstant()
                    .toString(stringifyOptions),
            );
        expect(result?.precision).toBe("month");
    });

    it("returns null for invalid month and year", () => {
        const parser = new TimeParser("InvalidMonth 2023", timezone);
        expect(parser.consumeMonthYear()).toBeNull();
    });

    it("parses a relative month", () => {
        const now = Temporal.Now.zonedDateTimeISO(timezone);
        expect(new TimeParser("next month", timezone).consumeMonthYear()?.time?.month)
            .toBe(now.add({ months: 1 }).month);
        expect(new TimeParser("the next month", timezone).consumeMonthYear()?.time?.month)
            .toBe(now.add({ months: 1 }).month);
        expect(new TimeParser("last month", timezone).consumeMonthYear()?.time?.month)
            .toBe(now.subtract({ months: 1 }).month);
        expect(new TimeParser("previous month", timezone).consumeMonthYear()?.time?.month)
            .toBe(now.subtract({ months: 1 }).month);
        expect(new TimeParser("the prior month", timezone).consumeMonthYear()?.time?.month)
            .toBe(now.subtract({ months: 1 }).month);
        expect(new TimeParser("this month", timezone).consumeMonthYear()?.time?.month)
            .toBe(now.month);
        expect(new TimeParser("the current month", timezone).consumeMonthYear()?.time?.month)
            .toBe(now.month);
        expect(new TimeParser("now month", timezone).consumeMonthYear()?.time?.month)
            .toBe(now.month);
    });

    it("parses a relative year", () => {
        const now = Temporal.Now.zonedDateTimeISO(timezone);
        expect(new TimeParser("next year", timezone).consumeMonthYear()?.time?.year)
            .toBe(now.add({ years: 1 }).year);
        expect(new TimeParser("the next year", timezone).consumeMonthYear()?.time?.year)
            .toBe(now.add({ years: 1 }).year);
        expect(new TimeParser("last year", timezone).consumeMonthYear()?.time?.year)
            .toBe(now.subtract({ years: 1 }).year);
        expect(new TimeParser("previous year", timezone).consumeMonthYear()?.time?.year)
            .toBe(now.subtract({ years: 1 }).year);
        expect(new TimeParser("the prior year", timezone).consumeMonthYear()?.time?.year)
            .toBe(now.subtract({ years: 1 }).year);
        expect(new TimeParser("this year", timezone).consumeMonthYear()?.time?.year)
            .toBe(now.year);
        expect(new TimeParser("the current year", timezone).consumeMonthYear()?.time?.year)
            .toBe(now.year);
        expect(new TimeParser("now year", timezone).consumeMonthYear()?.time?.year)
            .toBe(now.year);
    });

    it("parses a month after relative", () => {
        const now = Temporal.Now.zonedDateTimeISO(timezone);
        expect(new TimeParser("month after last", timezone).consumeMonthYear()?.time?.month)
            .toBe(now.month);
        expect(new TimeParser("month after now", timezone).consumeMonthYear()?.time?.month)
            .toBe(now.add({ months: 1 }).month);
        expect(new TimeParser("month after next", timezone).consumeMonthYear()?.time?.month)
            .toBe(now.add({ months: 2 }).month);
        expect(new TimeParser("month before last", timezone).consumeMonthYear()?.time?.month)
            .toBe(now.subtract({ months: 2 }).month);
        expect(new TimeParser("month before now", timezone).consumeMonthYear()?.time?.month)
            .toBe(now.subtract({ months: 1 }).month);
        expect(new TimeParser("month before next", timezone).consumeMonthYear()?.time?.month)
            .toBe(now.month);
        expect(new TimeParser("month following following", timezone).consumeMonthYear()?.time?.month)
            .toBe(now.add({ months: 2 }).month);
    });

    it("parses a year after relative", () => {
        const now = Temporal.Now.zonedDateTimeISO(timezone);
        expect(new TimeParser("year after last", timezone).consumeMonthYear()?.time?.year)
            .toBe(now.year);
        expect(new TimeParser("year after now", timezone).consumeMonthYear()?.time?.year)
            .toBe(now.add({ years: 1 }).year);
        expect(new TimeParser("year after next", timezone).consumeMonthYear()?.time?.year)
            .toBe(now.add({ years: 2 }).year);
        expect(new TimeParser("year before last", timezone).consumeMonthYear()?.time?.year)
            .toBe(now.subtract({ years: 2 }).year);
        expect(new TimeParser("year before now", timezone).consumeMonthYear()?.time?.year)
            .toBe(now.subtract({ years: 1 }).year);
        expect(new TimeParser("year before next", timezone).consumeMonthYear()?.time?.year)
            .toBe(now.year);
        expect(new TimeParser("year following following", timezone).consumeMonthYear()?.time?.year)
            .toBe(now.add({ years: 2 }).year);
    });

    it("parses a weekday", () => {
        expect(new TimeParser("monday", timezone).consumeWeekday()).toBe(1);
        expect(new TimeParser("tue", timezone).consumeWeekday()).toBe(2);
        expect(new TimeParser("Wednesday", timezone).consumeWeekday()).toBe(3);
        expect(new TimeParser("THU", timezone).consumeWeekday()).toBe(4);
        expect(new TimeParser("friday", timezone).consumeWeekday()).toBe(5);
        expect(new TimeParser("sat", timezone).consumeWeekday()).toBe(6);
        expect(new TimeParser("sun", timezone).consumeWeekday()).toBe(0);
        expect(new TimeParser("invalidday", timezone).consumeWeekday()).toBeNull();
    });

    it("should handle empty input", () => {
        const parser = new TimeParser("", timezone);
        const results = parser.parse();
        expect(results).toHaveLength(0);
    });

    it("should handle invalid input", () => {
        const parser = new TimeParser("invalid text", timezone);
        const results = parser.parse();
        expect(results).toHaveLength(0);
    });

    it("should handle arbitrary timezones", () => {
        const parser = new TimeParser("today", "+05:18");
        const results = parser.parse();
        expect(results).toHaveLength(1);
        expect(results[0].date.timeZoneId).toBe("+05:18");
    });

    it("should handle negative timezone offset", () => {
        const parser = new TimeParser("today", "-08:00");
        const results = parser.parse();
        expect(results).toHaveLength(1);
        expect(results[0].date.timeZoneId).toBe("-08:00");
    });

    it("should handle timezone offset 23:59", () => {
        const parser = new TimeParser("today", "+23:59");
        const results = parser.parse();
        expect(results).toHaveLength(1);
        expect(results[0].date.timeZoneId).toBe("+23:59");
    });

    it("match in 15, invites in 10", () => {
        const parser = new TimeParser("match in 15, invites in 10", timezone);
        const results = parser.parse();
        expect(results).toHaveLength(2);
        expect(results[0].match).toBe("match in 15");
        expect(results[0].date.toInstant().toString(stringifyOptions))
            .toBe(now.add({ minutes: 15 }).toInstant().toString(stringifyOptions));
        expect(results[1].match).toBe("invites in 10");
        expect(results[1].date.toInstant().toString(stringifyOptions))
            .toBe(now.add({ minutes: 10 }).toInstant().toString(stringifyOptions));
    });

    it("edge: missing unit", () => {
        const matches = new TimeParser("in 2", timezone).parse();
        expect(matches).toHaveLength(0);

        const matches2 = new TimeParser("just a", timezone).parse();
        expect(matches2).toHaveLength(0);
    });

    it("edge: double units", () => {
        const matches = new TimeParser("in 2 hours minutes", timezone).parse();
        expect(matches).toHaveLength(1);
        expect(matches[0].match).toBe("in 2 hours");
        expect(matches[0].date.toInstant().toString(stringifyOptions))
            .toBe(now.add({ hours: 2 }).toInstant().toString(stringifyOptions));
    });

});
