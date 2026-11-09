"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { useRouter } from "next/navigation";
import { useStudioSession } from "@/core/context/StudioSessionContext";
import { LOCAL_DEV_USER } from "@/features/auth";
import {
  FlowNodePosition,
  ModelGenerationParams,
  NanoBananaModel,
  renderPreparedBatchWithNanoBanana,
} from "@/features/studio";
import {
  HarnessCandidateEvaluation,
  HarnessDeliverableSpec,
  HarnessMissionRecord,
  HarnessMissionStatus,
  HarnessReferenceSlot,
  HarnessRoundRecord,
  HarnessRubricCriterion,
  HarnessSlotRoundOutcome,
  buildReiterationDraftsForDeliverable,
  buildRound1DraftPromptsForDeliverable,
  imageUrlToInlinePartForHarness,
  runHarnessCriticAgent,
  runHarnessPlannerAgent,
  runHarnessTraceRefinerAgent,
} from "@/features/harness";
import {
  localDbGetHarnessMission,
  localDbListHarnessMissions,
  localDbSaveHarnessMission,
} from "@/core/tauri/tauriBridge";
import {
  IconAtelierStar,
  IconAutoGrid,
  IconClose,
  IconDownload,
  IconExpand,
  IconGripDots,
  IconMinus,
  IconPlus,
  IconRefresh,
} from "@/shared/components/icons/AtelierIcons";

const HARNESS_MODELS: Array<{
  id: NanoBananaModel;
  label: string;
  badge: string;
}> = [
  {
    id: "gemini-2.5-flash-image",
    label: "Gemini 2.5 Flash Image",
    badge: "Fast",
  },
  {
    id: "gemini-3-pro-image-preview",
    label: "Gemini 3 Pro Image",
    badge: "Pro",
  },
  {
    id: "gemini-2.0-flash-exp-image-generation",
    label: "Gemini 2.0 Flash Exp",
    badge: "Exp",
  },
];

const QUICK_GOAL_PRESETS = [
  {
    label: "Isometric Space Pack (4)",
    goal: "Crie os assets do meu jogo de space, em formato isometrico",
    aspectRatio: "1:1",
    candidatesPerSlot: 2,
  },
  {
    label: "Kyoto Matcha Bar Hero",
    goal: "Hero banner editorial para cafeteria japonesa minimalista em Kyoto com cerâmica artesanal e luz matinal",
    aspectRatio: "16:9",
    candidatesPerSlot: 2,
  },
  {
    label: "Isometric Potion Pack (4)",
    goal: "Create an isometric game asset pack of 4 magical glass alchemy potions with glowing botanical ingredients",
    aspectRatio: "1:1",
    candidatesPerSlot: 2,
  },
];

const ASPECT_RATIO_OPTIONS = ["1:1", "3:4", "4:3", "16:9", "9:16"];

const HARNESS_CARD_WIDTH = 284;
const HARNESS_CARD_HEIGHT = 296;
const HARNESS_PORT_OFFSET_Y = 145;
const HARNESS_COL_SPACING = 340;
const HARNESS_DRAFT_ROW_SPACING = 336;
const HARNESS_ROUND_STRIDE_X = HARNESS_COL_SPACING * 4 + 44;
const HARNESS_TOP_ROW_Y = 160;
const HARNESS_LEFT_X = 56;
const HARNESS_ZOOM_PRESETS = [25, 35, 50, 65, 75, 100, 125, 150] as const;

export type HarnessFlowStepKind =
  | "thinking"
  | "draft"
  | "refining"
  | "result";

export interface HarnessFlowNodeItem {
  nodeId: string;
  stepKind: HarnessFlowStepKind;
  roundNumber: number;
  roundSummary: string;
  roundStatus: HarnessRoundRecord["status"];
  deliverableId: string;
  deliverableTitle: string;
  outcome: HarnessSlotRoundOutcome;
  candidate?: HarnessCandidateEvaluation;
  winnerCandidate: HarnessCandidateEvaluation;
  candidateIndex: number;
  defaultPos: FlowNodePosition;
}

export interface HarnessFlowEdgeItem {
  key: string;
  sourceNodeId: string;
  targetNodeId: string;
  edgeKind: "pipeline" | "inter-round";
  isHighlighted: boolean;
  path: string;
  startX: number;
  startY: number;
}

/**
 * Left-to-Right rounded orthogonal/cubic wire between consecutive pipeline columns
 * (01 Thinking -> 02 Drafts [parallel stack] -> 03 Refining -> 04 Result -> Next Round 01 Thinking)
 */
function buildLeftToRightFlowWire(
  sourcePos: FlowNodePosition,
  targetPos: FlowNodePosition
): { path: string; startX: number; startY: number } {
  const startX = Math.round(sourcePos.x + HARNESS_CARD_WIDTH);
  const startY = Math.round(sourcePos.y + HARNESS_PORT_OFFSET_Y);
  const endX = Math.round(targetPos.x - 6);
  const endY = Math.round(targetPos.y + HARNESS_PORT_OFFSET_Y);
  const midX = Math.round((startX + endX) / 2);

  if (Math.abs(endY - startY) < 4) {
    return {
      path: `M ${startX} ${startY} L ${endX} ${endY}`,
      startX,
      startY,
    };
  }

  const r = 14;
  const dirY = endY >= startY ? 1 : -1;
  const dirX = endX >= startX ? 1 : -1;
  if (Math.abs(endX - startX) >= 48 && Math.abs(endY - startY) >= 28) {
    const path = [
      `M ${startX} ${startY}`,
      `L ${midX - dirX * r} ${startY}`,
      `Q ${midX} ${startY} ${midX} ${startY + dirY * r}`,
      `L ${midX} ${endY - dirY * r}`,
      `Q ${midX} ${endY} ${midX + dirX * r} ${endY}`,
      `L ${endX} ${endY}`,
    ].join(" ");
    return { path, startX, startY };
  }

  return {
    path: `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`,
    startX,
    startY,
  };
}

function buildProceduralIsometricPreviewDataUrl(params: {
  slotTitle: string;
  candidateLabel: string;
  roundNumber: number;
  slotIndex: number;
  candidateIndex: number;
}): string {
  const accentColors = [
    "rgb(119,141,169)",
    "rgb(65,90,119)",
    "rgb(224,225,221)",
    "rgb(148,163,184)",
  ];
  const accent =
    accentColors[
      (params.slotIndex + params.candidateIndex) % accentColors.length
    ];
  const safeTitle = params.slotTitle.replace(/[<>&"']/g, "").slice(0, 32);
  const safeLabel = params.candidateLabel.replace(/[<>&"']/g, "").slice(0, 36);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
    <rect width="512" height="512" fill="rgb(13,27,42)"/>
    <g stroke="rgba(119,141,169,0.22)" stroke-width="1">
      <line x1="256" y1="64" x2="448" y2="176"/>
      <line x1="256" y1="64" x2="64" y2="176"/>
      <line x1="64" y1="176" x2="256" y2="288"/>
      <line x1="448" y1="176" x2="256" y2="288"/>
      <line x1="64" y1="304" x2="256" y2="416"/>
      <line x1="448" y1="304" x2="256" y2="416"/>
    </g>
    <polygon points="256,112 396,192 256,272 116,192" fill="rgba(65,90,119,0.28)" stroke="${accent}" stroke-width="3"/>
    <polygon points="116,192 256,272 256,384 116,304" fill="rgba(27,38,59,0.88)" stroke="${accent}" stroke-width="2.5"/>
    <polygon points="396,192 256,272 256,384 396,304" fill="rgba(13,27,42,0.92)" stroke="${accent}" stroke-width="2.5"/>
    <circle cx="256" cy="192" r="24" fill="${accent}" opacity="0.88"/>
    <text x="256" y="446" text-anchor="middle" fill="rgb(224,225,221)" font-family="monospace" font-size="16" font-weight="700">${safeTitle}</text>
    <text x="256" y="472" text-anchor="middle" fill="rgb(119,141,169)" font-family="monospace" font-size="13">R${params.roundNumber} • ${safeLabel}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export default function GoalHarnessPage() {
  const router = useRouter();
  const {
    apiKey,
    user,
    harnessPlannerPrompt,
    harnessCriticPrompt,
    harnessRefinerPrompt,
    activeHarnessMissionId,
    setActiveHarnessMissionId,
    setPendingRemix,
    openSettingsModal,
  } = useStudioSession();

  const activeUser = user || LOCAL_DEV_USER;

  // Mission persistence state
  const [activeMissionId, setActiveMissionId] = useState<string>("");
  const [missionTitle, setMissionTitle] = useState<string>(
    "Untitled Goal Mission"
  );
  const [goalInput, setGoalInput] = useState<string>("");
  const [globalPackInvariants, setGlobalPackInvariants] = useState<string>("");

  // Execution parameters (inside Floating Parameters Modal)
  const [modelUsed, setModelUsed] = useState<NanoBananaModel>(
    "gemini-2.5-flash-image"
  );
  const [aspectRatio, setAspectRatio] = useState<string>("1:1");
  const [maxRounds, setMaxRounds] = useState<number>(3);
  const [targetScore, setTargetScore] = useState<number>(85);
  const [candidatesPerSlot, setCandidatesPerSlot] = useState<number>(2);
  const [executionMode, setExecutionMode] = useState<"COPILOT" | "AUTONOMOUS">(
    "AUTONOMOUS"
  );

  // Reference slots (AutoRef-Harness: up to 2 role-allocated references)
  const [referenceSlots, setReferenceSlots] = useState<HarnessReferenceSlot[]>(
    []
  );
  const refFileInputRef = useRef<HTMLInputElement | null>(null);

  // Plan & Rubric state
  const [deliverables, setDeliverables] = useState<HarnessDeliverableSpec[]>(
    []
  );
  const [rubric, setRubric] = useState<HarnessRubricCriterion[]>([]);
  const [keystoneAnchor, setKeystoneAnchor] = useState<{
    deliverableId: string;
    title: string;
    imageUrl: string;
    score: number;
  } | null>(null);

  // Rounds & Status
  const [rounds, setRounds] = useState<HarnessRoundRecord[]>([]);
  const [status, setStatus] = useState<HarnessMissionStatus>("idle");
  const [liveStepNote, setLiveStepNote] = useState<string>("");
  const [activeStageLabel, setActiveStageLabel] = useState<string>("");
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [lastPlannedGoal, setLastPlannedGoal] = useState<string>("");
  const [selectedSlotFilter, setSelectedSlotFilter] = useState<string>("ALL");

  // Side Reiteration & Refinement state
  const [reiterateNote, setReiterateNote] = useState<string>("");
  const [reiterateTargetSlotId, setReiterateTargetSlotId] =
    useState<string>("ALL");
  const [reiterateExtraRounds, setReiterateExtraRounds] = useState<number>(1);
  const [reiterateAnchorToIncumbent, setReiterateAnchorToIncumbent] =
    useState<boolean>(true);
  const reiterateInputRef = useRef<HTMLTextAreaElement | null>(null);

  // Floating Modals state
  const [isParamsModalOpen, setIsParamsModalOpen] = useState<boolean>(false);
  const [paramsModalTab, setParamsModalTab] = useState<"params" | "plan">(
    "params"
  );
  const [inspectedNodeId, setInspectedNodeId] = useState<string | null>(null);
  const [lightboxCard, setLightboxCard] = useState<HarnessFlowNodeItem | null>(
    null
  );

  // Flow Canvas Pan, Zoom & Node Positions (0.50 default zoom fits all 5 pipeline steps horizontally)
  const [canvasViewport, setCanvasViewport] = useState<{
    x: number;
    y: number;
    zoom: number;
  }>({ x: 16, y: 36, zoom: 0.5 });
  const [customNodePositions, setCustomNodePositions] = useState<
    Record<string, FlowNodePosition>
  >({});
  const [selectedNodeId, setSelectedNodeId] = useState<string>("");
  const [isDraggingCanvas, setIsDraggingCanvas] = useState<boolean>(false);
  const [isCameraGliding, setIsCameraGliding] = useState<boolean>(false);
  const cameraGlideTimerRef = useRef<number | null>(null);
  const canvasViewportRef = useRef<HTMLDivElement | null>(null);

  const triggerCameraGlide = useCallback(() => {
    if (typeof window === "undefined") return;
    setIsCameraGliding(true);
    if (cameraGlideTimerRef.current !== null) {
      window.clearTimeout(cameraGlideTimerRef.current);
    }
    cameraGlideTimerRef.current = window.setTimeout(() => {
      setIsCameraGliding(false);
      cameraGlideTimerRef.current = null;
    }, 360);
  }, []);
  const dragStateRef = useRef<
    | {
        mode: "pan";
        startClientX: number;
        startClientY: number;
        originX: number;
        originY: number;
      }
    | {
        mode: "node";
        nodeId: string;
        startClientX: number;
        startClientY: number;
        originX: number;
        originY: number;
      }
    | null
  >(null);

  const abortRef = useRef<boolean>(false);
  const hasRestoredViewportRef = useRef<boolean>(false);
  const isRunning = status === "planning" || status === "running";

  const persistHarnessCanvasState = useCallback(
    (
      missionId: string,
      positions: Record<string, FlowNodePosition>,
      viewport: { x: number; y: number; zoom: number }
    ) => {
      if (typeof window === "undefined" || !missionId) return;
      try {
        window.localStorage.setItem(
          `nanobanana_harness_flow_meta_v2:${missionId}`,
          JSON.stringify({ positions, viewport })
        );
      } catch {
        // Ignore storage quota warnings
      }
    },
    []
  );

  useEffect(() => {
    if (!isRunning) return;
    setElapsedSeconds(0);
    const timer = window.setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isRunning]);

  // Global mouse move / up for Flow Canvas panning & node dragging
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const st = dragStateRef.current;
      if (!st) return;
      if (st.mode === "pan") {
        const dx = e.clientX - st.startClientX;
        const dy = e.clientY - st.startClientY;
        hasRestoredViewportRef.current = true;
        setCanvasViewport((prev) => {
          const next = {
            ...prev,
            x: Math.round(st.originX + dx),
            y: Math.round(st.originY + dy),
          };
          if (activeMissionId) {
            persistHarnessCanvasState(
              activeMissionId,
              customNodePositions,
              next
            );
          }
          return next;
        });
      } else if (st.mode === "node") {
        const dx = (e.clientX - st.startClientX) / canvasViewport.zoom;
        const dy = (e.clientY - st.startClientY) / canvasViewport.zoom;
        hasRestoredViewportRef.current = true;
        setCustomNodePositions((prev) => {
          const next = {
            ...prev,
            [st.nodeId]: {
              x: Math.round(st.originX + dx),
              y: Math.round(st.originY + dy),
            },
          };
          if (activeMissionId) {
            persistHarnessCanvasState(activeMissionId, next, canvasViewport);
          }
          return next;
        });
      }
    };
    const handleMouseUp = () => {
      if (dragStateRef.current) {
        dragStateRef.current = null;
        setIsDraggingCanvas(false);
      }
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [
    activeMissionId,
    canvasViewport,
    customNodePositions,
    persistHarnessCanvasState,
  ]);

  // Rounds ordered from NEWEST (top of sidebar list) to OLDEST
  const newestFirstRounds = useMemo(() => {
    return [...rounds].sort((a, b) => b.roundNumber - a.roundNumber);
  }, [rounds]);

  // Rounds ordered chronologically (Left-to-Right on the Flow Canvas: Round 1 -> Round 2 -> ...)
  const chronologicalRounds = useMemo(() => {
    return [...rounds].sort((a, b) => a.roundNumber - b.roundNumber);
  }, [rounds]);

  /**
   * Build the full 4-Stage Left-to-Right Pipeline Flow Nodes:
   * - Flows strictly from Left to Right across stages AND across iterations (Round 1 ──► Round 2 ──► ...):
   *   Col 0: [01 • THINKING & PLAN] (vertically centered)
   *   Col 1: [02 • CANDIDATE DRAFT #1..#N] (parallel vertical column stack)
   *   Col 2: [03 • TRACE REFINING & CRITIC] (vertically centered)
   *   Col 3: [04 • ROUND RESULT / CHAMPION 🏆] (vertically centered)
   * - Deliverable slots are stacked in horizontal swimlanes if a mission has multiple deliverables.
   */
  const { flowNodes, rowHeaders } = useMemo(() => {
    const nodes: HarnessFlowNodeItem[] = [];
    const headers: Array<{
      key: string;
      roundNumber: number;
      deliverableTitle: string;
      roundSummary: string;
      isLatest: boolean;
      colX: number;
      rowY: number;
    }> = [];

    if (chronologicalRounds.length === 0) {
      return { flowNodes: nodes, rowHeaders: headers };
    }

    const latestRoundNum =
      chronologicalRounds[chronologicalRounds.length - 1]?.roundNumber ?? 1;

    // Collect distinct deliverable IDs in order
    const deliverableIds: string[] = [];
    const seenDeliverables = new Set<string>();
    for (const r of chronologicalRounds) {
      for (const so of r.slotOutcomes) {
        if (
          selectedSlotFilter !== "ALL" &&
          so.deliverableId !== selectedSlotFilter
        ) {
          continue;
        }
        if (!seenDeliverables.has(so.deliverableId)) {
          seenDeliverables.add(so.deliverableId);
          deliverableIds.push(so.deliverableId);
        }
      }
    }

    let currentSwimlaneTopY = HARNESS_TOP_ROW_Y;

    deliverableIds.forEach((delivId) => {
      // Find max candidate count across rounds for this deliverable to size the swimlane vertically
      let maxDraftCount = 1;
      for (const r of chronologicalRounds) {
        const so = r.slotOutcomes.find((x) => x.deliverableId === delivId);
        if (so) {
          maxDraftCount = Math.max(maxDraftCount, so.candidates.length || 1);
        }
      }

      const swimlaneCenterY =
        currentSwimlaneTopY +
        Math.round(((maxDraftCount - 1) * HARNESS_DRAFT_ROW_SPACING) / 2);

      chronologicalRounds.forEach((round, roundChronIdx) => {
        const outcome = round.slotOutcomes.find(
          (so) => so.deliverableId === delivId
        );
        if (!outcome) return;

        const roundBaseX =
          HARNESS_LEFT_X + roundChronIdx * HARNESS_ROUND_STRIDE_X;

        headers.push({
          key: `row-hdr-r${round.roundNumber}-${outcome.deliverableId}`,
          roundNumber: round.roundNumber,
          deliverableTitle: outcome.deliverableTitle,
          roundSummary: round.roundSummary,
          isLatest: round.roundNumber === latestRoundNum,
          colX: roundBaseX,
          rowY: currentSwimlaneTopY,
        });

        const winnerIdx = outcome.slotWinnerIndex ?? 0;
        const winnerCandidate =
          outcome.candidates[winnerIdx] || outcome.candidates[0];
        if (!winnerCandidate) return;

        // COLUMN 0: STEP 01 — THINKING & PLAN NODE (vertically centered)
        nodes.push({
          nodeId: `r${round.roundNumber}::${outcome.deliverableId}::thinking`,
          stepKind: "thinking",
          roundNumber: round.roundNumber,
          roundSummary: round.roundSummary,
          roundStatus: round.status,
          deliverableId: outcome.deliverableId,
          deliverableTitle: outcome.deliverableTitle,
          outcome,
          winnerCandidate,
          candidateIndex: 0,
          defaultPos: {
            x: roundBaseX + 0 * HARNESS_COL_SPACING,
            y: swimlaneCenterY,
          },
        });

        // COLUMN 1: STEP 02 — CANDIDATE DRAFT NODES (stacked vertically in parallel)
        const draftCount = Math.max(1, outcome.candidates.length);
        const draftTopY =
          swimlaneCenterY -
          Math.round(((draftCount - 1) * HARNESS_DRAFT_ROW_SPACING) / 2);

        outcome.candidates.forEach((cand, cIdx) => {
          nodes.push({
            nodeId: `r${round.roundNumber}::${outcome.deliverableId}::draft-${cIdx}`,
            stepKind: "draft",
            roundNumber: round.roundNumber,
            roundSummary: round.roundSummary,
            roundStatus: round.status,
            deliverableId: outcome.deliverableId,
            deliverableTitle: outcome.deliverableTitle,
            outcome,
            candidate: cand,
            winnerCandidate,
            candidateIndex: cIdx,
            defaultPos: {
              x: roundBaseX + 1 * HARNESS_COL_SPACING,
              y: draftTopY + cIdx * HARNESS_DRAFT_ROW_SPACING,
            },
          });
        });

        // COLUMN 2: STEP 03 — TRACE REFINING & CRITIC DIAGNOSIS NODE (vertically centered)
        nodes.push({
          nodeId: `r${round.roundNumber}::${outcome.deliverableId}::refining`,
          stepKind: "refining",
          roundNumber: round.roundNumber,
          roundSummary: round.roundSummary,
          roundStatus: round.status,
          deliverableId: outcome.deliverableId,
          deliverableTitle: outcome.deliverableTitle,
          outcome,
          winnerCandidate,
          candidateIndex: winnerIdx,
          defaultPos: {
            x: roundBaseX + 2 * HARNESS_COL_SPACING,
            y: swimlaneCenterY,
          },
        });

        // COLUMN 3: STEP 04 — ROUND RESULT / CHAMPION NODE (vertically centered)
        nodes.push({
          nodeId: `r${round.roundNumber}::${outcome.deliverableId}::result`,
          stepKind: "result",
          roundNumber: round.roundNumber,
          roundSummary: round.roundSummary,
          roundStatus: round.status,
          deliverableId: outcome.deliverableId,
          deliverableTitle: outcome.deliverableTitle,
          outcome,
          candidate: winnerCandidate,
          winnerCandidate,
          candidateIndex: winnerIdx,
          defaultPos: {
            x: roundBaseX + 3 * HARNESS_COL_SPACING,
            y: swimlaneCenterY,
          },
        });
      });

      currentSwimlaneTopY +=
        maxDraftCount * HARNESS_DRAFT_ROW_SPACING + 96;
    });

    return { flowNodes: nodes, rowHeaders: headers };
  }, [chronologicalRounds, selectedSlotFilter]);

  const getEffectivePos = useCallback(
    (node: HarnessFlowNodeItem): FlowNodePosition => {
      return customNodePositions[node.nodeId] || node.defaultPos;
    },
    [customNodePositions]
  );

  // Build Left-to-Right DAG wires:
  // [01 Thinking] ──► [02 Draft #1..#N] ──► [03 Refining] ──► [04 Result 🏆] ──► [Next Round 01 Thinking]
  const flowEdges = useMemo<HarnessFlowEdgeItem[]>(() => {
    const byId = new Map<string, HarnessFlowNodeItem>();
    for (const n of flowNodes) {
      byId.set(n.nodeId, n);
    }

    const edges: HarnessFlowEdgeItem[] = [];

    chronologicalRounds.forEach((round) => {
      const outcomes =
        selectedSlotFilter === "ALL"
          ? round.slotOutcomes
          : round.slotOutcomes.filter(
              (so) => so.deliverableId === selectedSlotFilter
            );

      outcomes.forEach((outcome) => {
        const prefix = `r${round.roundNumber}::${outcome.deliverableId}`;
        const thinkingNode = byId.get(`${prefix}::thinking`);
        const refiningNode = byId.get(`${prefix}::refining`);
        const resultNode = byId.get(`${prefix}::result`);

        const draftNodes = outcome.candidates
          .map((_, idx) => byId.get(`${prefix}::draft-${idx}`))
          .filter((x): x is HarnessFlowNodeItem => Boolean(x));

        // 1. Fan-out: [01 Thinking] ──► each [02 Draft #k]
        if (thinkingNode) {
          for (const draftNode of draftNodes) {
            const wire = buildLeftToRightFlowWire(
              getEffectivePos(thinkingNode),
              getEffectivePos(draftNode)
            );
            edges.push({
              key: `pipe-${thinkingNode.nodeId}-${draftNode.nodeId}`,
              sourceNodeId: thinkingNode.nodeId,
              targetNodeId: draftNode.nodeId,
              edgeKind: "pipeline",
              isHighlighted:
                Boolean(draftNode.candidate?.isSlotRoundWinner) ||
                selectedNodeId === thinkingNode.nodeId ||
                selectedNodeId === draftNode.nodeId,
              path: wire.path,
              startX: wire.startX,
              startY: wire.startY,
            });
          }
        }

        // 2. Fan-in: each [02 Draft #k] ──► [03 Refining]
        if (refiningNode) {
          for (const draftNode of draftNodes) {
            const wire = buildLeftToRightFlowWire(
              getEffectivePos(draftNode),
              getEffectivePos(refiningNode)
            );
            edges.push({
              key: `pipe-${draftNode.nodeId}-${refiningNode.nodeId}`,
              sourceNodeId: draftNode.nodeId,
              targetNodeId: refiningNode.nodeId,
              edgeKind: "pipeline",
              isHighlighted:
                Boolean(draftNode.candidate?.isSlotRoundWinner) ||
                selectedNodeId === draftNode.nodeId ||
                selectedNodeId === refiningNode.nodeId,
              path: wire.path,
              startX: wire.startX,
              startY: wire.startY,
            });
          }
        }

        // 3. [03 Refining] ──► [04 Result 🏆]
        if (refiningNode && resultNode) {
          const wire = buildLeftToRightFlowWire(
            getEffectivePos(refiningNode),
            getEffectivePos(resultNode)
          );
          edges.push({
            key: `pipe-${refiningNode.nodeId}-${resultNode.nodeId}`,
            sourceNodeId: refiningNode.nodeId,
            targetNodeId: resultNode.nodeId,
            edgeKind: "pipeline",
            isHighlighted: true,
            path: wire.path,
            startX: wire.startX,
            startY: wire.startY,
          });
        }

        // 4. Inter-round Left-to-Right continuation: Previous Round's [04 Result 🏆] ──► This Round's [01 Thinking]
        if (round.roundNumber > 1 && thinkingNode) {
          for (let prevR = round.roundNumber - 1; prevR >= 1; prevR--) {
            const prevResultNode = byId.get(
              `r${prevR}::${outcome.deliverableId}::result`
            );
            if (prevResultNode) {
              const wire = buildLeftToRightFlowWire(
                getEffectivePos(prevResultNode),
                getEffectivePos(thinkingNode)
              );
              edges.push({
                key: `inter-${prevResultNode.nodeId}-${thinkingNode.nodeId}`,
                sourceNodeId: prevResultNode.nodeId,
                targetNodeId: thinkingNode.nodeId,
                edgeKind: "inter-round",
                isHighlighted: true,
                path: wire.path,
                startX: wire.startX,
                startY: wire.startY,
              });
              break;
            }
          }
        }
      });
    });

    return edges;
  }, [
    flowNodes,
    chronologicalRounds,
    selectedSlotFilter,
    getEffectivePos,
    selectedNodeId,
  ]);

  const inspectedNode = useMemo(() => {
    if (!inspectedNodeId) return null;
    return flowNodes.find((n) => n.nodeId === inspectedNodeId) || null;
  }, [flowNodes, inspectedNodeId]);

  const applyFitViewportToPositions = useCallback(
    (positions: FlowNodePosition[], options?: { minZoom?: number }) => {
      triggerCameraGlide();
      if (positions.length === 0) {
        setCanvasViewport({ x: 24, y: 24, zoom: 0.65 });
        return;
      }
      const viewportEl = canvasViewportRef.current;
      const vw = viewportEl?.clientWidth || 920;
      const vh = viewportEl?.clientHeight || 760;

      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const pos of positions) {
        minX = Math.min(minX, pos.x);
        minY = Math.min(minY, pos.y - 48);
        maxX = Math.max(maxX, pos.x + HARNESS_CARD_WIDTH);
        maxY = Math.max(maxY, pos.y + HARNESS_CARD_HEIGHT);
      }

      const toolbarSafeTop = 86;
      const sidePad = 24;
      const usableW = Math.max(320, vw - sidePad * 2);
      const usableH = Math.max(260, vh - toolbarSafeTop - 24);
      const rawW = Math.max(320, maxX - minX);
      const rawH = Math.max(320, maxY - minY);
      const minZoomFloor = options?.minZoom ?? 0.16;
      const nextZoom = Math.min(
        0.95,
        Math.max(minZoomFloor, Math.min(usableW / rawW, usableH / rawH))
      );
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      const centeredX = Math.round(vw / 2 - centerX * nextZoom);
      const centeredY = Math.round(
        toolbarSafeTop + usableH / 2 - centerY * nextZoom
      );
      const minAllowedX = Math.round(sidePad - minX * nextZoom);
      const minAllowedY = Math.round(toolbarSafeTop + 8 - minY * nextZoom);

      setCanvasViewport({
        zoom: Number(nextZoom.toFixed(2)),
        x: rawW * nextZoom > usableW ? minAllowedX : centeredX,
        y: rawH * nextZoom > usableH ? minAllowedY : centeredY,
      });
    },
    []
  );

  const handleAutoOrganizeFlow = useCallback(() => {
    setCustomNodePositions({});
    if (typeof window !== "undefined" && activeMissionId) {
      window.localStorage.removeItem(
        `nanobanana_harness_flow_pos:${activeMissionId}`
      );
      window.localStorage.removeItem(
        `nanobanana_harness_flow_meta_v2:${activeMissionId}`
      );
    }
    hasRestoredViewportRef.current = true;
    applyFitViewportToPositions(
      flowNodes.map((n) => n.defaultPos),
      { minZoom: 0.48 }
    );
  }, [activeMissionId, applyFitViewportToPositions, flowNodes]);

  const handleFitFlowView = useCallback(() => {
    hasRestoredViewportRef.current = true;
    applyFitViewportToPositions(
      flowNodes.map((n) => getEffectivePos(n)),
      { minZoom: 0.14 }
    );
  }, [applyFitViewportToPositions, flowNodes, getEffectivePos]);

  const handleApplyZoomPreset = useCallback(
    (value: string) => {
      if (value === "FIT") {
        handleFitFlowView();
        return;
      }
      if (value === "AUTO") {
        handleAutoOrganizeFlow();
        return;
      }
      const parsedPct = Number(value);
      if (!Number.isFinite(parsedPct) || parsedPct <= 0) return;
      const targetZoom = Math.min(
        1.5,
        Math.max(0.14, Number((parsedPct / 100).toFixed(2)))
      );
      const viewportEl = canvasViewportRef.current;
      const cx = (viewportEl?.clientWidth || 920) / 2;
      const cy = (viewportEl?.clientHeight || 760) / 2;

      hasRestoredViewportRef.current = true;
      triggerCameraGlide();
      setCanvasViewport((prev) => {
        const worldCenterX = (cx - prev.x) / prev.zoom;
        const worldCenterY = (cy - prev.y) / prev.zoom;
        return {
          zoom: targetZoom,
          x: Math.round(cx - worldCenterX * targetZoom),
          y: Math.round(cy - worldCenterY * targetZoom),
        };
      });
    },
    [handleAutoOrganizeFlow, handleFitFlowView]
  );

  // Persist custom dragged node positions & viewport (zoom, panX, panY) per missionId so F5 preserves layout & zoom
  useEffect(() => {
    if (typeof window === "undefined" || !activeMissionId) {
      return;
    }
    persistHarnessCanvasState(
      activeMissionId,
      customNodePositions,
      canvasViewport
    );
  }, [
    activeMissionId,
    customNodePositions,
    canvasViewport,
    persistHarnessCanvasState,
  ]);

  // Synchronize active mission, zoom, pan & UI state into the URL query string so F5 never resets the flow
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!activeMissionId) return;

    const params = new URLSearchParams(window.location.search);
    params.delete("new");
    params.set("missionId", activeMissionId);
    params.set("zoom", String(Math.round(canvasViewport.zoom * 100)));
    params.set("panX", String(Math.round(canvasViewport.x)));
    params.set("panY", String(Math.round(canvasViewport.y)));

    if (selectedSlotFilter && selectedSlotFilter !== "ALL") {
      params.set("slot", selectedSlotFilter);
    } else {
      params.delete("slot");
    }

    if (selectedNodeId) {
      params.set("node", selectedNodeId);
    } else {
      params.delete("node");
    }

    if (inspectedNodeId) {
      params.set("inspect", inspectedNodeId);
    } else {
      params.delete("inspect");
    }

    if (isParamsModalOpen) {
      params.set("modal", paramsModalTab);
    } else {
      params.delete("modal");
    }

    const nextSearch = params.toString();
    const nextUrl = nextSearch ? `/harness?${nextSearch}` : "/harness";
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (currentUrl !== nextUrl) {
      window.history.replaceState(null, "", nextUrl);
    }
  }, [
    activeMissionId,
    canvasViewport.zoom,
    canvasViewport.x,
    canvasViewport.y,
    selectedSlotFilter,
    selectedNodeId,
    inspectedNodeId,
    isParamsModalOpen,
    paramsModalTab,
  ]);

  // Auto-organize Left-to-Right ONLY when a mission has no saved viewport/positions yet
  useEffect(() => {
    if (
      flowNodes.length > 0 &&
      !hasRestoredViewportRef.current &&
      Object.keys(customNodePositions).length === 0
    ) {
      hasRestoredViewportRef.current = true;
      applyFitViewportToPositions(
        flowNodes.map((n) => n.defaultPos),
        { minZoom: 0.48 }
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flowNodes.length, activeMissionId]);

  const handleFocusRoundOnCanvas = (roundNumber: number) => {
    const roundNodes = flowNodes.filter((n) => n.roundNumber === roundNumber);
    if (roundNodes.length === 0) return;
    hasRestoredViewportRef.current = true;
    applyFitViewportToPositions(roundNodes.map((n) => getEffectivePos(n)));
  };

  const handleResetNewMission = () => {
    abortRef.current = true;
    hasRestoredViewportRef.current = false;
    setActiveMissionId("");
    setActiveHarnessMissionId(null);
    setMissionTitle("Untitled Goal Mission");
    setGoalInput("");
    setLastPlannedGoal("");
    setGlobalPackInvariants("");
    setDeliverables([]);
    setRubric([]);
    setKeystoneAnchor(null);
    setRounds([]);
    setReferenceSlots([]);
    setCustomNodePositions({});
    setSelectedNodeId("");
    setInspectedNodeId(null);
    setIsParamsModalOpen(false);
    setStatus("idle");
    setLiveStepNote("");
    setActiveStageLabel("");
    setSelectedSlotFilter("ALL");
    setReiterateNote("");
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", "/harness?new=1");
    }
  };

  const handleLoadMission = async (
    missionId: string,
    opts?: { preserveUrlParams?: boolean }
  ) => {
    if (!missionId) return;
    const loaded = await localDbGetHarnessMission(missionId);
    if (!loaded) return;
    abortRef.current = true;

    // Read URL params BEFORE setActiveMissionId triggers any URL sync effect
    const urlParams =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search)
        : new URLSearchParams();
    const urlZoom = Number(urlParams.get("zoom"));
    const urlPanX = Number(urlParams.get("panX"));
    const urlPanY = Number(urlParams.get("panY"));
    const hasUrlViewport =
      opts?.preserveUrlParams &&
      urlParams.has("zoom") &&
      Number.isFinite(urlZoom) &&
      urlZoom >= 14 &&
      urlZoom <= 150;

    // Restore custom node positions & viewport if saved for this mission
    let restoredPositions: Record<string, FlowNodePosition> = {};
    let restoredViewport: { x: number; y: number; zoom: number } | null = null;
    if (typeof window !== "undefined") {
      try {
        const rawMeta = window.localStorage.getItem(
          `nanobanana_harness_flow_meta_v2:${loaded.id}`
        );
        if (rawMeta) {
          const parsed = JSON.parse(rawMeta);
          if (parsed?.positions && typeof parsed.positions === "object") {
            restoredPositions = parsed.positions;
          }
          if (
            parsed?.viewport &&
            typeof parsed.viewport.zoom === "number" &&
            typeof parsed.viewport.x === "number" &&
            typeof parsed.viewport.y === "number"
          ) {
            restoredViewport = parsed.viewport;
          }
        } else {
          const rawLegacyPos = window.localStorage.getItem(
            `nanobanana_harness_flow_pos:${loaded.id}`
          );
          if (rawLegacyPos) {
            restoredPositions = JSON.parse(rawLegacyPos) || {};
          }
        }
      } catch {
        restoredPositions = {};
      }
    }

    if (hasUrlViewport) {
      restoredViewport = {
        zoom: Number((urlZoom / 100).toFixed(2)),
        x: Number.isFinite(urlPanX) ? urlPanX : restoredViewport?.x ?? 16,
        y: Number.isFinite(urlPanY) ? urlPanY : restoredViewport?.y ?? 36,
      };
    }

    if (restoredViewport || Object.keys(restoredPositions).length > 0) {
      hasRestoredViewportRef.current = true;
      if (restoredViewport) {
        setCanvasViewport(restoredViewport);
      }
    } else {
      hasRestoredViewportRef.current = false;
    }

    setCustomNodePositions(restoredPositions);
    setActiveMissionId(loaded.id);
    setActiveHarnessMissionId(loaded.id);
    setMissionTitle(loaded.title);
    setGoalInput(loaded.goal);
    setLastPlannedGoal(loaded.goal);
    setGlobalPackInvariants(loaded.globalPackInvariants);
    setAspectRatio(loaded.config?.aspectRatio || "1:1");
    setModelUsed(loaded.config?.model || "gemini-2.5-flash-image");
    setMaxRounds(loaded.config?.maxRounds || 3);
    setTargetScore(loaded.config?.targetScore || 85);
    setCandidatesPerSlot(loaded.config?.candidatesPerSlot || 2);
    setStatus(
      loaded.status === "running" || loaded.status === "planning"
        ? "idle"
        : loaded.status || "idle"
    );
    setDeliverables(loaded.deliverables || []);
    setRubric(loaded.rubric || []);
    setRounds(loaded.rounds || []);
    setReferenceSlots(loaded.referenceSlots || []);

    if (opts?.preserveUrlParams) {
      const slotParam = urlParams.get("slot");
      const nodeParam = urlParams.get("node");
      const inspectParam = urlParams.get("inspect");
      const modalParam = urlParams.get("modal");

      setSelectedSlotFilter(slotParam || "ALL");
      if (nodeParam) setSelectedNodeId(nodeParam);
      if (inspectParam) setInspectedNodeId(inspectParam);
      if (modalParam === "params" || modalParam === "plan") {
        setParamsModalTab(modalParam);
        setIsParamsModalOpen(true);
      }
    } else {
      setSelectedSlotFilter("ALL");
    }

    setActiveStageLabel("");
    setLiveStepNote(
      (loaded.rounds || []).length === 0 &&
        (loaded.deliverables || []).length > 0
        ? `Loaded planned mission "${loaded.title}" (${loaded.deliverables.length} deliverable slot(s) ready to run).`
        : ""
    );

    if ((loaded.deliverables || []).length > 1) {
      const top = [...loaded.deliverables]
        .filter((d) => Boolean(d.incumbentImageUrl))
        .sort((a, b) => b.incumbentScore - a.incumbentScore)[0];
      if (top && top.incumbentImageUrl) {
        setKeystoneAnchor({
          deliverableId: top.id,
          title: top.title,
          imageUrl: top.incumbentImageUrl,
          score: top.incumbentScore,
        });
      } else {
        setKeystoneAnchor(null);
      }
    } else {
      setKeystoneAnchor(null);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const bootstrapMissionFromRouteOrDb = async () => {
      let targetId = "";
      let isExplicitNew = false;

      if (typeof window !== "undefined") {
        const urlParams = new URLSearchParams(window.location.search);
        const fromQuery = urlParams.get("missionId");
        isExplicitNew = urlParams.get("new") === "1";
        if (fromQuery) {
          targetId = fromQuery;
        }
      }

      if (isExplicitNew) {
        return;
      }

      if (!targetId && activeHarnessMissionId) {
        targetId = activeHarnessMissionId;
      }

      if (!targetId && typeof window !== "undefined") {
        targetId =
          window.localStorage.getItem("nanobanana_active_harness_mission_id") ||
          "";
      }

      if (!targetId) {
        const list = await localDbListHarnessMissions(activeUser.id);
        if (list.length > 0) {
          targetId = list[0].id;
        }
      }

      if (!cancelled && targetId && targetId !== activeMissionId) {
        await handleLoadMission(targetId, { preserveUrlParams: true });
      }
    };

    void bootstrapMissionFromRouteOrDb();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeHarnessMissionId]);

  const handleAddReferenceImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || referenceSlots.length >= 2) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      if (!dataUrl.startsWith("data:image/")) return;
      setReferenceSlots((prev) => {
        if (prev.length >= 2) return prev;
        const slotIdx = prev.length + 1;
        return [
          ...prev,
          {
            id: `ref_${slotIdx}_${Date.now().toString(36)}`,
            role:
              slotIdx === 1
                ? "Identity & Subject Anchor"
                : "Isometric Style & Palette Anchor",
            name: file.name || `Reference #${slotIdx}`,
            dataUrl,
          },
        ];
      });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleRemoveReference = (id: string) => {
    setReferenceSlots((prev) => prev.filter((r) => r.id !== id));
  };

  const handleOpenInStudio = (params: {
    title: string;
    prompt: string;
    imageUrl?: string | null;
  }) => {
    setPendingRemix({
      idea: params.title || goalInput || "Goal Harness Asset",
      prompt: params.prompt,
      imageUrl: params.imageUrl || undefined,
      nonce: Date.now(),
    });
    router.push("/create");
  };

  // Phase 1: Run Planner Agent to decompose Goal into Deliverables, Pack Invariants & Weighted Rubric
  const handleRunPlanner = async (opts?: {
    createNewMission?: boolean;
    keepRunningStatus?: boolean;
  }): Promise<{
    missionId: string;
    title: string;
    invariants: string;
    plannedDeliverables: HarnessDeliverableSpec[];
    plannedRubric: HarnessRubricCriterion[];
  } | null> => {
    const trimmedGoal = goalInput.trim();
    if (!trimmedGoal) return null;

    abortRef.current = false;
    setStatus("planning");
    setActiveStageLabel("STAGE 1/4 • THINKING & PLANNER");
    setLiveStepNote(
      "Planner Agent decomposing goal into deliverables, pack invariants & evaluation rubric..."
    );

    try {
      const plan = await runHarnessPlannerAgent({
        apiKey,
        goal: trimmedGoal,
        referenceSlots,
        customPlannerPrompt: harnessPlannerPrompt,
      });

      const nextMissionId =
        !opts?.createNewMission && activeMissionId
          ? activeMissionId
          : `hm_${Date.now().toString(36)}_${Math.random()
              .toString(36)
              .slice(2, 6)}`;
      const nowIso = new Date().toISOString();
      const preservedRounds = opts?.createNewMission ? [] : rounds;

      setActiveMissionId(nextMissionId);
      setActiveHarnessMissionId(nextMissionId);
      setMissionTitle(plan.missionTitle);
      setLastPlannedGoal(trimmedGoal);
      setGlobalPackInvariants(plan.globalPackInvariants);
      setDeliverables(plan.deliverables);
      setRubric(plan.rubric);
      if (opts?.createNewMission) {
        setRounds([]);
        setKeystoneAnchor(null);
      }
      setSelectedSlotFilter("ALL");

      const initialRecord: HarnessMissionRecord = {
        id: nextMissionId,
        user_id: activeUser.id,
        title: plan.missionTitle,
        goal: trimmedGoal,
        globalPackInvariants: plan.globalPackInvariants,
        referenceSlots,
        deliverables: plan.deliverables,
        rubric: plan.rubric,
        config: {
          model: modelUsed,
          modelParams: { temperature: 1.0, topP: 0.95, seed: null },
          aspectRatio,
          modifierIds: [],
          maxRounds,
          candidatesPerSlot,
          targetScore,
          checkpointMode: executionMode === "COPILOT",
        },
        rounds: preservedRounds,
        status: opts?.keepRunningStatus ? "running" : "idle",
        bestScore: 0,
        bestImageUrl: null,
        created_at: nowIso,
        updated_at: nowIso,
      };

      const saved = await localDbSaveHarnessMission(initialRecord);
      setDeliverables(saved.deliverables);
      if (!opts?.keepRunningStatus) {
        setStatus("idle");
        setActiveStageLabel("PLAN READY");
      }
      setLiveStepNote(
        `Plan ready: ${saved.deliverables.length} deliverable(s) & ${saved.rubric.length} weighted criteria.`
      );

      return {
        missionId: saved.id,
        title: saved.title,
        invariants: saved.globalPackInvariants,
        plannedDeliverables: saved.deliverables,
        plannedRubric: saved.rubric,
      };
    } catch (err) {
      setStatus("idle");
      setActiveStageLabel("");
      setLiveStepNote(
        `Planner warning: ${
          err instanceof Error ? err.message : "Failed to plan goal"
        }`
      );
      return null;
    }
  };

  // Phase 2 & 3: Execute Autonomous Multi-Round Loop (01 Thinking -> 02 Drafts -> 03 Refining -> 04 Result)
  const executeHarnessLoop = async (
    overridePlan?: {
      missionId: string;
      title: string;
      invariants: string;
      plannedDeliverables: HarnessDeliverableSpec[];
      plannedRubric: HarnessRubricCriterion[];
    },
    reiterateOpts?: {
      isReiteration: boolean;
      extraRounds?: number;
      targetSlotId?: string;
      userRefinementNote?: string;
      anchorToIncumbent?: boolean;
    }
  ) => {
    const currentMissionId =
      overridePlan?.missionId ||
      activeMissionId ||
      `hm_${Date.now().toString(36)}`;
    const currentTitle = overridePlan?.title || missionTitle || "Goal Mission";
    const currentInvariants =
      overridePlan?.invariants ?? globalPackInvariants;
    let workingDeliverables = [
      ...(overridePlan?.plannedDeliverables || deliverables),
    ];
    const workingRubric = [...(overridePlan?.plannedRubric || rubric)];

    if (workingDeliverables.length === 0 || workingRubric.length === 0) {
      return;
    }

    setActiveMissionId(currentMissionId);
    setActiveHarnessMissionId(currentMissionId);

    const hasExistingRounds = rounds.length > 0;
    const isReiterating = Boolean(
      reiterateOpts?.isReiteration || hasExistingRounds
    );
    const targetSlotFilter = isReiterating
      ? reiterateOpts?.targetSlotId || "ALL"
      : "ALL";
    const steeringNote = isReiterating
      ? (reiterateOpts?.userRefinementNote || "").trim()
      : "";
    const forceAnchorToIncumbent = isReiterating
      ? reiterateOpts?.anchorToIncumbent ?? true
      : true;

    let workingRounds: HarnessRoundRecord[] = [...rounds];
    const startRoundNum = workingRounds.length + 1;
    const totalMaxRounds = isReiterating
      ? workingRounds.length + Math.max(1, reiterateOpts?.extraRounds || 1)
      : workingRounds.length + maxRounds;

    workingDeliverables = workingDeliverables.map((d) =>
      targetSlotFilter === "ALL" || d.id === targetSlotFilter
        ? { ...d, status: "pending" }
        : d
    );
    setDeliverables([...workingDeliverables]);

    setCanvasViewport((prev) => ({ ...prev, x: 20, y: 12 }));

    abortRef.current = false;
    setStatus("running");
    setActiveStageLabel(
      isReiterating
        ? `STEP 01 • THINKING & REFINING PLAN`
        : "STEP 02 • CANDIDATE DRAFTS"
    );
    let workingKeystone = keystoneAnchor;
    const createdAtIso = new Date().toISOString();

    const nextDraftsBySlot: Record<
      string,
      Array<{ label: string; promptStrategy: string; prompt: string }>
    > = {};
    const useIncumbentRefBySlot: Record<string, boolean> = {};
    const modelParamsBySlot: Record<string, ModelGenerationParams> = {};

    const syncLiveRoundToState = (
      roundNum: number,
      slotOutcomes: HarnessSlotRoundOutcome[],
      roundStatus: HarnessRoundRecord["status"],
      summaryText: string
    ) => {
      const liveRound: HarnessRoundRecord = {
        roundNumber: roundNum,
        status: roundStatus,
        modelUsed,
        modelParamsUsed: { temperature: 1.0, topP: 0.95, seed: null },
        keystoneDeliverableId: workingKeystone?.deliverableId || null,
        keystoneImageUrl: workingKeystone?.imageUrl || null,
        roundSummary: summaryText,
        slotOutcomes: [...slotOutcomes],
        createdAt: new Date().toISOString(),
      };
      const existingIdx = workingRounds.findIndex(
        (r) => r.roundNumber === roundNum
      );
      if (existingIdx >= 0) {
        workingRounds = workingRounds.map((r, i) =>
          i === existingIdx ? liveRound : r
        );
      } else {
        workingRounds = [...workingRounds, liveRound];
      }
      setRounds([...workingRounds]);
    };

    try {
      for (
        let roundNum = startRoundNum;
        roundNum <= totalMaxRounds;
        roundNum++
      ) {
        if (abortRef.current) {
          setStatus("stopped");
          setActiveStageLabel("STOPPED");
          setLiveStepNote("Mission stopped by user.");
          break;
        }

        const slotOutcomes: HarnessSlotRoundOutcome[] = [];
        const unsolvedCount = workingDeliverables.filter(
          (d) =>
            (targetSlotFilter === "ALL" || d.id === targetSlotFilter) &&
            d.status !== "solved"
        ).length;

        if (unsolvedCount === 0 && roundNum > startRoundNum) {
          setStatus("completed");
          setActiveStageLabel("CONVERGED");
          setLiveStepNote(
            "All targeted deliverables reached the target score! Mission converged."
          );
          break;
        }

        for (let sIdx = 0; sIdx < workingDeliverables.length; sIdx++) {
          if (abortRef.current) break;
          const slot = workingDeliverables[sIdx];

          if (targetSlotFilter !== "ALL" && slot.id !== targetSlotFilter) {
            continue;
          }

          if (slot.status === "solved" && roundNum > startRoundNum) {
            continue;
          }

          const slotParams: ModelGenerationParams = modelParamsBySlot[
            slot.id
          ] || {
            temperature: 1.0,
            topP: 0.95,
            seed: null,
          };

          let draftEntries: Array<{
            label: string;
            promptStrategy: string;
            prompt: string;
          }> = [];

          if (hasExistingRounds && roundNum === startRoundNum) {
            setActiveStageLabel(`STEP 01 • THINKING & STRATEGY`);
            setLiveStepNote(
              `Round ${roundNum} • Synthesizing refined prompts for "${slot.title}"${
                steeringNote ? ` ("${steeringNote}")` : ""
              }...`
            );

            let priorStrengths: string[] = [];
            let priorComplaints: string[] = [];
            for (let rIdx = workingRounds.length - 1; rIdx >= 0; rIdx--) {
              const prevOutcome = workingRounds[rIdx].slotOutcomes.find(
                (so) => so.deliverableId === slot.id
              );
              if (prevOutcome && prevOutcome.candidates.length > 0) {
                const winCand =
                  prevOutcome.candidates[prevOutcome.slotWinnerIndex] ||
                  prevOutcome.candidates[0];
                priorStrengths = winCand.strengths || [];
                priorComplaints = [
                  ...(winCand.hardFailures || []),
                  ...(winCand.complaints || []),
                ];
                break;
              }
            }

            const reitPlan = await buildReiterationDraftsForDeliverable({
              apiKey,
              goal: goalInput.trim(),
              globalPackInvariants: currentInvariants,
              deliverable: slot,
              nextRoundNumber: roundNum,
              candidatesPerSlot,
              anchorToIncumbent: forceAnchorToIncumbent,
              hasKeystoneAnchorAvailable: Boolean(
                workingKeystone && workingKeystone.deliverableId !== slot.id
              ),
              priorStrengths,
              priorComplaints,
              userRefinementNote: steeringNote,
              aspectRatio,
              customRefinerPrompt: harnessRefinerPrompt,
            });
            draftEntries = reitPlan.drafts;
            useIncumbentRefBySlot[slot.id] = forceAnchorToIncumbent;
          } else if (roundNum === 1 || !nextDraftsBySlot[slot.id]) {
            draftEntries = buildRound1DraftPromptsForDeliverable({
              deliverable: slot,
              globalPackInvariants: currentInvariants,
              referenceSlots,
              hasKeystoneAnchor: Boolean(
                workingKeystone && workingKeystone.deliverableId !== slot.id
              ),
              candidatesPerSlot,
              modifierLabels: [],
              aspectRatio,
            });
          } else {
            draftEntries = nextDraftsBySlot[slot.id];
          }

          setActiveStageLabel("STEP 02 • CANDIDATE DRAFTS");
          setLiveStepNote(
            `Round ${roundNum} • Generating ${draftEntries.length} candidate(s) for "${slot.title}" (${sIdx + 1}/${workingDeliverables.length})...`
          );

          const shouldAnchorIncumbent =
            roundNum > 1 &&
            (useIncumbentRefBySlot[slot.id] ?? forceAnchorToIncumbent) &&
            Boolean(slot.incumbentImageUrl);

          const primaryRef = shouldAnchorIncumbent
            ? slot.incumbentImageUrl
            : referenceSlots[0]?.dataUrl || null;

          const secondaryRef =
            workingDeliverables.length > 1 &&
            workingKeystone &&
            workingKeystone.deliverableId !== slot.id
              ? workingKeystone.imageUrl
              : referenceSlots[1]?.dataUrl || null;

          const streamingCandidates: HarnessCandidateEvaluation[] =
            draftEntries.map((d, cIdx) => ({
              candidateIndex: cIdx,
              deliverableId: slot.id,
              deliverableTitle: slot.title,
              label: d.label,
              promptStrategy: d.promptStrategy,
              prompt: d.prompt,
              imageUrl: buildProceduralIsometricPreviewDataUrl({
                slotTitle: `${slot.title} (Rendering...)`,
                candidateLabel: d.label,
                roundNumber: roundNum,
                slotIndex: sIdx,
                candidateIndex: cIdx,
              }),
              mimeType: "image/png",
              hardFailures: [],
              passedHardGate: true,
              totalScore: 0,
              criterionScores: workingRubric.map((r) => ({
                criterionId: r.id,
                score: 0,
                rationale: "Rendering candidate image...",
              })),
              strengths: [],
              complaints: [],
              isSlotRoundWinner: false,
            }));

          const placeholderOutcome: HarnessSlotRoundOutcome = {
            deliverableId: slot.id,
            deliverableTitle: slot.title,
            wasAlreadySolved: false,
            anchoredFromImageUrl: primaryRef,
            keystoneAnchorImageUrl: secondaryRef,
            candidates: streamingCandidates,
            slotWinnerIndex: 0,
            traceAttribution: {
              failurePattern: "NONE",
              primaryModule: "PROMPT_SPECIFICATION",
              diagnosisSummary: steeringNote
                ? `Applying user refinement directive: "${steeringNote}"...`
                : "Generating candidate images...",
              noPatchTriggered: false,
              pairwiseVerdict: "INITIAL_INCUMBENT",
              pairwiseReasoning: "Awaiting Multimodal Critic evaluation...",
            },
            refinerDecisionForNextRound: null,
          };

          slotOutcomes.push(placeholderOutcome);
          const currentOutcomeIdx = slotOutcomes.length - 1;
          syncLiveRoundToState(
            roundNum,
            slotOutcomes,
            "rendering",
            `Round ${roundNum} in progress • Rendering "${slot.title}"...`
          );

          const [primaryInline, secondaryInline] = await Promise.all([
            primaryRef ? imageUrlToInlinePartForHarness(primaryRef) : null,
            secondaryRef ? imageUrlToInlinePartForHarness(secondaryRef) : null,
          ]);

          const renderedVariants = await renderPreparedBatchWithNanoBanana({
            apiKey,
            model: modelUsed,
            items: draftEntries.map((d) => ({
              label: d.label,
              prompt: d.prompt,
            })),
            referenceImage: primaryInline,
            secondaryReferenceImage: secondaryInline,
            modelParams: slotParams,
            onSlotCompleted: (completedIdx, completedSlot) => {
              if (abortRef.current) return;
              const liveUrl =
                completedSlot.imageUrl ||
                buildProceduralIsometricPreviewDataUrl({
                  slotTitle: slot.title,
                  candidateLabel: completedSlot.label,
                  roundNumber: roundNum,
                  slotIndex: sIdx,
                  candidateIndex: completedIdx,
                });
              streamingCandidates[completedIdx] = {
                ...streamingCandidates[completedIdx],
                imageUrl: liveUrl,
              };
              slotOutcomes[currentOutcomeIdx] = {
                ...slotOutcomes[currentOutcomeIdx],
                candidates: [...streamingCandidates],
              };
              syncLiveRoundToState(
                roundNum,
                slotOutcomes,
                "rendering",
                `Round ${roundNum} • Rendered ${completedSlot.label} for "${slot.title}"`
              );
            },
          });

          if (abortRef.current) break;

          void localDbSaveHarnessMission({
            id: currentMissionId,
            user_id: activeUser.id,
            title: currentTitle,
            goal: goalInput.trim(),
            globalPackInvariants: currentInvariants,
            referenceSlots,
            deliverables: workingDeliverables,
            rubric: workingRubric,
            config: {
              model: modelUsed,
              modelParams: { temperature: 1.0, topP: 0.95, seed: null },
              aspectRatio,
              modifierIds: [],
              maxRounds: Math.max(maxRounds, totalMaxRounds),
              candidatesPerSlot,
              targetScore,
              checkpointMode: executionMode === "COPILOT",
            },
            rounds: workingRounds,
            status: "running",
            bestScore: 0,
            bestImageUrl: renderedVariants[0]?.imageUrl || null,
            created_at: createdAtIso,
            updated_at: new Date().toISOString(),
          });

          setActiveStageLabel("STEP 03 • CRITIC & TRACE REFINING");
          setLiveStepNote(
            `Round ${roundNum} • Multimodal Critic scoring ${renderedVariants.length} candidate(s) for "${slot.title}"...`
          );
          syncLiveRoundToState(
            roundNum,
            slotOutcomes,
            "evaluating",
            `Round ${roundNum} • Multimodal Critic evaluating "${slot.title}"...`
          );

          const evaluatedCandidates = await Promise.all(
            renderedVariants.map(async (variant, cIdx) => {
              const draftMeta = draftEntries[cIdx] || draftEntries[0];
              const effectiveImageUrl =
                variant.imageUrl ||
                buildProceduralIsometricPreviewDataUrl({
                  slotTitle: slot.title,
                  candidateLabel: variant.label,
                  roundNumber: roundNum,
                  slotIndex: sIdx,
                  candidateIndex: cIdx,
                });

              const criticEval = await runHarnessCriticAgent({
                apiKey,
                goal: goalInput.trim(),
                globalPackInvariants: currentInvariants,
                deliverable: slot,
                rubric: workingRubric,
                candidateIndex: cIdx,
                candidateLabel: variant.label,
                promptStrategy:
                  draftMeta?.promptStrategy || "Direct Generation",
                promptUsed: variant.prompt,
                imageUrl: effectiveImageUrl,
                mimeType: variant.mimeType || "image/png",
                roundNumber: roundNum,
                userSteeringHint: steeringNote || undefined,
                customCriticPrompt: harnessCriticPrompt,
              });

              streamingCandidates[cIdx] = criticEval;
              slotOutcomes[currentOutcomeIdx] = {
                ...slotOutcomes[currentOutcomeIdx],
                candidates: [...streamingCandidates],
              };
              syncLiveRoundToState(
                roundNum,
                slotOutcomes,
                "evaluating",
                `Round ${roundNum} • Scored ${variant.label} (${criticEval.totalScore}/100)`
              );

              return criticEval;
            })
          );

          if (abortRef.current) break;

          setActiveStageLabel("STEP 04 • SELECTING ROUND RESULT");
          setLiveStepNote(
            `Round ${roundNum} • TRACE diagnosing root causes & crowning Champion for "${slot.title}"...`
          );

          const traceResult = await runHarnessTraceRefinerAgent({
            apiKey,
            goal: goalInput.trim(),
            globalPackInvariants: currentInvariants,
            deliverable: slot,
            rubric: workingRubric,
            roundNumber: roundNum,
            candidates: evaluatedCandidates,
            currentModelParams: slotParams,
            candidatesPerSlot,
            targetScore,
            hasKeystoneAnchorAvailable: Boolean(workingKeystone),
            modifierLabels: [],
            aspectRatio,
            userSteeringHint: steeringNote || undefined,
            customRefinerPrompt: harnessRefinerPrompt,
          });

          const annotatedCandidates = evaluatedCandidates.map((c, idx) => ({
            ...c,
            isSlotRoundWinner: idx === traceResult.slotWinnerIndex,
          }));

          workingDeliverables = workingDeliverables.map((d) =>
            d.id === slot.id ? traceResult.updatedDeliverable : d
          );
          setDeliverables([...workingDeliverables]);

          if (
            workingDeliverables.length > 1 &&
            traceResult.updatedDeliverable.incumbentImageUrl &&
            (!workingKeystone ||
              traceResult.updatedDeliverable.incumbentScore >
                workingKeystone.score)
          ) {
            workingKeystone = {
              deliverableId: traceResult.updatedDeliverable.id,
              title: traceResult.updatedDeliverable.title,
              imageUrl: traceResult.updatedDeliverable.incumbentImageUrl,
              score: traceResult.updatedDeliverable.incumbentScore,
            };
            setKeystoneAnchor(workingKeystone);
          }

          if (traceResult.refinerDecision) {
            nextDraftsBySlot[slot.id] =
              traceResult.refinerDecision.nextPromptDrafts;
            useIncumbentRefBySlot[slot.id] =
              traceResult.refinerDecision.useWinnerAsReference;
            modelParamsBySlot[slot.id] =
              traceResult.refinerDecision.adjustedModelParams;
          }

          slotOutcomes[currentOutcomeIdx] = {
            deliverableId: slot.id,
            deliverableTitle: slot.title,
            wasAlreadySolved: false,
            anchoredFromImageUrl: primaryRef,
            keystoneAnchorImageUrl: secondaryRef,
            candidates: annotatedCandidates,
            slotWinnerIndex: traceResult.slotWinnerIndex,
            traceAttribution: traceResult.traceAttribution,
            refinerDecisionForNextRound: traceResult.refinerDecision,
          };

          const interimAvgScore = Math.round(
            workingDeliverables.reduce(
              (acc, d) => acc + (d.incumbentScore || 0),
              0
            ) / Math.max(1, workingDeliverables.length)
          );
          const interimSolved = workingDeliverables.filter(
            (d) => d.status === "solved"
          ).length;

          syncLiveRoundToState(
            roundNum,
            slotOutcomes,
            "evaluating",
            `Round ${roundNum} • ${slotOutcomes.length} Slot(s) Evaluated • Avg Score: ${interimAvgScore}/100`
          );

          const topDelivNow = [...workingDeliverables].sort(
            (a, b) => b.incumbentScore - a.incumbentScore
          )[0];
          const savedInterim = await localDbSaveHarnessMission({
            id: currentMissionId,
            user_id: activeUser.id,
            title: currentTitle,
            goal: goalInput.trim(),
            globalPackInvariants: currentInvariants,
            referenceSlots,
            deliverables: workingDeliverables,
            rubric: workingRubric,
            config: {
              model: modelUsed,
              modelParams: { temperature: 1.0, topP: 0.95, seed: null },
              aspectRatio,
              modifierIds: [],
              maxRounds: Math.max(maxRounds, totalMaxRounds),
              candidatesPerSlot,
              targetScore,
              checkpointMode: executionMode === "COPILOT",
            },
            rounds: workingRounds,
            status:
              interimSolved === workingDeliverables.length
                ? "completed"
                : "running",
            bestScore: interimAvgScore,
            bestImageUrl: topDelivNow?.incumbentImageUrl || null,
            created_at: createdAtIso,
            updated_at: new Date().toISOString(),
          });
          workingDeliverables = savedInterim.deliverables;
          workingRounds = savedInterim.rounds;
          setDeliverables(savedInterim.deliverables);
          setRounds(savedInterim.rounds);
        }

        if (abortRef.current) {
          setStatus("stopped");
          setActiveStageLabel("STOPPED");
          setLiveStepNote("Mission stopped by user.");
          break;
        }

        const packAvgScore = Math.round(
          workingDeliverables.reduce(
            (acc, d) => acc + (d.incumbentScore || 0),
            0
          ) / Math.max(1, workingDeliverables.length)
        );

        const solvedNow = workingDeliverables.filter(
          (d) => d.status === "solved"
        ).length;

        syncLiveRoundToState(
          roundNum,
          slotOutcomes,
          "completed",
          `Round ${roundNum} complete${
            steeringNote ? ` (Refined: "${steeringNote}")` : ""
          } • Pack Avg Score: ${packAvgScore}/100 • ${solvedNow}/${
            workingDeliverables.length
          } Solved`
        );

        const allSolved = workingDeliverables.every(
          (d) => d.status === "solved"
        );
        const isFinalRound = roundNum >= totalMaxRounds;
        const nextStatus: HarnessMissionStatus =
          allSolved || isFinalRound ? "completed" : "running";

        const topDeliverable = [...workingDeliverables].sort(
          (a, b) => b.incumbentScore - a.incumbentScore
        )[0];

        const persisted = await localDbSaveHarnessMission({
          id: currentMissionId,
          user_id: activeUser.id,
          title: currentTitle,
          goal: goalInput.trim(),
          globalPackInvariants: currentInvariants,
          referenceSlots,
          deliverables: workingDeliverables,
          rubric: workingRubric,
          config: {
            model: modelUsed,
            modelParams: { temperature: 1.0, topP: 0.95, seed: null },
            aspectRatio,
            modifierIds: [],
            maxRounds: Math.max(maxRounds, totalMaxRounds),
            candidatesPerSlot,
            targetScore,
            checkpointMode: executionMode === "COPILOT",
          },
          rounds: workingRounds,
          status: nextStatus,
          bestScore: packAvgScore,
          bestImageUrl: topDeliverable?.incumbentImageUrl || null,
          created_at: createdAtIso,
          updated_at: new Date().toISOString(),
        });

        workingDeliverables = persisted.deliverables;
        workingRounds = persisted.rounds;
        setDeliverables(persisted.deliverables);
        setRounds(persisted.rounds);

        if (allSolved && (!isReiterating || roundNum >= totalMaxRounds)) {
          setStatus("completed");
          setActiveStageLabel("CONVERGED 🏆");
          setLiveStepNote(
            `Round ${roundNum} complete! Avg Pack Score: ${packAvgScore}/100 (${solvedNow}/${workingDeliverables.length} solved).`
          );
          break;
        }

        if (isFinalRound) {
          setStatus("completed");
          setActiveStageLabel("COMPLETED");
          setLiveStepNote(
            `Completed Round ${roundNum} (${solvedNow}/${workingDeliverables.length} solved • Avg Score: ${packAvgScore}/100).`
          );
          break;
        }
      }
    } catch (err) {
      setStatus("stopped");
      setActiveStageLabel("ERROR");
      setLiveStepNote(
        `Harness loop stopped: ${
          err instanceof Error ? err.message : "Unexpected error"
        }`
      );
    } finally {
      setStatus((prev) =>
        prev === "running" || prev === "planning" ? "completed" : prev
      );
    }
  };

  const handleReiterateLoop = async (overrideNote?: string) => {
    if (isRunning || deliverables.length === 0) return;
    const noteToUse =
      overrideNote !== undefined ? overrideNote : reiterateNote;
    setReiterateNote("");
    await executeHarnessLoop(undefined, {
      isReiteration: true,
      extraRounds: reiterateExtraRounds,
      targetSlotId: reiterateTargetSlotId,
      userRefinementNote: noteToUse,
      anchorToIncumbent: reiterateAnchorToIncumbent,
    });
  };

  const handleSelectCandidateForReiteration = (
    cand: HarnessCandidateEvaluation,
    roundNumber: number
  ) => {
    setDeliverables((prev) =>
      prev.map((d) =>
        d.id === cand.deliverableId
          ? {
              ...d,
              incumbentImageUrl: cand.imageUrl,
              incumbentPrompt: cand.prompt,
              incumbentScore: cand.totalScore,
              incumbentRound: roundNumber,
              incumbentCandidateIndex: cand.candidateIndex,
            }
          : d
      )
    );
    setReiterateTargetSlotId(cand.deliverableId);
    setReiterateAnchorToIncumbent(true);
    setInspectedNodeId(null);
    setLiveStepNote(
      `Selected "${cand.label}" (R${roundNumber}) as base for "${cand.deliverableTitle}". Type your refinement in the side box and click Reiterate.`
    );
    window.setTimeout(() => {
      reiterateInputRef.current?.focus();
    }, 60);
  };

  const handlePrimaryAction = async () => {
    const trimmed = goalInput.trim();
    if (!trimmed || isRunning) return;

    const goalChangedSincePlan =
      Boolean(lastPlannedGoal.trim()) &&
      trimmed.toLowerCase() !== lastPlannedGoal.trim().toLowerCase();

    if (
      deliverables.length === 0 ||
      (goalChangedSincePlan && rounds.length === 0)
    ) {
      const plan = await handleRunPlanner({
        createNewMission: false,
        keepRunningStatus: true,
      });
      if (plan && !abortRef.current) {
        await executeHarnessLoop(plan);
      }
    } else if (rounds.length > 0) {
      await handleReiterateLoop();
    } else {
      await executeHarnessLoop();
    }
  };

  const handleAddDeliverableSlot = () => {
    if (deliverables.length >= 8) return;
    const nextIdx = deliverables.length + 1;
    const nextDeliverable: HarnessDeliverableSpec = {
      id: `deliv_${nextIdx}_${Date.now().toString(36)}`,
      index: nextIdx,
      title: `0${nextIdx} • Custom Asset Slot`,
      description: `${goalInput.trim()}. ${globalPackInvariants}. Isolated subject, clean composition.`,
      status: "pending",
      incumbentScore: 0,
      incumbentRound: null,
      incumbentCandidateIndex: null,
      incumbentImageUrl: null,
      incumbentPrompt: null,
    };
    setDeliverables([...deliverables, nextDeliverable]);
  };

  const handleRemoveDeliverableSlot = (id: string) => {
    if (deliverables.length <= 1) return;
    const nextList = deliverables
      .filter((d) => d.id !== id)
      .map((d, idx) => ({ ...d, index: idx + 1 }));
    setDeliverables(nextList);
  };

  const solvedDeliverablesCount = deliverables.filter(
    (d) => d.status === "solved"
  ).length;
  const overallPackAverage =
    deliverables.length > 0
      ? Math.round(
          deliverables.reduce((acc, d) => acc + (d.incumbentScore || 0), 0) /
            deliverables.length
        )
      : 0;

  const latestComplaints = useMemo(() => {
    const latestR = newestFirstRounds[0];
    if (!latestR) return [];
    return Array.from(
      new Set(
        latestR.slotOutcomes
          .flatMap((so) => so.candidates.flatMap((c) => c.complaints || []))
          .filter(Boolean)
      )
    ).slice(0, 2);
  }, [newestFirstRounds]);

  return (
    <div className="ref-page-container">
      <div className="ref-harness-flow-layout">
        {/* ==================== LEFT: STUDIO-STYLE INTERACTIVE FLOW CANVAS (ALL STEPS: THINKING -> DRAFTS -> REFINING -> RESULT) ==================== */}
        <section
          className="ref-flow-canvas-panel"
          aria-label="Goal Harness Evolution Flow Canvas"
        >
          {/* Floating Single-Row Top Flow Toolbar */}
          <div className="ref-flow-toolbar ref-harness-flow-toolbar">
            <div className="ref-flow-toolbar-left">
              <div className="ref-flow-project-title-group">
                <span
                  className="ref-flow-project-title-text"
                  title={missionTitle}
                >
                  {missionTitle}
                </span>
              </div>
              <span className="ref-flow-toolbar-divider" aria-hidden="true" />
              <span className="ref-flow-toolbar-badge is-solved-pill">
                {rounds.length}R • {flowNodes.length} Steps
                {deliverables.length > 0
                  ? ` • 🏆 ${overallPackAverage}/100`
                  : ""}
              </span>
            </div>

            <div className="ref-flow-toolbar-right">
              {deliverables.length > 1 && (
                <select
                  className="ref-harness-select ref-harness-toolbar-select"
                  value={selectedSlotFilter}
                  onChange={(e) => setSelectedSlotFilter(e.target.value)}
                  aria-label="Filter Flow Canvas by deliverable"
                >
                  <option value="ALL">
                    All Slots ({deliverables.length})
                  </option>
                  {deliverables.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.title} ({d.incumbentScore}/100)
                    </option>
                  ))}
                </select>
              )}

              <button
                type="button"
                id="harness-new-mission-btn"
                className="ref-mura-btn-outline"
                onClick={handleResetNewMission}
                disabled={isRunning}
                title="Start a new Goal Harness mission"
              >
                <IconPlus size={11} strokeWidth={2.3} />
                <span>New</span>
              </button>

              <button
                type="button"
                className="ref-studio-ghost-action"
                onClick={handleAutoOrganizeFlow}
                title="Auto-organize nodes left-to-right across rounds"
              >
                <IconAutoGrid size={13} />
                <span>Organize</span>
              </button>

              <button
                type="button"
                className="ref-studio-ghost-action"
                onClick={handleFitFlowView}
                title="Fit all iterations in viewport"
              >
                <IconExpand size={13} />
                <span>Fit</span>
              </button>

              <div className="ref-flow-zoom-pill">
                <button
                  type="button"
                  className="ref-flow-zoom-btn"
                  onClick={() =>
                    handleApplyZoomPreset(
                      String(
                        Math.max(15, Math.round(canvasViewport.zoom * 100) - 10)
                      )
                    )
                  }
                  aria-label="Zoom out"
                >
                  <IconMinus size={12} strokeWidth={2.1} />
                </button>
                <select
                  id="harness-zoom-preset-select"
                  className="ref-flow-zoom-readout ref-harness-zoom-select"
                  value={String(Math.round(canvasViewport.zoom * 100))}
                  onChange={(e) => handleApplyZoomPreset(e.target.value)}
                  aria-label="Select zoom preset"
                  title="Select a zoom preset"
                >
                  {!HARNESS_ZOOM_PRESETS.includes(
                    Math.round(
                      canvasViewport.zoom * 100
                    ) as (typeof HARNESS_ZOOM_PRESETS)[number]
                  ) && (
                    <option
                      value={String(Math.round(canvasViewport.zoom * 100))}
                    >
                      {Math.round(canvasViewport.zoom * 100)}%
                    </option>
                  )}
                  {HARNESS_ZOOM_PRESETS.map((pct) => (
                    <option key={pct} value={String(pct)}>
                      {pct}%
                    </option>
                  ))}
                  <option value="FIT">Fit All</option>
                </select>
                <button
                  type="button"
                  className="ref-flow-zoom-btn"
                  onClick={() =>
                    handleApplyZoomPreset(
                      String(
                        Math.min(150, Math.round(canvasViewport.zoom * 100) + 10)
                      )
                    )
                  }
                  aria-label="Zoom in"
                >
                  <IconPlus size={12} strokeWidth={2.1} />
                </button>
              </div>
            </div>
          </div>

          {/* Live Floating Toast / Status Strip inside Flow Canvas */}
          {(isRunning || liveStepNote) && (
            <div className="ref-flow-floating-toast" role="status">
              <span className="ref-atelier-toast-pill">
                {isRunning
                  ? `● ${activeStageLabel || "RUNNING"} (${elapsedSeconds}s) — ${liveStepNote}`
                  : liveStepNote}
              </span>
            </div>
          )}

          {/* Infinite Pan & Zoom Dotted Viewport */}
          <div
            ref={canvasViewportRef}
            className={`ref-flow-canvas-viewport ${
              isDraggingCanvas ? "is-grabbing" : ""
            }`}
            onMouseDown={(e) => {
              const target = e.target as HTMLElement;
              if (
                target.closest(".ref-flow-step-card") ||
                target.closest(".ref-flow-toolbar")
              ) {
                return;
              }
              setIsCameraGliding(false);
              dragStateRef.current = {
                mode: "pan",
                startClientX: e.clientX,
                startClientY: e.clientY,
                originX: canvasViewport.x,
                originY: canvasViewport.y,
              };
              setIsDraggingCanvas(true);
            }}
            onWheel={(e) => {
              setIsCameraGliding(false);
              if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                const delta = e.deltaY < 0 ? 0.08 : -0.08;
                setCanvasViewport((prev) => ({
                  ...prev,
                  zoom: Math.min(
                    1.4,
                    Math.max(0.25, Number((prev.zoom + delta).toFixed(2)))
                  ),
                }));
              } else {
                setCanvasViewport((prev) => ({
                  ...prev,
                  x: prev.x - e.deltaX,
                  y: prev.y - e.deltaY,
                }));
              }
            }}
          >
            <div
              className={`ref-flow-canvas-transform-layer ${
                isCameraGliding && !isDraggingCanvas ? "is-camera-gliding" : ""
              }`}
              style={{
                transform: `translate3d(${canvasViewport.x}px, ${canvasViewport.y}px, 0) scale(${canvasViewport.zoom})`,
              }}
            >
              {/* 1. SVG ORTHOGONAL WIRES LAYER (Left-to-Right Pipeline Wires + Inter-Round Trajectory Wires) */}
              <svg
                className="ref-flow-edges-svg"
                width="4800"
                height="3600"
                aria-hidden="true"
              >
                <defs>
                  <marker
                    id="harness-arrow-pipeline"
                    markerWidth="7"
                    markerHeight="7"
                    refX="6"
                    refY="3.5"
                    markerUnits="userSpaceOnUse"
                    orient="auto"
                  >
                    <path
                      d="M0,1 L6.5,3.5 L0,6 Z"
                      fill="var(--ref-moss-outer)"
                    />
                  </marker>
                  <marker
                    id="harness-arrow-highlight"
                    markerWidth="7"
                    markerHeight="7"
                    refX="6"
                    refY="3.5"
                    markerUnits="userSpaceOnUse"
                    orient="auto"
                  >
                    <path
                      d="M0,1 L6.5,3.5 L0,6 Z"
                      fill="var(--ref-lime-accent)"
                    />
                  </marker>
                </defs>

                {flowEdges.map((edge) => {
                  const isInterRound = edge.edgeKind === "inter-round";
                  return (
                    <g key={edge.key}>
                      <path
                        d={edge.path}
                        fill="none"
                        stroke="var(--ref-canvas)"
                        strokeWidth={edge.isHighlighted ? "4.5" : "3.8"}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        data-flow-wire="main"
                        d={edge.path}
                        fill="none"
                        stroke={
                          edge.isHighlighted
                            ? "var(--ref-lime-accent)"
                            : "var(--ref-moss-outer)"
                        }
                        strokeWidth={edge.isHighlighted ? "2.2" : "1.75"}
                        strokeDasharray={isInterRound ? "6 4" : undefined}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        markerEnd={
                          edge.isHighlighted
                            ? "url(#harness-arrow-highlight)"
                            : "url(#harness-arrow-pipeline)"
                        }
                      />
                      {(isRunning ||
                        selectedNodeId === edge.sourceNodeId ||
                        selectedNodeId === edge.targetNodeId) && (
                        <path
                          d={edge.path}
                          fill="none"
                          className="ref-flow-wire-signal"
                        />
                      )}
                      <circle
                        cx={edge.startX}
                        cy={edge.startY}
                        r="3.2"
                        fill="var(--ref-lime-accent)"
                        stroke="var(--ref-moss-outer)"
                        strokeWidth="1.4"
                      />
                    </g>
                  );
                })}
              </svg>

              {/* 2. ITERATION COLUMN HEADERS ON CANVAS (LEFT-TO-RIGHT BY ROUND) */}
              {rowHeaders.map((hdr) => (
                <div
                  key={hdr.key}
                  className={`ref-harness-canvas-row-tag ${
                    hdr.isLatest ? "is-latest" : ""
                  }`}
                  style={{
                    left: `${hdr.colX}px`,
                    top: `${hdr.rowY - 56}px`,
                  }}
                >
                  <span>
                    ROUND 0{hdr.roundNumber}
                    {hdr.isLatest ? " • LATEST" : ""} • {hdr.deliverableTitle}
                  </span>
                </div>
              ))}

              {/* 3. ALL 4 PIPELINE STEP NODES (LEFT-TO-RIGHT): THINKING -> DRAFTS [STACK] -> REFINING -> RESULT */}
              {flowNodes.map((node) => {
                const pos = getEffectivePos(node);
                const isSelected = selectedNodeId === node.nodeId;
                const isResult = node.stepKind === "result";
                const isThinking = node.stepKind === "thinking";
                const isRefining = node.stepKind === "refining";
                const isDraft = node.stepKind === "draft";
                const cand = node.candidate || node.winnerCandidate;

                return (
                  <article
                    key={node.nodeId}
                    data-step-kind={node.stepKind}
                    className={`ref-flow-step-card is-locked ${
                      isResult ? "is-result-card" : ""
                    } ${isSelected || isResult ? "selected" : ""} ${
                      isCameraGliding && !isDraggingCanvas
                        ? "is-camera-gliding"
                        : ""
                    }`}
                    style={{
                      left: `${pos.x}px`,
                      top: `${pos.y}px`,
                    }}
                    onClick={() => setSelectedNodeId(node.nodeId)}
                  >
                    {(!isThinking || node.roundNumber > 1) && (
                      <span
                        className="ref-flow-port input-port"
                        title="Connected from previous pipeline step"
                      />
                    )}

                    {/* '+' Output Port on Draft & Result nodes: branch/refine next round from this node */}
                    {(isResult || isDraft) && (
                      <button
                        type="button"
                        className="ref-flow-port output-port-btn"
                        disabled={isRunning}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectCandidateForReiteration(
                            cand,
                            node.roundNumber
                          );
                        }}
                        title={`Refine next iteration from R${node.roundNumber} • ${cand.label}`}
                        aria-label={`Refine from R${node.roundNumber}`}
                      >
                        <IconPlus size={12} strokeWidth={2.3} />
                      </button>
                    )}

                    {/* Draggable Card Header */}
                    <div
                      className="ref-flow-node-header"
                      onMouseDown={(e) => {
                        if ((e.target as HTMLElement).closest("button")) {
                          return;
                        }
                        e.stopPropagation();
                        setSelectedNodeId(node.nodeId);
                        dragStateRef.current = {
                          mode: "node",
                          nodeId: node.nodeId,
                          startClientX: e.clientX,
                          startClientY: e.clientY,
                          originX: pos.x,
                          originY: pos.y,
                        };
                        setIsDraggingCanvas(true);
                      }}
                    >
                      <div className="ref-flow-node-title-group">
                        <span
                          className="ref-flow-drag-grip"
                          title="Drag to reposition step"
                        >
                          <IconGripDots size={12} />
                        </span>
                        <span
                          className={`ref-flow-step-badge locked is-${node.stepKind}`}
                        >
                          {isThinking
                            ? `R${node.roundNumber} • 01 THINKING`
                            : isDraft
                            ? `R${node.roundNumber} • 02 DRAFT #${
                                node.candidateIndex + 1
                              }`
                            : isRefining
                            ? `R${node.roundNumber} • 03 REFINING`
                            : `R${node.roundNumber} • 04 RESULT 🏆`}
                        </span>

                        {(isDraft || isResult) && (
                          <span
                            className={`ref-flow-step-ratio ${
                              isResult || cand.isSlotRoundWinner
                                ? "is-winner"
                                : "is-candidate"
                            }`}
                          >
                            {isResult || cand.isSlotRoundWinner ? "🏆 " : ""}
                            {cand.totalScore}/100
                          </span>
                        )}
                      </div>
                    </div>

                    {/* ==================== BODY BY STEP KIND ==================== */}
                    {isThinking && (
                      <div className="ref-harness-node-stage-box is-thinking">
                        <div className="ref-harness-stage-top">
                          <div className="ref-harness-stage-heading-row">
                            <span className="ref-harness-stage-heading">
                              ✦{" "}
                              {node.roundNumber === 1
                                ? "Initial Goal Decomposition"
                                : "Iterative Refinement Strategy"}
                            </span>
                          </div>
                          <p className="ref-harness-stage-summary">
                            {node.roundNumber > 1 &&
                            node.roundSummary.includes("Refined:")
                              ? node.roundSummary
                              : `Goal: "${goalInput}" — Slot: ${node.deliverableTitle}`}
                          </p>
                        </div>

                        <div className="ref-harness-stage-bottom">
                          <span className="ref-harness-stage-sublabel">
                            Synthesized Draft Strategies (
                            {node.outcome.candidates.length}):
                          </span>
                          {node.outcome.candidates.map((c, idx) => (
                            <div
                              key={idx}
                              className="ref-harness-strategy-pill"
                            >
                              • <strong>#{idx + 1}:</strong>{" "}
                              {c.promptStrategy || c.label}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {isRefining && (
                      <div className="ref-harness-node-stage-box is-refining">
                        <div className="ref-harness-stage-top">
                          <div className="ref-harness-stage-heading-row">
                            <span className="ref-harness-stage-heading">
                              ✦ TRACE:{" "}
                              {node.outcome.traceAttribution.failurePattern}
                            </span>
                            <span className="ref-harness-stage-module-tag">
                              {node.outcome.traceAttribution.primaryModule.split(
                                "_"
                              )[0]}
                            </span>
                          </div>
                          <p className="ref-harness-stage-summary">
                            {node.outcome.traceAttribution.pairwiseReasoning ||
                              node.outcome.traceAttribution.diagnosisSummary}
                          </p>
                        </div>

                        {/* Top 3 Rubric Mini-Bars */}
                        <div className="ref-harness-stage-bottom">
                          {node.winnerCandidate.criterionScores
                            .slice(0, 3)
                            .map((cs) => {
                              const critMeta = rubric.find(
                                (r) => r.id === cs.criterionId
                              );
                              const maxW = critMeta?.weight || 25;
                              const pct = Math.round((cs.score / maxW) * 100);
                              return (
                                <div
                                  key={cs.criterionId}
                                  className="ref-harness-mini-rubric-row"
                                >
                                  <div className="ref-harness-mini-rubric-head">
                                    <span className="ref-harness-mini-rubric-label">
                                      {critMeta?.label || cs.criterionId}
                                    </span>
                                    <strong>
                                      {cs.score}/{maxW}
                                    </strong>
                                  </div>
                                  <div className="ref-harness-mini-rubric-track">
                                    <div
                                      className="ref-harness-mini-rubric-fill"
                                      style={{
                                        width: `${Math.min(
                                          100,
                                          Math.max(0, pct)
                                        )}%`,
                                      }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    )}

                    {(isDraft || isResult) && (
                      <div
                        className="ref-flow-hero-frame"
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          setLightboxCard(node);
                        }}
                      >
                        <img
                          src={cand.imageUrl}
                          alt={`${node.deliverableTitle} - ${cand.label}`}
                          className="ref-flow-hero-img"
                        />
                        <span
                          className={`ref-flow-slot-num-badge ${
                            isResult ? "is-champion" : ""
                          }`}
                        >
                          {isResult
                            ? "Winner"
                            : cand.label.split(" • ")[0]}
                        </span>
                        <div className="ref-flow-hero-hover-actions">
                          <button
                            type="button"
                            className="ref-quad-overlay-icon-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              setLightboxCard(node);
                            }}
                            title="Expand image in full screen"
                            aria-label="Expand image in full screen"
                          >
                            <IconExpand size={14} strokeWidth={1.9} />
                          </button>
                          <button
                            type="button"
                            className="ref-quad-overlay-icon-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              const a = document.createElement("a");
                              a.href = cand.imageUrl;
                              a.download = `harness-r${node.roundNumber}-${
                                isResult
                                  ? "result"
                                  : `draft-${node.candidateIndex + 1}`
                              }.png`;
                              a.click();
                            }}
                            title="Download PNG"
                            aria-label="Download PNG"
                          >
                            <IconDownload size={14} strokeWidth={1.9} />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* 1-Line Footer (Click to open Floating Rubric, Thinking & TRACE Inspector Modal) */}
                    <button
                      type="button"
                      className="ref-flow-node-footer-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedNodeId(node.nodeId);
                        setInspectedNodeId(node.nodeId);
                      }}
                      title="Click to inspect full Thinking, Critic scores, TRACE diagnosis & exact prompt"
                    >
                      <span className="ref-flow-node-prompt-single">
                        {isThinking
                          ? `Plan: ${globalPackInvariants || goalInput}`
                          : isRefining
                          ? node.outcome.refinerDecisionForNextRound
                              ?.refinementSummary ||
                            node.outcome.traceAttribution.diagnosisSummary
                          : cand.prompt}
                      </span>
                      <span className="ref-flow-footer-inspect-tag">
                        Inspect ↗
                      </span>
                    </button>
                  </article>
                );
              })}

              {/* 4. EMPTY FLOW STARTER WHEN NO ROUNDS EXIST YET */}
              {!isRunning && flowNodes.length === 0 && (
                <div className="ref-flow-starter-plus-wrapper ref-harness-empty-starter">
                  <button
                    type="button"
                    id="harness-flow-starter-btn"
                    className="ref-flow-starter-plus-btn"
                    onClick={() => {
                      if (goalInput.trim()) {
                        void handlePrimaryAction();
                      } else {
                        setIsParamsModalOpen(true);
                      }
                    }}
                    title="Launch Goal Harness Flow"
                    aria-label="Launch Goal Harness Flow"
                  >
                    <IconPlus size={24} strokeWidth={2.4} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ==================== RIGHT SIDE PANEL: TEXT BOX + REITERATION + NEWEST-FIRST ITERATIONS LIST ==================== */}
        <aside
          className="ref-harness-side-dock"
          aria-label="Goal and Reiteration Side Panel"
        >
          {/* 1. SIDE HEADER + FLOATING PARAMETERS MODAL BUTTON */}
          <div className="ref-harness-side-header">
            <div>
              <strong className="ref-harness-side-title">
                Goal &amp; Iteration Prompt
              </strong>
              <span className="ref-harness-side-meta">
                {modelUsed === "gemini-3-pro-image-preview"
                  ? "Gemini 3 Pro"
                  : "Gemini 2.5 Flash"}{" "}
                • {aspectRatio} • Target {targetScore}/100
              </span>
            </div>

            <button
              type="button"
              id="harness-open-params-modal-btn"
              className="ref-mura-btn-outline"
              onClick={() => setIsParamsModalOpen(true)}
              title="Open Floating Parameters, Deliverables & Rubric Modal"
            >
              <span>⚙ Parameters</span>
            </button>
          </div>

          {/* 2. GOAL TEXT BOX */}
          <div className="ref-harness-goal-box">
            <div className="ref-harness-goal-label-row">
              <label
                htmlFor="harness-goal-textarea"
                className="ref-field-label ref-no-margin"
              >
                Mission Visual Goal
              </label>
            </div>

            {rounds.length === 0 && (
              <div className="ref-harness-presets-wrap">
                {QUICK_GOAL_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    className="ref-pill-chip"
                    onClick={() => {
                      setGoalInput(preset.goal);
                      setAspectRatio(preset.aspectRatio);
                      setCandidatesPerSlot(preset.candidatesPerSlot);
                    }}
                  >
                    ✦ {preset.label}
                  </button>
                ))}
              </div>
            )}

            <textarea
              id="harness-goal-textarea"
              className="ref-params-textarea"
              rows={rounds.length > 0 ? 2 : 3}
              value={goalInput}
              onChange={(e) => setGoalInput(e.target.value)}
              placeholder='E.g.: "Crie os assets do meu jogo de space, em formato isometrico"...'
            />
          </div>

          {/* 3. REITERATION / REFINEMENT TEXT BOX (FOR CONTINUING ITERATIONS) */}
          {rounds.length > 0 && (
            <div
              id="harness-reiteration-console"
              className="ref-harness-reiterate-console"
            >
              <div className="ref-harness-reiterate-top">
                <span className="ref-harness-next-round-tag">
                  NEXT: ROUND 0{rounds.length + 1}
                </span>
                <button
                  type="button"
                  id="harness-reiterate-anchor-btn"
                  className={`ref-pill-chip ${
                    reiterateAnchorToIncumbent ? "active" : ""
                  }`}
                  onClick={() =>
                    setReiterateAnchorToIncumbent((prev) => !prev)
                  }
                >
                  {reiterateAnchorToIncumbent
                    ? "✓ Anchor Winner: ON"
                    : "○ Anchor Winner: OFF"}
                </button>
              </div>

              <label
                htmlFor="harness-reiterate-input"
                className="ref-field-label ref-no-margin"
              >
                Refinement Instructions for Round 0{rounds.length + 1}
              </label>

              <textarea
                ref={reiterateInputRef}
                id="harness-reiterate-input"
                className="ref-params-textarea"
                rows={3}
                disabled={isRunning}
                value={reiterateNote}
                onChange={(e) => setReiterateNote(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !isRunning) {
                    e.preventDefault();
                    void handleReiterateLoop();
                  }
                }}
                placeholder={`Describe what to refine, add, or adjust in Round ${
                  rounds.length + 1
                } (or leave blank for automatic TRACE refinement)...`}
              />

              {/* Quick suggestion chips */}
              <div className="ref-harness-quick-chips">
                {latestComplaints.length > 0
                  ? latestComplaints.map((comp, idx) => (
                      <button
                        key={`comp_${idx}`}
                        type="button"
                        className="ref-pill-chip"
                        onClick={() => setReiterateNote(comp)}
                        title={comp}
                      >
                        ✦ Fix: {comp.length > 34 ? `${comp.slice(0, 34)}...` : comp}
                      </button>
                    ))
                  : [
                      "Warmer golden sunset light",
                      "Sharpen textures & shadows",
                    ].map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        className="ref-pill-chip"
                        onClick={() =>
                          setReiterateNote((prev) =>
                            prev.trim() ? `${prev.trim()}; ${chip}` : chip
                          )
                        }
                      >
                        + {chip}
                      </button>
                    ))}
              </div>

              <div className="ref-harness-reiterate-controls-row">
                {deliverables.length > 1 && (
                  <select
                    id="harness-reiterate-slot-select"
                    className="ref-harness-select ref-harness-reiterate-slot-select"
                    disabled={isRunning}
                    value={reiterateTargetSlotId}
                    onChange={(e) => setReiterateTargetSlotId(e.target.value)}
                  >
                    <option value="ALL">
                      All Slots ({deliverables.length})
                    </option>
                    {deliverables.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.title}
                      </option>
                    ))}
                  </select>
                )}

                <select
                  id="harness-reiterate-rounds-select"
                  className="ref-harness-select ref-harness-reiterate-rounds-select"
                  disabled={isRunning}
                  value={reiterateExtraRounds}
                  onChange={(e) =>
                    setReiterateExtraRounds(Number(e.target.value))
                  }
                >
                  <option value={1}>+1 Round</option>
                  <option value={2}>+2 Rounds</option>
                  <option value={3}>+3 Rounds</option>
                </select>
              </div>
            </div>
          )}

          {/* 4. PRIMARY LAUNCH / REITERATE BUTTONS */}
          <div className="ref-harness-primary-cta-row">
            <button
              type="button"
              id="harness-primary-launch-btn"
              className="ref-dark-pill-btn ref-harness-primary-cta-btn"
              disabled={isRunning || !goalInput.trim()}
              onClick={() => void handlePrimaryAction()}
            >
              <IconAtelierStar size={14} />
              <span>
                {isRunning
                  ? `Running (${elapsedSeconds}s)...`
                  : rounds.length > 0
                  ? `Reiterate & Refine (+${reiterateExtraRounds} ${
                      reiterateExtraRounds === 1 ? "Round" : "Rounds"
                    })`
                  : deliverables.length > 0
                  ? `Launch Evolution (${deliverables.length} ${
                      deliverables.length === 1 ? "Slot" : "Slots"
                    })`
                  : "Plan & Launch Flow"}
              </span>
            </button>

            {isRunning && (
              <button
                type="button"
                id="harness-abort-btn"
                className="ref-harness-abort-btn"
                onClick={() => {
                  abortRef.current = true;
                  setStatus("stopped");
                  setActiveStageLabel("STOPPING");
                  setLiveStepNote("Stopping after current API call...");
                }}
              >
                Stop
              </button>
            )}
          </div>

          {/* 5. ITERATIONS TIMELINE IN SIDE PANEL (LATEST ITERATION ON TOP, OLDER KEPT BELOW) */}
          <div className="ref-harness-iterations-section">
            <div className="ref-harness-iterations-header">
              <span className="ref-field-label ref-no-margin">
                Iterations (Latest on Top • {rounds.length})
              </span>
              {deliverables.length > 0 && (
                <span className="ref-harness-best-score-readout">
                  Best: {overallPackAverage}/100
                </span>
              )}
            </div>

            {newestFirstRounds.length === 0 ? (
              <div className="ref-harness-iterations-empty">
                Enter a visual goal above and click{" "}
                <strong>Plan &amp; Launch Flow</strong> to start Round 01.
              </div>
            ) : (
              <div
                id="harness-iterations-feed"
                className="ref-harness-iterations-feed"
              >
                {newestFirstRounds.map((round, idx) => {
                  const isLatest = idx === 0;
                  const roundBestScore = Math.max(
                    0,
                    ...round.slotOutcomes.flatMap((so) =>
                      so.candidates.map((c) => c.totalScore || 0)
                    )
                  );
                  return (
                    <div
                      key={`side-round-${round.roundNumber}`}
                      onClick={() => handleFocusRoundOnCanvas(round.roundNumber)}
                      className={`ref-harness-iteration-card ${
                        isLatest ? "is-latest" : ""
                      }`}
                      title={`Click to focus Round 0${round.roundNumber} on Flow Canvas`}
                    >
                      <div className="ref-harness-iteration-card-top">
                        <span className="ref-harness-iteration-round-badge">
                          ROUND 0{round.roundNumber}
                          {isLatest ? " • LATEST" : ""}
                        </span>
                        <span className="ref-harness-iteration-steps-flow">
                          {roundBestScore > 0
                            ? `🏆 ${roundBestScore}/100`
                            : round.status}
                        </span>
                      </div>

                      <p className="ref-harness-iteration-summary">
                        {round.roundSummary}
                      </p>

                      <div className="ref-harness-iteration-thumbs">
                        {round.slotOutcomes.flatMap((so) =>
                          so.candidates.map((cand) => (
                            <button
                              key={`thumb_${round.roundNumber}_${so.deliverableId}_${cand.candidateIndex}`}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const nId = `r${round.roundNumber}::${so.deliverableId}::draft-${cand.candidateIndex}`;
                                setSelectedNodeId(nId);
                                setInspectedNodeId(nId);
                              }}
                              className={`ref-harness-iteration-thumb-btn ${
                                cand.isSlotRoundWinner ? "is-winner" : ""
                              }`}
                              title={`${cand.label} (${cand.totalScore}/100) — Click to inspect`}
                            >
                              <img
                                src={cand.imageUrl}
                                alt={cand.label}
                                className="ref-harness-iteration-thumb-img"
                              />
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* ==================== FLOATING MODAL 1: PARAMETERS, DELIVERABLES & RUBRIC ==================== */}
      {isParamsModalOpen && (
        <div
          className="ref-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="harness-params-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsParamsModalOpen(false);
          }}
        >
          <div className="ref-modal-card ref-harness-modal-card">
            <div className="ref-modal-header">
              <div>
                <strong
                  id="harness-params-modal-title"
                  className="ref-soft-card-title"
                >
                  ⚙ Goal Harness Parameters, Deliverables &amp; Rubric
                </strong>
                <span className="ref-harness-modal-sub">
                  Configure model &amp; loop parameters, reference anchors, and
                  planned deliverable specifications.
                </span>
              </div>
              <button
                type="button"
                aria-label="Close parameters modal"
                className="ref-circle-icon-btn sm"
                onClick={() => setIsParamsModalOpen(false)}
              >
                <IconClose size={12} />
              </button>
            </div>

            {/* Modal Section Tabs */}
            <div className="ref-harness-modal-tabs">
              <button
                type="button"
                className={`ref-pill-chip ${
                  paramsModalTab === "params" ? "active" : ""
                }`}
                onClick={() => setParamsModalTab("params")}
              >
                1. Model &amp; Loop Parameters
              </button>
              <button
                type="button"
                className={`ref-pill-chip ${
                  paramsModalTab === "plan" ? "active" : ""
                }`}
                onClick={() => setParamsModalTab("plan")}
              >
                2. Deliverables ({deliverables.length}) &amp; Rubric (
                {rubric.length})
              </button>
              <button
                type="button"
                className="ref-studio-ghost-action"
                onClick={() => {
                  setIsParamsModalOpen(false);
                  openSettingsModal();
                }}
              >
                <span>Agent System Prompts ↗</span>
              </button>
            </div>

            {paramsModalTab === "params" ? (
              <div className="ref-harness-modal-body">
                <div className="ref-harness-controls-grid">
                  <div>
                    <label
                      htmlFor="harness-model-select"
                      className="ref-field-label"
                    >
                      Generator Model
                    </label>
                    <select
                      id="harness-model-select"
                      className="ref-harness-select full"
                      value={modelUsed}
                      onChange={(e) =>
                        setModelUsed(e.target.value as NanoBananaModel)
                      }
                    >
                      {HARNESS_MODELS.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.label} ({m.badge})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="harness-aspect-select"
                      className="ref-field-label"
                    >
                      Aspect Ratio
                    </label>
                    <select
                      id="harness-aspect-select"
                      className="ref-harness-select full"
                      value={aspectRatio}
                      onChange={(e) => setAspectRatio(e.target.value)}
                    >
                      {ASPECT_RATIO_OPTIONS.map((ar) => (
                        <option key={ar} value={ar}>
                          {ar}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="harness-rounds-select"
                      className="ref-field-label"
                    >
                      Max Rounds per Run
                    </label>
                    <select
                      id="harness-rounds-select"
                      className="ref-harness-select full"
                      value={maxRounds}
                      onChange={(e) => setMaxRounds(Number(e.target.value))}
                    >
                      {[1, 2, 3, 4, 5].map((r) => (
                        <option key={r} value={r}>
                          {r} {r === 1 ? "Round" : "Rounds"}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="harness-target-select"
                      className="ref-field-label"
                    >
                      Target Score Gate
                    </label>
                    <select
                      id="harness-target-select"
                      className="ref-harness-select full"
                      value={targetScore}
                      onChange={(e) => setTargetScore(Number(e.target.value))}
                    >
                      {[75, 80, 85, 90, 95].map((s) => (
                        <option key={s} value={s}>
                          {s} / 100
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="harness-candidates-select"
                      className="ref-field-label"
                    >
                      Drafts / Slot / Round
                    </label>
                    <select
                      id="harness-candidates-select"
                      className="ref-harness-select full"
                      value={candidatesPerSlot}
                      onChange={(e) =>
                        setCandidatesPerSlot(Number(e.target.value))
                      }
                    >
                      {[1, 2, 3, 4].map((c) => (
                        <option key={c} value={c}>
                          {c} {c === 1 ? "Candidate" : "Candidates"}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="harness-mode-select"
                      className="ref-field-label"
                    >
                      Orchestration Mode
                    </label>
                    <select
                      id="harness-mode-select"
                      className="ref-harness-select full"
                      value={executionMode}
                      onChange={(e) =>
                        setExecutionMode(
                          e.target.value as "COPILOT" | "AUTONOMOUS"
                        )
                      }
                    >
                      <option value="COPILOT">
                        Co-Pilot (Review Plan First)
                      </option>
                      <option value="AUTONOMOUS">
                        Autonomous (1-Click Full Loop)
                      </option>
                    </select>
                  </div>
                </div>

                {/* Role-Allocated Reference Anchors */}
                <div className="ref-harness-refs-bar">
                  <div className="ref-harness-refs-header">
                    <span className="ref-field-label ref-no-margin">
                      Role-Allocated Reference Anchors ({referenceSlots.length}
                      /2)
                    </span>
                    <input
                      ref={refFileInputRef}
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={handleAddReferenceImage}
                    />
                    {referenceSlots.length < 2 && (
                      <button
                        type="button"
                        className="ref-studio-ghost-action"
                        onClick={() => refFileInputRef.current?.click()}
                      >
                        <IconPlus size={12} />
                        <span>Add Reference Anchor</span>
                      </button>
                    )}
                  </div>

                  {referenceSlots.length > 0 && (
                    <div className="ref-harness-refs-list">
                      {referenceSlots.map((ref, idx) => (
                        <div key={ref.id} className="ref-harness-ref-slot-item">
                          <img
                            src={ref.dataUrl}
                            alt={`Reference Slot ${idx + 1}`}
                            className="ref-harness-ref-thumb"
                          />
                          <div className="ref-harness-ref-meta">
                            <span className="ref-harness-ref-slot-tag">
                              Slot #{idx + 1} Role
                            </span>
                            <input
                              type="text"
                              className="ref-input ref-harness-ref-role-input"
                              value={ref.role}
                              onChange={(e) => {
                                const val = e.target.value;
                                setReferenceSlots((prev) =>
                                  prev.map((r) =>
                                    r.id === ref.id ? { ...r, role: val } : r
                                  )
                                );
                              }}
                            />
                          </div>
                          <button
                            type="button"
                            className="ref-circle-icon-btn sm"
                            onClick={() => handleRemoveReference(ref.id)}
                          >
                            <IconClose size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="ref-harness-modal-body">
                <div className="ref-harness-modal-toolbar">
                  <button
                    type="button"
                    id="harness-replan-btn"
                    className="ref-mura-btn-outline"
                    disabled={isRunning || !goalInput.trim()}
                    onClick={() => void handleRunPlanner()}
                  >
                    <IconRefresh size={12} />
                    <span>Decompose Goal with Planner Agent</span>
                  </button>

                  {deliverables.length < 8 && (
                    <button
                      type="button"
                      className="ref-mura-btn-outline"
                      disabled={isRunning}
                      onClick={handleAddDeliverableSlot}
                    >
                      <IconPlus size={12} />
                      <span>Add Deliverable Slot</span>
                    </button>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="harness-pack-invariants-input"
                    className="ref-field-label"
                  >
                    Global Pack Invariants (Camera, Projection, Lighting &amp;
                    Palette Cohesion)
                  </label>
                  <input
                    id="harness-pack-invariants-input"
                    type="text"
                    className="ref-input"
                    value={globalPackInvariants}
                    onChange={(e) => setGlobalPackInvariants(e.target.value)}
                  />
                </div>

                <div className="ref-harness-deliverables-ledger">
                  {deliverables.map((slot, idx) => (
                    <div
                      key={slot.id}
                      className={`ref-harness-slot-row status-${slot.status}`}
                    >
                      <div className="ref-harness-slot-index">
                        <span>0{idx + 1}</span>
                      </div>

                      <div className="ref-harness-slot-fields">
                        <div className="ref-harness-slot-top-bar">
                          <input
                            type="text"
                            className="ref-input ref-harness-slot-title-input"
                            value={slot.title}
                            onChange={(e) => {
                              const val = e.target.value;
                              setDeliverables((prev) =>
                                prev.map((d) =>
                                  d.id === slot.id ? { ...d, title: val } : d
                                )
                              );
                            }}
                          />
                          <span
                            className={`ref-harness-slot-status-pill is-${slot.status}`}
                          >
                            {slot.status === "solved"
                              ? `SOLVED 🏆 (${slot.incumbentScore}/100)`
                              : slot.incumbentScore > 0
                              ? `INCUMBENT: ${slot.incumbentScore}/100`
                              : "PENDING"}
                          </span>
                        </div>

                        <input
                          type="text"
                          className="ref-input ref-harness-slot-prompt-input"
                          value={slot.incumbentPrompt || slot.description}
                          onChange={(e) => {
                            const val = e.target.value;
                            setDeliverables((prev) =>
                              prev.map((d) =>
                                d.id === slot.id
                                  ? { ...d, description: val }
                                  : d
                              )
                            );
                          }}
                        />
                      </div>

                      {deliverables.length > 1 && (
                        <button
                          type="button"
                          className="ref-circle-icon-btn sm"
                          onClick={() => handleRemoveDeliverableSlot(slot.id)}
                        >
                          <IconClose size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {rubric.length > 0 && (
                  <div className="ref-harness-rubric-block">
                    <h3 className="ref-harness-rubric-title">
                      Weighted Evaluation Rubric
                    </h3>
                    <div className="ref-harness-rubric-list">
                      {rubric.map((crit) => (
                        <div key={crit.id} className="ref-harness-rubric-row">
                          <span className="ref-harness-rubric-weight">
                            {crit.weight}%
                          </span>
                          <div className="ref-harness-rubric-copy">
                            <strong>{crit.label}</strong>
                            <span>{crit.description}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="ref-harness-modal-footer">
              <button
                type="button"
                className="ref-dark-pill-btn"
                onClick={() => setIsParamsModalOpen(false)}
              >
                <span>Done</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== FLOATING MODAL 2: FLOW NODE INSPECTOR (THINKING, DRAFT, REFINING, RESULT) ==================== */}
      {inspectedNode && (
        <div
          className="ref-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Flow Card Inspector Modal"
          onClick={(e) => {
            if (e.target === e.currentTarget) setInspectedNodeId(null);
          }}
        >
          <div className="ref-modal-card ref-harness-modal-card">
            {(() => {
              const cand =
                inspectedNode.candidate || inspectedNode.winnerCandidate;
              return (
                <>
                  <div className="ref-modal-header">
                    <div>
                      <strong className="ref-soft-card-title">
                        ROUND 0{inspectedNode.roundNumber} •{" "}
                        {inspectedNode.stepKind.toUpperCase()} STEP •{" "}
                        {inspectedNode.deliverableTitle} ({cand.label})
                      </strong>
                      <span className="ref-harness-modal-sub">
                        Score: <strong>{cand.totalScore}/100</strong> •{" "}
                        {cand.passedHardGate
                          ? "HARD GATE PASS"
                          : "HARD GATE FAIL"}{" "}
                        • Strategy: {cand.promptStrategy}
                      </span>
                    </div>
                    <button
                      type="button"
                      aria-label="Close inspector modal"
                      className="ref-circle-icon-btn sm"
                      onClick={() => setInspectedNodeId(null)}
                    >
                      <IconClose size={12} />
                    </button>
                  </div>

                  <div className="ref-harness-inspector-grid">
                    <img
                      src={cand.imageUrl}
                      alt={cand.label}
                      className="ref-harness-inspector-img"
                    />

                    <div className="ref-harness-inspector-details">
                      <div className="ref-harness-crit-bars">
                        {cand.criterionScores.map((cs) => {
                          const critMeta = rubric.find(
                            (r) => r.id === cs.criterionId
                          );
                          const maxW = critMeta?.weight || 25;
                          const pct = Math.round((cs.score / maxW) * 100);
                          return (
                            <div
                              key={cs.criterionId}
                              className="ref-harness-crit-bar-item"
                            >
                              <div className="ref-harness-crit-bar-top">
                                <span>{critMeta?.label || cs.criterionId}</span>
                                <strong>
                                  {cs.score}/{maxW}
                                </strong>
                              </div>
                              <div className="ref-harness-crit-track">
                                <div
                                  className="ref-harness-crit-fill"
                                  style={{
                                    width: `${Math.min(100, Math.max(0, pct))}%`,
                                  }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {cand.complaints.length > 0 && (
                        <div className="ref-harness-complaints-box">
                          <span className="ref-harness-complaints-title">
                            Critic Complaints for Next Revision:
                          </span>
                          <ul className="ref-harness-complaints-list">
                            {cand.complaints.map((comp, i) => (
                              <li key={i}>{comp}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="ref-harness-trace-ledger">
                        <div className="ref-harness-trace-col">
                          <span className="ref-harness-trace-heading">
                            TRACE Trajectory Attribution
                          </span>
                          <p className="ref-harness-trace-text">
                            {
                              inspectedNode.outcome.traceAttribution
                                .diagnosisSummary
                            }
                          </p>
                        </div>
                        <div className="ref-harness-trace-col">
                          <span className="ref-harness-trace-heading">
                            Pairwise Gate &amp; Refiner Strategy
                          </span>
                          <p className="ref-harness-trace-text">
                            {
                              inspectedNode.outcome.traceAttribution
                                .pairwiseReasoning
                            }
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <span className="ref-field-label">
                      Exact Prompt Sent to Image Model
                    </span>
                    <pre className="ref-harness-exact-prompt-pre">
                      {cand.prompt}
                    </pre>
                  </div>

                  <div className="ref-harness-modal-footer">
                    <button
                      type="button"
                      className="ref-mura-btn-outline"
                      onClick={() =>
                        handleOpenInStudio({
                          title: `${inspectedNode.deliverableTitle} (${cand.label})`,
                          prompt: cand.prompt,
                          imageUrl: cand.imageUrl,
                        })
                      }
                    >
                      <span>Open in Studio</span>
                    </button>
                    <button
                      type="button"
                      className="ref-dark-pill-btn"
                      onClick={() =>
                        handleSelectCandidateForReiteration(
                          cand,
                          inspectedNode.roundNumber
                        )
                      }
                    >
                      <IconRefresh size={12} />
                      <span>Refine Next Iteration from This Card</span>
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* ==================== FULLSCREEN IMAGE LIGHTBOX ==================== */}
      {lightboxCard && (
        <div
          className="ref-modal-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={() => setLightboxCard(null)}
        >
          <div
            className="ref-modal-card ref-harness-lightbox-card"
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const cand =
                lightboxCard.candidate || lightboxCard.winnerCandidate;
              return (
                <>
                  <div className="ref-modal-header ref-harness-lightbox-header">
                    <strong className="ref-soft-card-title">
                      R{lightboxCard.roundNumber} •{" "}
                      {lightboxCard.deliverableTitle} ({cand.totalScore}/100)
                    </strong>
                    <button
                      type="button"
                      className="ref-circle-icon-btn sm"
                      onClick={() => setLightboxCard(null)}
                    >
                      <IconClose size={12} />
                    </button>
                  </div>
                  <img
                    src={cand.imageUrl}
                    alt={cand.label}
                    className="ref-harness-lightbox-img"
                  />
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
