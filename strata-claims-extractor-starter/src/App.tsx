import { useMemo, useState } from 'react';
import { detectTargets, enrichSummary, extractFacts, locateEvidence, verifySummary } from './lib/api';
import { parseManualTargets } from './lib/heuristics';
import { extractPdfDocument } from './lib/pdf';
import type { ExportBundle, ProcessedTarget } from './lib/types';
import { downloadJson, downloadText, formatTargetSummaryMarkdown } from './lib/utils';
import { useAppStore } from './state/appStore';

function App() {
  const {
    document,
    targets,
    sections,
    processedTargets,
    activeTargetId,
    stage,
    status,
    error,
    manualTargetsText,
    setDocument,
    setTargets,
    replaceTargets,
    upsertProcessedTarget,
    setActiveTargetId,
    setStage,
    setStatus,
    setError,
    setManualTargetsText,
    reset,
    diagnostics
  } = useAppStore();
  const [isRunning, setIsRunning] = useState(false);

  const activeTarget = activeTargetId ? processedTargets[activeTargetId] : undefined;

  async function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setError(undefined);
      setStage('extracting-pdf');
      setStatus('Extracting PDF text in your browser...');
      const doc = await extractPdfDocument(file);
      setDocument(doc);
      setStatus('PDF extracted. Ready to detect lots and common property.');
      setStage('idle');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to extract the PDF.');
    }
  }

  async function runPipeline() {
    if (!document) return;
    setIsRunning(true);
    setError(undefined);

    try {
      setStage('detecting-targets');
      setStatus('Detecting lots and common property...');
      const detected = await detectTargets(document);
      setTargets(detected.targets, detected.candidateSections);

      setStage('locating-evidence');
      setStatus('Locating evidence by lot and common property...');
      const workingTargets = detected.targets;
      for (const target of workingTargets) {
        const evidenceResult = await locateEvidence(document, target, detected.candidateSections);
        upsertProcessedTarget({ target, evidence: evidenceResult.evidenceItems.map((item) => ({ ...item, include: item.include ?? true })) });
      }

      setStage('extracting-facts');
      setStatus('Extracting structured facts...');
      for (const target of workingTargets) {
        const current = useAppStore.getState().processedTargets[target.targetId];
        const keptEvidence = current.evidence.filter((item) => item.include !== false);
        const facts = await extractFacts(target, keptEvidence, document);
        upsertProcessedTarget({ ...current, facts });
      }

      setStage('enriching-summaries');
      setStatus('Preparing plain-English summaries...');
      for (const target of workingTargets) {
        const current = useAppStore.getState().processedTargets[target.targetId];
        if (!current.facts) continue;
        const summary = await enrichSummary(target, current.facts, current.evidence.filter((item) => item.include !== false));
        upsertProcessedTarget({ ...current, draftSummary: summary.draftSummary });
      }

      setStage('verifying-summaries');
      setStatus('Verifying summaries against report evidence...');
      for (const target of workingTargets) {
        const current = useAppStore.getState().processedTargets[target.targetId];
        if (!current.facts || !current.draftSummary) continue;
        const verification = await verifySummary(
          target,
          current.facts,
          current.draftSummary,
          current.evidence.filter((item) => item.include !== false)
        );
        upsertProcessedTarget({ ...current, verification });
      }

      setStage('completed');
      setStatus('Processing complete. Review the outputs and export if required.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The pipeline failed.');
    } finally {
      setIsRunning(false);
    }
  }

  function applyManualTargets() {
    const parsed = parseManualTargets(manualTargetsText);
    if (!parsed.length) return;
    replaceTargets(parsed);
  }

  function toggleEvidence(targetId: string, evidenceId: string) {
    const current = processedTargets[targetId];
    if (!current) return;
    upsertProcessedTarget({
      ...current,
      evidence: current.evidence.map((item) => (item.evidenceId === evidenceId ? { ...item, include: !item.include } : item))
    });
  }

  function exportBundle() {
    const bundle: ExportBundle = {
      exportedAt: new Date().toISOString(),
      document,
      targets,
      sections,
      processedTargets,
      diagnostics
    };
    downloadJson('strata-claims-extraction-bundle.json', bundle);
  }

  function exportCustomerSummaries() {
    const markdown = Object.values(processedTargets)
      .map((item) =>
        formatTargetSummaryMarkdown(
          item.target.displayName,
          item.verification?.approvedSummary ?? item.draftSummary ?? 'No verified summary available.',
          (item.facts?.sourceReferences ?? []).map((ref) => `${ref.pageStart}${ref.pageEnd > ref.pageStart ? `-${ref.pageEnd}` : ''}`)
        )
      )
      .join('\n');
    downloadText('customer-summaries.md', markdown);
  }

  const processedList = useMemo(() => Object.values(processedTargets), [processedTargets]);

  return (
    <div className="app-shell">
      <section className="hero stack">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ margin: 0 }}>Strata Claims Assessment Extractor</h1>
            <p style={{ marginBottom: 0 }}>
              Browser-side PDF extraction, Claude-backed evidence routing, fact extraction, plain-English summaries, and verification.
            </p>
          </div>
          <div className="badge">Stage: {stage}</div>
        </div>
        <div className="row">
          <input type="file" accept="application/pdf" onChange={onFileChange} />
          <button className="secondary" onClick={() => reset()}>Reset session</button>
          <button onClick={() => runPipeline()} disabled={!document || isRunning}>Run full pipeline</button>
        </div>
        <div className="small">{status}</div>
        {error ? <div className="error">{error}</div> : null}
      </section>

      <div className="grid">
        <aside className="panel stack">
          <h2 style={{ marginTop: 0 }}>Session</h2>
          {document ? (
            <div className="card stack">
              <div><strong>File:</strong> {document.fileName}</div>
              <div><strong>Pages:</strong> {document.pageCount}</div>
              <div><strong>Average chars/page:</strong> {document.diagnostics.averageCharsPerPage}</div>
              <div><strong>Extraction quality:</strong> {document.diagnostics.extractionQuality}</div>
              <div><strong>Likely needs OCR:</strong> {document.diagnostics.likelyNeedsOcr ? 'Yes' : 'No'}</div>
            </div>
          ) : <div className="muted">Upload a PDF to begin.</div>}

          <div className="stack">
            <h3 style={{ marginBottom: 0 }}>Manual targets override</h3>
            <textarea
              value={manualTargetsText}
              onChange={(e) => setManualTargetsText(e.target.value)}
              placeholder="Lot 1\nLot 2\nCommon Property"
            />
            <button className="secondary" onClick={applyManualTargets} disabled={!manualTargetsText.trim()}>Apply manual targets</button>
          </div>

          <div className="stack target-list">
            <h3 style={{ marginBottom: 0 }}>Targets</h3>
            {targets.map((target) => (
              <button
                key={target.targetId}
                className={target.targetId === activeTargetId ? 'active' : ''}
                onClick={() => setActiveTargetId(target.targetId)}
              >
                <span>{target.displayName}</span>
                <span className="small">{processedTargets[target.targetId]?.evidence.length ?? 0} evidence</span>
              </button>
            ))}
          </div>

          <div className="row">
            <button className="secondary" onClick={exportBundle} disabled={!targets.length}>Export full JSON</button>
            <button className="secondary" onClick={exportCustomerSummaries} disabled={!targets.length}>Export summaries</button>
          </div>
        </aside>

        <main className="stack">
          <section className="panel stack">
            <h2 style={{ marginTop: 0 }}>Detected sections</h2>
            {!sections.length ? <div className="muted">Run the pipeline to populate sections.</div> : null}
            {sections.map((section) => (
              <div className="card" key={section.sectionId}>
                <strong>{section.title}</strong>
                <div className="small">Pages {section.startPage}-{section.endPage} · {section.sectionType}</div>
              </div>
            ))}
          </section>

          <section className="panel stack">
            <h2 style={{ marginTop: 0 }}>Evidence and outputs</h2>
            {!activeTarget ? <div className="muted">Select a target to review evidence and extracted output.</div> : null}
            {activeTarget ? <TargetPanel item={activeTarget} onToggleEvidence={toggleEvidence} /> : null}
          </section>

          <section className="panel stack">
            <h2 style={{ marginTop: 0 }}>Run summary</h2>
            <div className="card">
              <div><strong>Targets processed:</strong> {processedList.length}</div>
              <div><strong>Verified summaries:</strong> {processedList.filter((item) => item.verification?.verificationStatus).length}</div>
              <div><strong>Evidence items:</strong> {processedList.reduce((sum, item) => sum + item.evidence.length, 0)}</div>
            </div>
            <pre>{JSON.stringify(diagnostics, null, 2)}</pre>
          </section>
        </main>
      </div>
    </div>
  );
}

function TargetPanel({
  item,
  onToggleEvidence
}: {
  item: ProcessedTarget;
  onToggleEvidence: (targetId: string, evidenceId: string) => void;
}) {
  return (
    <div className="stack">
      <div className="card stack">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <strong>{item.target.displayName}</strong>
          <span className="badge">{item.target.targetType}</span>
        </div>
        <div className="small">Aliases: {item.target.aliases.join(', ') || 'None'}</div>
      </div>

      <div className="stack">
        <h3 style={{ marginBottom: 0 }}>Evidence review</h3>
        {!item.evidence.length ? <div className="muted">No evidence captured yet.</div> : null}
        {item.evidence.map((evidence) => (
          <div className="card stack" key={evidence.evidenceId}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <strong>{evidence.summary}</strong>
              <button className="secondary" onClick={() => onToggleEvidence(item.target.targetId, evidence.evidenceId)}>
                {evidence.include === false ? 'Excluded' : 'Included'}
              </button>
            </div>
            <div className="small">Pages {evidence.pageStart}-{evidence.pageEnd} · {evidence.explicitness} · {evidence.confidence}</div>
            <div className="small">Applies to: {evidence.appliesTo.join(', ')}</div>
            <div>{evidence.rawSnippet}</div>
          </div>
        ))}
      </div>

      <div className="stack">
        <h3 style={{ marginBottom: 0 }}>Structured facts</h3>
        {item.facts ? <pre>{JSON.stringify(item.facts, null, 2)}</pre> : <div className="muted">No fact extraction yet.</div>}
      </div>

      <div className="stack">
        <h3 style={{ marginBottom: 0 }}>Draft summary</h3>
        <div className="card">{item.draftSummary ?? 'No draft summary yet.'}</div>
      </div>

      <div className="stack">
        <h3 style={{ marginBottom: 0 }}>Verified summary</h3>
        {item.verification ? (
          <div className="card stack">
            <div><strong>Status:</strong> {item.verification.verificationStatus}</div>
            <div>{item.verification.approvedSummary}</div>
            {item.verification.removedStatements.length ? (
              <div>
                <strong>Removed statements</strong>
                <ul>
                  {item.verification.removedStatements.map((line) => <li key={line}>{line}</li>)}
                </ul>
              </div>
            ) : null}
          </div>
        ) : <div className="muted">No verification output yet.</div>}
      </div>
    </div>
  );
}

export default App;
