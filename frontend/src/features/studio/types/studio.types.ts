export type NanoBananaModel =
  | "gemini-2.5-flash-image"
  | "gemini-2.0-flash-exp-image-generation";

export type CreationFlowMode = "compose" | "surgical-delta";

export type ExplorationMatrixAxis =
  | "auto-director"
  | "camera-angles"
  | "lighting-setups"
  | "wardrobe-variants"
  | "storyboard-4"
  | `cat:${string}`;

export interface PreservationLocks {
  keepCharacter: boolean;
  keepPose: boolean;
  keepBackground: boolean;
}

export interface CanonicalDnaReference {
  label: string;
  imageUrl: string;
  prompt: string;
  sourceTurn?: number;
}

export interface InlineImagePart {
  mimeType: string;
  data: string;
}

export interface GenerateNanoBananaRequest {
  apiKey: string;
  model: NanoBananaModel;
  prompt: string;
  referenceImage?: InlineImagePart | null;
  secondaryReferenceImage?: InlineImagePart | null;
}

export interface GenerateNanoBananaResult {
  imageDataUrl: string;
  mimeType: string;
  base64Data: string;
  modelText?: string;
  modelUsed: string;
  mode: "direct-api" | "simulation";
}

export interface StylePreset {
  id: string;
  title: string;
  description: string;
  prompt_tokens: string;
  aspect_ratio: string;
}

export interface ModifierOption {
  id: string;
  label: string;
  token: string;
}

export interface ModifierCategory {
  id: string;
  title: string;
  options: ModifierOption[];
}

export interface WorkflowStepInfo {
  step: number;
  title: string;
  subtitle: string;
  description: string;
}

export interface QuickIterationChip {
  id?: string;
  label: string;
  instruction: string;
}

export interface BootstrapResponse {
  style_presets: StylePreset[];
  modifier_categories: ModifierCategory[];
  interactive_workflow_steps: WorkflowStepInfo[];
  quick_iteration_chips: QuickIterationChip[];
}

export interface GuidedQuestionOption {
  label: string;
  prompt_addition: string;
}

export interface GuidedQuestion {
  id: string;
  dimension: string;
  question: string;
  options: GuidedQuestionOption[];
}

export interface PromptVariation {
  id: string;
  title: string;
  focus: string;
  full_prompt: string;
  recommended_aspect_ratio: string;
}

export interface AnalyzePromptResponse {
  completeness_score: number;
  missing_dimensions: string[];
  detected_dimensions: string[];
  guided_questions: GuidedQuestion[];
  variations: PromptVariation[];
  master_prompt: string;
}

export interface RefinePromptResponse {
  refined_prompt: string;
  edit_instruction: string;
  explanation: string;
  next_suggestions: QuickIterationChip[];
}

export interface SessionFrame {
  id: string;
  turn: number;
  imageUrl: string;
  mimeType: string;
  base64Data?: string;
  promptUsed: string;
  instructionUsed?: string;
  explanation?: string;
  modelUsed: string;
  mode: "direct-api" | "simulation";
  timestamp: string;
  bucketKey?: string | null;
  savedToPostgres?: boolean;
  isPublished?: boolean;
}

export interface FlowNodePosition {
  x: number;
  y: number;
}

export interface FlowStepParameterSnapshot {
  flowMode: CreationFlowMode;
  aspectRatio: string;
  matrixAxis: ExplorationMatrixAxis;
  styleId: string;
  modifierIds: string[];
  preservationLocks: PreservationLocks;
}

