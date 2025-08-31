import cloneRegex from "../util/cloneRegex.ts";
import {
    DurationUnit, durationUnitFullRegexes,
    durationUnitRegexCaseInsensitive,
    durationUnitRegexCaseSensitive,
    durationUnits,
    durationUnitShorthandRegexes,
} from "./Duration.ts";
import Parser from "./Parser.ts";

export default class TimeParser extends Parser {

    /**
     * Consume a duration. If no duration was found, null is returned.
     * This advances the parser's index.
     *
     * @protected
     */
    protected consumeDuration(): number | null {
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
        for (const unit in durationUnits) {
            const matching =
                cloneRegex(durationUnitShorthandRegexes[unit as DurationUnit], { prefix: "^" }).test(unitWord) ||
                cloneRegex(durationUnitFullRegexes[unit as DurationUnit], { prefix: "^" }).test(unitWord);
            if (matching) {
                durationInSeconds = durationNumber * durationUnits[unit as DurationUnit];
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

        return durationInSeconds;
    }

}
