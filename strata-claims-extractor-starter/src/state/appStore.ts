import { create } from 'zustand';
import type {
  CandidateSection,
  DocumentRecord,
  ProcessedTarget,
  RunDiagnostics,
  StageName,
  TargetRecord
} from '../lib/types';
import { createEmptyDiagnostics } from '../lib/api';

type AppState = {
  document?: DocumentRecord;
  targets: TargetRecord[];
  sections: CandidateSection[];
  processedTargets: Record<string, ProcessedTarget>;
  activeTargetId?: string;
  stage: StageName;
  status: string;
  error?: string;
  diagnostics: RunDiagnostics;
  manualTargetsText: string;
  setDocument: (document?: DocumentRecord) => void;
  setTargets: (targets: TargetRecord[], sections: CandidateSection[]) => void;
  replaceTargets: (targets: TargetRecord[]) => void;
  upsertProcessedTarget: (item: ProcessedTarget) => void;
  setActiveTargetId: (targetId?: string) => void;
  setStage: (stage: StageName) => void;
  setStatus: (status: string) => void;
  setError: (error?: string) => void;
  setManualTargetsText: (value: string) => void;
  pushFunctionCall: (item: RunDiagnostics['functionCalls'][number]) => void;
  reset: () => void;
};

export const useAppStore = create<AppState>((set) => ({
  document: undefined,
  targets: [],
  sections: [],
  processedTargets: {},
  activeTargetId: undefined,
  stage: 'idle',
  status: 'Ready',
  error: undefined,
  diagnostics: createEmptyDiagnostics(),
  manualTargetsText: '',
  setDocument: (document?: DocumentRecord) => set({ document }),
  setTargets: (targets: TargetRecord[], sections: CandidateSection[]) =>
    set({
      targets,
      sections,
      activeTargetId: targets[0]?.targetId,
      processedTargets: Object.fromEntries(targets.map((target) => [target.targetId, { target, evidence: [] }]))
    }),
  replaceTargets: (targets: TargetRecord[]) =>
    set((state) => ({
      targets,
      activeTargetId: targets[0]?.targetId,
      processedTargets: Object.fromEntries(
        targets.map((target) => [target.targetId, state.processedTargets[target.targetId] ?? { target, evidence: [] }])
      )
    })),
  upsertProcessedTarget: (item: ProcessedTarget) =>
    set((state) => ({
      processedTargets: { ...state.processedTargets, [item.target.targetId]: item }
    })),
  setActiveTargetId: (activeTargetId?: string) => set({ activeTargetId }),
  setStage: (stage: StageName) => set({ stage }),
  setStatus: (status: string) => set({ status }),
  setError: (error?: string) => set({ error, stage: error ? 'error' : 'idle' }),
  setManualTargetsText: (manualTargetsText: string) => set({ manualTargetsText }),
  pushFunctionCall: (item) =>
    set((state) => ({
      diagnostics: {
        ...state.diagnostics,
        functionCalls: [...state.diagnostics.functionCalls, item]
      }
    })),
  reset: () =>
    set({
      document: undefined,
      targets: [],
      sections: [],
      processedTargets: {},
      activeTargetId: undefined,
      stage: 'idle',
      status: 'Ready',
      error: undefined,
      diagnostics: createEmptyDiagnostics(),
      manualTargetsText: ''
    })
}));
