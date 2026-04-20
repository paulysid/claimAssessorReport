const state = {
  file: null,
  document: null,
  sections: [],
  targets: [],
  evidenceByTarget: {},
  extractionByTarget: {},
  summariesByTarget: {},
  diagnostics: null,
  progress: []
};

const els = {
  pdfFileInput: document.getElementById('pdfFileInput'),
  extractPdfBtn: document.getElementById('extractPdfBtn'),
  detectTargetsBtn: document.getElementById('detectTargetsBtn'),
  runPipelineBtn: document.getElementById('runPipelineBtn'),
  addTargetBtn: document.getElementById('addTargetBtn'),
  downloadAuditBtn: document.getElementById('downloadAuditBtn'),
  downloadSummaryBtn: document.getElementById('downloadSummaryBtn'),
  clearSessionBtn: document.getElementById('clearSessionBtn'),
  fileMeta: document.getElementById('fileMeta'),
  extractionDiagnostics: document.getElementById('extractionDiagnostics'),
  documentPreview: document.getElementById('documentPreview'),
  targetsContainer: document.getElementById('targetsContainer'),
  evidenceTargetSelect: document.getElementById('evidenceTargetSelect'),
  refreshEvidenceBtn: document.getElementById('refreshEvidenceBtn'),
  evidenceContainer: document.getElementById('evidenceContainer'),
  resultsContainer: document.getElementById('resultsContainer'),
  progressList: document.getElementById('progressList'),
  modelProfileSelect: document.getElementById('modelProfileSelect'),
  maxWindowPagesInput: document.getElementById('maxWindowPagesInput'),
  sectionPreviewPagesInput: document.getElementById('sectionPreviewPagesInput'),
  targetDialog: document.getElementById('targetDialog'),
  targetForm: document.getElementById('targetForm')
};

function uuid() {
  return crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function estimateTokens(text) {
  return Math.ceil((text || '').length / 4);
}

function setProgress(stage, status, detail = '') {
  const existing = state.progress.find((item) => item.stage === stage);
  if (existing) {
    existing.status = status;
    existing.detail = detail;
  } else {
    state.progress.push({ stage, status, detail });
  }
  renderProgress();
}

function renderProgress() {
  els.progressList.innerHTML = state.progress.map((item) => `
    <div class="progress-item">
      <strong>${escapeHtml(item.stage)}</strong>
      <span class="status-${item.status}">${escapeHtml(item.status)}${item.detail ? ` — ${escapeHtml(item.detail)}` : ''}</span>
    </div>
  `).join('');
}

function renderFileMeta() {
  if (!state.file || !state.document) {
    els.fileMeta.innerHTML = '';
    return;
  }
  els.fileMeta.innerHTML = [
    ['File', state.file.name],
    ['Size', `${Math.round(state.file.size / 1024)} KB`],
    ['Pages', state.document.pageCount],
    ['Estimated tokens', state.document.pages.reduce((sum, p) => sum + p.tokensEstimate, 0)]
  ].map(([label, value]) => `<div><strong>${escapeHtml(label)}</strong><div>${escapeHtml(String(value))}</div></div>`).join('');
}

function renderDiagnostics() {
  const d = state.diagnostics;
  if (!d) {
    els.extractionDiagnostics.className = 'callout hidden';
    els.extractionDiagnostics.textContent = '';
    return;
  }
  const cls = d.needsOcr ? 'callout warning' : 'callout success';
  els.extractionDiagnostics.className = cls;
  els.extractionDiagnostics.innerHTML = `
    <strong>Extraction quality</strong><br />
    Score: ${escapeHtml(String(d.score))}/100<br />
    Empty pages: ${escapeHtml(String(d.emptyPages))}<br />
    Suspicious characters: ${escapeHtml(String(d.suspiciousRatio))}%<br />
    OCR recommended: ${d.needsOcr ? 'Yes' : 'No'}
  `;
}

function renderDocumentPreview() {
  const preview = state.document?.pages?.slice(0, 4).map((p) => p.text).join('\n\n') || '';
  els.documentPreview.textContent = preview;
}

function renderTargets() {
  els.targetsContainer.innerHTML = state.targets.length ? state.targets.map((target) => `
    <div class="card">
      <div class="split-header">
        <div>
          <h3>${escapeHtml(target.displayName)} <span class="badge">${escapeHtml(target.targetType)}</span></h3>
          <div class="small">Aliases: ${escapeHtml(target.aliases.join(', ') || 'None')}</div>
        </div>
        <div class="actions-row compact">
          <button class="secondary" data-action="edit-target" data-id="${escapeHtml(target.targetId)}">Edit</button>
          <button class="secondary" data-action="delete-target" data-id="${escapeHtml(target.targetId)}">Delete</button>
        </div>
      </div>
    </div>
  `).join('') : '<div class="small">No targets detected yet.</div>';

  els.evidenceTargetSelect.innerHTML = state.targets.map((t) => `<option value="${escapeHtml(t.targetId)}">${escapeHtml(t.displayName)}</option>`).join('');
  els.refreshEvidenceBtn.disabled = state.targets.length === 0 || !state.document;
}

function renderEvidence() {
  const targetId = els.evidenceTargetSelect.value;
  const items = state.evidenceByTarget[targetId] || [];
  els.evidenceContainer.innerHTML = items.length ? items.map((item, idx) => `
    <div class="card evidence-item ${item.included === false ? 'excluded' : ''}">
      <div class="split-header">
        <strong>Pages ${escapeHtml(String(item.pageStart))}${item.pageEnd !== item.pageStart ? `-${escapeHtml(String(item.pageEnd))}` : ''}</strong>
        <label><input type="checkbox" data-action="toggle-evidence" data-target-id="${escapeHtml(targetId)}" data-index="${idx}" ${item.included === false ? '' : 'checked'} /> Include</label>
      </div>
      <div class="small">Applies to: ${escapeHtml((item.appliesTo || []).join(', '))}</div>
      <p>${escapeHtml(item.summary)}</p>
      <details>
        <summary>Raw snippet</summary>
        <pre class="document-preview">${escapeHtml(item.rawSnippet || '')}</pre>
      </details>
    </div>
  `).join('') : '<div class="small">No evidence loaded for the selected target.</div>';
}

function renderResults() {
  const entries = state.targets.map((target) => {
    const extraction = state.extractionByTarget[target.targetId];
    const summary = state.summariesByTarget[target.targetId];
    if (!extraction && !summary) return '';
    return `
      <div class="card">
        <h3>${escapeHtml(target.displayName)} <span class="badge">${escapeHtml(target.targetType)}</span></h3>
        ${summary ? `
          <div class="callout ${summary.verificationStatus === 'failed' ? 'error' : 'success'}">
            <strong>Customer summary</strong>
            <p>${escapeHtml(summary.approvedSummary || 'No approved summary returned.')}</p>
          </div>
        ` : ''}
        ${extraction ? `
          <div class="inline-grid">
            <div>
              <h4>Damage observed</h4>
              <ul>${(extraction.damageObserved || []).map((x) => `<li>${escapeHtml(x)}</li>`).join('') || '<li>None returned</li>'}</ul>
            </div>
            <div>
              <h4>Cause statements</h4>
              <ul>${(extraction.causeStatements || []).map((x) => `<li>${escapeHtml(x)}</li>`).join('') || '<li>None returned</li>'}</ul>
            </div>
          </div>
          <details>
            <summary>Structured JSON</summary>
            <pre class="document-preview">${escapeHtml(JSON.stringify(extraction, null, 2))}</pre>
          </details>
        ` : ''}
      </div>
    `;
  }).filter(Boolean).join('');

  els.resultsContainer.innerHTML = entries || '<div class="small">No results yet.</div>';
}

function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

async function extractPdfText(file) {
  const { pdfjsLib } = globalThis;
  if (!pdfjsLib) throw new Error('pdf.js failed to load from CDN.');

  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs';
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages = [];

  for (let i = 1; i <= pdf.numPages; i += 1) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items.map((item) => item.str || '').filter(Boolean);
    const text = `[PAGE ${i}]\n${strings.join(' ')}`;
    const normalisedText = text.replace(/\s+/g, ' ').trim();
    const blocks = content.items.map((item, idx) => ({
      blockId: `p${i}-b${idx + 1}`,
      text: item.str || '',
      order: idx + 1,
      bbox: { x: item.transform?.[4] || 0, y: item.transform?.[5] || 0, w: item.width || 0, h: item.height || 0 }
    })).filter((b) => b.text);
    pages.push({
      pageNumber: i,
      marker: `[PAGE ${i}]`,
      text,
      normalisedText,
      charCount: normalisedText.length,
      tokensEstimate: estimateTokens(normalisedText),
      blocks
    });
  }

  return {
    documentId: uuid(),
    fileName: file.name,
    pageCount: pdf.numPages,
    pages
  };
}

function analyseExtractionQuality(doc) {
  const emptyPages = doc.pages.filter((p) => p.normalisedText.length < 40).length;
  const totalChars = doc.pages.reduce((sum, p) => sum + p.normalisedText.length, 0);
  const suspiciousChars = (doc.pages.map((p) => p.normalisedText.match(/[�□]/g)?.length || 0).reduce((a, b) => a + b, 0));
  const suspiciousRatio = totalChars ? ((suspiciousChars / totalChars) * 100).toFixed(2) : '0.00';
  const avgChars = doc.pageCount ? totalChars / doc.pageCount : 0;
  let score = 100;
  if (emptyPages > 0) score -= emptyPages * 12;
  if (avgChars < 350) score -= 20;
  if (Number(suspiciousRatio) > 0.5) score -= 20;
  score = Math.max(0, Math.round(score));
  return {
    score,
    emptyPages,
    suspiciousRatio,
    needsOcr: score < 60
  };
}

function buildCandidateSections(doc, previewPages) {
  const sections = [];
  let sectionCounter = 1;
  for (let i = 0; i < doc.pages.length; i += previewPages) {
    const chunkPages = doc.pages.slice(i, i + previewPages);
    sections.push({
      sectionId: `sec-${String(sectionCounter).padStart(2, '0')}`,
      title: `Pages ${chunkPages[0].pageNumber}-${chunkPages.at(-1).pageNumber}`,
      startPage: chunkPages[0].pageNumber,
      endPage: chunkPages.at(-1).pageNumber,
      sectionType: 'candidate',
      text: chunkPages.map((p) => p.text).join('\n\n')
    });
    sectionCounter += 1;
  }
  return sections;
}

function getTargetKeywords(target) {
  const aliases = Array.isArray(target?.aliases) ? target.aliases : [];
  const names = [target?.displayName, ...aliases].filter(Boolean).map((x) => String(x).toLowerCase());
  if (target?.targetType === 'common') {
    names.push('common property', 'shared', 'common area', 'roof', 'hallway', 'stairwell', 'foyer', 'facade', 'external', 'ceiling cavity');
  }
  return [...new Set(names)];
}

function buildEvidenceCandidateContext(target, config) {
  const windowPages = Math.max(1, Number(config.maxWindowPages || 3));
  const keywords = getTargetKeywords(target);
  const windows = [];
  for (let i = 0; i < state.document.pages.length; i += windowPages) {
    const chunkPages = state.document.pages.slice(i, i + windowPages);
    const text = chunkPages.map((p) => p.text).join('\n\n');
    const lower = text.toLowerCase();
    const hits = keywords.reduce((sum, kw) => sum + (kw && lower.includes(kw) ? 1 : 0), 0);
    const startPage = chunkPages[0].pageNumber;
    const endPage = chunkPages.at(-1).pageNumber;
    windows.push({
      sectionId: `w-${startPage}-${endPage}`,
      title: `Pages ${startPage}-${endPage}`,
      startPage,
      endPage,
      score: hits,
      text: text.slice(0, 9000)
    });
  }
  windows.sort((a, b) => (b.score - a.score) || (a.startPage - b.startPage));
  const shortlisted = windows.filter((w) => w.score > 0).slice(0, 6);
  if (!shortlisted.length && windows.length) shortlisted.push(...windows.slice(0, Math.min(3, windows.length)));
  shortlisted.sort((a, b) => a.startPage - b.startPage);
  return shortlisted;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    const requestId = data?.error?.requestId ? ` Request ID: ${data.error.requestId}.` : '';
    const retryable = data?.error?.retryable ? ' This should be temporary. Please retry.' : '';
    throw new Error((data?.error?.message || `Request failed for ${url}`) + requestId + retryable);
  }
  return data.data;
}

function getConfig() {
  return {
    modelProfile: els.modelProfileSelect.value,
    maxWindowPages: Number(els.maxWindowPagesInput.value || 3),
    sectionPreviewPages: Number(els.sectionPreviewPagesInput.value || 8)
  };
}

async function detectTargets() {
  if (!state.document) return;
  const config = getConfig();
  setProgress('Detect targets', 'running');
  state.sections = buildCandidateSections(state.document, config.sectionPreviewPages);
  const payload = {
    document: {
      documentId: state.document.documentId,
      fileName: state.document.fileName,
      pageCount: state.document.pageCount,
      previewText: state.document.pages.slice(0, Math.min(state.document.pageCount, config.sectionPreviewPages)).map((p) => p.text).join('\n\n')
    },
    sections: state.sections.map((s) => ({ sectionId: s.sectionId, title: s.title, startPage: s.startPage, endPage: s.endPage, text: s.text.slice(0, 12000) })),
    config
  };
  const data = await postJson('/.netlify/functions/detect-targets', payload);
  state.targets = data.targets || [];
  renderTargets();
  setProgress('Detect targets', 'completed', `${state.targets.length} targets`);
  els.runPipelineBtn.disabled = state.targets.length === 0;
  els.addTargetBtn.disabled = false;
}

async function refreshEvidenceForTarget(targetId) {
  const target = state.targets.find((t) => t.targetId === targetId);
  if (!target || !state.document) return;
  const config = getConfig();
  setProgress(`Locate evidence: ${target.displayName}`, 'running');
  const candidateContext = buildEvidenceCandidateContext(target, config);
  const data = await postJson('/.netlify/functions/locate-evidence', {
    target,
    document: { documentId: state.document.documentId, fileName: state.document.fileName },
    candidateContext,
    config
  });
  state.evidenceByTarget[targetId] = (data.evidenceItems || []).map((item) => ({ ...item, included: item.included !== false }));
  renderEvidence();
  setProgress(`Locate evidence: ${target.displayName}`, 'completed', `${state.evidenceByTarget[targetId].length} items`);
}

function buildTargetContext(targetId) {
  const items = (state.evidenceByTarget[targetId] || []).filter((item) => item.included !== false);
  return items.map((item) => ({
    evidenceId: item.evidenceId,
    pageStart: item.pageStart,
    pageEnd: item.pageEnd,
    summary: item.summary,
    rawSnippet: item.rawSnippet
  }));
}

async function runTargetPipeline(target) {
  if (!state.evidenceByTarget[target.targetId]?.length) {
    await refreshEvidenceForTarget(target.targetId);
  }
  const assembledEvidence = buildTargetContext(target.targetId);

  setProgress(`Extract facts: ${target.displayName}`, 'running');
  const extraction = await postJson('/.netlify/functions/extract-facts', {
    target,
    assembledEvidence,
    config: getConfig()
  });
  state.extractionByTarget[target.targetId] = extraction;
  setProgress(`Extract facts: ${target.displayName}`, 'completed');

  setProgress(`Summarise: ${target.displayName}`, 'running');
  const summaryDraft = await postJson('/.netlify/functions/enrich-summary', {
    target,
    extraction,
    assembledEvidence,
    config: getConfig()
  });
  setProgress(`Summarise: ${target.displayName}`, 'completed');

  setProgress(`Verify: ${target.displayName}`, 'running');
  const verified = await postJson('/.netlify/functions/verify-summary', {
    target,
    extraction,
    summary: summaryDraft,
    assembledEvidence,
    config: getConfig()
  });
  state.summariesByTarget[target.targetId] = verified;
  setProgress(`Verify: ${target.displayName}`, 'completed', verified.verificationStatus);
}

async function runFullPipeline() {
  for (const target of state.targets) {
    await runTargetPipeline(target);
    renderResults();
    await sleep(1200);
  }
}

function resetSession() {
  state.file = null;
  state.document = null;
  state.sections = [];
  state.targets = [];
  state.evidenceByTarget = {};
  state.extractionByTarget = {};
  state.summariesByTarget = {};
  state.diagnostics = null;
  state.progress = [];
  els.pdfFileInput.value = '';
  renderFileMeta();
  renderDiagnostics();
  renderTargets();
  renderEvidence();
  renderResults();
  renderProgress();
  renderDocumentPreview();
  els.detectTargetsBtn.disabled = true;
  els.runPipelineBtn.disabled = true;
  els.addTargetBtn.disabled = true;
}

function downloadFile(name, content, type = 'application/json') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function auditExport() {
  return {
    exportedAt: new Date().toISOString(),
    fileName: state.file?.name || null,
    document: state.document,
    diagnostics: state.diagnostics,
    sections: state.sections,
    targets: state.targets,
    evidenceByTarget: state.evidenceByTarget,
    extractionByTarget: state.extractionByTarget,
    summariesByTarget: state.summariesByTarget
  };
}

function summaryExportMarkdown() {
  return state.targets.map((target) => {
    const summary = state.summariesByTarget[target.targetId];
    if (!summary) return `## ${target.displayName}\n\nNo verified summary available.\n`;
    const softened = (summary.softenedStatements || []).map((item) => `- Original: ${item.original}\n  Revised: ${item.revised}\n  Reason: ${item.reason}`).join('\n');
    const removed = (summary.removedStatements || []).map((item) => `- ${item}`).join('\n');
    return `## ${target.displayName}\n\n${summary.approvedSummary}\n\nVerification status: ${summary.verificationStatus}\n${softened ? `\nSoftened statements\n${softened}\n` : ''}${removed ? `\nRemoved statements\n${removed}\n` : ''}`;
  }).join('\n');
}

function openTargetDialog(existing = null) {
  els.targetForm.displayName.value = existing?.displayName || '';
  els.targetForm.targetType.value = existing?.targetType || 'lot';
  els.targetForm.aliases.value = existing?.aliases?.join(', ') || '';
  els.targetForm.dataset.editId = existing?.targetId || '';
  els.targetDialog.showModal();
}

els.extractPdfBtn.addEventListener('click', async () => {
  try {
    const file = els.pdfFileInput.files?.[0];
    if (!file) throw new Error('Please choose a PDF file first.');
    state.file = file;
    setProgress('Extract PDF', 'running');
    state.document = await extractPdfText(file);
    state.diagnostics = analyseExtractionQuality(state.document);
    renderFileMeta();
    renderDiagnostics();
    renderDocumentPreview();
    els.detectTargetsBtn.disabled = false;
    setProgress('Extract PDF', 'completed', `${state.document.pageCount} pages`);
  } catch (error) {
    setProgress('Extract PDF', 'failed', error.message);
    alert(error.message);
  }
});

els.detectTargetsBtn.addEventListener('click', async () => {
  try {
    await detectTargets();
    renderEvidence();
    renderResults();
  } catch (error) {
    setProgress('Detect targets', 'failed', error.message);
    alert(error.message);
  }
});

els.runPipelineBtn.addEventListener('click', async () => {
  try {
    await runFullPipeline();
    renderResults();
  } catch (error) {
    alert(error.message);
  }
});

els.refreshEvidenceBtn.addEventListener('click', async () => {
  try {
    await refreshEvidenceForTarget(els.evidenceTargetSelect.value);
  } catch (error) {
    alert(error.message);
  }
});

els.evidenceTargetSelect.addEventListener('change', renderEvidence);

els.targetsContainer.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const targetId = button.dataset.id;
  const action = button.dataset.action;
  if (action === 'delete-target') {
    state.targets = state.targets.filter((t) => t.targetId !== targetId);
    delete state.evidenceByTarget[targetId];
    delete state.extractionByTarget[targetId];
    delete state.summariesByTarget[targetId];
    renderTargets();
    renderEvidence();
    renderResults();
  }
  if (action === 'edit-target') {
    const target = state.targets.find((t) => t.targetId === targetId);
    if (target) openTargetDialog(target);
  }
});

els.evidenceContainer.addEventListener('change', (event) => {
  const checkbox = event.target.closest('input[data-action="toggle-evidence"]');
  if (!checkbox) return;
  const { targetId, index } = checkbox.dataset;
  state.evidenceByTarget[targetId][Number(index)].included = checkbox.checked;
  renderEvidence();
});

els.addTargetBtn.addEventListener('click', () => openTargetDialog());

els.targetForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const formData = new FormData(els.targetForm);
  const displayName = String(formData.get('displayName') || '').trim();
  const targetType = String(formData.get('targetType') || 'lot');
  const aliases = String(formData.get('aliases') || '').split(',').map((x) => x.trim()).filter(Boolean);
  const editId = els.targetForm.dataset.editId;
  if (editId) {
    const existing = state.targets.find((t) => t.targetId === editId);
    if (existing) {
      existing.displayName = displayName;
      existing.targetType = targetType;
      existing.aliases = aliases;
    }
  } else {
    state.targets.push({
      targetId: `${targetType}-${slugify(displayName)}-${Math.random().toString(36).slice(2, 6)}`,
      displayName,
      targetType,
      aliases
    });
  }
  renderTargets();
  els.runPipelineBtn.disabled = state.targets.length === 0;
  els.targetDialog.close();
});

els.downloadAuditBtn.addEventListener('click', () => {
  downloadFile('strata-claims-audit.json', JSON.stringify(auditExport(), null, 2));
});

els.downloadSummaryBtn.addEventListener('click', () => {
  downloadFile('customer-summaries.md', summaryExportMarkdown(), 'text/markdown');
});

els.clearSessionBtn.addEventListener('click', resetSession);

resetSession();
