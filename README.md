# Domain Look-Up Servers

A TypeScript/Bun project that crawls the [IANA Root Database](https://www.iana.org/domains/root/db) to generate a comprehensive list of WHOIS and RDAP servers for all top-level domains (TLDs).

## Features

- 🚀 Fast crawling using Bun runtime
- 📊 Extracts WHOIS and RDAP server information for 1300+ TLDs
- 🔄 Batch processing with rate limiting to be respectful to IANA servers
- 💾 Incremental per-TLD caching system (7-day cache) for resilient crawling
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
1. Fetch the list of all TLDs from the IANA root database
2. For each TLD, check if cached data exists (valid for 7 days)
3. Use cached data if available, otherwise fetch from IANA
4. Save each TLD to cache immediately after fetching
5. Generate `servers.json` with all collected data

**Resilient crawling**: If the crawler fails midway (e.g., network error at TLD #500), the next run will automatically pick up where it left off. Already-cached TLDs are skipped, and only missing or expired TLDs are fetched.

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
│   └── tlds/        # Individual TLD cache files
│       ├── com.json
│       ├── org.json
│       └── ... (1300+ files, 7-day expiry each)
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

1. **Fetch TLD List**: Fetches the IANA root database page which contains a table of all 1300+ TLDs
2. **Extract Detail URLs**: For each TLD, extracts the URL to the TLD's detail page
3. **Incremental Processing**: For each TLD (processed in batches of 10):
   - **Check Cache**: Looks for `.cache/tlds/{tld}.json` with data less than 7 days old
   - **Use Cache or Fetch**: If cached and valid, uses cached data; otherwise fetches from IANA
   - **Parse Details**: If fetching, extracts WHOIS server hostname and RDAP service URL
   - **Save Immediately**: Caches the result immediately after fetching (resilient to failures)
4. **Generate Output**: Combines all cached and fetched data, sorts alphabetically, and writes to `servers.json`

**Why incremental caching?** If the crawler fails at TLD #500 due to network issues, the next run will use the 500 cached TLDs and only fetch the remaining 800+. This makes the crawler resilient and efficient.

## Development

Watch mode for development:

```bash
bun run dev
```

## License

MIT