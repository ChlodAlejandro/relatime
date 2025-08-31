import offsetToString from "./offsetToString";

export default function dateToString(date: Date, timezone: string | number, locale: string, format: Intl.DateTimeFormatOptions = {}): string {
    if (typeof timezone === "number") {
        // timezone is an offset in hours
        const offset = timezone * 60;
        const localDate = new Date(date.getTime() + (date.getTimezoneOffset() + offset) * 60e3);
        return localDate.toLocaleString(
            locale,
            Object.assign({}, format, {
                timeZone: "UTC",
                timeZoneName: undefined
            })
        ) + " " + offsetToString(timezone);
    } else {
        // timezone is an IANA timezone name
        return date.toLocaleString(locale, {timeZone: timezone, ...format});
    }
}
