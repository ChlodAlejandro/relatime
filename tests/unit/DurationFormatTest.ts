import { Temporal } from "temporal-polyfill";

describe("DurationFormat", () => {

    test("should format durations correctly", () => {
        const duration = new Temporal.Duration(0, 0, 0, 0, 1, 15, 42);
        // Bad type.
        // https://github.com/fullcalendar/temporal-polyfill/issues/59
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        expect(duration.toLocaleString("en", { style: "long" })).toBe("1 hour, 15 minutes, 42 seconds");
    });

});
