import {
  FlowNodePosition,
  FlowStepParameterSnapshot,
} from "../types/studio.types";

export const FLOW_NODE_WIDTH = 284;
export const FLOW_NODE_HEIGHT_ESTIMATE = 290;
export const FLOW_HORIZONTAL_SPACING = 410;
export const FLOW_VERTICAL_SPACING = 315;

export interface PersistedProjectFlowMeta {
  positions: Record<string, FlowNodePosition>;
  parentVariantByTurn: Record<number, number>;
  snapshotsByTurn: Record<number, FlowStepParameterSnapshot>;
}

const FLOW_META_STORAGE_PREFIX = "nanobanana_flow_meta_v2:";

export function getFrameNodeId(roundId: string, variantIndex: number): string {
  return `${roundId}::frame-${variantIndex}`;
}

export function parseFrameNodeId(
  nodeId: string
): { roundId: string; variantIndex: number } | null {
  if (!nodeId || nodeId === "draft") return null;
  const sepIdx = nodeId.indexOf("::frame-");
  if (sepIdx === -1) {
    return { roundId: nodeId, variantIndex: 0 };
  }
  const roundId = nodeId.slice(0, sepIdx);
  const parsedIdx = Number(nodeId.slice(sepIdx + 8));
  return {
    roundId,
    variantIndex: Number.isFinite(parsedIdx) ? parsedIdx : 0,
  };
}

export function loadProjectFlowMeta(
  projectId: string | null
): PersistedProjectFlowMeta {
  const empty: PersistedProjectFlowMeta = {
    positions: {},
    parentVariantByTurn: {},
    snapshotsByTurn: {},
  };
  if (typeof window === "undefined" || !projectId) {
    return empty;
  }
  try {
    const raw =
      window.localStorage.getItem(`${FLOW_META_STORAGE_PREFIX}${projectId}`) ||
      window.localStorage.getItem(`nanobanana_flow_meta_v1:${projectId}`);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as Partial<PersistedProjectFlowMeta>;
    return {
      positions: parsed.positions || {},
      parentVariantByTurn: parsed.parentVariantByTurn || {},
      snapshotsByTurn: parsed.snapshotsByTurn || {},
    };
  } catch {
    return empty;
  }
}

export function saveProjectFlowMeta(
  projectId: string | null,
  meta: PersistedProjectFlowMeta
): void {
  if (typeof window === "undefined" || !projectId) return;
  try {
    window.localStorage.setItem(
      `${FLOW_META_STORAGE_PREFIX}${projectId}`,
      JSON.stringify(meta)
    );
  } catch {
    // Ignore storage quota errors
  }
}

export interface TreeLayoutInputTurn {
  id: string;
  turnNumber: number;
  parentTurnNumber: number | null;
  parentVariantIndex: number;
  variantCount: number;
}

/**
 * Computes a clean left-to-right n8n tree layout where EVERY generated image is its own card:
 * - Each turn with 4 images creates 4 vertically stacked cards in its depth column.
 * - Child image cards sit in column (parentDepth + 1) * FLOW_HORIZONTAL_SPACING.
 */
export function computeTreeAutoLayout(
  turns: TreeLayoutInputTurn[]
): Record<string, FlowNodePosition> {
  const result: Record<string, FlowNodePosition> = {};
  if (turns.length === 0) return result;

  const byTurn = new Map<number, TreeLayoutInputTurn>();
  for (const t of turns) {
    byTurn.set(t.turnNumber, t);
  }

  // Compute depth (column index) for each turn
  const depthMap = new Map<number, number>();
  const getDepth = (
    turn: TreeLayoutInputTurn,
    visited = new Set<number>()
  ): number => {
    if (depthMap.has(turn.turnNumber)) return depthMap.get(turn.turnNumber)!;
    if (
      turn.parentTurnNumber === null ||
      !byTurn.has(turn.parentTurnNumber) ||
      visited.has(turn.turnNumber)
    ) {
      depthMap.set(turn.turnNumber, 0);
      return 0;
    }
    visited.add(turn.turnNumber);
    const parent = byTurn.get(turn.parentTurnNumber)!;
    const d = getDepth(parent, visited) + 1;
    depthMap.set(turn.turnNumber, d);
    return d;
  };

  const columns = new Map<number, TreeLayoutInputTurn[]>();
  for (const t of turns) {
    const d = getDepth(t);
    const list = columns.get(d) || [];
    list.push(t);
    columns.set(d, list);
  }

  const sortedDepths = Array.from(columns.keys()).sort((a, b) => a - b);
  for (const depth of sortedDepths) {
    const colTurns = columns.get(depth)!;
    colTurns.sort((a, b) => {
      const pa = a.parentTurnNumber ?? 0;
      const pb = b.parentTurnNumber ?? 0;
      if (pa !== pb) return pa - pb;
      if (a.parentVariantIndex !== b.parentVariantIndex) {
        return a.parentVariantIndex - b.parentVariantIndex;
      }
      return a.turnNumber - b.turnNumber;
    });

    let currentColumnBottomY = 60;

    for (const turn of colTurns) {
      const count = Math.max(1, turn.variantCount || 4);
      const x = 70 + depth * FLOW_HORIZONTAL_SPACING;
      let startY = currentColumnBottomY;

      if (turn.parentTurnNumber !== null) {
        const parentTurn = byTurn.get(turn.parentTurnNumber);
        if (parentTurn) {
          const parentCardId = getFrameNodeId(
            parentTurn.id,
            turn.parentVariantIndex
          );
          const parentPos = result[parentCardId];
          if (parentPos) {
            const batchHeight = (count - 1) * FLOW_VERTICAL_SPACING;
            const centeredY = Math.round(parentPos.y - batchHeight * 0.35);
            startY = Math.max(currentColumnBottomY, Math.max(60, centeredY));
          }
        }
      }

      for (let vIdx = 0; vIdx < count; vIdx++) {
        const cardId = getFrameNodeId(turn.id, vIdx);
        const y = startY + vIdx * FLOW_VERTICAL_SPACING;
        result[cardId] = { x, y };
        currentColumnBottomY = y + FLOW_VERTICAL_SPACING + 28;
      }
    }
  }

  return result;
}

/**
 * Computes 4 non-overlapping card positions to the right of `parentPos` for a newly branched step
 * that generates `count` (4) separate image cards.
 */
export function computeBatchBranchNodePositions(
  parentPos: FlowNodePosition | null,
  existingPositions: FlowNodePosition[],
  count: number = 4
): FlowNodePosition[] {
  const targetX = parentPos ? parentPos.x + FLOW_HORIZONTAL_SPACING : 70;
  const batchSpan = (count - 1) * FLOW_VERTICAL_SPACING;
  let startY = parentPos
    ? Math.max(60, Math.round(parentPos.y - batchSpan * 0.35))
    : 60;

  const doesBatchCollide = (x: number, baseY: number) => {
    for (let i = 0; i < count; i++) {
      const candidateY = baseY + i * FLOW_VERTICAL_SPACING;
      const collides = existingPositions.some(
        (p) => Math.abs(p.x - x) < 250 && Math.abs(p.y - candidateY) < 280
      );
      if (collides) return true;
    }
    return false;
  };

  let attempts = 0;
  while (doesBatchCollide(targetX, startY) && attempts < 30) {
    startY += FLOW_VERTICAL_SPACING;
    attempts += 1;
  }

  return Array.from({ length: count }, (_, idx) => ({
    x: targetX,
    y: startY + idx * FLOW_VERTICAL_SPACING,
  }));
}

export interface StepBezierWireGeometry {
  path: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  midX: number;
  midY: number;
}

function buildRoundedOrthogonalSvgPath(
  points: Array<{ x: number; y: number }>,
  maxRadius: number = 16
): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  const commands: string[] = [`M ${points[0].x} ${points[0].y}`];

  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];

    const v1x = curr.x - prev.x;
    const v1y = curr.y - prev.y;
    const len1 = Math.hypot(v1x, v1y);

    const v2x = next.x - curr.x;
    const v2y = next.y - curr.y;
    const len2 = Math.hypot(v2x, v2y);

    if (len1 < 1 || len2 < 1) {
      commands.push(`L ${curr.x} ${curr.y}`);
      continue;
    }

    const r = Math.min(maxRadius, len1 * 0.5, len2 * 0.5);
    const entryX = Number((curr.x - (v1x / len1) * r).toFixed(2));
    const entryY = Number((curr.y - (v1y / len1) * r).toFixed(2));
    const exitX = Number((curr.x + (v2x / len2) * r).toFixed(2));
    const exitY = Number((curr.y + (v2y / len2) * r).toFixed(2));

    commands.push(`L ${entryX} ${entryY}`);
    commands.push(`Q ${curr.x} ${curr.y} ${exitX} ${exitY}`);
  }

  const last = points[points.length - 1];
  commands.push(`L ${last.x} ${last.y}`);
  return commands.join(" ");
}

/**
 * Computes an orthogonal smooth-step wire (straight horizontal/vertical segments with rounded 90° bends)
 * between a parent image card's right output port and a child image card's left input port.
 */
export function buildStepBezierPath(
  sourcePos: FlowNodePosition,
  targetPos: FlowNodePosition
): StepBezierWireGeometry {
  const startX = sourcePos.x + FLOW_NODE_WIDTH;
  const startY = sourcePos.y + 145;

  const endX = targetPos.x;
  const endY = targetPos.y + 145;

  const midX = Math.round((startX + endX) / 2);
  const midY = Math.round((startY + endY) / 2);

  let waypoints: Array<{ x: number; y: number }>;
  if (Math.abs(endY - startY) < 1 && endX >= startX) {
    waypoints = [
      { x: startX, y: startY },
      { x: endX, y: endY },
    ];
  } else if (endX >= startX + 24) {
    waypoints = [
      { x: startX, y: startY },
      { x: midX, y: startY },
      { x: midX, y: endY },
      { x: endX, y: endY },
    ];
  } else {
    const outX = startX + 28;
    const inX = endX - 28;
    waypoints = [
      { x: startX, y: startY },
      { x: outX, y: startY },
      { x: outX, y: midY },
      { x: inX, y: midY },
      { x: inX, y: endY },
      { x: endX, y: endY },
    ];
  }

  const path = buildRoundedOrthogonalSvgPath(waypoints, 16);

  return {
    path,
    startX,
    startY,
    endX,
    endY,
    midX,
    midY,
  };
}
