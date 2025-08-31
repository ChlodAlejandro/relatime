import { RelativeTimeParser } from "../../src/parsing/RelativeTimeParser.ts";

describe("RelativeTimeParser tests", () => {

    const simpleTests = {
        // in <duration>
        "in 4 hours": 60 * 60 * 4,
        // after <duration>
        "after 1 week": 60 * 60 * 24 * 7,
        // within <duration>
        "within 2 days": 60 * 60 * 24 * 2,
        // give me <duration>
        "give me 10 minutes": 60 * 10,
        // gimme <duration>
        "gimme 1 hour": 60 * 60,
        // just <duration>
        "just 30 seconds": 30,
        // <duration> ago
        "5 minutes ago": 60 * -5,
        // <duration> prior
        "2 hours prior": 60 * 60 * -2,
        // <duration> from now
        "3 hours from now": 60 * 60 * 3,
        // duration shorthand: seconds
        "in 45s": 45,
        "in 300 sec": 300,
        // duration shorthand: minutes
        "in 20m": 60 * 20,
        "in 15 min": 60 * 15,
        // duration shorthand: hours
        "in 12h": 60 * 60 * 12,
        "in 6 hr": 60 * 60 * 6,
        // duration shorthand: days
        "in 3d": 60 * 60 * 24 * 3,
        // duration shorthand: weeks
        "in 2w": 60 * 60 * 24 * 7 * 2,
        "in 1 wk": 60 * 60 * 24 * 7,
        // duration shorthand: months
        "in 4mo": 60 * 60 * 24 * 30 * 4,
        "in 2 mon": 60 * 60 * 24 * 30 * 2,
        // duration shorthand: years
        "in 1y": 60 * 60 * 24 * 365,
        "in 3 yr": 60 * 60 * 24 * 365 * 3,
        // mixed duration shorthand
        "in 1h 30m": 60 * 60 + 60 * 30,
        "in 2d4h15m": 60 * 60 * 24 * 2 + 60 * 60 * 4 + 60 * 15,
        "in 2 hours 30 minutes": 60 * 60 * 2 + 60 * 30,
    };

    test("blank", () => {
        const matches = new RelativeTimeParser("").parse();
        expect(matches).toHaveLength(0);
    });

    test.each(Object.keys(simpleTests))("simple test: '%s'", (input) => {
        const matches = new RelativeTimeParser(input).parse();
        expect(matches).toHaveLength(1);
        expect(matches[0].match).toBe(input);
        expect(matches[0].duration).toBe(simpleTests[input]);
    }, 100);

    test("concatenated test (simples)", () => {
        const concatenated = Object.keys(simpleTests).join(", ");
        const matches = new RelativeTimeParser(concatenated).parse();
        expect(matches).toHaveLength(Object.keys(simpleTests).length);
        matches.forEach((match, i) => {
            const input = Object.keys(simpleTests)[i];
            expect(match.match).toBe(input);
            expect(match.duration).toBe(simpleTests[input]);
        });
    });

    test("inside of misc. text", () => {
        const text = "Let's meet in 2 hours, or maybe after 30 minutes. I don't want to wait more than 1 day.";
        const matches = new RelativeTimeParser(text).parse();
        expect(matches).toHaveLength(2);
        expect(matches[0].match).toBe("in 2 hours");
        expect(matches[0].duration).toBe(60 * 60 * 2);
        expect(matches[1].match).toBe("after 30 minutes");
        expect(matches[1].duration).toBe(60 * 30);
    });

    test("edge: missing unit", () => {
        const matches = new RelativeTimeParser("in 2").parse();
        expect(matches).toHaveLength(0);

        const matches2 = new RelativeTimeParser("just a").parse();
        expect(matches2).toHaveLength(0);
    });

    test("edge: double units", () => {
        const matches = new RelativeTimeParser("in 2 hours minutes").parse();
        expect(matches).toHaveLength(1);
        expect(matches[0].match).toBe("in 2 hours");
        expect(matches[0].duration).toBe(60 * 60 * 2);
    });

});
