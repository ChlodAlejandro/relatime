import { Temporal } from "temporal-polyfill";
import AbsoluteTimeParser from "../../src/parsing/AbsoluteTimeParser";

describe("AbsoluteTimeParser", () => {

    const simpleTests: Record<string, (now: Temporal.ZonedDateTime) => Temporal.ZonedDateTime> = {
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
        "Monday":
            (now) => {
                const daysUntilMonday = (1 + 7 - now.dayOfWeek) % 7;
                return now.add({ days: daysUntilMonday === 0 ? 7 : daysUntilMonday }).startOfDay();
            },
    };

    const timezone = "UTC";
    const now = Temporal.Now.zonedDateTimeISO(timezone);

    test.each(Object.keys(simpleTests))("should parse '%s' correctly", (input) => {
        const parser = new AbsoluteTimeParser(input, timezone);
        const results = parser.parse();

        expect(results).toHaveLength(1);

        const expectedDate = simpleTests[input](now);
        const actualDate = results[0].date;

        expect(actualDate.toInstant().toString({ timeZone: "UTC" }))
            .toBe(expectedDate.toInstant().toString({ timeZone: "UTC" }));
    });

    test("concatenated test (simples)", () => {
        const concatenated = Object.keys(simpleTests).join(", ");
        const matches = new AbsoluteTimeParser(concatenated, timezone).parse();
        expect(matches).toHaveLength(Object.keys(simpleTests).length);
        matches.forEach((match, i) => {
            const input = Object.keys(simpleTests)[i];
            const expectedDate = simpleTests[input](now);

            expect(match.date.toInstant().toString({ timeZone: "UTC" }))
                .toBe(expectedDate.toInstant().toString({ timeZone: "UTC" }));
        });
    });

    test("inside of misc. text", () => {
        const text = "strinova at 9pm?";
        const matches = new AbsoluteTimeParser(text, "Asia/Manila").parse();
        expect(matches).toHaveLength(1);
        expect(matches[0].match).toBe("at 9pm");
        expect(matches[0].date.toInstant().toString({ timeZone: "UTC" }))
            .toBe(now.startOfDay().add({ hours: 13 }).toInstant().toString({ timeZone: "UTC" }));
    });

    test("should handle empty input", () => {
        const parser = new AbsoluteTimeParser("", timezone);
        const results = parser.parse();
        expect(results).toHaveLength(0);
    });

    test("should handle invalid input", () => {
        const parser = new AbsoluteTimeParser("invalid text", timezone);
        const results = parser.parse();
        expect(results).toHaveLength(0);
    });

    test("should handle timezone offset as number", () => {
        const parser = new AbsoluteTimeParser("today", 5);
        const results = parser.parse();
        expect(results).toHaveLength(1);
        expect(results[0].date.timeZoneId).toBe("+05:00");
    });

    test("should handle arbitrary timezones", () => {
        const parser = new AbsoluteTimeParser("today", 5 + (18 / 60));
        const results = parser.parse();
        expect(results).toHaveLength(1);
        expect(results[0].date.timeZoneId).toBe("+05:18");
    });

    test("should handle negative timezone offset", () => {
        const parser = new AbsoluteTimeParser("today", -8);
        const results = parser.parse();
        expect(results).toHaveLength(1);
        expect(results[0].date.timeZoneId).toBe("-08:00");
    });
});
