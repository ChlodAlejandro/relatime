export default function convertToStringMatch(regex: RegExp): RegExp {
    return new RegExp(`^(?:${regex.source})$`, regex.flags);
}
