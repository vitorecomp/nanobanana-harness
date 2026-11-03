export interface SavedGenerationVariant {
  label: string;
  prompt: string;
  imageUrl: string;
  imagePath?: string | null;
}

export interface SavedTurnRecord {
  id: string;
  conversation_id: string;
  turn_number: number;
  parent_turn_number?: number | null;
  role: string;
  raw_idea: string;
  master_prompt: string;
  edit_instruction?: string | null;
  style_id?: string | null;
  modifiers?: string[];
  completeness_score?: number;
  image_bucket_key?: string | null;
  image_url?: string | null;
  aspect_ratio?: string | null;
  model_used?: string | null;
  is_published?: boolean;
  variants?: SavedGenerationVariant[];
  selected_variant_index?: number;
  storage_status?: string;
  created_at?: string;
}

export interface SavedConversationSummary {
  id: string;
  user_id: string;
  title: string;
  style_id?: string | null;
  turn_count: number;
  latest_prompt?: string | null;
  preview_image_url?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface SavedCanonicalDna {
  label: string;
  imageUrl: string;
  prompt: string;
  sourceTurn?: number;
}

export interface SavedConversationDetail extends SavedConversationSummary {
  canonical_dna?: SavedCanonicalDna | null;
  turns: SavedTurnRecord[];
}

export interface BucketGalleryItem {
  id: string;
  turn_id?: string;
  conversation_id: string;
  conversation_title?: string;
  turn_number: number;
  author_name?: string;
  author_id?: string;
  raw_idea?: string;
  master_prompt: string;
  edit_instruction?: string | null;
  style_id?: string | null;
  modifiers?: string[];
  aspect_ratio?: string | null;
  image_bucket_key?: string | null;
  image_url: string;
  model_used?: string | null;
  is_published?: boolean;
  is_curated?: boolean;
  created_at?: string;
}
