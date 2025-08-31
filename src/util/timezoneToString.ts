import {DisplayFormat} from "timezone-soft";
import {CustomTimezone, isCustomTimezone} from "./isCustomTimezone";
import offsetToString from "./offsetToString";

export default function timezoneToString(timezone: CustomTimezone | DisplayFormat | string | number): string {
    let timeString = "";
    if (typeof timezone === "number") {
        return offsetToString(timezone);
    } else if (typeof timezone === "string") {
        return timezone;
    } if (isCustomTimezone(timezone)) {
        timeString = `${timezone.name}`;
        // Multiplication to avoid floating point errors
        if ((timezone.standard.offset * 100 % 100) / 25 !== 0) {
            timeString += " (yes, we support this too)";
        }
    } else {
        let subInfo = "";
        if ((timezone as any).name) {
            timeString = `${(timezone as any).name}`
            subInfo = `\`${timezone.iana}\``;
        } else {
            timeString = `\`${timezone.iana}\``;
        }
        if (subInfo) {
            subInfo += `, `;
        }
        if (timezone.standard) {
            subInfo += offsetToString((timezone.standard as any).offset);
        }
        if (timezone.daylight && (timezone.standard as any).offset !== (timezone.standard as any).offset) {
            if (subInfo) {
                subInfo += `, `;
            }
            subInfo += `${offsetToString((timezone.daylight as any).offset)} on daylight savings`;
        }
        if (subInfo) {
            timeString += ` (${subInfo})`;
        }
    }

    return timeString;
}
