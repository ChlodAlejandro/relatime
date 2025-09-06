/*
 * Second has been commented out since Discord timestamps don't
 * seem to show seconds anyway.
 */

import combineRegex from "../util/combineRegex.ts";

// These number values are only used for sorting.
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
export const durationUnitShorthandRegexes: Record<DurationUnit, RegExp> = {
    second: /s|secs?/,
    minute: /m(?!o)|mins?/,
    hour: /h|hr/,
    day: /dy?/,
    week: /w|wk/,
    month: /mo|mon/,
    year: /y|yr/,
};
export const durationUnitFullRegexes: Record<DurationUnit, RegExp> = {
    second: /seconds?/i,
    minute: /minutes?/i,
    hour: /hours?/i,
    day: /days?/i,
    week: /week(?:day)?s?/i,
    month: /months?/i,
    year: /years?/i,
};
export const durationUnitRegexes = Object.fromEntries(
    Object.keys(durationUnits)
        .map((k) => [
            k,
            combineRegex([durationUnitShorthandRegexes[k], durationUnitFullRegexes[k]], {
                prepend: "^",
                append: "$",
            }),
        ]),
) as Record<DurationUnit, RegExp>;
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

/**
 * Compares two duration units. Returns a negative number if `a` is smaller than `b`,
 * a positive number if `a` is larger than `b`, and zero if they are equal.
 *
 * @param a
 * @param b
 */
export function unitCompare(a: DurationUnit, b: DurationUnit): number {
    return durationUnits[a] - durationUnits[b];
}

/**
 * Get the smallest duration unit in a duration object.
 * @param durationObject
 */
export function getSmallestDurationUnit(durationObject: Partial<Record<DurationUnit, number>>) {
    const units = Object.keys(durationObject) as DurationUnit[];
    if (units.length === 0) return null;
    return units.reduce((smallest, current) => {
        if (unitCompare(current, smallest) < 0) return current;
        return smallest;
    }, units[0]);
}
