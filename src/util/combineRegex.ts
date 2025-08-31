export interface CombineRegexOptions {
    trimStart: RegExp;
    trimEnd: RegExp;
    append: string;
    prepend: string;
}

export default function combineRegex(
    regexes: RegExp[],
    options: Partial<CombineRegexOptions> = {},
): RegExp {
    let sources = regexes
        .map(r => r.source);

    if (options.trimStart)
        sources = sources
            .map(s => s.replace(
                new RegExp(`^${options.trimStart.source}`), ""),
            );
    if (options.trimEnd)
        sources = sources
            .map(s => s.replace(
                new RegExp(`${options.trimEnd.source}$`), ""),
            );

    const flags = Array.from(
        new Set(
            regexes.map(r => r.flags).join(""),
        ),
    ).join("");

    let source = sources
        .map(s => `(?:${s})`)
        .join("|");
    if (options.prepend)
        source = `${options.prepend}(?:${source})`;
    if (options.append)
        source = `(?:${source})${options.append}`;

    return new RegExp(source, flags);
}
