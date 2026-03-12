type LeaderIndicatorProps = {
  leaderName: string
}

export function LeaderIndicator({ leaderName }: LeaderIndicatorProps) {
  return (
    <p className="text-lg font-semibold">
      Leader: {leaderName}
    </p>
  )
}
