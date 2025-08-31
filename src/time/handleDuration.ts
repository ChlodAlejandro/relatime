export const secondsRegex = /s(ec(onds?|s)?)?/;
export const minutesRegex = /m(in(utes?|s)?)?/;
export const hoursRegex = /h(rs?|ours?)?/;
export const daysRegex = /d(ays?)?/;
export const weeksRegex = /w(ks?|eeks?)?/;
export const monthsRegex = /mo(s|nths?)?/;
export const yearsRegex = /y(rs?|ears?)?/;
export const unitRegex = new RegExp([
    secondsRegex,
    minutesRegex,
    hoursRegex,
    daysRegex,
    weeksRegex,
    monthsRegex,
    yearsRegex,
].map(r => r.source.replace(/\(/g, "(?:")).join("|"));
export const durationRegex =
    new RegExp(String.raw`([\d,.]+)\s*(${unitRegex.source})`);

/**
 * Handle a duration match such as ["5 minutes", "5", "minutes"] and return
 * the number of seconds it represents.
 */
export function handleDuration(match: RegExpExecArray): number {
    const value = parseFloat(match[1].replace(/,/g, ""));
    if (isNaN(value))
        return NaN;
    const unit = match[2].toLowerCase();
    let duration = 0;
    switch (unit) {
        case "second":
        case "seconds":
        case "s":
        case "sec":
        case "secs":
            duration = value;
            break;
        case "minute":
        case "minutes":
        case "m":
        case "min":
        case "mins":
            duration = value * 60;
            break;
        case "hour":
        case "hours":
        case "h":
        case "hr":
        case "hrs":
            duration = value * 3600;
            break;
        case "day":
        case "days":
        case "d":
            duration = value * 86400;
            break;
        case "week":
        case "weeks":
        case "w":
        case "wk":
        case "wks":
            duration = value * 604800;
            break;
        case "month":
        case "months":
        case "mo":
        case "mos":
            // Approximate month as 30 days
            duration = value * 2592000;
            break;
        case "year":
        case "years":
        case "y":
        case "yr":
        case "yrs":
            // Approximate year as 365 days
            duration = value * 31536000;
            break;
        default:
            return NaN;
    }
    return duration;
}
