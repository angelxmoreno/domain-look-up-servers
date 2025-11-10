# Tests

This directory contains unit tests for the domain-look-up-servers project.

## Prerequisites

This project uses [Bun](https://bun.sh) as its runtime. Make sure you have Bun installed:

```bash
curl -fsSL https://bun.sh/install | bash
```

## Running Tests

```bash
# Run all tests
bun test

# or using npm script
npm test
```

## Available Test Scripts

- `npm test` - Run all tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage report

## Test Structure

- `crawler.test.ts` - Tests for utility functions in `src/crawler.ts`
  - `cleanServerName()` - Tests for cleaning and extracting server hostnames
  - `cleanRdapUrl()` - Tests for cleaning and validating RDAP URLs

## Writing Tests

Tests use Bun's built-in test runner which has a Jest-compatible API:

```typescript
import { describe, expect, test } from 'bun:test';

describe('my function', () => {
  test('should do something', () => {
    expect(myFunction()).toBe('expected value');
  });
});
```

## Git Hooks

Tests are automatically run before pushing code via lefthook's pre-push hook.
