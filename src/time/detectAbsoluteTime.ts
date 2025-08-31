import {time} from "discord.js";
import {unitRegex} from "./handleDuration.ts";
import { Temporal } from 'temporal-polyfill';

// Derived from the wonderful http://www.php.net/manual/en/datetime.formats.php#datetime.formats.relative

export const dayNameRegex = /(?:sun|mon|tues?|we(?:dn|nd|n)e?s|th(?:u(?:rs)?)?|fri|sat(?:ur)?)(?:day)?/;
export const dayTextRegex = /weekdays?/;
export const numberRegex = /[+-]?\d+/;
export const relativeTextRegex = /next|last|previous|this/;
export const ordinal = new RegExp(String.raw`first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth`);
export const unit = new RegExp(String.raw`${unitRegex.source}|${dayTextRegex.source}`);

export interface AbsoluteTimeMatch {
    match: RegExpMatchArray;
    /** The date that represents this given absolute time */
    date: Temporal.ZonedDateTime;
}

// One day in milliseconds
const day = 86400e3;

function msToNs(ms: number): bigint {
    return BigInt(ms) * BigInt(1e6);
}

/**
 * Get the weekday from a string. Sunday is 0.
 * @param weekday
 * @return The weekday. NaN if unrecognized.
 */
function getWeekday(weekday: string): number {
    weekday = weekday.toLowerCase();
    if (weekday.startsWith("su")) return 0;
    if (weekday.startsWith("m")) return 1;
    if (weekday.startsWith("tu")) return 2;
    if (weekday.startsWith("w")) return 3;
    if (weekday.startsWith("th")) return 4;
    if (weekday.startsWith("f")) return 5;
    if (weekday.startsWith("sa")) return 6;
    return NaN;
}

function ordinalToNumber(ordinal: string): number {
    ordinal = ordinal.toLowerCase();
    switch (ordinal) {
        case "first":
            return 1;
        case "second":
            return 2;
        case "third":
            return 3;
        case "fourth":
            return 4;
        case "fifth":
            return 5;
        case "sixth":
            return 6;
        case "seventh":
            return 7;
        case "eighth":
            return 8;
        case "ninth":
            return 9;
        case "tenth":
            return 10;
        case "eleventh":
            return 11;
        case "twelfth":
            return 12;
        default:
            return NaN;
    }
}

export default function detectAbsoluteTime(text: string, timezone: number|string): AbsoluteTimeMatch[] {
    const matches: AbsoluteTimeMatch[] = [];

    const ns = BigInt(Date.now()) * BigInt(1e6);
    const timeZoneId = typeof timezone === 'string' ? timezone : (
        (timezone < 0 ? "-" : "+") +
        Math.floor(Math.abs(timezone)).toString().padStart(2, '0') +
        ":" +
        (Math.floor(Math.abs(timezone % 1) * 60)).toString().padStart(2, '0')
    );

    // 'yesterday', midnight of yesterday
    {
        const pattern = /\byesterday\b/gi;
        let match: RegExpExecArray;
        while ((match = pattern.exec(text)) !== null) {
            const date = new Temporal.ZonedDateTime(ns, timeZoneId)
                .subtract({ days: 1 })
                .startOfDay();
            matches.push({match, date});
        }
    }

    // 'yesterday (at)? <time>'
    {
        const pattern = new RegExp(String.raw`\byesterday(?:\s+at)?\s+(${numberRegex.source})(?::(${numberRegex.source}))?\s*([ap]m)?\b`, 'gi');
        let match: RegExpExecArray;
        while ((match = pattern.exec(text)) !== null) {
            let hour = parseInt(match[1]);
            const minute = match[2] ? parseInt(match[2]) : 0;
            const meridian = match[3];

            if (isNaN(hour) || isNaN(minute)) continue;

            if (meridian === "pm" && hour < 12) {
                hour += 12;
            } else if (meridian === "am" && hour === 12) {
                hour = 0;
            }

            const date = new Temporal.ZonedDateTime(ns, timeZoneId)
                .subtract({ days: 1 })
                .startOfDay()
                .add({
                    hours: hour,
                    minutes: minute
                });
            matches.push({match, date});
        }
    }

    // 'midnight' or 'today', time set to midnight
    {
        const pattern = /\b(midnight|today)\b/gi;
        let match: RegExpExecArray;
        while ((match = pattern.exec(text)) !== null) {
            const date = new Temporal.ZonedDateTime(ns, timeZoneId)
                .startOfDay();
            matches.push({match, date});
        }
    }

    // 'now', current time
    {
        const pattern = /\bnow\b/gi;
        let match: RegExpExecArray;
        while ((match = pattern.exec(text)) !== null) {
            const date = new Temporal.ZonedDateTime(ns, timeZoneId);
            matches.push({match, date});
        }
    }

    // '<yesterday|tomorrow>? noon', time set to noon
    {
        const pattern = /\b(yesterday|tomorrow)?\s*noon\b/gi;
        let match: RegExpExecArray;
        while ((match = pattern.exec(text)) !== null) {
            const when = match[1];
            let date = new Temporal.ZonedDateTime(ns, timeZoneId)
                .startOfDay()
                .add({ hours: 12 });
            if (when === "yesterday") {
                date = date.subtract({ days: 1 });
            } else if (when === "tomorrow") {
                date = date.add({ days: 1 });
            }
            matches.push({match, date});
        }
    }

    // 'tomorrow', midnight of tomorrow
    {
        const pattern = /\btomorrow\b/gi;
        let match: RegExpExecArray;
        while ((match = pattern.exec(text)) !== null) {
            const date = new Temporal.ZonedDateTime(ns, timeZoneId)
                .add({ days: 1 })
                .startOfDay();
            matches.push({match, date});
        }
    }

    // 'back of <hour>', 15 minutes past the given hour
    {
        const pattern = new RegExp(String.raw`\bback\s+of\s+(${numberRegex.source})([ap]m)?\b`, 'gi');
        let match: RegExpExecArray;
        while ((match = pattern.exec(text)) !== null) {
            let hour = parseInt(match[1]);
            const meridian = match[2];

            if (isNaN(hour)) continue;

            if (meridian === "pm" && hour < 12) {
                hour += 12;
            }

            const date = new Temporal.ZonedDateTime(ns, timeZoneId)
                .startOfDay()
                .add({
                    hours: hour,
                    minutes: 15
                });
            matches.push({match, date});
        }
    }

    // 'front of <hour>', 15 minutes before the given hour
    {
        const pattern = new RegExp(String.raw`\bfront\s+of\s+(${numberRegex.source})([ap]m)?\b`, 'gi');
        let match: RegExpExecArray;
        while ((match = pattern.exec(text)) !== null) {
            let hour = parseInt(match[1]);
            const meridian = match[2];

            if (isNaN(hour)) continue;

            if (meridian === "pm" && hour < 12) {
                hour += 12;
            }

            const date = new Temporal.ZonedDateTime(ns, timeZoneId)
                .startOfDay()
                .add({
                    hours: hour,
                    minutes: 45
                })
                .subtract({
                    hours: 1
                });
            matches.push({match, date});
        }
    }

    // 'first day of <month/month year>'
    {
        const pattern = /first\s+day\s+of\s+(\w+\s+)?(\d+)/gi;
        let match: RegExpExecArray;
        while ((match = pattern.exec(text)) !== null) {
            const monthName = match[1] ? match[1].trim() : undefined;
            const year = parseInt(match[2]);
            if (isNaN(year)) continue;

            let rawDate;
            if (monthName) {
                // TODO: Dangerous use of Date. This assumes that the current timezone is UTC!
                rawDate = new Date(`${monthName} 1, ${year}`);
                if (isNaN(rawDate.getTime())) continue;
            } else {
                rawDate = new Date(`January 1, ${year}`)
            }

            const date = new Temporal.ZonedDateTime(msToNs(rawDate.getTime()), timeZoneId)
                .startOfDay();
            matches.push({match, date});
        }
    }

    // 'first day of next|last|previous|this <week|month|year>'
    {
        const pattern = new RegExp(String.raw`\bfirst\s+day\s+of\s+(${relativeTextRegex.source})\s+(w(?:ee)?k|mo(?:n|nth)?|y(?:ea)?r)\b`, 'gi');
        let match: RegExpExecArray;
        while ((match = pattern.exec(text)) !== null) {
            const when = match[1];
            const unit = match[2].toLowerCase();

            let date = new Temporal.ZonedDateTime(ns, timeZoneId)
                .startOfDay()
                .with({ day: 1 });

            switch (unit) {
                case "week":
                case "wk":
                    if (when === "next") {
                        date = date.add({ days: 7 });
                    } else if (when === "last" || when === "previous") {
                        date = date.subtract({ days: 7 });
                    }
                    // Set to the start of the week (assuming Sunday as the first day of the week)
                    date = date
                        .subtract({ days: date.dayOfWeek % 7 });
                    break;
                case "mo":
                case "mon":
                case "month":
                    if (when === "next") {
                        date = date.add({ months: 1 });
                    } else if (when === "last" || when === "previous") {
                        date = date.subtract({ months: 1 });
                    }
                    date = date
                        .with({ day: 1 })
                        .startOfDay();
                    break;
                case "y":
                case "yr":
                case "year":
                    if (when === "next") {
                        date = date.add({ years: 1 });
                    } else if (when === "last" || when === "previous") {
                        date = date.subtract({ years: 1 });
                    }
                    date = date
                        .with({ month: 1, day: 1 })
                        .startOfDay();
                    break;
            }

            matches.push({match, date});
        }
    }

    // 'last day of <month/month year>'
    {
        const pattern = /last\s+day\s+of\s+(\w+\s+)?(\d+)/gi;
        let match: RegExpExecArray;
        while ((match = pattern.exec(text)) !== null) {
            const monthName = match[1] ? match[1].trim() : undefined;
            const year = parseInt(match[2]);
            if (isNaN(year)) continue;

            let rawDate;
            if (monthName) {
                // TODO: Dangerous use of Date. This assumes that the current timezone is UTC!
                rawDate = new Date(`${monthName} ${year}`);
                if (isNaN(rawDate.getTime())) continue;
            } else {
                rawDate = new Date(`January 1, ${year}`)
            }

            const date = new Temporal.ZonedDateTime(msToNs(rawDate.getTime()), timeZoneId)
                .with({ day: 32 }, { overflow: 'constrain' })
                .startOfDay();
            matches.push({match, date});
        }
    }

    // 'last day of next|last|previous|this <week|month|year>'
    {
        const pattern = new RegExp(String.raw`\blast\s+day\s+of\s+(${relativeTextRegex.source})\s+(w(?:ee)?k|mo(?:n|nth)?|y(?:ea)?r)\b`, 'gi');
        let match: RegExpExecArray;
        while ((match = pattern.exec(text)) !== null) {
            const when = match[1];
            const unit = match[2].toLowerCase();

            let date = new Temporal.ZonedDateTime(ns, timeZoneId)
                .startOfDay()
                .with({ day: 32 }, { overflow: 'constrain' });

            switch (unit) {
                case "week":
                case "wk":
                    if (when === "next") {
                        date = date.add({ days: 7 });
                    } else if (when === "last" || when === "previous") {
                        date = date.subtract({ days: 7 });
                    }
                    // Set to the end of the week (assuming Sunday as the first day of the week)
                    date = date
                        .add({ days: 6 - (date.dayOfWeek % 7) });
                    break;
                case "mo":
                case "mon":
                case "month":
                    if (when === "next") {
                        date = date.add({ months: 1 });
                    } else if (when === "last" || when === "previous") {
                        date = date.subtract({ months: 1 });
                    }
                    date = date
                        .with({ day: 32 }, { overflow: 'constrain' })
                        .startOfDay();
                    break;
                case "y":
                case "yr":
                case "year":
                    if (when === "next") {
                        date = date.add({ years: 1 });
                    } else if (when === "last" || when === "previous") {
                        date = date.subtract({ years: 1 });
                    }
                    date = date
                        .with({ month: 12, day: 32 }, { overflow: 'constrain' })
                        .startOfDay();
                    break;
            }

            matches.push({match, date});
        }
    }

    // '<ordinal> <dayname> of <month/month year>'
    {
        const pattern = new RegExp(String.raw`\b(${ordinal.source})\s+(${dayNameRegex.source})\s+of\s+(\w+\s+)?(\d+)\b`, 'gi');
        let match: RegExpExecArray;
        while ((match = pattern.exec(text)) !== null) {
            const ordinalText = match[1].toLowerCase();
            const dayName = match[2].toLowerCase();
            const monthName = match[4] ? match[4].trim() : undefined;
            const year = parseInt(match[5]);
            if (isNaN(year)) continue;

            const weekday = getWeekday(dayName);
            if (isNaN(weekday)) continue;

            let rawDate;
            if (monthName) {
                // TODO: Dangerous use of Date. This assumes that the current timezone is UTC!
                rawDate = new Date(`${monthName} ${year}`);
                if (isNaN(rawDate.getTime())) continue;
            } else {
                rawDate = new Date(`January 1, ${year}`)
            }

            const date = new Temporal.ZonedDateTime(msToNs(rawDate.getTime()), timeZoneId)
                .startOfDay()
                .with({ day: 1 })
                .add({ days: (7 * (ordinalToNumber(ordinalText) - 1)) })
                .add({ days: (weekday - (new Temporal.ZonedDateTime(msToNs(rawDate.getTime()), timeZoneId).with({ day: 1 }).dayOfWeek + 7) % 7) % 7 });
            matches.push({match, date});
        }
    }

    // '<ordinal> <dayname> of next|last|previous|this <week|month|year>'
    {
        const pattern = new RegExp(String.raw`\b(${ordinal.source})\s+(${dayNameRegex.source})\s+of\s+(${relativeTextRegex.source})\s+(w(?:ee)?k|mo(?:n|nth)?|y(?:ea)?r)\b`, 'gi');
        let match: RegExpExecArray;
        while ((match = pattern.exec(text)) !== null) {
            const ordinalText = match[1].toLowerCase();
            const dayName = match[2].toLowerCase();
            const when = match[3];
            const unit = match[4].toLowerCase();

            const weekday = getWeekday(dayName);
            if (isNaN(weekday)) continue;

            let date = new Temporal.ZonedDateTime(ns, timeZoneId)
                .startOfDay()
                .with({day: 1});

            switch (unit) {
                case "week":
                case "wk":
                    if (when === "next") {
                        date = date.add({days: 7});
                    } else if (when === "last" || when === "previous") {
                        date = date.subtract({days: 7});
                    }
                    // Set to the start of the week (assuming Sunday as the first day of the week)
                    date = date
                        .subtract({days: date.dayOfWeek % 7});
                    break;
                case "mo":
                case "mon":
                case "month":
                    if (when === "next") {
                        date = date.add({months: 1});
                    } else if (when === "last" || when === "previous") {
                        date = date.subtract({months: 1});
                    }
                    date = date
                        .with({day: 1})
                        .startOfDay();
                    break;
                case "y":
                case "yr":
                case "year":
                    if (when === "next") {
                        date = date.add({years: 1});
                    } else if (when === "last" || when === "previous") {
                        date = date.subtract({years: 1});
                    }
                    date = date
                        .with({month: 1, day: 1})
                        .startOfDay();
                    break;
            }

            date = date
                .add({days: (7 * (ordinalToNumber(ordinalText) - 1))})
                .add({days: (weekday - (date.dayOfWeek + 7) % 7) % 7});
            matches.push({match, date});
        }
    }

    // 'last <dayname> of <month/month year>'
    {
        const pattern = new RegExp(String.raw`\blast\s+(${dayNameRegex.source})\s+of\s+(\w+\s+)?(\d+)\b`, 'gi');
        let match: RegExpExecArray;
        while ((match = pattern.exec(text)) !== null) {
            const dayName = match[1].toLowerCase();
            const monthName = match[3] ? match[3].trim() : undefined;
            const year = parseInt(match[4]);
            if (isNaN(year)) continue;

            const weekday = getWeekday(dayName);
            if (isNaN(weekday)) continue;

            let rawDate;
            if (monthName) {
                // TODO: Dangerous use of Date. This assumes that the current timezone is UTC!
                rawDate = new Date(`${monthName} ${year}`);
                if (isNaN(rawDate.getTime())) continue;
            } else {
                rawDate = new Date(`January 1, ${year}`);
            }

            const date = new Temporal.ZonedDateTime(msToNs(rawDate.getTime()), timeZoneId)
                .with({day: 32}, {overflow: 'constrain'})
                .startOfDay()
                .add({days: -((new Temporal.ZonedDateTime(msToNs(rawDate.getTime()), timeZoneId).with({day: 32}, {overflow: 'constrain'}).dayOfWeek + 7 - weekday) % 7)});
            matches.push({match, date});
        }
    }

    // 'last <dayname> of next|last|previous|this <week|month|year>'
    {
        const pattern = new RegExp(String.raw`\blast\s+(${dayNameRegex.source})\s+of\s+(${relativeTextRegex.source})\s+(w(?:ee)?k|mo(?:n|nth)?|y(?:ea)?r)\b`, 'gi');
        let match: RegExpExecArray;
        while ((match = pattern.exec(text)) !== null) {
            const dayName = match[1].toLowerCase();
            const when = match[2];
            const unit = match[3].toLowerCase();

            const weekday = getWeekday(dayName);
            if (isNaN(weekday)) continue;

            let date = new Temporal.ZonedDateTime(ns, timeZoneId)
                .startOfDay()
                .with({day: 32}, {overflow: 'constrain'});

            switch (unit) {
                case "week":
                case "wk":
                    if (when === "next") {
                        date = date.add({days: 7});
                    } else if (when === "last" || when === "previous") {
                        date = date.subtract({days: 7});
                    }
                    // Set to the end of the week (assuming Sunday as the first day of the week)
                    date = date
                        .add({days: 6 - (date.dayOfWeek % 7)});
                    break;
                case "mo":
                case "mon":
                case "month":
                    if (when === "next") {
                        date = date.add({months: 1});
                    } else if (when === "last" || when === "previous") {
                        date = date.subtract({months: 1});
                    }
                    date = date
                        .with({day: 32}, {overflow: 'constrain'})
                        .startOfDay();
                    break;
                case "y":
                case "yr":
                case "year":
                    if (when === "next") {
                        date = date.add({years: 1});
                    } else if (when === "last" || when === "previous") {
                        date = date.subtract({years: 1});
                    }
                    date = date
                        .with({month: 12, day: 32}, {overflow: 'constrain'})
                        .startOfDay();
                    break;
            }

            date = date
                .add({days: -((date.dayOfWeek + 7 - weekday) % 7)});
            matches.push({match, date});
        }
    }

    // '<number> <unit|week>'
    {
        const pattern = new RegExp(String.raw`\b(${numberRegex.source})\s+(${unit.source})\b`, 'gi');
        let match: RegExpExecArray;
        while ((match = pattern.exec(text)) !== null) {
            const value = parseInt(match[1]);
            const unit = match[2].toLowerCase();

            if (isNaN(value)) continue;

            let date = new Temporal.ZonedDateTime(ns, timeZoneId)
                .startOfDay();

            if (unit.startsWith("week") || unit === "w" || unit === "wk" || unit === "wks") {
                date = date.add({ days: value * 7 });
            } else if (unit.startsWith("day") || unit === "d") {
                date = date.add({ days: value });
            } else if (unit.startsWith("month") || unit === "mo" || unit === "mos") {
                date = date.add({ months: value });
            } else if (unit.startsWith("year") || unit === "y" || unit === "yr" || unit === "yrs") {
                date = date.add({ years: value });
            } else if (unit.startsWith("weekday")) {
                let daysAdded = 0;
                while (daysAdded < value) {
                    date = date.add({ days: 1 });
                    if (date.dayOfWeek !== 0 && date.dayOfWeek !== 6) { // Not Sunday or Saturday
                        daysAdded++;
                    }
                }
            } else {
                continue;
            }

            matches.push({match, date});
        }
    }

    // '<ordinal | reltext> <unit>'
    {
        const pattern = new RegExp(String.raw`\b(${ordinal.source})\s+(${unit.source})\b`, 'gi');
        let match: RegExpExecArray;
        while ((match = pattern.exec(text)) !== null) {
            const ordinalText = match[1].toLowerCase();
            const unit = match[2].toLowerCase();

            let date = new Temporal.ZonedDateTime(ns, timeZoneId)
                .startOfDay();

            const ordinalNumber = ordinalToNumber(ordinalText);
            if (!isNaN(ordinalNumber)) {
                if (unit.startsWith("week") || unit === "w" || unit === "wk" || unit === "wks") {
                    date = date.add({ days: (ordinalNumber - 1) * 7 });
                } else if (unit.startsWith("day") || unit === "d") {
                    date = date.add({ days: ordinalNumber - 1 });
                } else if (unit.startsWith("month") || unit === "mo" || unit === "mos") {
                    date = date.add({ months: ordinalNumber - 1 });
                } else if (unit.startsWith("year") || unit === "y" || unit === "yr" || unit === "yrs") {
                    date = date.add({ years: ordinalNumber - 1 });
                } else if (unit.startsWith("weekday")) {
                    let daysAdded = 0;
                    while (daysAdded < ordinalNumber) {
                        date = date.add({ days: 1 });
                        if (date.dayOfWeek !== 0 && date.dayOfWeek !== 6) { // Not Sunday or Saturday
                            daysAdded++;
                        }
                    }
                } else {
                    continue;
                }
            } else {
                // Relative text
                if (ordinalText === "next") {
                    if (unit.startsWith("week") || unit === "w" || unit === "wk" || unit === "wks") {
                        date = date.add({days: 7});
                    } else if (unit.startsWith("day") || unit === "d") {
                        date = date.add({days: 1});
                    } else if (unit.startsWith("month") || unit === "mo" || unit === "mos") {
                        date = date.add({months: 1});
                    } else if (unit.startsWith("year") || unit === "y" || unit === "yr" || unit === "yrs") {
                        date = date.add({years: 1});
                    } else if (unit.startsWith("weekday")) {
                        let daysAdded = 0;
                        while (daysAdded < 1) {
                            date = date.add({days: 1});
                            if (date.dayOfWeek !== 0 && date.dayOfWeek !== 6) { // Not Sunday or Saturday
                                daysAdded++;
                            }
                        }
                    } else {
                        continue;
                    }
                } else if (ordinalText === "last" || ordinalText === "previous") {
                    if (unit.startsWith("week") || unit === "w" || unit === "wk" || unit === "wks") {
                        date = date.subtract({days: 7});
                    } else if (unit.startsWith("day") || unit === "d") {
                        date = date.subtract({days: 1});
                    } else if (unit.startsWith("month") || unit === "mo" || unit === "mos") {
                        date = date.subtract({months: 1});
                    } else if (unit.startsWith("year") || unit === "y" || unit === "yr" || unit === "yrs") {
                        date = date.subtract({years: 1});
                    } else if (unit.startsWith("weekday")) {
                        let daysSubtracted = 0;
                        while (daysSubtracted < 1) {
                            date = date.subtract({days: 1});
                            if (date.dayOfWeek !== 0 && date.dayOfWeek !== 6) { // Not Sunday or Saturday
                                daysSubtracted++;
                            }
                        }
                    } else {
                        continue;
                    }
                } else if (ordinalText === "this") {
                    // Do nothing, just use the current date
                } else {
                    continue;
                }
            }
            matches.push({match, date});
        }
    }

    // '<dayname>'
    {
        const pattern = new RegExp(String.raw`\b(${dayNameRegex.source})\b`, 'gi');
        let match: RegExpExecArray;
        while ((match = pattern.exec(text)) !== null) {
            const dayName = match[1].toLowerCase();

            const weekday = getWeekday(dayName);
            if (isNaN(weekday)) continue;

            let date = new Temporal.ZonedDateTime(ns, timeZoneId)
                .startOfDay();

            // Move to the next occurrence of the specified weekday
            date = date.add({ days: (weekday - date.dayOfWeek + 7) % 7 });

            matches.push({match, date});
        }
    }

    // '<daytext> <last|this|next|previous> week'
    {
        const pattern = new RegExp(String.raw`\b(${dayTextRegex.source})\s+(${relativeTextRegex.source})\s+week\b`, 'gi');
        let match: RegExpExecArray;
        while ((match = pattern.exec(text)) !== null) {
            const when = match[2];

            let date = new Temporal.ZonedDateTime(ns, timeZoneId)
                .startOfDay();
            date = date
                .subtract({ days: date.dayOfWeek % 7 }); // Start of this week (Sunday)

            if (when === "next") {
                date = date.add({ days: 7 });
            } else if (when === "last" || when === "previous") {
                date = date.subtract({ days: 7 });
            }

            matches.push({match, date});
        }
    }

    return matches
        .sort((a, b) => a.match.index - b.match.index);
}
