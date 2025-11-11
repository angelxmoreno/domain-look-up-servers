# Domain Look-Up Servers

A TypeScript/Bun project that crawls the [IANA Root Database](https://www.iana.org/domains/root/db) to generate a comprehensive list of WHOIS and RDAP servers for all top-level domains (TLDs).

## Features

- 🚀 Fast crawling using Bun runtime
- 📊 Extracts WHOIS and RDAP server information for 1300+ TLDs
- 🔄 Batch processing with rate limiting to be respectful to IANA servers
- 💾 Smart caching system (7-day cache) to avoid repeated API calls
- 📄 Generates JSON output for universal language support

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

To crawl the IANA database and generate the `servers.json` file:

```bash
bun run crawl
```

This will:
1. Check for cached data (valid for 7 days)
2. If cache is valid, use cached data
3. Otherwise, fetch all TLDs from the IANA root database
4. Visit each TLD's detail page to extract WHOIS and RDAP servers
5. Save results to cache and generate `servers.json`

### Force Refresh

To ignore the cache and fetch fresh data:

```bash
bun run crawl --force
```

### Using the Generated Data

The `servers.json` file is a simple JSON object that can be used in any programming language:

```json
{
  "com": {
    "whois": "whois.verisign-grs.com",
    "rdap": "https://rdap.verisign.com/com/v1/"
  },
  "org": {
    "whois": "whois.pir.org",
    "rdap": "https://rdap.publicinterestregistry.org/rdap/"
  }
}
```

**JavaScript/TypeScript:**
```typescript
import servers from './servers.json';

// Get WHOIS server for .com domains
const comServers = servers.com;
console.log(comServers.whois); // 'whois.verisign-grs.com'
console.log(comServers.rdap);  // 'https://rdap.verisign.com/com/v1/'
```

**Python:**
```python
import json

with open('servers.json', 'r') as f:
    servers = json.load(f)

com_servers = servers['com']
print(com_servers['whois'])  # whois.verisign-grs.com
```

**Any other language:** Simply parse the JSON file.

## Project Structure

```text
domain-look-up-servers/
├── .cache/          # Cache directory (gitignored)
│   └── tld-data.json  # Cached TLD data (7-day expiry)
├── src/
│   ├── crawler.ts    # Main crawler script
│   └── types.ts      # TypeScript type definitions
├── tests/
│   └── crawler.test.ts  # Unit tests
├── servers.json      # Generated lookup data (created by crawler)
├── package.json
├── tsconfig.json
└── README.md
```

## How It Works

1. **Check Cache**: First checks if cached data exists and is less than 7 days old
2. **Fetch TLD List**: If no valid cache, fetches the IANA root database page which contains a table of all TLDs
3. **Extract Detail URLs**: For each TLD, extracts the URL to the TLD's detail page
4. **Parse Details**: Visits each detail page and extracts:
   - WHOIS server hostname (e.g., `whois.verisign-grs.com`)
   - RDAP service URL (e.g., `https://rdap.verisign.com/com/v1/`)
5. **Save Cache**: Stores the collected data in `.cache/tld-data.json` for future runs
6. **Generate Output**: Formats all data and writes to `servers.json` at the project root

## Development

Watch mode for development:

```bash
bun run dev
```

## License

MIT