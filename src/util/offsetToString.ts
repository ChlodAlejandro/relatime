/**
 * Convert a timezone offset into a string.
 *
 * @param offset The offset in hours.
 */
export default function offsetToString(offset: number): string {
    const offsetSign = (offset < 0 ? "-" : "+");
    const offsetHour = Math.floor(Math.abs(offset));
    const offsetMinute = Math.round((Math.abs(offset) - offsetHour) * 60);

    return `UTC${offsetSign}${offsetHour.toString().padStart(2, "0")}:${offsetMinute.toString().padStart(2, "0")}`;

}
