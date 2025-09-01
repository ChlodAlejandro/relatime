export default function dbTimezone(timezone: string | null): string | number {
    if (timezone.startsWith("custom:")) {
        const offsetHours = parseInt(timezone.replace(/^custom:/, ""), 10);

    } else {
        return timezone.replace(/^iana:/, "");
    }
}
