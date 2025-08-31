/*
 * Second has been commented out since Discord timestamps don't
 * seem to show seconds anyway.
 */

export const durationUnits = {
    second: 1,
    minute: 60,
    hour: 60 * 60,
    day: 60 * 60 * 24,
    week: 60 * 60 * 24 * 7,
    // Approximated to 30 days
    month: 60 * 60 * 24 * 30,
    // Approximated to 365 days
    year: 60 * 60 * 24 * 365,
};
export type DurationUnit = keyof typeof durationUnits;
export const durationUnitShorthandRegexes: Record<keyof typeof durationUnits, RegExp> = {
    second: /s|secs?/,
    minute: /m(?!o)|min/,
    hour: /h|hr/,
    day: /dy?/,
    week: /w|wk/,
    month: /mo|mon/,
    year: /y|yr/,
};
export const durationUnitFullRegexes: Record<keyof typeof durationUnits, RegExp> = {
    second: /seconds?/i,
    minute: /minutes?/i,
    hour: /hours?/i,
    day: /days?/i,
    week: /weeks?/i,
    month: /months?/i,
    year: /years?/i,
};
export const durationUnitRegexCaseInsensitive = new RegExp(
    Object.values(durationUnitShorthandRegexes)
        .concat(Object.values(durationUnitFullRegexes))
        .filter(r => r.flags.includes("i"))
        .map(r => r.source)
        .join("|"),
    "i",
);
export const durationUnitRegexCaseSensitive = new RegExp(
    Object.values(durationUnitShorthandRegexes)
        .concat(Object.values(durationUnitFullRegexes))
        .filter(r => !r.flags.includes("i"))
        .map(r => r.source)
        .join("|"),
);
