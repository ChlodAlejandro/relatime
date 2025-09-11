import Parser from "../../src/lib/parsing/Parser";

describe("Parser", () => {
    it("parses the next word correctly", () => {
        const parser = new Parser("Hello world!");
        expect(parser.consumeWord()).toBe("Hello");
        expect(parser.consumeWord()).toBe("world");
    });

    it("returns null when no word is available", () => {
        const parser = new Parser("   ");
        expect(parser.consumeWord()).toBeNull();
    });

    it("parses numbers correctly", () => {
        const parser = new Parser("123 456");
        expect(parser.consumeNumbers()).toBe(123);
        expect(parser.consumeNumbers()).toBe(456);
    });

    it("returns null when no number is available", () => {
        const parser = new Parser("abc");
        expect(parser.consumeNumbers()).toBeNull();
    });

    it("parses ordinal numbers correctly", () => {
        const parser = new Parser("first second");
        expect(parser.consumeOrdinal()).toBe(1);
        expect(parser.consumeOrdinal()).toBe(2);
    });

    it("returns null for invalid ordinal numbers", () => {
        const parser = new Parser("twenty something");
        expect(parser.consumeOrdinal()).toBeNull();
    });

    it("parses punctuation correctly", () => {
        const parser = new Parser("!@#");
        expect(parser.consumePunctuation()).toBe("!@#");
    });

    it("returns null when no punctuation is available", () => {
        const parser = new Parser("abc");
        expect(parser.consumePunctuation()).toBeNull();
    });

    it("parses whitespace correctly", () => {
        const parser = new Parser("   \t");
        expect(parser.consumeWhitespace()).toBe("   \t");
    });

    it("returns null when no whitespace is available", () => {
        const parser = new Parser("abc");
        expect(parser.consumeWhitespace()).toBeNull();
    });

    it("parses regex matches correctly", () => {
        const parser = new Parser("abc123");
        expect(parser.consumeRegex(/^[a-z]+/)).toBe("abc");
        expect(parser.consumeRegex(/^\d+/)).toBe("123");
    });

    it("returns null when regex does not match", () => {
        const parser = new Parser("abc");
        expect(parser.consumeRegex(/^\d+/)).toBeNull();
    });

    it("resets the parser correctly", () => {
        const parser = new Parser("Hello world!");
        parser.consumeWord();
        parser.reset();
        expect(parser.consumeWord()).toBe("Hello");
    });

    it("seeks to the correct index", () => {
        const parser = new Parser("Hello world!");
        parser.seek(6);
        expect(parser.consumeWord()).toBe("world");
    });

    it("checks if the parser is empty", () => {
        const parser = new Parser("");
        expect(parser.isEmpty()).toBe(true);
    });

    it("returns false when the parser is not empty", () => {
        const parser = new Parser("Hello");
        expect(parser.isEmpty()).toBe(false);
    });
});
