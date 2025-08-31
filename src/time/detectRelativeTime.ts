import {durationRegex, handleDuration} from "./handleDuration.ts";

export interface RelativeTimeMatch {
    match: RegExpMatchArray;
    /** The number of seconds that represent the match. */
    duration: number;
}

export default function detectRelativeTime(text: string): RelativeTimeMatch[] {
    const matches: RelativeTimeMatch[] = [];

    // Match "in <duration>"
    {
        const inPattern = new RegExp(String.raw`\bin\s+${durationRegex.source}\b`, 'gi');
        let match: RegExpExecArray;
        while ((match = inPattern.exec(text)) !== null) {
            const duration = handleDuration(match);
            if (isNaN(duration)) continue;
            matches.push({match, duration});
        }

    }

    // Match "<duration> ago"
    {
        const agoPattern = new RegExp(String.raw`\b${durationRegex.source}\s+ago\b`, 'gi');
        let match: RegExpExecArray;
        while ((match = agoPattern.exec(text)) !== null) {
            const duration = handleDuration(match);
            if (isNaN(duration)) continue;
            matches.push({match, duration: -duration});
        }
    }

    // Match "<duration> from now"
    {
        const fromNowPattern = new RegExp(String.raw`\b${durationRegex.source}\s+from\s+now\b`, 'gi');
        let match: RegExpExecArray;
        while ((match = fromNowPattern.exec(text)) !== null) {
            const duration = handleDuration(match);
            if (isNaN(duration)) continue;
            matches.push({match, duration});
        }
    }

    // Match "after <duration>"
    {
        const afterPattern = new RegExp(String.raw`\bafter\s+${durationRegex.source}\b`, 'gi');
        let match: RegExpExecArray;
        while ((match = afterPattern.exec(text)) !== null) {
            const duration = handleDuration(match);
            if (isNaN(duration)) continue;
            matches.push({match, duration});
        }
    }

    // Match "within <duration>"
    {
        const withinPattern = new RegExp(String.raw`\bwithin\s+${durationRegex.source}\b`, 'gi');
        let match: RegExpExecArray;
        while ((match = withinPattern.exec(text)) !== null) {
            const duration = handleDuration(match);
            if (isNaN(duration)) continue;
            matches.push({match, duration});
        }
    }

    // Match "give me <duration>"
    {
        const giveMePattern = new RegExp(String.raw`\bgive\s+me\s+${durationRegex.source}\b`, 'gi');
        let match: RegExpExecArray;
        while ((match = giveMePattern.exec(text)) !== null) {
            const duration = handleDuration(match);
            if (isNaN(duration)) continue;
            matches.push({match, duration});
        }
    }

    // Match "just <duration>"
    {
        const justPattern = new RegExp(String.raw`\bjust\s+${durationRegex.source}\b`, 'gi');
        let match: RegExpExecArray;
        while ((match = justPattern.exec(text)) !== null) {
            const duration = handleDuration(match);
            if (isNaN(duration)) continue;
            matches.push({match, duration});
        }
    }

    // Match "X in Y, Z in W" (no units)
    {
        const osuPatternPart = /(?:\S+\s){1,3}?\s*in\s+(\d+)/;
        const osuPattern = new RegExp(String.raw`\b${osuPatternPart.source},\s*${osuPatternPart.source}\b`, 'gi');
        let match: RegExpExecArray;
        while ((match = osuPattern.exec(text)) !== null) {
            const value1 = parseInt(match[1], 10);
            const value2 = parseInt(match[2], 10);
            if (isNaN(value1) || isNaN(value2)) continue;
            // Assume minutes
            const duration1 = value1 * 60;
            const duration2 = value2 * 60;

            // Run submatches for proper display
            const split = match[0].split(",");
            const match1 = split[0].match(osuPatternPart);
            const match2 = split[1].match(osuPatternPart);
            if (!match1 || !match2) continue;

            matches.push({match: match1, duration: duration1});
            matches.push({match: match2, duration: duration2});
        }
    }

    return matches
        .sort((a, b) => a.match.index - b.match.index);
}
