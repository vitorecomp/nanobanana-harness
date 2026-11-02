use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GuidedOption {
    pub label: String,
    pub prompt_addition: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GuidedQuestion {
    pub id: String,
    pub dimension: String,
    pub question: String,
    pub options: Vec<GuidedOption>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PromptVariation {
    pub id: String,
    pub title: String,
    pub focus: String,
    pub full_prompt: String,
    pub recommended_aspect_ratio: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalyzePromptResponse {
    pub completeness_score: i64,
    pub missing_dimensions: Vec<String>,
    pub detected_dimensions: Vec<String>,
    pub guided_questions: Vec<GuidedQuestion>,
    pub variations: Vec<PromptVariation>,
    pub master_prompt: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuickChip {
    pub id: String,
    pub label: String,
    pub instruction: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RefinePromptResponse {
    pub refined_prompt: String,
    pub edit_instruction: String,
    pub explanation: String,
    pub next_suggestions: Vec<QuickChip>,
}

pub fn analyze_idea(idea: &str, style_id: &str, modifiers: &[String]) -> AnalyzePromptResponse {
    let clean_idea = if idea.trim().is_empty() {
        "A futuristic urban explorer with aviator goggles walking down a sunlit street"
    } else {
        idea.trim()
    };

    let style_tokens = match style_id {
        "analog-35mm" => "35mm analog film photography, Kodak Portra 400 color science, natural halation, shallow depth of field f/1.8",
        "neo-brutalist" => "swiss neo-brutalist graphic illustration, bold carbon black ink outlines, acid yellow #F2FA3C accents on warm bone paper",
        "cyberpunk-3d" => "cinematic sci-fi concept art, volumetric atmospheric lighting, utilitarian techwear details, anamorphic lens flare",
        "botanical-watercolor" => "botanical architectural watercolor with fine technical pen ink linework, cold-press cotton paper texture",
        _ => "high-craft editorial anime illustration, crisp cel-shaded linework, graphic flat shadow blocks, warm cream paper texture, dynamic character design",
    };

    let lower = format!("{} {}", clean_idea, modifiers.join(" ")).to_lowercase();
    let mut detected = vec!["subject".to_string(), "style".to_string()];
    let mut missing = Vec::new();

    if lower.contains("light") || lower.contains("sun") || lower.contains("golden") || lower.contains("neon") || lower.contains("shadow") {
        detected.push("lighting".to_string());
    } else {
        missing.push("lighting".to_string());
    }

    if lower.contains("35mm") || lower.contains("85mm") || lower.contains("24mm") || lower.contains("close") || lower.contains("lens") {
        detected.push("camera".to_string());
    } else {
        missing.push("camera".to_string());
    }

    if lower.contains("street") || lower.contains("city") || lower.contains("tokyo") || lower.contains("backdrop") {
        detected.push("environment".to_string());
    } else {
        missing.push("environment".to_string());
    }

    let score = std::cmp::min(
        98,
        std::cmp::max(45, 42 + (detected.len() as i64) * 12 + (modifiers.len() as i64) * 6),
    );

    let mod_suffix = if modifiers.is_empty() {
        String::new()
    } else {
        format!(", {}", modifiers.join(", "))
    };

    let master_prompt = format!(
        "{}. Style: {}{}, sharp focus, cohesive color grading, masterpiece composition.",
        clean_idea, style_tokens, mod_suffix
    );

    AnalyzePromptResponse {
        completeness_score: score,
        missing_dimensions: missing,
        detected_dimensions: detected,
        guided_questions: vec![
            GuidedQuestion {
                id: "q-lighting".to_string(),
                dimension: "lighting".to_string(),
                question: "What lighting atmosphere should elevate this scene?".to_string(),
                options: vec![
                    GuidedOption {
                        label: "Warm Golden Hour Sunlight".to_string(),
                        prompt_addition: "bathed in warm late-afternoon golden hour sunlight with long expressive shadows".to_string(),
                    },
                    GuidedOption {
                        label: "Acid-Yellow Rim Light (#F2FA3C)".to_string(),
                        prompt_addition: "dramatic acid-yellow (#F2FA3C) rim lighting with deep carbon-black ink shadows".to_string(),
                    },
                    GuidedOption {
                        label: "Diffused Studio Key Light".to_string(),
                        prompt_addition: "diffused editorial studio lighting highlighting fabric textures and crisp linework".to_string(),
                    },
                ],
            },
            GuidedQuestion {
                id: "q-camera".to_string(),
                dimension: "camera".to_string(),
                question: "Which camera framing and optical lens should we apply?".to_string(),
                options: vec![
                    GuidedOption {
                        label: "85mm Editorial Portrait".to_string(),
                        prompt_addition: "medium portrait framing on an 85mm f/1.4 lens with creamy background separation".to_string(),
                    },
                    GuidedOption {
                        label: "35mm Street Perspective".to_string(),
                        prompt_addition: "35mm street lens revealing surrounding architecture and dynamic posture".to_string(),
                    },
                    GuidedOption {
                        label: "Dramatic Close-Up".to_string(),
                        prompt_addition: "tight close-up focusing on the eyes, aviator goggles, and structured collar".to_string(),
                    },
                ],
            },
            GuidedQuestion {
                id: "q-detail".to_string(),
                dimension: "environment".to_string(),
                question: "Which graphic element or environmental detail should stand out?".to_string(),
                options: vec![
                    GuidedOption {
                        label: "Overhead Lines & Pastel Teal Sky".to_string(),
                        prompt_addition: "urban utility poles silhouetted against a clean pastel teal sky".to_string(),
                    },
                    GuidedOption {
                        label: "Utility Jacket & Goggles".to_string(),
                        prompt_addition: "structured olive-and-cream utility jacket with aviator goggles resting on forehead".to_string(),
                    },
                    GuidedOption {
                        label: "Acid-Yellow #F2FA3C Graphic Accents".to_string(),
                        prompt_addition: "graphic signage details and insignia in vibrant acid-yellow (#F2FA3C)".to_string(),
                    },
                ],
            },
        ],
        variations: vec![
            PromptVariation {
                id: "var-editorial".to_string(),
                title: "Flagship Editorial Cover".to_string(),
                focus: "Crypko-inspired graphic composition and crisp ink contrast".to_string(),
                full_prompt: format!(
                    "{}, {}{}, bold ink linework, warm bone backdrop #E9E7DF, acid-yellow #F2FA3C graphic accents, magazine cover framing.",
                    clean_idea, style_tokens, mod_suffix
                ),
                recommended_aspect_ratio: "3:4".to_string(),
            },
            PromptVariation {
                id: "var-cinematic".to_string(),
                title: "Cinematic Street Narrative".to_string(),
                focus: "Sunlit urban avenue depth and atmospheric perspective".to_string(),
                full_prompt: format!(
                    "{}, wide 35mm street perspective, {}{}, pastel teal sky, sunlit architectural facades, dynamic walking pose, rich cel-shaded shadows.",
                    clean_idea, style_tokens, mod_suffix
                ),
                recommended_aspect_ratio: "16:9".to_string(),
            },
            PromptVariation {
                id: "var-closeup".to_string(),
                title: "Intimate Character Close-Up (85mm)".to_string(),
                focus: "Expressive gaze, protective eyewear, and garment textures".to_string(),
                full_prompt: format!(
                    "Intimate 85mm close-up portrait of {}, {}{}, detailed expressive eyes, utility collar and goggles, crisp ink contours.",
                    clean_idea, style_tokens, mod_suffix
                ),
                recommended_aspect_ratio: "1:1".to_string(),
            },
        ],
        master_prompt,
    }
}

pub fn refine_prompt(current_prompt: &str, instruction: &str) -> RefinePromptResponse {
    let edit_instruction = format!(
        "Preserve the main character design, pose, and composition from the reference image, and apply the following visual modification: {}. Maintain crisp cel-shaded linework and editorial color harmony.",
        instruction.trim()
    );
    let refined_prompt = format!("{} — [Multi-Turn Edit: {}]", current_prompt.trim(), instruction.trim());

    RefinePromptResponse {
        refined_prompt,
        edit_instruction,
        explanation: "Native Rust Co-Pilot structured a surgical multi-turn edit instruction preserving character identity and linework from the previous canvas.".to_string(),
        next_suggestions: vec![
            QuickChip {
                id: "dramatic-light".to_string(),
                label: "Make lighting more dramatic".to_string(),
                instruction: "Make the lighting more dramatic with chiaroscuro contrast and an acid-yellow rim light".to_string(),
            },
            QuickChip {
                id: "neon-night".to_string(),
                label: "Switch to neon Tokyo night".to_string(),
                instruction: "Transform the setting into a rainy nocturnal Tokyo street with neon reflections on wet asphalt".to_string(),
            },
            QuickChip {
                id: "closeup-85mm".to_string(),
                label: "85mm cinematic close-up".to_string(),
                instruction: "Move the camera closer for a dramatic 85mm f/1.4 close-up portrait while preserving character identity".to_string(),
            },
            QuickChip {
                id: "acid-visor".to_string(),
                label: "Add acid-yellow visor (#F2FA3C)".to_string(),
                instruction: "Add a translucent tactical visor in acid-yellow (#F2FA3C) and graphic insignia on the jacket".to_string(),
            },
        ],
    }
}
