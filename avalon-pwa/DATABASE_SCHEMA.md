# Realtime Database schema (Avalon)

All game data lives under **`rooms/{roomId}`**. The app creates this structure when a room is created; there is no separate schema to apply in Firebase.

## Structure

```
rooms
 └ {roomId}
     ├ hostId          (string)  – creator's player id
     ├ state           (string)  – LOBBY | ROLE_REVEAL | TEAM_SELECTION | TEAM_VOTING | MISSION_VOTING | ROUND_RESULT | ASSASSINATION | GAME_END
     ├ round           (number)  – 1–5, current mission round
     ├ leaderIndex     (number)  – index into sorted player ids
     ├ players         (object)  – { [playerId]: { name, ready, role, reconnectToken, uid? } }
     ├ roles           (object)  – { [playerId]: roleName }  (after start game)
     ├ team            (array)   – selected player ids for current mission (when state = TEAM_VOTING / MISSION_VOTING)
     ├ votes           (object)  – { [playerId]: "approve"|"reject" }  (team vote)
     ├ missionVotes    (object)  – { [playerId]: "success"|"fail" }   (mission vote, only team members)
     ├ history         (array)  – [ { round, success }, ... ]
     ├ score           (object)  – { good: number, evil: number }
     ├ result          (string?) – "good"|"evil" (when state = GAME_END)
     └ missionSuccess  (bool?)  – set on ROUND_RESULT for display, then next state
```

### Player identity (`players/{playerId}`)

| Field | Notes |
|-------|--------|
| `uid` | Firebase Auth uid (anonymous by default). Binds the seat to an account so reconnect survives localStorage loss. Older rooms may lack this field; local `playerId` / `reconnectToken` still work. |
| `reconnectToken` | Shareable one-time reconnect link fallback |
| `lastSeen` | Client heartbeat timestamp (`Date.now()`). Missing or older than ~75s ⇒ treated as offline for nickname reclaim UI. |
| `seatGeneration` | Integer bumped on nickname/token reclaim. Old clients watching a lower generation exit as “座位已在其他设备恢复”. |

### Active games index

```
users/{uid}/activeGames/{game}_{roomId}
  game: "avalon" | "undercover" | "ninja"
  roomId: string
  playerId: string
  isHost: boolean
  updatedAt: number
```

Written on create/join/reconnect; cleared on leave lobby, kick, game end, or intentional force-exit.

Security rules require `auth != null` for room paths. `users/$uid` is readable/writable only by that uid. Per-player write scoping can be tightened later without changing this shape.

Security rules in `database.rules.json` allow read/write under `rooms` for authenticated clients. Deploy with:

```bash
firebase deploy --only database
```

## Night of the Ninja (`ninjaRooms/{roomId}`)

```
ninjaRooms
 └ {roomId}
     ├ hostId                 (string)
     ├ state                  (string) – LOBBY | HOUSE_REVEAL | DRAFT_PICK_1 | DRAFT_PICK_2 |
     │                                    NIGHT_SPY | NIGHT_MYSTIC | NIGHT_TRICKSTER |
     │                                    NIGHT_BLIND_ASSASSIN | NIGHT_SHINOBI | NIGHT_MASTERMIND |
     │                                    REVEAL | GAME_END
     ├ round                  (number)
     ├ targetPlayerCount      (number) – host-selected player count for the next game, 4-11
     ├ players                (object) – { [playerId]: NinjaPlayer }
     ├ seatOrder              (array)  – clockwise seated player ids frozen at game start; drives draft passing and tie-breaks
     ├ seatAssignments        (object) – { [playerId]: seatIndex } lobby seat positions (0-10)
     ├ houseCardAssignments   (object) – { [playerId]: HouseCard }
     ├ publiclyRevealedHouseIds (array) – house cards publicly exposed this round
     ├ tokenBag               (array)  – remaining honor tokens (shuffled at game start)
     ├ ninjaDiscardPile       (array)  – cards discarded this game
     ├ currentNight           (object?) – per-phase resolution state with pendingAction / reactive window
     ├ mastermindRevealedAliveIds (array) – alive Mastermind owners that block normal scoring
     ├ reveal                 (object?) – per-round reveal summary
     ├ resultWinnerIds        (array?)  – set on GAME_END
     ├ serverTimeOffset       (number) – reserved for client clock offset / timed windows
     └ privateState           (object) – { [playerId]: { current: NinjaPrivateRoundState } }
```

`seatAssignments` stores the lobby table position. Players may choose any empty seat before
readying; once ready, their seat is locked. At game start, `seatOrder` is derived from
`seatAssignments` and becomes the authoritative order for draft passing (“left neighbor”) and
same-priority resolution ties.

Per-player private info (spy/mystic/shinobi/trickster peeks) lives under `privateState/{playerId}/current`
so each client can subscribe to only their own subtree.
