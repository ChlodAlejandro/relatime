export interface CustomTimezone {
    _custom: true;
    name: string;
    standard: { offset: number };
}

export function isCustomTimezone(tz: unknown): tz is CustomTimezone {
    return (tz as CustomTimezone)._custom === true;
}
