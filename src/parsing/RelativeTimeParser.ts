import { log } from "../util/log.ts";
import { DurationUnit, durationUnits, unitCompare } from "./Duration.ts";
import TimeParser from "./TimeParser.ts";

export interface RelativeTimeMatch {
    match: string;
    /** The number of seconds that represent the match. */
    duration: number;
    precision: "second" | "minute" | "hour" | "day" | "week" | "month" | "year";
}

/**
 * A parser for relative time expressions. This class takes in any arbitrary string and
 * parses it to find relative time expressions.
 */
export class RelativeTimeParser extends TimeParser {

    protected readonly prefixDurationRegex =
        /^(?:in|after|within|give|gimme|just)$/i;
    protected readonly prefixSkipWords = {
        give: ["me", "us"],
    };
    protected readonly postfixDurationRegex =
        /^(?:ago|prior|from)$/i;
    protected readonly postfixMatchWords = {
        from: ["now"],
    };
    protected readonly negateDurationRegex =
        /^(?:ago|prior)$/;
    protected readonly spelledDurationRegex =
        /^(?:an?|one)$/;

    public parse(): RelativeTimeMatch[] {
        const matches: (RelativeTimeMatch | null)[] = [];

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

            if (this.detectPrefixDuration(matches, word, startIndex))
                continue;
            if (this.detectPostfixDuration(matches, word, startIndex))
                continue;
            if (this.detectOsuDurations(matches, word, startIndex))
                continue;
            // TODO: Relative keywords ("in the next hour")

            if (lastIndex === this.index) {
                log.warn("RelativeTimeParser did not advance!");
                // No progress made, consume a character to avoid infinite loops.
                this.consume();
            }
        } while (!this.isEmpty());

        return matches
            .filter(v => !!v);
    }

    protected consumeDurationChain(): { durationInSeconds: number, precision: keyof typeof durationUnits } | null {
        let durationInSeconds: number = null;
        // Using a loop here allows us to detect "1h30m".
        let detectedDuration: { durationInSeconds: number, unit: keyof typeof durationUnits } | null;
        let precision: DurationUnit;
        do {
            detectedDuration = this.consumeDuration(true);
            if (detectedDuration !== null) {
                durationInSeconds = (durationInSeconds ?? 0) + detectedDuration.durationInSeconds;
                if (precision && unitCompare(detectedDuration.unit, precision) > 0) {
                    precision = detectedDuration.unit;
                } else {
                    precision = detectedDuration.unit;
                }
            }
        } while (detectedDuration !== null);
        if (durationInSeconds == null) {
            // No duration found, discard.
            return null;
        }
        return { durationInSeconds, precision };
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
        matches: RelativeTimeMatch[],
        word: string,
        startIndex: number,
    ): boolean {
        if (!this.prefixDurationRegex.test(word)) {
            return false;
        }

        if (this.prefixSkipWords[word]) {
            if (this.prefixSkipWords[word].includes(this.peekWord())) {
                // Check for skippable words for specific prefix words.
                this.consumeWord();
            } else {
                // No skip word found, discard.
                return false;
            }
        }

        const duration = this.consumeDurationChain();
        if (duration == null) {
            // No duration found, discard.
            return false;
        }

        matches.push({
            match: this.source.substring(startIndex, this.index).trim(),
            duration: duration.durationInSeconds *
                (this.negateDurationRegex.test(word) ? -1 : 1),
            precision: duration.precision,
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
        matches: RelativeTimeMatch[],
        word: string,
        startIndex: number,
    ): boolean {
        // Detect numbers for a duration. This does postfix matching.
        if (this.spelledDurationRegex.test(word) || /^\d+$/.test(word)) {
            // Reset the index so we can consume the whole thing as a duration.
            this.seek(startIndex);
        } else {
            // Not a postfix duration. Skip.
            return false;
        }

        const duration = this.consumeDurationChain();
        if (duration == null) {
            // No duration found, discard.
            return false;
        }

        // Check if there's a matching postfix word.
        const postfix = this.consumeWord();
        if (!this.postfixDurationRegex.test(postfix)) {
            // No postfix word found, discard.
            return false;
        }

        // If the next word requires a match word, detect and consume it.
        if (this.postfixMatchWords[postfix]) {
            if (this.postfixMatchWords[postfix].includes(this.peekWord() || "")) {
                this.consumeWord();
            } else {
                // If the match word isn't found, discard.
                return false;
            }
        }
        matches.push({
            match: this.source.substring(startIndex, this.index).trim(),
            duration: duration.durationInSeconds *
                (this.negateDurationRegex.test(postfix) ? -1 : 1),
            precision: duration.precision,
        });
    }

    /**
     * Detect osu! style durations like "match in 15, invites in 10". In this case,
     * minutes are implied.
     *
     * @param matches
     * @param word
     * @param startIndex
     * @protected
     */
    protected detectOsuDurations(
        matches: RelativeTimeMatch[],
        word: string,
        startIndex: number,
    ): boolean {
        if (word === "in") {
            const numbers1 = this.consumeNumbers();
            const numbers1EndIndex = this.index;
            const delim = this.consumePunctuation();
            if (!delim || !delim.startsWith(",")) {
                // Not a comma. Discard.
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
                matches.push({
                    match: this.source.substring(startIndex, numbers1EndIndex).trim(),
                    duration: numbers1 * durationUnits.minute,
                    precision: "minute",
                });
                matches.push({
                    match: this.source.substring(numbers2StartIndex, this.index).trim(),
                    duration: numbers2 * durationUnits.minute,
                    precision: "minute",
                });
            } else {
                // Second part not matched
                return false;
            }
        }
    }

}
