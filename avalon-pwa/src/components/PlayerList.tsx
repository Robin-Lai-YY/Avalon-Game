export type Player = {
  name: string
  ready: boolean
  role: string
}

type PlayerListProps = {
  players: Record<string, Player>
}

export function PlayerList({ players }: PlayerListProps) {
  const entries = Object.entries(players ?? {})
  return (
    <ul className="list-none p-0 space-y-2">
      {entries.map(([id, p]) => (
        <li key={id} className="flex items-center gap-2">
          <span>{p.name}</span>
          {p.ready && <span aria-hidden>✔</span>}
        </li>
      ))}
    </ul>
  )
}
