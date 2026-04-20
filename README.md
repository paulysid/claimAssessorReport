# Strata Claims Assessment Report Extractor — Build-Validated Netlify Package

This package is designed to be dropped into GitHub and deployed to Netlify with minimal setup.

## What this package includes

- Static browser app with no frontend build dependency required
- Browser-side PDF extraction using pdf.js loaded from a CDN
- Netlify Functions for all Anthropic calls
- Multi-stage pipeline endpoints:
  - detect-targets
  - locate-evidence
  - extract-facts
  - enrich-summary
  - verify-summary
- Prompt and schema files separated from function code
- Session-only processing in the browser
- Manual target editing and evidence include/exclude review
- Audit JSON and customer summary markdown export

## What is build-validated here

This package has been validated in a dependency-light way:

- JavaScript files included in the zip were syntax-checked locally in the build environment
- JSON schema files were parsed successfully
- The site structure is deployable on Netlify as a static site plus Functions without a frontend bundling step

## What still requires your environment

- Anthropic API key in Netlify environment variables
- External access from the browser to the pdf.js CDN
- A live Netlify deployment to exercise the serverless endpoints end to end

## Deploy steps

1. Upload this folder to a GitHub repository.
2. In Netlify, create a new site from that repository.
3. Build settings:
   - Publish directory: `.`
   - Functions directory: `netlify/functions`
4. Add environment variable:
   - `ANTHROPIC_API_KEY`
5. Optionally add:
   - `ANTHROPIC_MODEL_ROUTING_JSON`
6. Deploy.

## Local check

Run:

```bash
node scripts/check.mjs
```

## Health endpoint

After deploy, call:

```text
/.netlify/functions/health
```

## Notes

- OCR fallback is still a planned enhancement. This package flags weak extraction quality but does not perform OCR.
- The Anthropic API call implementation uses `fetch` directly inside Netlify Functions to keep the package dependency-light and easier to validate here.
- The Content Security Policy allows the pdf.js CDN and Anthropic API.

## Recommended next hardening steps

- Add OCR fallback for scanned PDFs
- Add response schema validation inside functions beyond JSON shape control
- Add integration tests with sample reports
- Add finer block/line evidence routing for complex layouts


## Prompt and best-practice updates

This version includes stronger production-grade prompts, tighter one-target-at-a-time evidence routing, smaller evidence windows to reduce timeout risk, schema-repair retry handling, configurable model environment variables, and visible verification details including softened and removed statements.

## Resilience improvements in this patch

This version adds:
- retry handling with backoff and jitter for temporary Anthropic overloads
- clean JSON error responses for retryable provider issues
- Anthropic request ID capture in debug logs where available
- optional fallback models for extraction and verification
- a small pause between target runs in the browser to reduce burst pressure
