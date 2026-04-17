import { z } from 'zod';

export const targetSchema = z.object({
  targetId: z.string(),
  targetType: z.enum(['lot', 'common']),
  displayName: z.string(),
  aliases: z.array(z.string())
});

export const candidateSectionSchema = z.object({
  sectionId: z.string(),
  title: z.string(),
  startPage: z.number().int(),
  endPage: z.number().int(),
  sectionType: z.string()
});

export const evidenceItemSchema = z.object({
  evidenceId: z.string(),
  pageStart: z.number().int(),
  pageEnd: z.number().int(),
  summary: z.string(),
  rawSnippet: z.string(),
  appliesTo: z.array(z.string()),
  explicitness: z.enum(['explicit', 'context-linked', 'ambiguous']),
  confidence: z.enum(['high', 'medium', 'low'])
});

export const detectTargetsRequestSchema = z.object({
  documentId: z.string(),
  fileName: z.string(),
  documentText: z.string().min(1)
});

export const detectTargetsResponseSchema = z.object({
  targets: z.array(targetSchema),
  candidateSections: z.array(candidateSectionSchema)
});

export const locateEvidenceRequestSchema = z.object({
  target: targetSchema,
  candidateSections: z.array(candidateSectionSchema),
  pageText: z.string().min(1)
});

export const locateEvidenceResponseSchema = z.object({
  targetId: z.string(),
  evidenceItems: z.array(evidenceItemSchema)
});

export const extractFactsRequestSchema = z.object({
  target: targetSchema,
  evidenceItems: z.array(evidenceItemSchema),
  pageText: z.string().min(1)
});

export const extractFactsResponseSchema = z.object({
  targetId: z.string(),
  targetType: z.enum(['lot', 'common']),
  areasAffected: z.array(z.string()),
  damageObserved: z.array(z.string()),
  causeStatements: z.array(z.string()),
  worksMentioned: z.array(z.string()),
  furtherInvestigationMentioned: z.array(z.string()),
  uncertaintiesMentioned: z.array(z.string()),
  sourceReferences: z.array(
    z.object({
      pageStart: z.number().int(),
      pageEnd: z.number().int(),
      evidenceId: z.string()
    })
  )
});

export const enrichSummaryRequestSchema = z.object({
  target: targetSchema,
  facts: extractFactsResponseSchema,
  evidenceItems: z.array(evidenceItemSchema)
});

export const enrichSummaryResponseSchema = z.object({
  draftSummary: z.string()
});

export const verifySummaryRequestSchema = z.object({
  target: targetSchema,
  facts: extractFactsResponseSchema,
  draftSummary: z.string().min(1),
  evidenceItems: z.array(evidenceItemSchema)
});

export const verifySummaryResponseSchema = z.object({
  targetId: z.string(),
  verificationStatus: z.enum(['verified', 'verified-with-softening', 'failed']),
  approvedSummary: z.string(),
  removedStatements: z.array(z.string()),
  softenedStatements: z.array(
    z.object({
      original: z.string(),
      revised: z.string(),
      reason: z.string()
    })
  )
});
