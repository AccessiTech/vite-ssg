# Test Suite for Vite SSG

This directory contains comprehensive tests for the Vite Static Site Generator.

## Test Files

### `test/index.test.ts`
Main test suite covering:
- **defineConfig**: Configuration merging and validation
- **genUrls**: RSS parsing and URL generation 
- **toBuildPath**: Path building utilities
- **genStatic**: Static page generation functionality
- **generate**: Full generation pipeline with error handling

### `test/generate.test.ts`
Tests for the CLI generation script

### `test/setup.ts`
Test environment setup with Jest DOM utilities

## Test Coverage

The test suite covers:
- ✅ Configuration merging and defaults
- ✅ RSS XML parsing (single and multiple items)
- ✅ URL generation from RSS feeds
- ✅ Static file generation
- ✅ Directory creation for nested paths
- ✅ Metadata handling for SEO
- ✅ Error handling and edge cases
- ✅ File system operations (mocked)
- ✅ Vite server integration (mocked)

## Running Tests

```bash
# Run all tests
yarn test:run

# Run tests in watch mode
yarn test

# Run tests with UI
yarn test:ui
```

## Mock Files Created

To support testing, the following mock metadata files were created:
- `src/meta.ts` - Default metadata
- `src/App/meta.ts` - App-specific metadata  
- `src/pages/Blog/meta.ts` - Blog page metadata

These files provide the required metadata structure that the SSG expects when processing static pages.

## Test Framework

- **Vitest**: Modern test runner with TypeScript support
- **jsdom**: Browser environment simulation
- **@testing-library/jest-dom**: Enhanced DOM assertions
- **Mocking**: Comprehensive mocking of file system, XML parser, and Vite server operations
