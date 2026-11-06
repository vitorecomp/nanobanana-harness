import {
  FlowNodePosition,
  FlowStepParameterSnapshot,
} from "../types/studio.types";

export const FLOW_NODE_WIDTH = 284;
export const FLOW_NODE_HEIGHT_ESTIMATE = 296;
export const FLOW_PORT_OFFSET_Y = 145;
export const FLOW_HORIZONTAL_SPACING = 440;
export const FLOW_VERTICAL_SPACING = 356;
export const FLOW_SUBCOLUMN_SPACING = 372;

const TOP_CANVAS_MARGIN = 84;
const LEFT_CANVAS_MARGIN = 80;
const ROW_CORRIDOR_GAP = FLOW_VERTICAL_SPACING - FLOW_NODE_HEIGHT_ESTIMATE; // 60px horizontal corridor
const TURN_GROUP_GAP = 76;
const ROOT_SWIMLANE_GAP = 96;

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

interface SubtreePlacementBounds {
  topY: number;
  bottomY: number;
  subtreeTopY: number;
  subtreeBottomY: number;
}

/**
 * Computes a collision-free, planar left-to-right hierarchical tree layout:
 * - Guarantees zero card-to-card overlaps across all depths and subcolumns.
 * - Separates sibling subtrees vertically so parent-to-child wire trunks never cross.
 * - Centers single-row parent cards (such as Reference Origin cards) vertically opposite their children.
 * - Preserves dedicated horizontal (60px+) and vertical (88px–156px) wire corridors between all cards.
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

  // 1. Compute cycle-safe depth for each turn
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

  let maxDepth = 0;
  const turnsByDepth = new Map<number, TreeLayoutInputTurn[]>();
  for (const t of turns) {
    const d = getDepth(t);
    if (d > maxDepth) maxDepth = d;
    const list = turnsByDepth.get(d) || [];
    list.push(t);
    turnsByDepth.set(d, list);
  }

  // 2. Compute horizontal X base for each depth column (accounting for 2-subcolumn batches)
  const depthBaseX = new Map<number, number>();
  let runningX = LEFT_CANVAS_MARGIN;
  for (let d = 0; d <= maxDepth; d++) {
    depthBaseX.set(d, runningX);
    const colTurns = turnsByDepth.get(d) || [];
    const hasTwoSubCols = colTurns.some(
      (t) => Math.max(1, t.variantCount || 1) > 4
    );
    runningX +=
      (hasTwoSubCols ? FLOW_SUBCOLUMN_SPACING : 0) + FLOW_HORIZONTAL_SPACING;
  }

  // 3. Index child turns per specific parent card: `${parentTurnNumber}:${clampedVariantIdx}`
  const childrenByCardKey = new Map<string, TreeLayoutInputTurn[]>();
  const rootTurns: TreeLayoutInputTurn[] = [];

  for (const t of turns) {
    const d = depthMap.get(t.turnNumber) ?? 0;
    if (d === 0 || t.parentTurnNumber === null || !byTurn.has(t.parentTurnNumber)) {
      rootTurns.push(t);
    } else {
      const parent = byTurn.get(t.parentTurnNumber)!;
      const parentCount = Math.max(1, parent.variantCount || 1);
      const clampedVarIdx = Math.min(
        Math.max(0, t.parentVariantIndex || 0),
        parentCount - 1
      );
      const key = `${parent.turnNumber}:${clampedVarIdx}`;
      const list = childrenByCardKey.get(key) || [];
      list.push(t);
      childrenByCardKey.set(key, list);
    }
  }

  rootTurns.sort((a, b) => a.turnNumber - b.turnNumber);
  for (const list of childrenByCardKey.values()) {
    list.sort((a, b) => a.turnNumber - b.turnNumber);
  }

  // Monotonic per-depth Y floor guarantees no two cards in the same depth ever overlap
  const depthNextFreeY = new Map<number, number>();
  const placedTurns = new Set<number>();

  const estimateDirectTurnStackSpan = (childList: TreeLayoutInputTurn[]): number => {
    if (childList.length === 0) return 0;
    let total = 0;
    for (let i = 0; i < childList.length; i++) {
      const count = Math.max(1, childList[i].variantCount || 1);
      const cols = count > 4 ? 2 : 1;
      const rows = Math.ceil(count / cols);
      total +=
        rows * FLOW_NODE_HEIGHT_ESTIMATE +
        Math.max(0, rows - 1) * ROW_CORRIDOR_GAP;
      if (i < childList.length - 1) {
        total += TURN_GROUP_GAP;
      }
    }
    return total;
  };

  const layoutTurnSubtree = (
    turn: TreeLayoutInputTurn,
    minStartY: number
  ): SubtreePlacementBounds => {
    placedTurns.add(turn.turnNumber);
    const depth = depthMap.get(turn.turnNumber) ?? 0;
    const baseX = depthBaseX.get(depth) ?? LEFT_CANVAS_MARGIN;
    const count = Math.max(1, turn.variantCount || 1);
    const numCols = count > 4 ? 2 : 1;
    const numRows = Math.ceil(count / numCols);

    let cardCursorY = Math.max(
      TOP_CANVAS_MARGIN,
      minStartY,
      depthNextFreeY.get(depth) ?? TOP_CANVAS_MARGIN
    );
    let prevBranchedDirectBottomY = -Infinity;

    let turnTopY = Infinity;
    let turnBottomY = -Infinity;
    let subtreeTopY = Infinity;
    let subtreeBottomY = -Infinity;

    for (let r = 0; r < numRows; r++) {
      const cardIndicesInRow =
        numCols === 2
          ? [2 * r, 2 * r + 1].filter((idx) => idx < count)
          : [r];

      const rowChildTurns: TreeLayoutInputTurn[] = [];
      for (const vIdx of cardIndicesInRow) {
        const attached = childrenByCardKey.get(`${turn.turnNumber}:${vIdx}`);
        if (attached && attached.length > 0) {
          for (const ct of attached) {
            if (!placedTurns.has(ct.turnNumber)) {
              rowChildTurns.push(ct);
            }
          }
        }
      }

      if (rowChildTurns.length === 0) {
        const rowY = Math.max(
          cardCursorY,
          depthNextFreeY.get(depth) ?? TOP_CANVAS_MARGIN
        );
        for (let c = 0; c < cardIndicesInRow.length; c++) {
          const vIdx = cardIndicesInRow[c];
          result[getFrameNodeId(turn.id, vIdx)] = {
            x: baseX + c * FLOW_SUBCOLUMN_SPACING,
            y: rowY,
          };
        }
        const rowBottom = rowY + FLOW_NODE_HEIGHT_ESTIMATE;
        depthNextFreeY.set(depth, rowBottom + ROW_CORRIDOR_GAP);
        cardCursorY = rowBottom + ROW_CORRIDOR_GAP;

        turnTopY = Math.min(turnTopY, rowY);
        turnBottomY = Math.max(turnBottomY, rowBottom);
        subtreeTopY = Math.min(subtreeTopY, rowY);
        subtreeBottomY = Math.max(subtreeBottomY, rowBottom);
      } else {
        const rowBaseMinY = Math.max(
          cardCursorY,
          depthNextFreeY.get(depth) ?? TOP_CANVAS_MARGIN,
          prevBranchedDirectBottomY > -Infinity
            ? prevBranchedDirectBottomY + TURN_GROUP_GAP
            : TOP_CANVAS_MARGIN
        );

        let proposedChildStartY = rowBaseMinY;
        if (prevBranchedDirectBottomY === -Infinity) {
          const directSpan = estimateDirectTurnStackSpan(rowChildTurns);
          const centeredStart = Math.round(
            rowBaseMinY + (FLOW_NODE_HEIGHT_ESTIMATE - directSpan) / 2
          );
          proposedChildStartY = Math.max(
            TOP_CANVAS_MARGIN,
            depthNextFreeY.get(depth + 1) ?? TOP_CANVAS_MARGIN,
            centeredStart
          );
        }

        let childCursorY = proposedChildStartY;
        let childrenDirectTopY = Infinity;
        let childrenDirectBottomY = -Infinity;
        let childrenTreeTopY = Infinity;
        let childrenTreeBottomY = -Infinity;

        for (const childTurn of rowChildTurns) {
          const childBounds = layoutTurnSubtree(childTurn, childCursorY);
          childrenDirectTopY = Math.min(childrenDirectTopY, childBounds.topY);
          childrenDirectBottomY = Math.max(
            childrenDirectBottomY,
            childBounds.bottomY
          );
          childrenTreeTopY = Math.min(
            childrenTreeTopY,
            childBounds.subtreeTopY
          );
          childrenTreeBottomY = Math.max(
            childrenTreeBottomY,
            childBounds.subtreeBottomY
          );
          childCursorY = childBounds.bottomY + TURN_GROUP_GAP;
        }

        // Center single-row parent cards opposite their direct children; keep multi-row batches aligned cleanly
        let rowY = rowBaseMinY;
        if (
          numRows === 1 &&
          Number.isFinite(childrenDirectTopY) &&
          Number.isFinite(childrenDirectBottomY)
        ) {
          const centeredParentY = Math.round(
            (childrenDirectTopY +
              childrenDirectBottomY -
              FLOW_NODE_HEIGHT_ESTIMATE) /
              2
          );
          rowY = Math.max(rowBaseMinY, centeredParentY);
        } else if (
          prevBranchedDirectBottomY > -Infinity &&
          Number.isFinite(childrenDirectTopY)
        ) {
          rowY = Math.max(rowBaseMinY, childrenDirectTopY);
        }

        for (let c = 0; c < cardIndicesInRow.length; c++) {
          const vIdx = cardIndicesInRow[c];
          result[getFrameNodeId(turn.id, vIdx)] = {
            x: baseX + c * FLOW_SUBCOLUMN_SPACING,
            y: rowY,
          };
        }

        const rowBottom = rowY + FLOW_NODE_HEIGHT_ESTIMATE;
        depthNextFreeY.set(depth, rowBottom + ROW_CORRIDOR_GAP);
        cardCursorY = rowBottom + ROW_CORRIDOR_GAP;
        prevBranchedDirectBottomY = Math.max(rowBottom, childrenDirectBottomY);

        turnTopY = Math.min(turnTopY, rowY);
        turnBottomY = Math.max(turnBottomY, rowBottom);
        subtreeTopY = Math.min(subtreeTopY, rowY, childrenTreeTopY);
        subtreeBottomY = Math.max(subtreeBottomY, rowBottom, childrenTreeBottomY);
      }
    }

    return {
      topY: turnTopY,
      bottomY: turnBottomY,
      subtreeTopY,
      subtreeBottomY,
    };
  };

  let nextSwimlaneY = TOP_CANVAS_MARGIN;
  for (const root of rootTurns) {
    const bounds = layoutTurnSubtree(root, nextSwimlaneY);
    let maxUsedY = bounds.subtreeBottomY;
    for (const freeY of depthNextFreeY.values()) {
      maxUsedY = Math.max(maxUsedY, freeY - ROW_CORRIDOR_GAP);
    }
    nextSwimlaneY = maxUsedY + ROOT_SWIMLANE_GAP;
    for (let d = 0; d <= maxDepth; d++) {
      depthNextFreeY.set(
        d,
        Math.max(depthNextFreeY.get(d) ?? TOP_CANVAS_MARGIN, nextSwimlaneY)
      );
    }
  }

  // Fallback safety for any disconnected cycles
  for (const t of turns) {
    if (!placedTurns.has(t.turnNumber)) {
      layoutTurnSubtree(t, nextSwimlaneY);
    }
  }

  return result;
}

/**
 * Computes non-overlapping card positions (1..8) to the right of `parentPos` (or on a fresh swimlane for roots):
 * - 1..4 cards stack in 1 vertical column.
 * - 5..8 cards organize into a compact 2-subcolumn grid (2x3 or 2x4) with generous routing corridors.
 */
export function computeBatchBranchNodePositions(
  parentPos: FlowNodePosition | null,
  existingPositions: FlowNodePosition[],
  count: number = 4,
  parentTurnMaxX?: number
): FlowNodePosition[] {
  const safeCount = Math.max(1, Math.min(8, Math.round(count || 1)));
  const numCols = safeCount > 4 ? 2 : 1;
  const numRows = Math.ceil(safeCount / numCols);
  const anchorRightmostX = parentPos
    ? Math.max(parentPos.x, parentTurnMaxX ?? parentPos.x)
    : null;
  const targetX =
    anchorRightmostX !== null
      ? anchorRightmostX + FLOW_HORIZONTAL_SPACING
      : LEFT_CANVAS_MARGIN;

  const batchSpan = Math.max(0, numRows - 1) * FLOW_VERTICAL_SPACING;
  let startY: number;

  if (parentPos) {
    startY = Math.max(
      TOP_CANVAS_MARGIN,
      Math.round(parentPos.y - batchSpan * 0.5)
    );
  } else if (existingPositions.length > 0) {
    const maxExistingBottomY = Math.max(
      ...existingPositions.map((p) => p.y + FLOW_NODE_HEIGHT_ESTIMATE)
    );
    startY = Math.max(TOP_CANVAS_MARGIN, maxExistingBottomY + ROOT_SWIMLANE_GAP);
  } else {
    startY = TOP_CANVAS_MARGIN;
  }

  const CLEARANCE_X = FLOW_NODE_WIDTH + 56; // 340px
  const CLEARANCE_Y = FLOW_NODE_HEIGHT_ESTIMATE + 54; // 350px

  const doesBatchCollide = (baseX: number, baseY: number) => {
    for (let i = 0; i < safeCount; i++) {
      const col = numCols === 2 ? i % 2 : 0;
      const row = numCols === 2 ? i >> 1 : i;
      const candidateX = baseX + col * FLOW_SUBCOLUMN_SPACING;
      const candidateY = baseY + row * FLOW_VERTICAL_SPACING;
      const collides = existingPositions.some(
        (p) =>
          Math.abs(p.x - candidateX) < CLEARANCE_X &&
          Math.abs(p.y - candidateY) < CLEARANCE_Y
      );
      if (collides) return true;
    }
    return false;
  };

  let attempts = 0;
  while (doesBatchCollide(targetX, startY) && attempts < 80) {
    startY += 60;
    attempts += 1;
  }

  return Array.from({ length: safeCount }, (_, idx) => {
    const col = numCols === 2 ? idx % 2 : 0;
    const row = numCols === 2 ? Math.floor(idx / 2) : idx;
    return {
      x: targetX + col * FLOW_SUBCOLUMN_SPACING,
      y: startY + row * FLOW_VERTICAL_SPACING,
    };
  });
}

export interface FlowObstacleNode {
  id?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
}

export interface WireRoutingOptions {
  obstacles?: FlowObstacleNode[];
  sourceId?: string;
  targetId?: string;
  laneOffset?: number;
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

interface PaddedObstacleRect {
  id?: string;
  left: number;
  right: number;
  top: number;
  bottom: number;
  rawLeft: number;
  rawRight: number;
}

function simplifyCollinearWaypoints(
  pts: Array<{ x: number; y: number }>
): Array<{ x: number; y: number }> {
  if (pts.length <= 2) return pts;
  const deduped: Array<{ x: number; y: number }> = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const prev = deduped[deduped.length - 1];
    if (Math.hypot(pts[i].x - prev.x, pts[i].y - prev.y) >= 0.5) {
      deduped.push(pts[i]);
    }
  }
  if (deduped.length <= 2) return deduped;

  const simplified: Array<{ x: number; y: number }> = [deduped[0]];
  for (let i = 1; i < deduped.length - 1; i++) {
    const a = simplified[simplified.length - 1];
    const b = deduped[i];
    const c = deduped[i + 1];
    const sameX = Math.abs(a.x - b.x) < 0.5 && Math.abs(b.x - c.x) < 0.5;
    const sameY = Math.abs(a.y - b.y) < 0.5 && Math.abs(b.y - c.y) < 0.5;
    if (!sameX && !sameY) {
      simplified.push(b);
    }
  }
  simplified.push(deduped[deduped.length - 1]);
  return simplified;
}

function buildRoundedOrthogonalSvgPath(
  rawPoints: Array<{ x: number; y: number }>,
  maxRadius: number = 14
): string {
  const points = simplifyCollinearWaypoints(rawPoints);
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

    const r = Math.min(maxRadius, len1 * 0.48, len2 * 0.48);
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

function segmentOverlapLengthWithObstacles(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  rects: PaddedObstacleRect[],
  ignoreId?: string
): number {
  let totalOverlap = 0;
  if (Math.abs(y1 - y2) < 0.5) {
    const y = y1;
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    for (let i = 0; i < rects.length; i++) {
      const r = rects[i];
      if (ignoreId && r.id === ignoreId) continue;
      if (y > r.top && y < r.bottom) {
        const ov = Math.min(maxX, r.right) - Math.max(minX, r.left);
        if (ov > 0) totalOverlap += ov;
      }
    }
  } else if (Math.abs(x1 - x2) < 0.5) {
    const x = x1;
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);
    for (let i = 0; i < rects.length; i++) {
      const r = rects[i];
      if (ignoreId && r.id === ignoreId) continue;
      if (x > r.left && x < r.right) {
        const ov = Math.min(maxY, r.bottom) - Math.max(minY, r.top);
        if (ov > 0) totalOverlap += ov;
      }
    }
  }
  return totalOverlap;
}

function mergeSortedAxisCoords(
  candidates: number[],
  pinnedValues: number[],
  minDelta: number = 5
): number[] {
  const pinnedSet = new Set(pinnedValues.map((v) => Math.round(v)));
  const sorted = Array.from(
    new Set([
      ...pinnedSet,
      ...candidates.filter(Number.isFinite).map((v) => Math.round(v)),
    ])
  ).sort((a, b) => a - b);

  const out: number[] = [];
  for (const val of sorted) {
    if (out.length === 0) {
      out.push(val);
      continue;
    }
    const prev = out[out.length - 1];
    if (val - prev >= minDelta || pinnedSet.has(val)) {
      if (val - prev < minDelta && pinnedSet.has(val) && !pinnedSet.has(prev)) {
        out[out.length - 1] = val;
      } else {
        out.push(val);
      }
    }
  }
  return out;
}

function routeOrthogonalCorridorWaypoints(
  startX: number,
  startY: number,
  stubStartX: number,
  endX: number,
  endY: number,
  stubEndX: number,
  preferredTrunkX: number,
  laneOffset: number,
  rects: PaddedObstacleRect[]
): Array<{ x: number; y: number }> {
  const xCandidates: number[] = [stubStartX, stubEndX, preferredTrunkX];
  const corridorMidYs: number[] = [];
  const yCandidates: number[] = [startY, endY];

  let minLeft = Math.min(startX, endX);
  let maxRight = Math.max(startX, endX);
  let minTop = Math.min(startY, endY);
  let maxBottom = Math.max(startY, endY);

  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    minLeft = Math.min(minLeft, r.left);
    maxRight = Math.max(maxRight, r.right);
    minTop = Math.min(minTop, r.top);
    maxBottom = Math.max(maxBottom, r.bottom);

    xCandidates.push(r.left - 8, r.right + 8);
    yCandidates.push(r.top - 10, r.bottom + 10);

    for (let j = i + 1; j < rects.length; j++) {
      const r2 = rects[j];
      // Vertical corridor midpoint between horizontally adjacent cards
      const vertOverlap =
        Math.min(r.bottom, r2.bottom) > Math.max(r.top, r2.top) - 140;
      if (vertOverlap) {
        if (r.right < r2.left && r2.left - r.right <= 280) {
          const mid = Math.round((r.right + r2.left) / 2 + laneOffset * 0.45);
          xCandidates.push(
            Math.max(r.right + 2, Math.min(r2.left - 2, mid))
          );
        } else if (r2.right < r.left && r.left - r2.right <= 280) {
          const mid = Math.round((r2.right + r.left) / 2 + laneOffset * 0.45);
          xCandidates.push(
            Math.max(r2.right + 2, Math.min(r.left - 2, mid))
          );
        }
      }

      // Horizontal corridor midpoint between vertically stacked cards
      const horizOverlap =
        Math.min(r.right, r2.right) > Math.max(r.left, r2.left) - 140;
      if (horizOverlap) {
        if (r.bottom < r2.top && r2.top - r.bottom <= 280) {
          const midY = Math.round((r.bottom + r2.top) / 2);
          corridorMidYs.push(midY);
          yCandidates.push(midY);
        } else if (r2.bottom < r.top && r.top - r2.bottom <= 280) {
          const midY = Math.round((r2.bottom + r.top) / 2);
          corridorMidYs.push(midY);
          yCandidates.push(midY);
        }
      }
    }
  }

  const rawMidY = Math.round((startY + endY) / 2);
  if (!corridorMidYs.some((cy) => Math.abs(cy - rawMidY) < 42)) {
    yCandidates.push(rawMidY);
  }

  xCandidates.push(minLeft - 28, maxRight + 28);
  yCandidates.push(minTop - 28, maxBottom + 28);

  const xs = mergeSortedAxisCoords(
    xCandidates,
    [stubStartX, stubEndX, preferredTrunkX],
    5
  );
  const ys = mergeSortedAxisCoords(
    yCandidates,
    [startY, endY, ...corridorMidYs],
    5
  );

  const nx = xs.length;
  const ny = ys.length;
  const startXi = xs.indexOf(Math.round(stubStartX));
  const startYi = ys.indexOf(Math.round(startY));
  const endXi = xs.indexOf(Math.round(stubEndX));
  const endYi = ys.indexOf(Math.round(endY));

  if (startXi < 0 || startYi < 0 || endXi < 0 || endYi < 0) {
    return [
      { x: startX, y: startY },
      { x: stubStartX, y: startY },
      { x: stubStartX, y: endY },
      { x: endX, y: endY },
    ];
  }

  // Precompute narrow vertical channel flags so main inter-depth gutters win over narrow subcolumn gutters
  const isNarrowVerticalX = new Uint8Array(nx);
  for (let xi = 0; xi < nx; xi++) {
    const x = xs[xi];
    let hasCloseLeft = false;
    let hasCloseRight = false;
    for (let k = 0; k < rects.length; k++) {
      const r = rects[k];
      if (x >= r.right && x - r.right < 56) hasCloseLeft = true;
      if (x <= r.left && r.left - x < 56) hasCloseRight = true;
      if (hasCloseLeft && hasCloseRight) {
        isNarrowVerticalX[xi] = 1;
        break;
      }
    }
  }

  // State index: (yi * nx + xi) * 2 + dir (0 = horizontal, 1 = vertical)
  const totalStates = nx * ny * 2;
  const dist = new Float64Array(totalStates);
  dist.fill(Infinity);
  const prev = new Int32Array(totalStates);
  prev.fill(-1);
  const visited = new Uint8Array(totalStates);

  // Binary min-heap for fast Dijkstra search
  const heapStates: number[] = [];
  const heapCosts: number[] = [];

  const pushHeap = (state: number, cost: number) => {
    let idx = heapStates.length;
    heapStates.push(state);
    heapCosts.push(cost);
    while (idx > 0) {
      const parent = (idx - 1) >> 1;
      if (heapCosts[parent] <= cost) break;
      heapStates[idx] = heapStates[parent];
      heapCosts[idx] = heapCosts[parent];
      idx = parent;
    }
    heapStates[idx] = state;
    heapCosts[idx] = cost;
  };

  const popHeap = (): number => {
    const topState = heapStates[0];
    const lastState = heapStates.pop()!;
    const lastCost = heapCosts.pop()!;
    if (heapStates.length > 0) {
      let idx = 0;
      const len = heapStates.length;
      while (true) {
        const left = (idx << 1) + 1;
        if (left >= len) break;
        const right = left + 1;
        const smallest =
          right < len && heapCosts[right] < heapCosts[left] ? right : left;
        if (lastCost <= heapCosts[smallest]) break;
        heapStates[idx] = heapStates[smallest];
        heapCosts[idx] = heapCosts[smallest];
        idx = smallest;
      }
      heapStates[idx] = lastState;
      heapCosts[idx] = lastCost;
    }
    return topState;
  };

  const BEND_PENALTY = 90;
  const startState = (startYi * nx + startXi) * 2 + 0; // Arriving horizontally rightwards at stubStart
  dist[startState] = 0;
  pushHeap(startState, 0);

  let bestGoalState = -1;
  let bestGoalCost = Infinity;

  while (heapStates.length > 0) {
    const curr = popHeap();
    if (visited[curr]) continue;
    visited[curr] = 1;

    const currCost = dist[curr];
    if (currCost >= bestGoalCost) break;

    const dir = curr & 1;
    const cell = curr >> 1;
    const xi = cell % nx;
    const yi = (cell / nx) | 0;

    if (xi === endXi && yi === endYi) {
      // Final approach into (endX, endY) is horizontal rightwards; dir === 1 needs one final 90° bend
      const finalCost = currCost + (dir === 1 ? BEND_PENALTY : 0);
      if (finalCost < bestGoalCost) {
        bestGoalCost = finalCost;
        bestGoalState = curr;
      }
    }

    const currX = xs[xi];
    const currY = ys[yi];

    // 4-neighbor orthogonal transitions
    // 1. Left (xi - 1) — disallow immediate 180° fold at stubStart
    if (xi > 0 && !(curr === startState)) {
      const nextXi = xi - 1;
      // Disallow arriving at (endXi, endYi) moving leftwards (would fold 180° over end stub)
      if (!(nextXi === endXi && yi === endYi)) {
        const nextX = xs[nextXi];
        const segLen = currX - nextX;
        const ov = segmentOverlapLengthWithObstacles(
          nextX,
          currY,
          currX,
          currY,
          rects
        );
        const stepCost =
          segLen +
          (dir === 0 ? 0 : BEND_PENALTY) +
          (ov > 0 ? 120000 + ov * 120 : 0);
        const nextState = (yi * nx + nextXi) * 2 + 0;
        const cand = currCost + stepCost;
        if (cand < dist[nextState]) {
          dist[nextState] = cand;
          prev[nextState] = curr;
          pushHeap(nextState, cand);
        }
      }
    }

    // 2. Right (xi + 1)
    if (xi + 1 < nx) {
      const nextXi = xi + 1;
      const nextX = xs[nextXi];
      const segLen = nextX - currX;
      const ov = segmentOverlapLengthWithObstacles(
        currX,
        currY,
        nextX,
        currY,
        rects
      );
      const stepCost =
        segLen +
        (dir === 0 ? 0 : BEND_PENALTY) +
        (ov > 0 ? 120000 + ov * 120 : 0);
      const nextState = (yi * nx + nextXi) * 2 + 0;
      const cand = currCost + stepCost;
      if (cand < dist[nextState]) {
        dist[nextState] = cand;
        prev[nextState] = curr;
        pushHeap(nextState, cand);
      }
    }

    // 3. Up (yi - 1)
    if (yi > 0) {
      const nextYi = yi - 1;
      const nextY = ys[nextYi];
      const segLen = currY - nextY;
      const ov = segmentOverlapLengthWithObstacles(
        currX,
        nextY,
        currX,
        currY,
        rects
      );
      const vertWeight = isNarrowVerticalX[xi] ? 1.08 : 1.0;
      const trunkBias = Math.abs(currX - preferredTrunkX) * 0.002;
      const stepCost =
        segLen * vertWeight +
        trunkBias +
        (dir === 1 ? 0 : BEND_PENALTY) +
        (ov > 0 ? 120000 + ov * 120 : 0);
      const nextState = (nextYi * nx + xi) * 2 + 1;
      const cand = currCost + stepCost;
      if (cand < dist[nextState]) {
        dist[nextState] = cand;
        prev[nextState] = curr;
        pushHeap(nextState, cand);
      }
    }

    // 4. Down (yi + 1)
    if (yi + 1 < ny) {
      const nextYi = yi + 1;
      const nextY = ys[nextYi];
      const segLen = nextY - currY;
      const ov = segmentOverlapLengthWithObstacles(
        currX,
        currY,
        currX,
        nextY,
        rects
      );
      const vertWeight = isNarrowVerticalX[xi] ? 1.08 : 1.0;
      const trunkBias = Math.abs(currX - preferredTrunkX) * 0.002;
      const stepCost =
        segLen * vertWeight +
        trunkBias +
        (dir === 1 ? 0 : BEND_PENALTY) +
        (ov > 0 ? 120000 + ov * 120 : 0);
      const nextState = (nextYi * nx + xi) * 2 + 1;
      const cand = currCost + stepCost;
      if (cand < dist[nextState]) {
        dist[nextState] = cand;
        prev[nextState] = curr;
        pushHeap(nextState, cand);
      }
    }
  }

  if (bestGoalState === -1) {
    return [
      { x: startX, y: startY },
      { x: stubStartX, y: startY },
      { x: stubStartX, y: endY },
      { x: endX, y: endY },
    ];
  }

  const gridChain: Array<{ x: number; y: number }> = [];
  let cursor = bestGoalState;
  while (cursor !== -1) {
    const cCell = cursor >> 1;
    gridChain.push({
      x: xs[cCell % nx],
      y: ys[(cCell / nx) | 0],
    });
    cursor = prev[cursor];
  }
  gridChain.reverse();

  return [
    { x: startX, y: startY },
    ...gridChain,
    { x: endX, y: endY },
  ];
}

/**
 * Computes an obstacle-avoiding orthogonal smooth-step wire (straight horizontal/vertical segments
 * with rounded 90° bends) between a parent card's right output port and a child card's left input port.
 */
export function buildStepBezierPath(
  sourcePos: FlowNodePosition,
  targetPos: FlowNodePosition,
  options?: WireRoutingOptions
): StepBezierWireGeometry {
  const startX = Math.round(sourcePos.x + FLOW_NODE_WIDTH);
  const startY = Math.round(sourcePos.y + FLOW_PORT_OFFSET_Y);

  const endX = Math.round(targetPos.x);
  const endY = Math.round(targetPos.y + FLOW_PORT_OFFSET_Y);

  const midX = Math.round((startX + endX) / 2);
  const midY = Math.round((startY + endY) / 2);

  const laneOffset = options?.laneOffset ?? 0;
  const rawObstacles = options?.obstacles;

  if (!rawObstacles || rawObstacles.length === 0) {
    let fallbackWaypoints: Array<{ x: number; y: number }>;
    if (Math.abs(endY - startY) < 1 && endX >= startX) {
      fallbackWaypoints = [
        { x: startX, y: startY },
        { x: endX, y: endY },
      ];
    } else if (endX >= startX + 28) {
      const turnX = Math.min(
        endX - 16,
        Math.max(startX + 20, Math.min(midX, startX + 70) + laneOffset)
      );
      fallbackWaypoints = [
        { x: startX, y: startY },
        { x: turnX, y: startY },
        { x: turnX, y: endY },
        { x: endX, y: endY },
      ];
    } else {
      const outX = startX + 30;
      const inX = endX - 28;
      fallbackWaypoints = [
        { x: startX, y: startY },
        { x: outX, y: startY },
        { x: outX, y: midY },
        { x: inX, y: midY },
        { x: inX, y: endY },
        { x: endX, y: endY },
      ];
    }

    return {
      path: buildRoundedOrthogonalSvgPath(fallbackWaypoints, 14),
      startX,
      startY,
      endX,
      endY,
      midX,
      midY,
    };
  }

  const sourceId = options?.sourceId;
  const targetId = options?.targetId;

  const rects: PaddedObstacleRect[] = rawObstacles.map((obs) => {
    const w = obs.width ?? FLOW_NODE_WIDTH;
    const h = obs.height ?? FLOW_NODE_HEIGHT_ESTIMATE;
    return {
      id: obs.id,
      left: Math.round(obs.x - 18),
      right: Math.round(obs.x + w + 24),
      top: Math.round(obs.y - 18),
      bottom: Math.round(obs.y + h + 18),
      rawLeft: Math.round(obs.x),
      rawRight: Math.round(obs.x + w),
    };
  });

  // Compute safe horizontal exit & entry stubs that adapt if cards are placed very close together
  let stubStartX = startX + 32;
  let nearestRightBlockRawLeft = Infinity;
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    if (sourceId && r.id === sourceId) continue;
    if (r.rawLeft > startX + 8 && startY > r.top && startY < r.bottom) {
      nearestRightBlockRawLeft = Math.min(nearestRightBlockRawLeft, r.rawLeft);
    }
  }
  if (nearestRightBlockRawLeft < stubStartX + 18) {
    stubStartX = Math.max(
      startX + 12,
      Math.round((startX + nearestRightBlockRawLeft) / 2)
    );
  }

  let stubEndX = endX - 26;
  let nearestLeftBlockRawRight = -Infinity;
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    if (targetId && r.id === targetId) continue;
    if (r.rawRight < endX - 8 && endY > r.top && endY < r.bottom) {
      nearestLeftBlockRawRight = Math.max(
        nearestLeftBlockRawRight,
        r.rawRight + 14
      );
    }
  }
  if (nearestLeftBlockRawRight > stubEndX - 18) {
    stubEndX = Math.min(
      endX - 10,
      Math.round((nearestLeftBlockRawRight + endX) / 2)
    );
  }

  // Ensure stub endpoints sit just outside padded margins when cards were manually placed tightly
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    if (sourceId && r.id === sourceId) {
      r.right = Math.min(r.right, stubStartX - 2);
    } else if (
      stubStartX > r.left &&
      stubStartX < r.rawLeft &&
      startY > r.top &&
      startY < r.bottom
    ) {
      r.left = Math.min(r.rawLeft - 2, stubStartX + 2);
    }

    if (targetId && r.id === targetId) {
      r.left = Math.max(r.left, stubEndX + 2);
    } else if (
      stubEndX < r.right &&
      stubEndX > r.rawRight &&
      endY > r.top &&
      endY < r.bottom
    ) {
      r.right = Math.max(r.rawRight + 2, stubEndX - 2);
    }
  }

  // Keep preferredTrunkX invariant per parent card so all sibling branches share one crisp vertical trunk
  const preferredTrunkX = Math.round(startX + 68 + laneOffset);

  // Fast-path check: clean 0-bend or 2-bend Z-wire if completely clear of every obstacle
  if (stubEndX >= stubStartX) {
    const trunkX = Math.max(stubStartX, Math.min(stubEndX, preferredTrunkX));
    const hitStartStub = segmentOverlapLengthWithObstacles(
      startX + 1,
      startY,
      trunkX,
      startY,
      rects,
      sourceId
    );
    const hitVert =
      Math.abs(endY - startY) < 1
        ? 0
        : segmentOverlapLengthWithObstacles(
            trunkX,
            startY,
            trunkX,
            endY,
            rects
          );
    const hitEndStub = segmentOverlapLengthWithObstacles(
      trunkX,
      endY,
      endX - 1,
      endY,
      rects,
      targetId
    );

    if (hitStartStub === 0 && hitVert === 0 && hitEndStub === 0) {
      const fastWaypoints =
        Math.abs(endY - startY) < 1
          ? [
              { x: startX, y: startY },
              { x: endX, y: endY },
            ]
          : [
              { x: startX, y: startY },
              { x: trunkX, y: startY },
              { x: trunkX, y: endY },
              { x: endX, y: endY },
            ];
      return {
        path: buildRoundedOrthogonalSvgPath(fastWaypoints, 14),
        startX,
        startY,
        endX,
        endY,
        midX,
        midY,
      };
    }
  }

  const routedWaypoints = routeOrthogonalCorridorWaypoints(
    startX,
    startY,
    stubStartX,
    endX,
    endY,
    stubEndX,
    preferredTrunkX,
    laneOffset,
    rects
  );

  return {
    path: buildRoundedOrthogonalSvgPath(routedWaypoints, 14),
    startX,
    startY,
    endX,
    endY,
    midX,
    midY,
  };
}
