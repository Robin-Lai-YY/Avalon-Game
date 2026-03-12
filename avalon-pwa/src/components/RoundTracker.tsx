type RoundTrackerProps = {
  round: number
}

export function RoundTracker({ round }: RoundTrackerProps) {
  return (
    <p className="text-lg font-semibold">
      Round: {round}
    </p>
  )
}
