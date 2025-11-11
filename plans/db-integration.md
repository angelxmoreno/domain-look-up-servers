# Plan: Database Integration for TLD Crawler

This plan outlines the steps to replace the current file-based caching and data storage with a more robust SQLite database.

## Phase 1: Core Database Migration

The initial goal is to replicate the existing crawler's functionality using a database instead of a file-based cache. This provides a solid foundation for future enhancements.

### Technology

-   **Database:** SQLite
-   **Driver:** `bun:sqlite`. Since the project uses Bun, we can leverage its built-in, high-performance SQLite driver for simplicity and speed.

### Database Schema

A single table is sufficient for the initial migration.

-   **`tlds` table:**
  -   `tld` (TEXT, PRIMARY KEY): The top-level domain (e.g., "com").
  -   `whois_server` (TEXT): The hostname of the WHOIS server.
  -   `rdap_server` (TEXT): The URL of the RDAP server.
  -   `last_fetched_at` (INTEGER): The Unix timestamp (milliseconds) of when the record was last fetched.

### Updated Crawler Workflow

The `src/crawler.ts` script will be modified as follows:

1.  **Initialization:** On startup, the script connects to the SQLite database.
2.  **Fetch TLD List:** The crawler fetches the master list of all TLDs from the IANA root database page, as it currently does.
3.  **Process Each TLD:** For each TLD in the list:
    a. **Check Cache:** Query the `tlds` table for an entry with the given `tld`.
    b. **Validate Cache:** If an entry exists, check its `last_fetched_at` timestamp. If the data is still fresh (e.g., less than 7 days old), skip to the next TLD. This replaces the `loadTLDCache` logic.
    c. **Fetch Data:** If no entry exists or the data is stale, fetch the details from the IANA website.
    d. **Save to DB:** Use an `UPSERT` (e.g., `INSERT ... ON CONFLICT DO UPDATE`) statement to insert or update the record in the `tlds` table with the new `whois_server`, `rdap_server`, and the current `last_fetched_at` timestamp. This replaces `saveTLDCache`.
4.  **Generate `servers.json`:** After the crawling process is complete, the `generateServersFile` function will be updated to:
    a. Query the `tlds` table to get all records.
    b. Format the results into the same key-value structure as the current `servers.json`.
    c. Write the final JSON object to the `servers.json` file.

### Error Handling

To ensure resilience, the crawler will adopt the following error-handling strategies, mirroring the project's existing graceful-degradation patterns. Each scenario will include robust logging and metrics.

-   **Startup DB Connection:**
  -   **Policy:** Implement a retry policy with exponential backoff for transient connection errors. Fail-fast after 3 attempts.
  -   **Fallback:** If the connection fails permanently, the crawler can optionally fall back to the file-based cache mode to ensure basic functionality, emitting clear logs and metrics to indicate the degraded state.
  -   **Recovery:** Manual intervention to check database file permissions, disk space, or corruption.

-   **UPSERT Failure Handling:**
  -   **Policy:** Wrap `UPSERT` operations in transactions to ensure atomicity. Retry transient errors (e.g., database locked) with a brief delay.
  -   **Resilience:** If an `UPSERT` fails permanently for a specific TLD, mark the row as failed (e.g., in-memory set), log the error, and continue the crawl to avoid halting the entire process.
  -   **Recovery:** A post-crawl job or a retry queue can be used to process the list of failed TLDs, ensuring eventual consistency.

-   **IANA Fetch Failures:**
  -   **Policy:** If an IANA fetch fails, use the stale value from the database, provided it is not older than the defined freshness threshold. Log a warning indicating stale data is being served.
  -   **Resilience:** Implement a backoff retry mechanism for individual TLD fetch failures. If a TLD fetch fails repeatedly, skip it for the current run but do not halt the entire crawl. The process should only terminate if a high threshold of fetches fail (e.g., >25%).
  -   **Recovery:** Failures are typically transient; the next scheduled crawl will automatically retry. Persistent failures may require updates to the scraper's logic.

-   **Data Integrity and Remediation:**
  -   **Policy:** Implement periodic validation queries (e.g., on startup) to check for corrupt rows or schema drift.
  -   **Resilience:** If corruption is detected, attempt to automatically repair the affected row by re-fetching the data from IANA. If repair fails, quarantine the row and raise an alert.
  -   **Recovery:** Expose alerts for human intervention when automatic repair is not possible. Recovery may involve restoring from a backup or manually editing the database entry.

## Phase 2: Change Tracking and Release Management

Building on the foundation from Phase 1, we can implement a system for tracking changes and generating releases. This aligns with the original, more advanced plan.

### Additional Schema

-   **`releases` table:**
  -   `id` (INTEGER, PRIMARY KEY)
  -   `version` (TEXT): The semantic version of the release (e.g., "v1.2.3").
  -   `created_at` (INTEGER): Unix timestamp of the release.

-   **`changes` table:**
  -   `id` (INTEGER, PRIMARY KEY)
  -   `release_id` (INTEGER, FOREIGN KEY to `releases.id`): The release this change is part of.
  -   `tld` (TEXT): The TLD that was changed.
  -   `change_type` (TEXT): The type of change ('add', 'remove', 'update').
  -   `field` (TEXT): The field that changed ('whois_server' or 'rdap_server').
  -   `old_value` (TEXT): The previous value.
  -   `new_value` (TEXT): The new value.

### Future Workflow Enhancements

-   **Change Detection:** During the crawl, when fetched data differs from the data in the `tlds` table, log the difference in the `changes` table.
-   **Release Generation:** Create a separate script or command to bundle all unreleased changes into a new version, create a `releases` entry, and generate a changelog entry.

This two-phased approach allows for a smoother, more iterative integration of the database while preserving the long-term vision for versioning and change tracking.
