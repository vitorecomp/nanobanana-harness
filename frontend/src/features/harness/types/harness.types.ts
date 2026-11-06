import {
  ModelGenerationParams,
  NanoBananaModel,
} from "@/features/studio/types/studio.types";

export type TraceResponsibilityModule =
  | "PROMPT_SPECIFICATION"
  | "REFERENCE_ROUTING"
  | "MODEL_PARAMETERS";

export interface HarnessReferenceSlot {
  id: string;
  role: string;
  name: string;
  dataUrl: string;
}

export interface HarnessDeliverableSpec {
  id: string;
  index: number;
  title: string;
  description: string;
  status: "pending" | "solved" | "failed";
  incumbentScore: number;
  incumbentRound: number | null;
  incumbentCandidateIndex: number | null;
  incumbentImageUrl: string | null;
  incumbentPrompt: string | null;
  lockedByUser?: boolean;
}

export interface HarnessRubricCriterion {
  id: string;
  label: string;
  description: string;
  weight: number; // Sum across criteria = 100
}

export interface HarnessCriterionScore {
  criterionId: string;
  score: number;
  rationale: string;
}

export interface HarnessCandidateEvaluation {
  candidateIndex: number;
  deliverableId: string;
  deliverableTitle: string;
  label: string;
  promptStrategy: string;
  prompt: string;
  imageUrl: string;
  mimeType: string;
  hardFailures: string[];
  passedHardGate: boolean;
  totalScore: number;
  criterionScores: HarnessCriterionScore[];
  strengths: string[];
  complaints: string[];
  isSlotRoundWinner: boolean;
}

export interface TraceRoundAttribution {
  failurePattern: "SYSTEMATIC" | "STOCHASTIC" | "NONE";
  primaryModule: TraceResponsibilityModule;
  diagnosisSummary: string;
  noPatchTriggered: boolean;
  pairwiseVerdict:
    | "CHALLENGER_WON"
    | "INCUMBENT_RETAINED"
    | "INITIAL_INCUMBENT";
  pairwiseReasoning: string;
}

export interface HarnessRefinerDecision {
  useWinnerAsReference: boolean;
  useKeystoneStyleAnchor: boolean;
  adjustedModelParams: ModelGenerationParams;
  refinementSummary: string;
  addressedComplaints: string[];
  nextPromptDrafts: Array<{
    label: string;
    promptStrategy: string;
    prompt: string;
  }>;
}

export interface HarnessSlotRoundOutcome {
  deliverableId: string;
  deliverableTitle: string;
  wasAlreadySolved: boolean;
  anchoredFromImageUrl: string | null;
  keystoneAnchorImageUrl: string | null;
  candidates: HarnessCandidateEvaluation[];
  slotWinnerIndex: number;
  traceAttribution: TraceRoundAttribution;
  refinerDecisionForNextRound: HarnessRefinerDecision | null;
}

export interface HarnessRoundRecord {
  roundNumber: number;
  status: "planning" | "rendering" | "evaluating" | "checkpoint" | "completed";
  modelUsed: NanoBananaModel;
  modelParamsUsed: ModelGenerationParams;
  keystoneDeliverableId: string | null;
  keystoneImageUrl: string | null;
  roundSummary: string;
  slotOutcomes: HarnessSlotRoundOutcome[];
  userSteeringHint?: string;
  createdAt: string;
}

export interface HarnessRunConfig {
  model: NanoBananaModel;
  modelParams: ModelGenerationParams;
  aspectRatio: string;
  modifierIds: string[];
  maxRounds: number; // 1..5
  candidatesPerSlot: number; // 1..4
  targetScore: number; // 60..100
  checkpointMode: boolean; // true = pause after each round for human inspection
}

export type HarnessMissionStatus =
  | "idle"
  | "planning"
  | "running"
  | "checkpoint"
  | "completed"
  | "stopped";

export interface HarnessMissionRecord {
  id: string;
  user_id: string;
  title: string;
  goal: string;
  globalPackInvariants: string;
  referenceSlots: HarnessReferenceSlot[];
  deliverables: HarnessDeliverableSpec[];
  rubric: HarnessRubricCriterion[];
  config: HarnessRunConfig;
  rounds: HarnessRoundRecord[];
  status: HarnessMissionStatus;
  bestScore: number;
  bestImageUrl: string | null;
  created_at: string;
  updated_at: string;
}

export interface HarnessMissionSummary {
  id: string;
  user_id: string;
  title: string;
  goal: string;
  deliverableCount: number;
  solvedCount: number;
  roundCount: number;
  status: HarnessMissionStatus;
  bestScore: number;
  bestImageUrl: string | null;
  created_at: string;
  updated_at: string;
}
