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
     ├ players         (object)  – { [playerId]: { name, ready, role } }
     ├ roles           (object)  – { [playerId]: roleName }  (after start game)
     ├ team            (array)   – selected player ids for current mission (when state = TEAM_VOTING / MISSION_VOTING)
     ├ votes           (object)  – { [playerId]: "approve"|"reject" }  (team vote)
     ├ missionVotes    (object)  – { [playerId]: "success"|"fail" }   (mission vote, only team members)
     ├ history         (array)  – [ { round, success }, ... ]
     ├ score           (object)  – { good: number, evil: number }
     ├ result          (string?) – "good"|"evil" (when state = GAME_END)
     └ missionSuccess  (bool?)  – set on ROUND_RESULT for display, then next state
```

Security rules in `database.rules.json` allow read/write under `rooms` for development. Deploy with:

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
