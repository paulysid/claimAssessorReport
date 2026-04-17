import type {
  CandidateSection,
  DocumentRecord,
  EvidenceItem,
  ExtractFactsResult,
  RunDiagnostics,
  SummaryResult,
  TargetRecord,
  VerificationResult
} from './types';
import { buildFallbackEvidence, buildFallbackTargets, buildTargetContext } from './heuristics';

async function postJson<T>(path: string, payload: unknown): Promise<T> {
  const response = await fetch(`/api/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const json = await response.json();
  if (!response.ok || !json.ok) {
    throw new Error(json?.error?.message ?? `Request failed for ${path}`);
  }
  return json.data as T;
}

export async function detectTargets(document: DocumentRecord): Promise<{ targets: TargetRecord[]; candidateSections: CandidateSection[] }> {
  const fallback = buildFallbackTargets(document);
  try {
    return await postJson('detect-targets', {
      documentId: document.documentId,
      fileName: document.fileName,
      documentText: document.pages.slice(0, 20).map((page) => page.normalisedText).join('\n\n')
    });
  } catch {
    return { targets: fallback.targets, candidateSections: fallback.sections };
  }
}

export async function locateEvidence(document: DocumentRecord, target: TargetRecord, sections: CandidateSection[]): Promise<{ targetId: string; evidenceItems: EvidenceItem[] }> {
  try {
    return await postJson('locate-evidence', {
      target,
      candidateSections: sections,
      pageText: buildTargetContext(document, sections, target)
    });
  } catch {
    return { targetId: target.targetId, evidenceItems: buildFallbackEvidence(document, target) };
  }
}

export async function extractFacts(target: TargetRecord, evidenceItems: EvidenceItem[], document: DocumentRecord): Promise<ExtractFactsResult> {
  return await postJson('extract-facts', {
    target,
    evidenceItems,
    pageText: buildTargetContext(document, [], target)
  });
}

export async function enrichSummary(target: TargetRecord, facts: ExtractFactsResult, evidenceItems: EvidenceItem[]): Promise<SummaryResult> {
  return await postJson('enrich-summary', {
    target,
    facts,
    evidenceItems
  });
}

export async function verifySummary(
  target: TargetRecord,
  facts: ExtractFactsResult,
  draftSummary: string,
  evidenceItems: EvidenceItem[]
): Promise<VerificationResult> {
  return await postJson('verify-summary', {
    target,
    facts,
    draftSummary,
    evidenceItems
  });
}

export function createEmptyDiagnostics(): RunDiagnostics {
  return {
    requestIds: [],
    retries: 0,
    functionCalls: []
  };
}
