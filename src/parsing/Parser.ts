import cloneRegex from "../util/cloneRegex.ts";
import combineRegex from "../util/combineRegex.ts";

/**
 * Simplified token parser for normal text.
 */
export default class Parser {

    private static readonly WORD_REGEX = /^[^\s\p{P}]+/u;
    private static readonly PUNCTUATION_REGEX = /^\p{P}+/u;
    private static readonly WHITESPACE_REGEX = /^\s+/;
    private static readonly WHITESPACE_SIMPLE_REGEX = /^[ \t]+/;
    private static readonly NUMBER_REGEX = /^\d+/;
    private static readonly ORDINAL_MAIN = {
        first: 1,
        second: 2,
        third: 3,
        forth: 4,
        fourth: 4,
        fifth: 5,
        sixth: 6,
        seventh: 7,
        eighth: 8,
        ninth: 9,
    };
    private static readonly ORDINAL_MAIN_REGEX = new RegExp(
        `^(?:${Object.keys(Parser.ORDINAL_MAIN).join("|")})`,
        "i",
    );
    private static readonly ORDINAL_OVERRIDE = {
        tenth: 10,
        eleventh: 11,
        twelfth: 12,
        thirteenth: 13,
        fourteenth: 14,
        fifteenth: 15,
        sixteenth: 16,
        seventeenth: 17,
        eighteenth: 18,
        nineteenth: 19,
        twentieth: 20,
        thirtieth: 30,
        fortieth: 40,
        fiftieth: 50,
        sixtieth: 60,
        seventieth: 70,
        eightieth: 80,
        ninetieth: 90,
    };
    private static readonly ORDINAL_OVERRIDE_REGEX = new RegExp(
        `^(?:${Object.keys(Parser.ORDINAL_OVERRIDE).join("|")})`,
        "i",
    );
    // noinspection SpellCheckingInspection
    private static readonly ORDINAL_PREFIXES = {
        twenty: 20,
        thirty: 30,
        forty: 40,
        fourty: 40,
        fifty: 50,
        sixty: 60,
        seventy: 70,
        eighty: 80,
        ninety: 90,
    };
    private static readonly ORDINAL_PREFIX_REGEX = new RegExp(
        `^(?:${Object.keys(Parser.ORDINAL_PREFIXES).join("|")})`,
        "i",
    );
    private static readonly ORDINAL_REGEX = combineRegex(
        [
            Parser.ORDINAL_MAIN_REGEX,
            Parser.ORDINAL_OVERRIDE_REGEX,
            combineRegex([Parser.ORDINAL_PREFIX_REGEX, Parser.ORDINAL_MAIN_REGEX], {
                joiner: "",
            }),
        ], {
            trimStart: /\^/,
        },
    );

    public readonly source: string;
    protected working: string;
    #index: number;

    get index() {
        return this.#index;
    }
    private set index(value: number) {
        this.#index = value;
    }

    constructor(source: string) {
        this.source = source;
        this.working = source;
        this.index = 0;
    }

    /**
     * Reset the parser to the beginning of the source text.
     */
    public reset() {
        this.working = this.source;
        this.index = 0;
    }

    /**
     * Move the parser to a given index.
     *
     * @param index
     */
    public seek(index: number) {
        this.working = this.source.slice(index);
        this.index = index;
    }

    /**
     * Return the next character without consuming it.
     */
    public peek() {
        return this.working[this.index];
    }

    /**
     * Return the next word without consuming it.
     * @param i The index of the word to peek (0 for next, 1 for the one after that, etc.)
     */
    public peekWord(i = 0) {
        const wordRegex = cloneRegex(Parser.WORD_REGEX);
        do {
            const match = wordRegex.exec(this.working);
            if (match) {
                if (i === 0) {
                    return match[0];
                }
                // Find out how big the next whitespace is and skip it.
                const whitespaceRegex = cloneRegex(Parser.WHITESPACE_REGEX);
                whitespaceRegex.lastIndex = match[0].length;
                wordRegex.lastIndex += match[0].length + (whitespaceRegex.exec(this.working)?.[0].length ?? 0);
                i--;
            } else {
                return null;
            }
        } while (i > 0);
        return null;
    }

    /**
     * Return the next text following a regex without consuming it.
     */
    public peekRegex(regex: RegExp) {
        const match = this.working.match(regex);
        if (match) {
            return match[0];
        }
        return null;
    }

    /**
     * Consume and return the next character.
     */
    public consume() {
        const char = this.working[this.index++];
        this.working = this.working.slice(1);
        return char;
    }

    /**
     * Pre-consumption processing, like consuming whitespace.
     *
     * @protected
     */
    protected preConsume() {
        if (Parser.WHITESPACE_REGEX.test(this.working)) {
            this.consumeWhitespace(true);
        }
    }

    /**
     * Consume and return the next word.
     * @param excludeWhitespace Whether to discard whitespace succeeding the word or not.
     */
    public consumeWord(excludeWhitespace = false) {
        this.preConsume();
        const match = this.working.match(Parser.WORD_REGEX);
        if (match) {
            this.index += match[0].length;
            this.working = this.working.slice(match[0].length);
            if (!excludeWhitespace) {
                this.consumeWhitespace();
            }
            return match[0];
        }
        return null;
    }

    /**
     * Consume and return the next number.
     * @param excludeWhitespace Whether to discard whitespace succeeding the word or not.
     */
    public consumeNumbers(excludeWhitespace = false) {
        this.preConsume();
        const match = this.working.match(Parser.NUMBER_REGEX);
        if (match) {
            this.index += match[0].length;
            this.working = this.working.slice(match[0].length);
            if (!excludeWhitespace) {
                this.consumeWhitespace();
            }
            return parseInt(match[0], 10);
        }
        return null;
    }

    /**
     * Consume and return the next ordinal number (e.g. "first", "second", "third").
     */
    public consumeOrdinal(excludeWhitespace = false): number {
        this.preConsume();
        if (this.peekRegex(/\d+(th|st|nd|rd)\b/i)) {
            // This is just a number and a suffix. Consume all.
            const number = this.consumeNumbers();
            this.consumeRegex(/(th|st|nd|rd)\b/i);
            if (!excludeWhitespace) {
                this.consumeWhitespace();
            }
            return number;
        } if (this.peekRegex(Parser.ORDINAL_OVERRIDE_REGEX)) {
            const ordinal = this.consumeRegex(Parser.ORDINAL_OVERRIDE_REGEX);
            if (!excludeWhitespace) {
                this.consumeWhitespace();
            }
            return Parser.ORDINAL_OVERRIDE[ordinal.toLowerCase()];
        } else if (this.peekRegex(Parser.ORDINAL_MAIN_REGEX)) {
            const ordinal = this.consumeRegex(Parser.ORDINAL_MAIN_REGEX);
            if (!excludeWhitespace) {
                this.consumeWhitespace();
            }
            return Parser.ORDINAL_MAIN[ordinal.toLowerCase()];
        } else if (this.peekRegex(Parser.ORDINAL_PREFIX_REGEX)) {
            // This is a prefix like "twenty", "thirty", etc.
            const prefix = this.consumeRegex(Parser.ORDINAL_PREFIX_REGEX);
            const main = this.consumeRegex(combineRegex([
                /[- ]?/,
                Parser.ORDINAL_MAIN_REGEX,
            ], { joiner: "" }));
            if (!main) {
                // Invalid ordinal, e.g. "twenty something"
                return null;
            }
            if (!excludeWhitespace) {
                this.consumeWhitespace();
            }
            return Parser.ORDINAL_PREFIXES[prefix.toLowerCase()] + Parser.ORDINAL_MAIN[main.toLowerCase()];
        }

        return null;
    }

    /**
     * Consume and return whitespace.
     *
     * This function does not run any pre-consumption processing.
     *
     * @param withNewlines Whether to include newlines as whitespace.
     */
    public consumeWhitespace(withNewlines = false) {
        const regex = withNewlines ?
            Parser.WHITESPACE_REGEX : Parser.WHITESPACE_SIMPLE_REGEX;
        const match = this.working.match(regex);
        if (match) {
            this.index += match[0].length;
            this.working = this.working.slice(match[0].length);
            return match[0];
        }
        return null;
    }

    /**
     * Consume and return symbols (non-word, non-whitespace characters).
     */
    public consumePunctuation() {
        this.preConsume();
        const match = this.working.match(Parser.PUNCTUATION_REGEX);
        if (match) {
            this.index += match[0].length;
            this.working = this.working.slice(match[0].length);
            return match[0];
        }
        return null;
    }

    /**
     * Consume and return non-word characters (punctuation and whitespace).
     */
    public consumeNonWord() {
        this.preConsume();
        const regex = combineRegex([Parser.PUNCTUATION_REGEX, Parser.WHITESPACE_SIMPLE_REGEX], {
            trimStart: /\^/,
            trimEnd: /\+/,
            append: "+",
        });
        const match = this.working.match(
            regex,
        );
        if (match) {
            this.index += match[0].length;
            this.working = this.working.slice(match[0].length);
            return match[0];
        }
        return null;
    }

    /**
     * Consume and return text matching a given regex.
     */
    public consumeRegex(regex: RegExp) {
        this.preConsume();
        const match = this.working.match(regex);
        if (match) {
            this.index += match[0].length;
            this.working = this.working.slice(match[0].length);
            return match[0];
        }
        return null;
    }

    /**
     * Measure consumption of a given callback. This returns the start and end indices of the
     * consumption, as well as the matched text.
     *
     * @param callback
     */
    public meter(callback: () => void): { start: number, end: number, match: string } {
        const start = this.index;
        callback();
        const end = this.index;
        return {
            start,
            end,
            match: this.source.slice(start, end),
        };
    }

    /**
     * Check if there is no more text to parse.
     */
    public isEmpty() {
        return this.working.length === 0;
    }

}
