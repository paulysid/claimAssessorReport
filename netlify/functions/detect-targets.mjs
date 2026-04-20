import { callAnthropic, jsonResponse, loadPrompt, pickFallbackModel, pickModel, safeParse, toClientError } from './_shared.mjs';

function collectSourceText(payload) {
  const preview = payload?.document?.previewText || '';
  const sections = Array.isArray(payload?.sections)
    ? payload.sections.map((s) => s?.text || '').join('\n\n')
    : '';
  return `${preview}\n\n${sections}`.trim();
}

function uniqueStrings(values) {
  return [...new Set((values || []).filter(Boolean).map((v) => String(v).trim()).filter(Boolean))];
}

function hasCommonTarget(targets) {
  return Array.isArray(targets) && targets.some((t) => t?.targetType === 'common');
}

function inferCommonAliases(sourceText) {
  const aliases = [];
  const checks = [
    [/the owners\s*-\s*strata plan\s*\d+/i, 'The Owners - Strata Plan'],
    [/the owners of strata plan\s*\d+/i, 'The Owners of Strata Plan'],
    [/common area contents/i, 'Common Area Contents'],
    [/insured property\s*[\s\S]{0,80}?building/i, 'Building'],
    [/fire damage to building/i, 'Building'],
    [/resume power to the building|power to the building/i, 'Building Services'],
    [/concrete slab/i, 'Concrete Slab'],
    [/warehouse/i, 'Warehouse'],
    [/factory/i, 'Factory'],
    [/electrical (?:wiring|services|distribution|sub-boards|subboards|lighting)/i, 'Electrical Services']
  ];
  for (const [regex, alias] of checks) {
    if (regex.test(sourceText)) aliases.push(alias);
  }
  aliases.push('Common Property', 'Building-Wide');
  return uniqueStrings(aliases);
}

function shouldAddBroadCommonTarget(sourceText, llmTargets) {
  if (hasCommonTarget(llmTargets)) return false;
  const strongSignals = [
    /the owners\s*-\s*strata plan\s*\d+/i,
    /the owners of strata plan\s*\d+/i,
    /common area contents/i,
    /insured property\s*[\s\S]{0,80}?building/i,
    /fire damage to building/i,
    /loss:\s*fire damage to building/i,
    /concrete slab/i,
    /reinstatement of the building|building requires reinstatement/i,
    /resume power to the building|temporary power supply to the building/i,
    /temporary distribution boards|sub-boards|electrical wiring|emergency lighting/i
  ];
  const signalCount = strongSignals.reduce((sum, regex) => sum + (regex.test(sourceText) ? 1 : 0), 0);
  return signalCount >= 2;
}

function inferCandidateSections(payload) {
  const sections = Array.isArray(payload?.sections) ? payload.sections : [];
  const regexes = [
    /insured property|common area contents|building/i,
    /material damage|concrete slab|spalling/i,
    /resumption of power supply|temporary electrical|electrical wiring|distribution boards|lighting/i,
    /warehouse|factory/i
  ];
  const matches = sections
    .filter((section) => regexes.some((re) => re.test(section?.text || '') || re.test(section?.title || '')))
    .map((section, idx) => ({
      sectionId: section.sectionId || `common-sec-${idx + 1}`,
      title: /material damage/i.test(section?.text || '')
        ? 'Building damage observations'
        : /electrical|power/i.test(section?.text || '')
          ? 'Building services and temporary electrical works'
          : /common area contents|insured property/i.test(section?.text || '')
            ? 'Building and common area cover details'
            : 'Building-wide report content',
      startPage: Number(section.startPage || 1),
      endPage: Number(section.endPage || section.startPage || 1),
      sectionType: 'building-wide'
    }));
  if (matches.length) return matches.slice(0, 4);
  return [{
    sectionId: 'common-auto-01',
    title: 'Building-wide report content',
    startPage: 1,
    endPage: Math.max(1, Math.min(3, Number(payload?.document?.pageCount || 1))),
    sectionType: 'building-wide'
  }];
}

function applyDetectionFallbacks(payload, data) {
  const sourceText = collectSourceText(payload);
  const targets = Array.isArray(data?.targets) ? [...data.targets] : [];
  const candidateSections = Array.isArray(data?.candidateSections) ? [...data.candidateSections] : [];

  if (shouldAddBroadCommonTarget(sourceText, targets)) {
    targets.unshift({
      targetId: 'common-property',
      targetType: 'common',
      displayName: /common area contents/i.test(sourceText) ? 'Common Property / Building-Wide' : 'Common Property',
      aliases: inferCommonAliases(sourceText)
    });

    const inferredSections = inferCandidateSections(payload);
    for (const section of inferredSections) {
      if (!candidateSections.some((existing) => existing.startPage === section.startPage && existing.endPage === section.endPage && existing.title === section.title)) {
        candidateSections.push(section);
      }
    }
  }

  return {
    targets,
    candidateSections: candidateSections.sort((a, b) => (a.startPage - b.startPage) || (a.endPage - b.endPage))
  };
}

export const handler = async (event) => {
  try {
    const payload = safeParse(event);
    const system = await loadPrompt('detect-targets');
    const data = await callAnthropic({
      model: pickModel(payload?.config?.modelProfile, 'light'),
      fallbackModel: pickFallbackModel('routing'),
      system,
      userPayload: payload,
      schemaName: 'detect-targets-response',
      temperature: 0
    });
    const adjusted = applyDetectionFallbacks(payload, data);
    return jsonResponse(200, { ok: true, data: adjusted });
  } catch (error) {
    const clientError = toClientError(error, 'The target detection step failed.');
    const status = clientError.error.retryable ? 503 : 500;
    return jsonResponse(status, clientError);
  }
};

export default handler;
