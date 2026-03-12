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
