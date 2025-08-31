export interface CustomTimezone {
    _custom: true;
    name: string;
    standard: { offset: number };
}

export function isCustomTimezone(tz: any): tz is CustomTimezone {
    return (tz as CustomTimezone)._custom === true;
}
