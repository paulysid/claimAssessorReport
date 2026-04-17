# Strata Claims Extractor MVP

A fuller MVP implementation for extracting lot-based and common-property information from strata claims assessment reports in PDF format.

## Included features

- React + Vite front end
- Browser-side PDF text extraction using pdf.js
- Page markers for traceability
- Extraction quality diagnostics and OCR-needed warning flag
- Netlify Functions for all Anthropic calls
- Multi-stage workflow:
  - detect targets
  - locate evidence
  - extract facts
  - enrich summaries
  - verify summaries
- Manual target override UI
- Evidence include/exclude review UI
- Structured JSON export bundle
- Customer summary markdown export
- Zod validation for backend request and response payloads
- Retry wrapper for Anthropic calls
- Session-only processing with no database requirement

## Important notes

This package is designed to be dropped into GitHub and deployed via Netlify.

It is an MVP-level build pack rather than a fully hardened production system. It intentionally avoids persistent storage and keeps raw PDF extraction in-browser for privacy.

## Environment variables

Set these in Netlify with Functions scope enabled:

- `ANTHROPIC_API_KEY`
- `ANTHROPIC_ROUTING_MODEL`
- `ANTHROPIC_EXTRACTION_MODEL`
- `ANTHROPIC_VERIFICATION_MODEL`
- `MAX_CONTEXT_CHARS`
- `ENABLE_DEBUG_LOGS`

## Local development

```bash
npm install
npm run netlify:dev
```

## Deployment

1. Create a GitHub repository.
2. Upload this project.
3. Connect the repository to Netlify.
4. Add the environment variables.
5. Deploy.

## Current limitations

- OCR fallback is flagged but not implemented.
- The diagnostics panel is basic.
- The evaluation harness is not included as an executable test suite.
- The app depends on the quality of PDF text extraction.
- Build verification was not executed inside the artifact-generation environment.

## Suggested next hardening steps

- add OCR fallback service integration
- add persistent resumable jobs if needed
- add structured telemetry and request IDs throughout
- add labelled regression test corpus
- tighten page-block extraction beyond page-level text
