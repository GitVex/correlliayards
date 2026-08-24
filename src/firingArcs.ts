// ---------------------------------------------------------------------------
// Firing arcs on a base token.
//
// Four handles slide around the token's edge and mark where the arc boundaries
// land; they're mirrored left/right, so dragging one moves its opposite number
// with it and the token stays symmetric. The boundaries converge on a pivot that
// slides up and down the token's centre axis, which is what lets the arcs sit
// off-centre. Split that pivot in two and the front boundaries meet at the upper
// one while the rear boundaries meet at the lower, with the centre axis between
// them separating the left arc from the right.
//
// An edge handle's position is a single number: the perimeter coordinate. The
// whole integer picks the edge, the fraction is how far along it, running
// clockwise from the top-left corner — so the corners are exactly 0, 1, 2 and 3.
//
//        0 ────────── 1
//        │    top     │
//     left            right
//        │   bottom   │
//        3 ────────── 2
// ---------------------------------------------------------------------------

export type FiringArcs = {
  /** Front-left handle. The front-right one is always its mirror image. */
  front: number
  /** Rear-right handle. The rear-left one is always its mirror image. */
  rear: number
  /** Where the front boundaries converge, as a fraction down the centre axis. */
  frontPivot: number
  /** Where the rear boundaries converge. Only distinct from frontPivot when split. */
  rearPivot: number
  /** Two convergence points instead of one. */
  split: boolean
}

/** Order matches the points arcHandlePoints returns: clockwise from top-left. */
export const ARC_HANDLE_LABELS = ['Front left', 'Front right', 'Rear right', 'Rear left'] as const

/** Corner to corner through the middle, which is what most ships print. */
export const DEFAULT_FIRING_ARCS: FiringArcs = {
  front: 0,
  rear: 2,
  frontPivot: 0.5,
  rearPivot: 0.5,
  split: false,
}

/** The top and bottom mid-points, where a handle would meet its own mirror. */
const TOP_MIDDLE = 0.5
const BOTTOM_MIDDLE = 2.5
/** Smallest gap allowed between neighbouring handles, so an arc can't invert. */
const MIN_GAP = 0.02
/** Keeps a pivot off the very edge of the token, and the two split ones apart. */
const PIVOT_LIMIT = 0.04
const MIN_PIVOT_GAP = 0.06

const TAU = Math.PI * 2
const wrap = (p: number) => ((p % 4) + 4) % 4
const clamp = (v: number, low: number, high: number) => Math.min(Math.max(v, low), high)

/** The same position on the other side of the centre axis. Falls straight out of
 *  the perimeter coordinate: the top edge runs one way, the bottom the other. */
export const mirrorPerimeter = (p: number) => wrap(1 - p)

/** Perimeter coordinate -> a point in the token's own mm coordinate space. */
export function arcHandlePoint(p: number, width: number, height: number): { x: number; y: number } {
  const at = wrap(p)
  const edge = Math.floor(at)
  const t = at - edge
  switch (edge) {
    case 0: return { x: t * width, y: 0 }
    case 1: return { x: width, y: t * height }
    case 2: return { x: (1 - t) * width, y: height }
    default: return { x: 0, y: (1 - t) * height }
  }
}

/** All four edge handles as perimeter coordinates, clockwise from the front-left
 *  one. The two mirrored halves are derived here rather than stored. */
export function arcHandlePositions(arcs: FiringArcs): [number, number, number, number] {
  return [arcs.front, mirrorPerimeter(arcs.front), arcs.rear, mirrorPerimeter(arcs.rear)]
}

/** All four edge handles, clockwise from the front-left one. */
export function arcHandlePoints(arcs: FiringArcs, width: number, height: number) {
  return arcHandlePositions(arcs).map((p) => arcHandlePoint(p, width, height))
}

/** Where the boundaries of an arc meet: the single pivot, or its own one of the
 *  two when they're split. */
export function pivotPoint(arcs: FiringArcs, which: 'front' | 'rear', width: number, height: number) {
  const at = which === 'front' || !arcs.split ? arcs.frontPivot : arcs.rearPivot
  return { x: width / 2, y: at * height }
}

/** Every line the arcs draw: each boundary from its pivot out to its handle, plus
 *  the stretch of centre axis between the pivots when they're split apart. */
export function arcBoundaries(arcs: FiringArcs, width: number, height: number) {
  const [frontLeft, frontRight, rearRight, rearLeft] = arcHandlePoints(arcs, width, height)
  const frontHub = pivotPoint(arcs, 'front', width, height)
  const rearHub = pivotPoint(arcs, 'rear', width, height)
  const lines = [
    { from: frontHub, to: frontLeft },
    { from: frontHub, to: frontRight },
    { from: rearHub, to: rearRight },
    { from: rearHub, to: rearLeft },
  ]
  if (arcs.split) lines.push({ from: frontHub, to: rearHub })
  return lines
}

export type ArcName = 'front' | 'right' | 'rear' | 'left'

/** The two handles bounding each arc, in clockwise order. */
function arcBounds(arcs: FiringArcs, arc: ArcName): [number, number] {
  const [frontLeft, frontRight, rearRight, rearLeft] = arcHandlePositions(arcs)
  switch (arc) {
    case 'front': return [frontLeft, frontRight]
    case 'right': return [frontRight, rearRight]
    case 'rear': return [rearRight, rearLeft]
    default: return [rearLeft, frontLeft]
  }
}

/** The point an arc is measured from: its own pivot for the front and rear, and
 *  for the side arcs the middle of the axis they run along — which is the single
 *  pivot, or the midpoint between the two when they're split. */
function arcApex(arcs: FiringArcs, arc: ArcName, width: number, height: number) {
  const at =
    arc === 'front' ? arcs.frontPivot
    : arc === 'rear' ? arcs.rearPivot
    : (arcs.frontPivot + arcs.rearPivot) / 2
  return { x: width / 2, y: at * height }
}

export type PanelPlacement = {
  /** The middle of the panel's outward edge, in the token's mm space. */
  x: number
  y: number
  /** Token edge it landed on: 0 top, 1 right, 2 bottom, 3 left. */
  edge: number
  /** How far to turn the panel so its top faces away from the token. */
  rotation: number
}

/** Where an arc's hull panel sits: the point on the token edge that halves the
 *  arc as seen from its apex, so sliding a pivot carries the side panels with it.
 *  The mirroring keeps the front and rear ones on the centre axis whatever the
 *  handles do. */
export function arcPanelPlacement(arcs: FiringArcs, arc: ArcName, width: number, height: number): PanelPlacement {
  const apex = arcApex(arcs, arc, width, height)
  const [from, to] = arcBounds(arcs, arc)
  const angleTo = (p: number) => {
    const point = arcHandlePoint(p, width, height)
    return Math.atan2(point.y - apex.y, point.x - apex.x)
  }
  // Sweep clockwise from one bound to the other and take the halfway heading. Going
  // the swept way round matters: bisecting the other way would point an arc wider
  // than a half-circle at its own back.
  const start = angleTo(from)
  const sweep = (((angleTo(to) - start) % TAU) + TAU) % TAU
  const heading = start + sweep / 2
  const direction = { x: Math.cos(heading), y: Math.sin(heading) }

  // Walk out from the apex until the ray leaves the token. Whichever side it
  // crosses first *is* the edge — reading it off here beats recovering it from the
  // exit point afterwards, which can't tell which side of a corner it landed on.
  const toX = direction.x > 0 ? (width - apex.x) / direction.x : direction.x < 0 ? -apex.x / direction.x : Infinity
  const toY = direction.y > 0 ? (height - apex.y) / direction.y : direction.y < 0 ? -apex.y / direction.y : Infinity
  const t = Math.min(toX, toY)
  const edge = toX <= toY ? (direction.x > 0 ? 1 : 3) : direction.y > 0 ? 2 : 0

  return {
    x: apex.x + direction.x * t,
    y: apex.y + direction.y * t,
    edge,
    // Edges run clockwise from the top, so a quarter turn each puts the panel's
    // top on the outside. (Edge 3 turns 270°, which is the same as -90°.)
    rotation: edge * 90,
  }
}

/** Nearest point on the token's edge to an arbitrary point, as a perimeter
 *  coordinate. Points inside or outside the token both snap out to an edge. */
export function nearestPerimeterPoint(x: number, y: number, width: number, height: number): number {
  const cx = clamp(x, 0, width)
  const cy = clamp(y, 0, height)
  const distances = [cy, width - cx, height - cy, cx] // top, right, bottom, left
  const edge = distances.indexOf(Math.min(...distances))
  switch (edge) {
    case 0: return cx / width
    case 1: return 1 + cy / height
    case 2: return 2 + (width - cx) / width
    default: return 3 + (height - cy) / height
  }
}

/** Keeps a dragged handle inside the gap running clockwise from `previous` to
 *  `next`, snapping to whichever end is closer when it's dragged out of range. */
export function clampBetween(p: number, previous: number, next: number): number {
  const low = wrap(previous + MIN_GAP)
  const high = wrap(next - MIN_GAP)
  const span = wrap(high - low)
  const offset = wrap(p - low)
  if (offset <= span) return wrap(p)
  return wrap(p - high) < wrap(low - p) ? high : low
}

/** Moves the front pair. `p` is wherever the dragged handle landed; pass the
 *  right-hand one through mirrorPerimeter first. Stops at the top mid-point so
 *  the pair can meet but never cross, and at the rear pair behind it. */
export function withFrontHandle(arcs: FiringArcs, p: number): FiringArcs {
  return { ...arcs, front: clampBetween(p, mirrorPerimeter(arcs.rear), TOP_MIDDLE) }
}

export function withRearHandle(arcs: FiringArcs, p: number): FiringArcs {
  return { ...arcs, rear: clampBetween(p, mirrorPerimeter(arcs.front), BOTTOM_MIDDLE) }
}

/** Slides a pivot along the centre axis. When they're split the front one stays
 *  above the rear one; when they aren't, both move together. */
export function withPivot(arcs: FiringArcs, which: 'front' | 'rear', at: number): FiringArcs {
  const limited = clamp(at, PIVOT_LIMIT, 1 - PIVOT_LIMIT)
  if (!arcs.split) return { ...arcs, frontPivot: limited, rearPivot: limited }
  return which === 'front'
    ? { ...arcs, frontPivot: Math.min(limited, arcs.rearPivot - MIN_PIVOT_GAP) }
    : { ...arcs, rearPivot: Math.max(limited, arcs.frontPivot + MIN_PIVOT_GAP) }
}

/** Turning the split on pulls the pivots apart around where the single one sat,
 *  so both handles are grabbable; turning it off collapses them back to one. */
export function withSplit(arcs: FiringArcs, split: boolean): FiringArcs {
  if (!split) return { ...arcs, split: false, rearPivot: arcs.frontPivot }
  if (arcs.rearPivot - arcs.frontPivot >= MIN_PIVOT_GAP) return { ...arcs, split: true }
  const middle = (arcs.frontPivot + arcs.rearPivot) / 2
  return {
    ...arcs,
    split: true,
    frontPivot: clamp(middle - MIN_PIVOT_GAP, PIVOT_LIMIT, 1 - PIVOT_LIMIT - MIN_PIVOT_GAP * 2),
    rearPivot: clamp(middle + MIN_PIVOT_GAP, PIVOT_LIMIT + MIN_PIVOT_GAP * 2, 1 - PIVOT_LIMIT),
  }
}
