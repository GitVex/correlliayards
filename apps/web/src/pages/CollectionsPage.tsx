import { Placeholder } from './Placeholder'

export function CollectionsPage() {
  return (
    <Placeholder
      title="Your collections"
      lead="Ordered sets of cards — a fleet, a supplement, a print run — each publishable as one link."
      feeds="GET /api/collections"
    />
  )
}
