import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import * as cheerio from 'cheerio';
import type { LookUpEntry, LookUpRecord } from './types';

const IANA_ROOT_DB_URL = 'https://www.iana.org/domains/root/db';
const IANA_BASE_URL = 'https://www.iana.org';
const CACHE_DIR = join(process.cwd(), '.cache', 'tlds');
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

interface TLDInfo {
    tld: string;
    detailUrl: string;
}

interface CachedTLD {
    timestamp: number;
    data: LookUpEntry;
}

/**
 * Get the cache file path for a specific TLD
 */
function getCacheFilePath(tld: string): string {
    return join(CACHE_DIR, `${tld}.json`);
}

/**
 * Load cached data for a specific TLD if it exists and is still valid
 */
async function loadTLDCache(tld: string): Promise<LookUpEntry | null> {
    try {
        const cacheFile = getCacheFilePath(tld);
        if (!existsSync(cacheFile)) {
            return null;
        }

        const content = await readFile(cacheFile, 'utf-8');
        const cached: CachedTLD = JSON.parse(content);

        const age = Date.now() - cached.timestamp;
        if (age > CACHE_DURATION) {
            return null; // Cache expired
        }

        return cached.data;
    } catch (_error) {
        return null; // Failed to load, will refetch
    }
}

/**
 * Save TLD data to cache
 */
async function saveTLDCache(tld: string, data: LookUpEntry): Promise<void> {
    try {
        // Ensure cache directory exists
        if (!existsSync(CACHE_DIR)) {
            await mkdir(CACHE_DIR, { recursive: true });
        }

        const cached: CachedTLD = {
            timestamp: Date.now(),
            data,
        };

        const cacheFile = getCacheFilePath(tld);
        await writeFile(cacheFile, JSON.stringify(cached), 'utf-8');
    } catch (error) {
        // Non-fatal: just log and continue
        console.warn(`Failed to cache ${tld}:`, error);
    }
}

/**
 * Load all cached TLDs
 */
async function _loadAllCachedTLDs(): Promise<{
    cached: LookUpRecord;
    count: number;
}> {
    const cached: LookUpRecord = {};
    let count = 0;

    try {
        if (!existsSync(CACHE_DIR)) {
            return { cached, count };
        }

        const { readdir } = await import('node:fs/promises');
        const files = await readdir(CACHE_DIR);

        for (const file of files) {
            if (!file.endsWith('.json')) continue;

            const tld = file.replace('.json', '');
            const data = await loadTLDCache(tld);

            if (data && (data.whois || data.rdap)) {
                cached[tld] = data;
                count++;
            }
        }
    } catch (error) {
        console.warn('Failed to load cached TLDs:', error);
    }

    return { cached, count };
}

/**
 * Fetch and parse the IANA root database page to get all TLDs
 */
async function fetchTLDs(): Promise<TLDInfo[]> {
    console.log('Fetching IANA root database...');
    const response = await fetch(IANA_ROOT_DB_URL);

    if (!response.ok) {
        throw new Error(`Failed to fetch IANA root database: ${response.status} ${response.statusText}`);
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
 * Process all TLDs with rate limiting and incremental caching
 */
async function processTLDs(tlds: TLDInfo[], forceRefresh: boolean): Promise<LookUpRecord> {
    const result: LookUpRecord = {};
    const total = tlds.length;
    let processed = 0;
    let cachedCount = 0;
    let fetchedCount = 0;

    console.log(`Processing ${total} TLDs...`);

    // Process in batches to avoid overwhelming the server
    const batchSize = 10;
    for (let i = 0; i < tlds.length; i += batchSize) {
        const batch = tlds.slice(i, i + batchSize);

        const batchResults = await Promise.all(
            batch.map(async (tldInfo) => {
                let details: LookUpEntry;
                let fromCache = false;

                // Try to load from cache first (unless force refresh)
                if (!forceRefresh) {
                    const cached = await loadTLDCache(tldInfo.tld);
                    if (cached) {
                        details = cached;
                        fromCache = true;
                        cachedCount++;
                    }
                }

                // Fetch if not cached or force refresh
                if (!fromCache) {
                    details = await fetchTLDDetails(tldInfo);
                    fetchedCount++;

                    // Save to cache immediately after fetching
                    if (details.whois || details.rdap) {
                        await saveTLDCache(tldInfo.tld, details);
                    }
                }

                processed++;

                if (processed % 50 === 0 || processed === total) {
                    console.log(
                        `Progress: ${processed}/${total} (${Math.round((processed / total) * 100)}%) - Cached: ${cachedCount}, Fetched: ${fetchedCount}`
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

    console.log(`\nCompleted: ${cachedCount} from cache, ${fetchedCount} fetched`);
    return result;
}

/**
 * Generate the servers.json file
 */
async function generateServersFile(data: LookUpRecord): Promise<void> {
    // Sort the data alphabetically by TLD
    const sortedData: LookUpRecord = {};
    Object.keys(data)
        .sort((a, b) => a.localeCompare(b))
        .forEach((tld) => {
            sortedData[tld] = data[tld];
        });

    const outputPath = join(process.cwd(), 'servers.json');
    await writeFile(outputPath, JSON.stringify(sortedData, null, 2), 'utf-8');
    console.log(`\nGenerated servers.json with ${Object.keys(data).length} TLDs`);
}

/**
 * Main crawler function
 */
async function main() {
    try {
        console.log('Starting IANA domain crawler...\n');

        const forceRefresh = process.argv.includes('--force');

        if (forceRefresh) {
            console.log('Force refresh enabled. Ignoring cache.\n');
        }

        // Fetch all TLDs from IANA
        const tlds = await fetchTLDs();

        // Process each TLD (with incremental caching)
        // This will check cache for each TLD and only fetch what's missing or expired
        const lookupData = await processTLDs(tlds, forceRefresh);

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
