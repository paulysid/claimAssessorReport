import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { DocumentRecord, PageRecord } from './types';
import { uid } from './utils';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

function normaliseText(value: string): string {
  return value
    .replace(/\u0000/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function evaluatePageQuality(text: string): 'good' | 'fair' | 'poor' {
  if (text.length < 50) return 'poor';
  const weirdRatio = (text.match(/[□�]/g)?.length ?? 0) / Math.max(text.length, 1);
  if (weirdRatio > 0.03) return 'poor';
  if (text.length < 250) return 'fair';
  return 'good';
}

export async function extractPdfDocument(file: File): Promise<DocumentRecord> {
  const buffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: buffer });
  const pdf = await loadingTask.promise;
  const pages: PageRecord[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const text = textContent.items
      .map((item: { str?: string }) => (typeof item.str === 'string' ? item.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    const marker = `[PAGE ${pageNumber}]`;
    const combined = `${marker}\n${text}`;
    pages.push({
      pageNumber,
      marker,
      text: combined,
      normalisedText: normaliseText(combined),
      charCount: combined.length,
      extractionQuality: evaluatePageQuality(combined)
    });
  }

  const totalChars = pages.reduce((sum, page) => sum + page.charCount, 0);
  const averageCharsPerPage = pdf.numPages ? Math.round(totalChars / pdf.numPages) : 0;
  const poorPages = pages.filter((page) => page.extractionQuality === 'poor').length;
  const likelyNeedsOcr = poorPages > Math.max(1, Math.floor(pdf.numPages * 0.4));
  const extractionQuality = likelyNeedsOcr ? 'poor' : averageCharsPerPage < 250 ? 'fair' : 'good';

  return {
    documentId: uid('doc'),
    fileName: file.name,
    pageCount: pdf.numPages,
    pages,
    diagnostics: {
      totalChars,
      averageCharsPerPage,
      likelyNeedsOcr,
      extractionQuality
    }
  };
}
