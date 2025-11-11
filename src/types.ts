export type LookUpEntry = {
  whois?: string;
  rdap?: string;
};

export type LookUpRecord = Record<string, LookUpEntry>;
