/** Number of impeller blades in the roundel. Six divides the circle evenly and
 *  still reads as separate blades at favicon size; eight turns to mush. */
const BLADES = 6

/** One blade, drawn pointing straight up from the hub. Every other blade is this
 *  path rotated about the centre, so the shape only has to be got right once. */
const BLADE =
  'M32 25.5 C 39.5 23.5 44.5 17 41.5 8.5 C 37 14.5 33 18 32 25.5 Z'

/**
 * The Corellian Engineering Corporation roundel: a segmented outer ring around a
 * six-blade impeller. Drawn rather than shipped as an image so it stays crisp at
 * any size and inherits the surrounding ink through `currentColor` — the topbar
 * hands it the rust accent, and it dims with the rest of the chrome on hover.
 */
export function CecMark({ size = 26, className }: { size?: number; className?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="Corellian Engineering Corporation"
      fill="none"
    >
      {/* Outer ring, broken at the poles. The dash pattern is sized off the
          circumference (2πr ≈ 182 at r=29) so the two gaps land top and bottom. */}
      <circle
        cx="32" cy="32" r="29"
        stroke="currentColor" strokeWidth="3.4"
        strokeDasharray="84 7" strokeDashoffset="45.5"
      />
      {/* Inner containment ring — thinner, and held back so the blades read as
          sitting inside it rather than touching it. */}
      <circle cx="32" cy="32" r="23.5" stroke="currentColor" strokeWidth="1.3" opacity=".55" />

      <g fill="currentColor">
        {Array.from({ length: BLADES }, (_, i) => (
          <path key={i} d={BLADE} transform={`rotate(${(360 / BLADES) * i} 32 32)`} />
        ))}
      </g>

      {/* Hub: a filled core with a bitten-out centre, so the blades converge on a
          ring rather than a blob. */}
      <circle cx="32" cy="32" r="5.6" fill="currentColor" />
      <circle cx="32" cy="32" r="2.4" fill="var(--void, #14100c)" />
    </svg>
  )
}

/** A wrench, shown beside the name of anything that is stubbed out rather than
 *  built. Inherits its colour, so the disabled styling carries it. */
export function WrenchMark({ size = 11, className }: { size?: number; className?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10.4 1.6a4.2 4.2 0 0 0-4.9 5.3L1.7 10.7a1.6 1.6 0 0 0 2.3 2.3l3.8-3.8a4.2 4.2 0 0 0 5.3-4.9l-2.2 2.2-2.4-.6-.6-2.4z" />
    </svg>
  )
}
