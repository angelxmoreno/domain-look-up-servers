import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import * as cheerio from 'cheerio';
import type { LookUpEntry, LookUpRecord } from './types';

const IANA_ROOT_DB_URL = 'https://www.iana.org/domains/root/db';
const IANA_BASE_URL = 'https://www.iana.org';

interface TLDInfo {
  tld: string;
  detailUrl: string;
}

/**
 * Fetch and parse the IANA root database page to get all TLDs
 */
async function fetchTLDs(): Promise<TLDInfo[]> {
  console.log('Fetching IANA root database...');
  const response = await fetch(IANA_ROOT_DB_URL);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch IANA root database: ${response.status} ${response.statusText}`
    );
  }

  const html = await response.text();

  const $ = cheerio.load(html);
  const tlds: TLDInfo[] = [];

  // The IANA page has a table with TLDs in the first column
  $('#tld-table tbody tr').each((_, element) => {
    const $row = $(element);
    const $link = $row.find('td:first-child a');
    const tld = $link.text().trim().replace('.', ''); // Remove leading dot
    const relativeUrl = $link.attr('href');

    if (tld && relativeUrl) {
      tlds.push({
        tld: tld.toLowerCase(),
        detailUrl: IANA_BASE_URL + relativeUrl,
      });
    }
  });

  console.log(`Found ${tlds.length} TLDs`);
  return tlds;
}

/**
 * Clean and extract server hostname from text
 */
export function cleanServerName(text: string): string | undefined {
  if (!text || text === 'None' || text.includes('Not assigned')) {
    return undefined;
  }

  // Remove common prefixes and clean up
  text = text
    .replace(/URL for registration services:\s*https?:\/\/[^\s]+/gi, '')
    .replace(/RDAP Server:/gi, '')
    .replace(/WHOIS Server:/gi, '')
    .trim();

  // Extract hostname pattern (e.g., whois.nic.com or subdomain.example.com)
  const hostnameMatch = text.match(/([a-z0-9][-a-z0-9]*\.)*[a-z0-9][-a-z0-9]*\.[a-z]{2,}/i);
  if (hostnameMatch) {
    return hostnameMatch[0].toLowerCase().trim();
  }

  return undefined;
}

/**
 * Clean and extract RDAP URL from text
 */
export function cleanRdapUrl(url: string): string | undefined {
  if (!url) return undefined;

  // Remove trailing punctuation and whitespace
  url = url.replace(/[,.\s]+$/, '').trim();

  // Validate it's a proper HTTP(S) URL
  if (!url.match(/^https?:\/\/.+/i)) {
    return undefined;
  }

  return url;
}

/**
 * Fetch details for a specific TLD and extract WHOIS and RDAP servers
 */
async function fetchTLDDetails(tldInfo: TLDInfo): Promise<LookUpEntry> {
  try {
    const response = await fetch(tldInfo.detailUrl);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    let whois: string | undefined;
    let rdap: string | undefined;

    // Find WHOIS server
    // Looking for a section that contains "WHOIS Server:"
    $('b').each((_, element) => {
      const text = $(element).text().trim();
      if (text === 'WHOIS Server:') {
        // Get the next sibling or parent text
        let value = $(element).next().text().trim();
        if (!value) {
          // Try getting from parent and removing the label
          value = $(element).parent().text().replace('WHOIS Server:', '').trim();
        }

        whois = cleanServerName(value);
      }
    });

    // Find RDAP server
    // First, look for RDAP label and get the URL from the following content
    $('b').each((_, element) => {
      const text = $(element).text().trim();
      if (text === 'RDAP Server:') {
        // Try to find a link in the next elements
        const $next = $(element).next();
        if ($next.is('a')) {
          const href = $next.attr('href');
          if (href?.startsWith('http')) {
            rdap = cleanRdapUrl(href);
          }
        } else {
          // Look for URL in text
          const value = $next.text().trim();
          const urlMatch = value.match(/(https?:\/\/[^\s]+)/i);
          if (urlMatch) {
            rdap = cleanRdapUrl(urlMatch[1]);
          }
        }
      }
    });

    // Alternative: look for RDAP links
    if (!rdap) {
      $('a').each((_, element) => {
        const href = $(element).attr('href') || '';
        const text = $(element).text().trim().toLowerCase();

        // Check if this is an RDAP URL
        if ((href.includes('rdap') || text.includes('rdap')) && href.startsWith('http')) {
          rdap = cleanRdapUrl(href);
          return false; // Break the loop
        }
      });
    }

    // Last resort: look for RDAP base URL in page text
    if (!rdap) {
      const pageText = $('body').text();
      const rdapMatch = pageText.match(/RDAP Server:\s*(https?:\/\/[^\s]+)/i);
      if (rdapMatch) {
        rdap = cleanRdapUrl(rdapMatch[1]);
      }
    }

    return {
      whois,
      rdap,
    };
  } catch (error) {
    console.error(`Error fetching details for ${tldInfo.tld}:`, error);
    return {};
  }
}

/**
 * Process all TLDs with rate limiting
 */
async function processTLDs(tlds: TLDInfo[]): Promise<LookUpRecord> {
  const result: LookUpRecord = {};
  const total = tlds.length;
  let processed = 0;

  console.log(`Processing ${total} TLDs...`);

  // Process in batches to avoid overwhelming the server
  const batchSize = 10;
  for (let i = 0; i < tlds.length; i += batchSize) {
    const batch = tlds.slice(i, i + batchSize);

    const batchResults = await Promise.all(
      batch.map(async (tldInfo) => {
        const details = await fetchTLDDetails(tldInfo);
        processed++;

        if (processed % 50 === 0 || processed === total) {
          console.log(
            `Progress: ${processed}/${total} (${Math.round((processed / total) * 100)}%)`
          );
        }

        return { tld: tldInfo.tld, details };
      })
    );

    // Add results to the record
    for (const { tld, details } of batchResults) {
      // Only add if there's at least one server defined
      if (details.whois || details.rdap) {
        result[tld] = details;
      }
    }

    // Small delay between batches
    if (i + batchSize < tlds.length) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  return result;
}

/**
 * Generate the servers.ts file
 */
async function generateServersFile(data: LookUpRecord): Promise<void> {
  const entries = Object.entries(data)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([tld, entry]) => {
      const props: string[] = [];

      if (entry.whois) {
        props.push(`whois: '${entry.whois}'`);
      }
      if (entry.rdap) {
        props.push(`rdap: '${entry.rdap}'`);
      }

      const indent = '        ';
      const propsStr = props.join(`,\n${indent}`);

      return `    '${tld}': {\n${indent}${propsStr}\n    }`;
    })
    .join(',\n');

  const content = `import type { LookUpRecord } from './types';

export const domainLookUpServers: LookUpRecord = {
${entries}
};
`;

  const outputPath = join(process.cwd(), 'src', 'servers.ts');
  await writeFile(outputPath, content, 'utf-8');
  console.log(`\nGenerated servers.ts with ${Object.keys(data).length} TLDs`);
}

/**
 * Main crawler function
 */
async function main() {
  try {
    console.log('Starting IANA domain crawler...\n');

    // Fetch all TLDs
    const tlds = await fetchTLDs();

    // Process each TLD to get WHOIS/RDAP info
    const lookupData = await processTLDs(tlds);

    // Generate the output file
    await generateServersFile(lookupData);

    console.log('\nCrawling completed successfully!');
  } catch (error) {
    console.error('Error during crawling:', error);
    process.exit(1);
  }
}

// Run the crawler only if this is the main module
if (import.meta.main) {
  main();
}
