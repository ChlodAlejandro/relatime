import TimeParser from "../../src/parsing/TimeParser";
import { Temporal } from "temporal-polyfill";

describe("TimeParser", () => {
    it("parses a valid duration with shorthand unit", () => {
        const parser = new TimeParser("5h");
        expect(parser.consumeDuration()).toBe(18000);
    });

    it("parses a valid duration with full unit", () => {
        const parser = new TimeParser("2 hours");
        expect(parser.consumeDuration()).toBe(7200);
    });

    it("returns null for invalid duration", () => {
        const parser = new TimeParser("durf hours");
        expect(parser.consumeDuration()).toBeNull();
    });

    it("parses a valid time of day with meridian", () => {
        const parser = new TimeParser("1:30pm");
        expect(parser.consumeTimeOfDay()).toEqual({ days: 0, hours: 13, minutes: 30, seconds: 0 });
    });

    it("parses a valid time of day without meridian", () => {
        const parser = new TimeParser("13:45");
        expect(parser.consumeTimeOfDay()).toEqual({ days: 0, hours: 13, minutes: 45, seconds: 0 });
    });

    it("parses a non-normal time of day", () => {
        const parser = new TimeParser("25:00");
        expect(parser.consumeTimeOfDay()).toEqual({ days: 1, hours: 1, minutes: 0, seconds: 0 });
    });

    it("returns null for invalid time of day", () => {
        // 1:00 is supported, of course.
        expect(new TimeParser("100:1").consumeTimeOfDay()).toEqual(null);
        expect(new TimeParser("16:9").consumeTimeOfDay()).toEqual(null);
        expect(new TimeParser("4:3").consumeTimeOfDay()).toEqual(null);
        expect(new TimeParser("100:00").consumeTimeOfDay()).toEqual(null);
        expect(new TimeParser("00:100").consumeTimeOfDay()).toEqual(null);
    });

    it("parses a valid month and year", () => {
        const parser = new TimeParser("January 2023");
        const result = parser.consumeMonthYear("UTC");
        expect(result?.time.toString()).toContain("2023-01-01T00:00:00+00:00[UTC]");
        expect(result?.precision).toBe("month");
    });

    it("parses a valid year and month", () => {
        const parser = new TimeParser("2023 January");
        const result = parser.consumeMonthYear("UTC");
        expect(result?.time.toString()).toContain("2023-01-01T00:00:00+00:00[UTC]");
        expect(result?.precision).toBe("month");
    });

    it("parses a valid year only", () => {
        const parser = new TimeParser("2025");
        const result = parser.consumeMonthYear("UTC");
        expect(result?.time.toString()).toContain("2025-01-01T00:00:00+00:00[UTC]");
        expect(result?.precision).toBe("year");
    });

    it("parses a month only", () => {
        const currentYearUTC = Temporal.Now.zonedDateTimeISO("UTC").year;
        const parser = new TimeParser("January");
        const result = parser.consumeMonthYear("UTC");
        expect(result?.time.toString()).toContain(`${currentYearUTC}-01-01T00:00:00+00:00[UTC]`);
        expect(result?.precision).toBe("month");
    });

    it("returns null for invalid month and year", () => {
        const parser = new TimeParser("InvalidMonth 2023");
        expect(parser.consumeMonthYear("UTC")).toBeNull();
    });

    it("parses a relative month", () => {
        const now = Temporal.Now.zonedDateTimeISO("UTC");
        expect(new TimeParser("next month").consumeMonthYear("UTC")?.time?.month)
            .toBe(now.add({ months: 1 }).month);
        expect(new TimeParser("the next month").consumeMonthYear("UTC")?.time?.month)
            .toBe(now.add({ months: 1 }).month);
        expect(new TimeParser("last month").consumeMonthYear("UTC")?.time?.month)
            .toBe(now.subtract({ months: 1 }).month);
        expect(new TimeParser("previous month").consumeMonthYear("UTC")?.time?.month)
            .toBe(now.subtract({ months: 1 }).month);
        expect(new TimeParser("the prior month").consumeMonthYear("UTC")?.time?.month)
            .toBe(now.subtract({ months: 1 }).month);
        expect(new TimeParser("this month").consumeMonthYear("UTC")?.time?.month)
            .toBe(now.month);
        expect(new TimeParser("the current month").consumeMonthYear("UTC")?.time?.month)
            .toBe(now.month);
        expect(new TimeParser("now month").consumeMonthYear("UTC")?.time?.month)
            .toBe(now.month);
    });

    it("parses a relative year", () => {
        const now = Temporal.Now.zonedDateTimeISO("UTC");
        expect(new TimeParser("next year").consumeMonthYear("UTC")?.time?.year)
            .toBe(now.add({ years: 1 }).year);
        expect(new TimeParser("the next year").consumeMonthYear("UTC")?.time?.year)
            .toBe(now.add({ years: 1 }).year);
        expect(new TimeParser("last year").consumeMonthYear("UTC")?.time?.year)
            .toBe(now.subtract({ years: 1 }).year);
        expect(new TimeParser("previous year").consumeMonthYear("UTC")?.time?.year)
            .toBe(now.subtract({ years: 1 }).year);
        expect(new TimeParser("the prior year").consumeMonthYear("UTC")?.time?.year)
            .toBe(now.subtract({ years: 1 }).year);
        expect(new TimeParser("this year").consumeMonthYear("UTC")?.time?.year)
            .toBe(now.year);
        expect(new TimeParser("the current year").consumeMonthYear("UTC")?.time?.year)
            .toBe(now.year);
        expect(new TimeParser("now year").consumeMonthYear("UTC")?.time?.year)
            .toBe(now.year);
    });

    it("parses a month after relative", () => {
        const now = Temporal.Now.zonedDateTimeISO("UTC");
        expect(new TimeParser("month after last").consumeMonthYear("UTC")?.time?.month)
            .toBe(now.month);
        expect(new TimeParser("month after now").consumeMonthYear("UTC")?.time?.month)
            .toBe(now.add({ months: 1 }).month);
        expect(new TimeParser("month after next").consumeMonthYear("UTC")?.time?.month)
            .toBe(now.add({ months: 2 }).month);
        expect(new TimeParser("month before last").consumeMonthYear("UTC")?.time?.month)
            .toBe(now.subtract({ months: 2 }).month);
        expect(new TimeParser("month before now").consumeMonthYear("UTC")?.time?.month)
            .toBe(now.subtract({ months: 1 }).month);
        expect(new TimeParser("month before next").consumeMonthYear("UTC")?.time?.month)
            .toBe(now.month);
        expect(new TimeParser("month following following").consumeMonthYear("UTC")?.time?.month)
            .toBe(now.add({ months: 2 }).month);
    });

    it("parses a year after relative", () => {
        const now = Temporal.Now.zonedDateTimeISO("UTC");
        expect(new TimeParser("year after last").consumeMonthYear("UTC")?.time?.year)
            .toBe(now.year);
        expect(new TimeParser("year after now").consumeMonthYear("UTC")?.time?.year)
            .toBe(now.add({ years: 1 }).year);
        expect(new TimeParser("year after next").consumeMonthYear("UTC")?.time?.year)
            .toBe(now.add({ years: 2 }).year);
        expect(new TimeParser("year before last").consumeMonthYear("UTC")?.time?.year)
            .toBe(now.subtract({ years: 2 }).year);
        expect(new TimeParser("year before now").consumeMonthYear("UTC")?.time?.year)
            .toBe(now.subtract({ years: 1 }).year);
        expect(new TimeParser("year before next").consumeMonthYear("UTC")?.time?.year)
            .toBe(now.year);
        expect(new TimeParser("year following following").consumeMonthYear("UTC")?.time?.year)
            .toBe(now.add({ years: 2 }).year);
    });

    it("parses a weekday correctly", () => {
        const parser = new TimeParser("Monday");
        expect(parser.consumeWeekday()).toBe(1);
    });

    it("returns null for invalid weekday", () => {
        const parser = new TimeParser("Funday");
        expect(parser.consumeWeekday()).toBeNull();
    });
});
