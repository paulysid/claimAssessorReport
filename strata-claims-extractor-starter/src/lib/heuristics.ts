import type { CandidateSection, DocumentRecord, EvidenceItem, TargetRecord } from './types';
import { dedupeStrings, slugify, uid } from './utils';

export function buildFallbackTargets(document: DocumentRecord): { targets: TargetRecord[]; sections: CandidateSection[] } {
  const text = document.pages.map((page) => page.normalisedText).join('\n');
  const lots = new Set<string>();
  const lotRegexes = [
    /\bLot\s+(\d{1,4})\b/gi,
    /\bUnit\s+(\d{1,4})\b/gi,
    /\bApartment\s+(\d{1,4})\b/gi
  ];

  for (const regex of lotRegexes) {
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      lots.add(match[1]);
    }
  }

  const targets: TargetRecord[] = Array.from(lots)
    .sort((a, b) => Number(a) - Number(b))
    .map((lotNo) => ({
      targetId: `lot-${lotNo}`,
      targetType: 'lot' as const,
      displayName: `Lot ${lotNo}`,
      aliases: dedupeStrings([`Lot ${lotNo}`, `Unit ${lotNo}`, `Apartment ${lotNo}`])
    }));

  if (/\bcommon property\b|\bshared\b|\broof\b|\bstairwell\b|\bhallway\b|\bfoyer\b/i.test(text)) {
    targets.push({
      targetId: 'common-property',
      targetType: 'common',
      displayName: 'Common Property',
      aliases: ['Common Property', 'shared areas', 'roof', 'hallway', 'stairwell']
    });
  }

  if (!targets.length) {
    targets.push({
      targetId: 'common-property',
      targetType: 'common',
      displayName: 'Common Property',
      aliases: ['Common Property']
    });
  }

  const sections = document.pages.map((page) => ({
    sectionId: `page-${page.pageNumber}`,
    title: `Page ${page.pageNumber}`,
    startPage: page.pageNumber,
    endPage: page.pageNumber,
    sectionType: 'page'
  }));

  return { targets, sections };
}

export function buildTargetContext(document: DocumentRecord, sections: CandidateSection[], target: TargetRecord, maxPages = 8): string {
  const pageTexts: string[] = [];
  for (const page of document.pages) {
    const text = page.normalisedText;
    const aliases = target.aliases.length ? target.aliases : [target.displayName];
    const aliasMatch = aliases.some((alias) => new RegExp(escapeRegExp(alias), 'i').test(text));
    const commonBroadMatch =
      target.targetType === 'common' && /\bcommon property\b|\broof\b|\bshared\b|\bstair\b|\bhallway\b|\bfoyer\b/i.test(text);
    if (aliasMatch || commonBroadMatch) {
      pageTexts.push(text);
    }
  }

  if (!pageTexts.length) {
    return document.pages.slice(0, maxPages).map((page) => page.normalisedText).join('\n\n');
  }
  return pageTexts.slice(0, maxPages).join('\n\n');
}

export function buildFallbackEvidence(document: DocumentRecord, target: TargetRecord): EvidenceItem[] {
  const aliases = target.aliases.length ? target.aliases : [target.displayName];
  const evidence: EvidenceItem[] = [];

  for (const page of document.pages) {
    const lower = page.normalisedText.toLowerCase();
    const targetHit = aliases.some((alias) => lower.includes(alias.toLowerCase()));
    const commonHit = target.targetType === 'common' && /common property|roof|hallway|stairwell|shared/.test(lower);
    if (!(targetHit || commonHit)) continue;

    const snippet = page.normalisedText.slice(0, 600);
    const appliesTo = [target.targetId];
    if (/common property|shared/.test(lower) && target.targetType === 'lot') appliesTo.push('common-property');
    evidence.push({
      evidenceId: uid('e'),
      pageStart: page.pageNumber,
      pageEnd: page.pageNumber,
      summary: `${target.displayName} referenced on page ${page.pageNumber}`,
      rawSnippet: snippet,
      appliesTo,
      explicitness: 'context-linked',
      confidence: 'medium',
      include: true
    });
  }

  return evidence;
}

export function parseManualTargets(input: string): TargetRecord[] {
  const lines = input
    .split(/\n|,/)
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.map((line) => {
    const isCommon = /common/i.test(line);
    if (isCommon) {
      return {
        targetId: 'common-property',
        targetType: 'common' as const,
        displayName: 'Common Property',
        aliases: ['Common Property'],
        userEdited: true
      };
    }

    const lotNo = line.match(/(\d{1,4})/)?.[1] ?? line;
    return {
      targetId: `lot-${slugify(lotNo)}`,
      targetType: 'lot' as const,
      displayName: /^lot/i.test(line) ? line : `Lot ${lotNo}`,
      aliases: dedupeStrings([line, `Lot ${lotNo}`, `Unit ${lotNo}`]),
      userEdited: true
    };
  });
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
