export const globalSystemPrompt = `You are a highly conservative extraction model for strata claims assessment reports in Australia.
Use Australian English spelling.
Return only information that is explicitly stated in the source text provided.
Do not infer ownership, liability, coverage, responsibility, cause, rectification entitlement, or recommendations unless explicitly stated.
If a detail is uncertain, omit it.
Prefer accuracy over completeness.
Return valid JSON only. Do not wrap the JSON in markdown.`;

export function buildDetectTargetsPrompt(documentText: string): string {
  return `Task: identify every explicitly referenced lot and whether the report also refers to common property.

Return JSON with this shape:
{
  "targets": [{ "targetId": "lot-12", "targetType": "lot", "displayName": "Lot 12", "aliases": ["Lot 12", "Unit 12"] }],
  "candidateSections": [{ "sectionId": "sec-01", "title": "Section title", "startPage": 1, "endPage": 2, "sectionType": "summary" }]
}

Rules:
- Include only explicitly referenced lots.
- Include Common Property only if the report explicitly refers to common property or shared building areas.
- If section headings are not clear, create broad page range sections.
- Keep aliases realistic and evidence-linked.

Document text:
${documentText}`;
}

export function buildLocateEvidencePrompt(targetJson: string, sectionsJson: string, pageText: string): string {
  return `Task: identify only the evidence relevant to the supplied target.

Return JSON with this shape:
{
  "targetId": "...",
  "evidenceItems": [{
    "evidenceId": "e-001",
    "pageStart": 9,
    "pageEnd": 10,
    "summary": "Short evidence summary",
    "rawSnippet": "Short direct snippet from the source",
    "appliesTo": ["lot-12"],
    "explicitness": "explicit",
    "confidence": "high"
  }]
}

Rules:
- Include only evidence explicitly relevant to the target.
- Do not infer that a passage applies to a lot or common property unless the wording supports it.
- If wording clearly applies to both the target and common property, include both target ids in appliesTo.
- Use concise snippets, not full pages.
- If no evidence is explicit, return an empty array.

Target:
${targetJson}

Candidate sections:
${sectionsJson}

Page text:
${pageText}`;
}

export function buildExtractFactsPrompt(targetJson: string, evidenceJson: string, pageText: string): string {
  return `Task: convert the evidence into a strict factual extraction for the supplied target.

Return JSON with this shape:
{
  "targetId": "lot-12",
  "targetType": "lot",
  "areasAffected": [],
  "damageObserved": [],
  "causeStatements": [],
  "worksMentioned": [],
  "furtherInvestigationMentioned": [],
  "uncertaintiesMentioned": [],
  "sourceReferences": [{ "pageStart": 9, "pageEnd": 10, "evidenceId": "e-001" }]
}

Rules:
- Only include facts explicitly stated in the evidence or linked page text.
- Do not infer coverage, ownership, liability or responsibility.
- If a category is not clearly stated, return an empty array.

Target:
${targetJson}

Evidence:
${evidenceJson}

Context:
${pageText}`;
}

export function buildEnrichSummaryPrompt(targetJson: string, factsJson: string, evidenceJson: string): string {
  return `Task: write a plain-English summary for the impacted customer for the supplied target.

Return JSON with this shape:
{ "draftSummary": "..." }

Rules:
- Use Australian English spelling.
- Be factual and informative.
- Do not provide recommendations or interpretation.
- Do not infer anything not explicitly supported by the supplied facts and evidence.
- Make it clear that the summary reflects what the report states.

Target:
${targetJson}

Facts:
${factsJson}

Evidence:
${evidenceJson}`;
}

export function buildVerifySummaryPrompt(targetJson: string, factsJson: string, draftSummary: string, evidenceJson: string): string {
  return `Task: verify the summary against the supplied evidence.

Return JSON with this shape:
{
  "targetId": "lot-12",
  "verificationStatus": "verified",
  "approvedSummary": "...",
  "removedStatements": [],
  "softenedStatements": [{ "original": "...", "revised": "...", "reason": "..." }]
}

Rules:
- Remove unsupported wording.
- Soften wording that is stronger than the source text.
- Keep only what is explicitly supported.
- If the summary is largely unsupported, set verificationStatus to "failed".

Target:
${targetJson}

Facts:
${factsJson}

Draft summary:
${draftSummary}

Evidence:
${evidenceJson}`;
}
