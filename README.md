# Strata Claims Assessment Report Extractor

## Overview

The Strata Claims Assessment Report Extractor is a web application designed to analyse PDF strata claims assessment reports and convert them into structured, traceable outputs.

The application is intended for reports that may contain:
- common property findings
- lot-specific findings
- issues that affect both common property and a particular lot

The solution is designed to prioritise **accuracy over completeness**. It uses a staged extraction and verification workflow so that information is only included where it is supported by the report text.

The application is built for deployment on **Netlify**, with the source code managed in **GitHub**. PDF text extraction is performed in the browser, while all AI processing is handled server-side through **Netlify Functions** using **Anthropic Claude** via API.

---

## Core Purpose

The application helps convert lengthy and often inconsistent assessment reports into:
- a **Common Property** output
- separate **lot-based outputs** where lots are clearly identified
- structured audit data with traceable source references
- customer-friendly summaries written in plain English using Australian spelling

The main goal is to support consistent extraction while reducing:
- cross-lot contamination
- unsupported inference
- loss of traceability back to the report
- overstatement in customer-facing summaries

---

## Key Design Principles

### 1. Accuracy over completeness
The application is designed to return only information that is explicitly supported by the report, or carefully qualified where broader common property capture is permitted.

### 2. Strict lot attribution
Information is only included in a lot-specific output where the report clearly supports that it relates to that lot.

### 3. Broad common property inclusion
Common property findings are intentionally treated more broadly. If an issue appears to relate to building fabric, shared elements, external envelope, structure, services, or a broader building issue, it is acceptable to include it in the Common Property output even where legal ownership may vary between jurisdictions or plan boundaries.

### 4. Single common property target
Common property is treated as a single target. Different common property findings are grouped within that target by finding type, such as:
- roof-related
- slab / structural
- electrical / building services
- external wall / façade
- shared areas
- other building-wide matters

### 5. Customer output and audit output are separated
Customer-facing outputs show only the approved summary. Verification details such as softened statements and removed statements are retained in the audit output only.

### 6. Browser-session-first processing
The application is designed to keep processing within the browser session wherever possible, without requiring a connected database for normal operation.

---

## Main Features

### PDF report ingestion
- Upload PDF assessment reports through the browser
- Extract text page by page
- Preserve page references to support traceability
- Support large report handling through staged processing

### Target detection
- Detect individual lots where they are clearly identified
- Detect a single Common Property target
- Detect whole-building or commercial strata reports even where the report does not explicitly say “common property”

### Common property enhancement
- Recognise common property and building-wide aspects even when they are not explicitly labelled as common property
- Use broad building-element detection to capture likely common property matters such as:
  - roof
  - slab
  - electrical infrastructure
  - façade / external walls
  - building services
  - shared areas
- Group these within the one Common Property target

### Evidence routing
- Identify which report content is relevant to a specific lot or to Common Property
- Use smaller evidence windows to reduce timeout risk and improve precision
- Allow evidence to be used in both Common Property and a specific lot where the report supports both

### Structured extraction
- Extract factual findings into structured JSON
- Keep lot impacts separate from broader common property findings
- Preserve page references and evidence traceability

### Customer-friendly summary generation
- Create plain-English summaries using Australian English
- Keep language neutral and factual
- Preserve the assessor’s level of certainty where causes are stated as likely, possible, or suspected

### Verification
- Verify summaries against extracted facts and source evidence
- Allow properly qualified suspected or likely causes where they are explicitly stated by the report
- Prevent overstatement or inference
- Keep all softening and removal information in audit outputs only

### Export capability
- Customer-facing summary export
- Audit-oriented export with verification and evidence detail

---

## Supported Output Model

### Common Property
The application always treats Common Property as one target. Findings are grouped under that target by finding type.

Example grouped finding types may include:
- roof-related findings
- slab / structural findings
- electrical / building services findings
- façade / external wall findings
- shared area findings
- other building-wide findings

### Lot outputs
Each lot is treated as its own separate target.

Lot content is only included where:
- the lot is explicitly identified, or
- the room / area is clearly and safely linked to that lot in context

### Dual attribution
Where the report indicates that a building-wide or common-property-type issue also affects a particular lot, the information can appear in:
- the Common Property output
- the affected lot output

This is only done where the report supports both.

---

## High-Level Processing Flow

### 1. Upload and text extraction
The PDF is uploaded into the browser and the text is extracted page by page.

### 2. Document preparation
The extracted text is normalised and page markers are retained.

### 3. Target detection
The system identifies:
- lots
- common property / building-wide target
- likely relevant sections

### 4. Evidence location
The system identifies which parts of the report are relevant to each lot and to Common Property.

### 5. Structured extraction
The system converts evidence into structured facts.

### 6. Plain-English summary generation
The system creates customer-friendly summaries.

### 7. Verification
The system checks the wording of the summary against the evidence and extracted facts.

### 8. Presentation and export
The final customer summary and audit outputs are made available.

---

## AI Processing Approach

The application uses a multi-step AI workflow rather than attempting to analyse the whole report in one pass.

### Step 1: target detection
Identify lots, common property / building-wide target, aliases, and candidate sections.

### Step 2: evidence location
Locate only the report text relevant to a given target.

### Step 3: fact extraction
Extract explicit facts into structured JSON.

### Step 4: summary generation
Convert the extracted facts into plain-English summaries.

### Step 5: verification
Check whether the summary is properly supported and soften or remove unsupported wording in the audit layer only.

This staged approach improves:
- traceability
- lot separation
- output accuracy
- resilience against irrelevant text

---

## Common Property Detection Logic

The application takes an intentionally broad approach to Common Property.

This means the Common Property section may include:
- explicitly identified common property
- broader building-fabric issues
- shared building services
- whole-building loss issues
- matters that may or may not ultimately be common property depending on jurisdiction, by-laws, plan boundaries, or factual nuance

This is acceptable by design.

The more important control is that lot-specific outputs do **not** contain information relating to other lots.

Examples of common property/building-wide indicators include:
- building
- common area contents
- roof
- slab
- electrical sub-boards
- temporary building power
- emergency lighting
- external walls
- façade
- structural elements
- warehouse / factory-wide areas in commercial strata reports

---

## Verification Outcomes

The verification stage uses three outcomes:

- `verified`
- `verified-with-softening`
- `failed`

These outcomes are retained in the audit data.

Customer-facing outputs do not display:
- verification status
- softened statements
- removed statements

Customer-facing outputs show only the approved summary.

---

## Customer Output vs Audit Output

### Customer output
The customer-facing output is designed to be simple and readable.

It includes:
- the approved summary only
- separate sections for Common Property and each identified lot

It excludes:
- verification status
- softened statements
- removed statements
- internal evidence-routing detail

### Audit output
The audit output is intended for internal or technical review.

It may include:
- structured extraction results
- evidence items
- page references
- verification status
- softened statements
- removed statements
- common property grouping detail
- lot attribution detail

---

## Technology Stack

### Front end
- Static browser-based application
- JavaScript
- HTML
- CSS
- PDF.js for in-browser PDF reading

### Back end
- Netlify Functions
- JavaScript / Node runtime
- Anthropic API integration through server-side functions only

### AI provider
- Anthropic Claude models
- Separate configuration for routing, extraction, and verification stages

---

## Environment Variables

Typical environment variables used by the application include:

- `ANTHROPIC_API_KEY`
- `ANTHROPIC_ROUTING_MODEL`
- `ANTHROPIC_EXTRACTION_MODEL`
- `ANTHROPIC_VERIFICATION_MODEL`
- `ANTHROPIC_EXTRACTION_FALLBACK_MODEL`
- `ANTHROPIC_VERIFICATION_FALLBACK_MODEL`
- `ANTHROPIC_MAX_RETRIES`
- `ANTHROPIC_RETRY_BASE_MS`
- `MAX_CONTEXT_CHARS`
- `ENABLE_DEBUG_LOGS`

These should be configured in Netlify as runtime environment variables.

---

## Netlify Deployment

The application is designed to be deployed on Netlify.

It uses:
- a static site for the front end
- Netlify Functions for all Anthropic calls
- included asset files for prompt and schema loading

Netlify configuration should ensure that:
- the functions directory is correctly configured
- prompt files are bundled with the function deployment
- schema files are bundled with the function deployment

---

## Prompt-Driven Extraction

The application uses prompt files for:
- target detection
- evidence location
- fact extraction
- summary generation
- summary verification

These prompt files are bundled into the function assets so they can be loaded server-side at runtime.

The prompts are designed to:
- favour accuracy over completeness
- avoid unsupported inference
- preserve qualified assessor wording
- allow broad common property capture
- keep lot attribution strict

---

## Operational Safeguards

The application includes a number of safeguards:

### Strict lot safety
Lot outputs are only populated where attribution is safe.

### Broad common property capture
Common Property may deliberately include ambiguous building-wide matters.

### Retry handling
Temporary Anthropic overloads can be retried with backoff and fallback models.

### Reduced evidence windows
Smaller evidence windows help reduce timeouts and improve precision.

### Verification controls
The verification layer prevents customer-facing outputs from overstating the report.

### Audit traceability
Evidence references and verification details remain available for internal review.

---

## Known Limitations

### OCR
OCR fallback is not fully implemented in all builds. Reports that are image-heavy or poorly text-extracted may require enhancement.

### Jurisdiction-specific legal precision
The application is intentionally broad in its Common Property treatment. It is not intended to make legal determinations about ownership boundaries.

### PDF extraction variability
Some PDFs may produce noisy font warnings or imperfect text extraction, depending on how the original document was generated.

### Model dependency
Output quality depends partly on the quality of extracted text and the performance of the configured Anthropic model.

---

## Intended Use

This application is intended to assist with:
- reviewing strata claims assessment reports
- separating common property and lot findings
- generating customer-friendly summaries
- producing audit-ready extraction outputs

It is not intended to:
- replace policy or legal interpretation
- make binding ownership determinations
- infer facts not supported by the report
- replace expert human review where required

---

## Summary

The Strata Claims Assessment Report Extractor is a staged AI-assisted document analysis tool designed to turn complex strata assessment reports into:
- one grouped Common Property output
- tightly controlled lot-specific outputs
- customer-facing summaries
- audit-ready structured data

Its core philosophy is:

**Be broad for Common Property, and strict for lot attribution.**

That balance helps ensure that:
- shared and building-wide issues are not missed
- lot-specific outputs remain safe to share
- summaries remain factual and supported
- internal users retain a traceable audit trail
