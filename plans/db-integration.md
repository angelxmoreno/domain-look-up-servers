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
