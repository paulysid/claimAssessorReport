export type PageRecord = {
  pageNumber: number;
  marker: string;
  text: string;
  normalisedText: string;
  charCount: number;
  extractionQuality?: 'good' | 'fair' | 'poor';
};

export type DocumentRecord = {
  documentId: string;
  fileName: string;
  pageCount: number;
  pages: PageRecord[];
  diagnostics: {
    totalChars: number;
    averageCharsPerPage: number;
    likelyNeedsOcr: boolean;
    extractionQuality: 'good' | 'fair' | 'poor';
  };
};

export type TargetRecord = {
  targetId: string;
  targetType: 'lot' | 'common';
  displayName: string;
  aliases: string[];
  userEdited?: boolean;
};

export type CandidateSection = {
  sectionId: string;
  title: string;
  startPage: number;
  endPage: number;
  sectionType: string;
};

export type EvidenceItem = {
  evidenceId: string;
  pageStart: number;
  pageEnd: number;
  summary: string;
  rawSnippet: string;
  appliesTo: string[];
  explicitness: 'explicit' | 'context-linked' | 'ambiguous';
  confidence: 'high' | 'medium' | 'low';
  include?: boolean;
};

export type ExtractFactsResult = {
  targetId: string;
  targetType: 'lot' | 'common';
  areasAffected: string[];
  damageObserved: string[];
  causeStatements: string[];
  worksMentioned: string[];
  furtherInvestigationMentioned: string[];
  uncertaintiesMentioned: string[];
  sourceReferences: Array<{
    pageStart: number;
    pageEnd: number;
    evidenceId: string;
  }>;
};

export type SummaryResult = {
  draftSummary: string;
};

export type VerificationResult = {
  targetId: string;
  verificationStatus: 'verified' | 'verified-with-softening' | 'failed';
  approvedSummary: string;
  removedStatements: string[];
  softenedStatements: Array<{
    original: string;
    revised: string;
    reason: string;
  }>;
};

export type ProcessedTarget = {
  target: TargetRecord;
  evidence: EvidenceItem[];
  facts?: ExtractFactsResult;
  draftSummary?: string;
  verification?: VerificationResult;
};

export type StageName =
  | 'idle'
  | 'extracting-pdf'
  | 'detecting-targets'
  | 'locating-evidence'
  | 'extracting-facts'
  | 'enriching-summaries'
  | 'verifying-summaries'
  | 'completed'
  | 'error';

export type RunDiagnostics = {
  requestIds: string[];
  retries: number;
  functionCalls: Array<{
    stage: string;
    targetId?: string;
    startedAt: string;
    completedAt?: string;
    success: boolean;
    error?: string;
  }>;
};

export type ExportBundle = {
  exportedAt: string;
  document?: DocumentRecord;
  targets: TargetRecord[];
  sections: CandidateSection[];
  processedTargets: Record<string, ProcessedTarget>;
  diagnostics: RunDiagnostics;
};
