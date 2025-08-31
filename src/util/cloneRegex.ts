export interface CloneRegexOptions {
    prefix: string;
    postfix: string;
    flags: string;
}

export default function cloneRegex(regex: RegExp, options: Partial<CloneRegexOptions> = {}): RegExp {
    const flags = options.flags ?? regex.flags;
    let pattern = regex.source;
    if (options.prefix) {
        pattern = options.prefix + `(?:${pattern})`;
    }
    if (options.postfix) {
        pattern = `(?:${pattern})` + options.postfix;
    }
    return new RegExp(pattern, flags);
}
