# Domain Look-Up Servers

A TypeScript/Bun project that crawls the [IANA Root Database](https://www.iana.org/domains/root/db) to generate a comprehensive list of WHOIS and RDAP servers for all top-level domains (TLDs).

## Features

- 🚀 Fast crawling using Bun runtime
- 📊 Extracts WHOIS and RDAP server information for 1300+ TLDs
- 🔄 Batch processing with rate limiting to be respectful to IANA servers
- 📝 Generates type-safe TypeScript output

## Requirements

- [Bun](https://bun.sh/) runtime (v1.0+)

## Installation

```bash
# Install Bun (if not already installed)
curl -fsSL https://bun.sh/install | bash

# Install dependencies
bun install
```

## Usage

### Run the Crawler

To crawl the IANA database and generate the `servers.ts` file:

```bash
bun run crawl
```

This will:
1. Fetch all TLDs from the IANA root database
2. Visit each TLD's detail page to extract WHOIS and RDAP servers
3. Generate `src/servers.ts` with the collected data

### Using the Generated Data

```typescript
import { domainLookUpServers } from './src/servers';

// Get WHOIS server for .com domains
const comServers = domainLookUpServers.com;
console.log(comServers.whois); // 'whois.verisign-grs.com'
console.log(comServers.rdap);  // 'https://rdap.verisign.com/com/v1/'

// Check if a TLD has RDAP support
if (domainLookUpServers.org?.rdap) {
    console.log('RDAP is supported for .org domains');
}
```

## Generated File Structure

The generated `src/servers.ts` file has the following structure:

```typescript
export type LookUpEntry = {
    whois?: string | null;
    rdap?: string | null;
}

export type LookUpRecord = Record<string, LookUpEntry>;

export const domainLookUpServers: LookUpRecord = {
    com: {
        whois: 'whois.verisign-grs.com',
        rdap: 'https://rdap.verisign.com/com/v1/'
    },
    org: {
        whois: 'whois.pir.org',
        rdap: 'https://rdap.publicinterestregistry.org/rdap/'
    },
    // ... 1300+ more TLDs
}
```

## Project Structure

```
domain-look-up-servers/
├── src/
│   ├── crawler.ts    # Main crawler script
│   ├── types.ts      # TypeScript type definitions
│   └── servers.ts    # Generated lookup data (created by crawler)
├── package.json
├── tsconfig.json
└── README.md
```

## How It Works

1. **Fetch TLD List**: The crawler starts by fetching the IANA root database page which contains a table of all TLDs
2. **Extract Detail URLs**: For each TLD, it extracts the URL to the TLD's detail page
3. **Parse Details**: It visits each detail page and extracts:
   - WHOIS server hostname (e.g., `whois.verisign-grs.com`)
   - RDAP service URL (e.g., `https://rdap.verisign.com/com/v1/`)
4. **Generate Output**: All collected data is formatted and written to `src/servers.ts`

## Development

Watch mode for development:

```bash
bun run dev
```

## License

MIT