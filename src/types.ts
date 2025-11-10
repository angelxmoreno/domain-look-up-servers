export type LookUpEntry = {
    whois?: string | null;
    rdap?: string | null;
}

export type LookUpRecord = Record<string, LookUpEntry>;
