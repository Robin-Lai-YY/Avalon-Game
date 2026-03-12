# Avalon Realtime Assistant -- Development Tasks

## Phase 1 -- Project Setup

Task 1 Create Vite React project with TypeScript.

Task 2 Install dependencies:

react firebase tailwindcss vite-plugin-pwa

Task 3 Configure TailwindCSS.

Task 4 Configure vite-plugin-pwa.

------------------------------------------------------------------------

## Phase 2 -- Firebase Setup

Task 5 Create Firebase project.

Task 6 Enable Realtime Database.

Task 7 Create firebase.ts service for initialization.

------------------------------------------------------------------------

## Phase 3 -- Room System

Task 8 Implement createRoom()

Responsibilities: - generate roomId - create room in database

Task 9 Implement joinRoom(roomId, name)

Task 10 Implement Lobby UI.

Task 11 Implement ready toggle.

------------------------------------------------------------------------

## Phase 4 -- Role System

Task 12 Implement generateRoles(playerCount)

Task 13 Implement shuffle()

Task 14 Assign roles to players.

Task 15 Create Role Reveal page.

------------------------------------------------------------------------

## Phase 5 -- Leader System

Task 16 Implement leader rotation.

------------------------------------------------------------------------

## Phase 6 -- Team Selection

Task 17 Build TeamSelector component.

Task 18 Save selected team to database.

------------------------------------------------------------------------

## Phase 7 -- Voting

Task 19 Implement team voting.

Task 20 Count votes.

If approve \> reject → mission proceeds.

Else → rotate leader.

------------------------------------------------------------------------

## Phase 8 -- Mission System

Task 21 Mission voting UI.

Task 22 Submit mission vote.

Task 23 Resolve mission result.

Task 24 Store round history.

------------------------------------------------------------------------

## Phase 9 -- Assassination

Task 25 Detect good victory.

Task 26 Show assassin UI.

Task 27 Determine final winner.

------------------------------------------------------------------------

## Phase 10 -- Result Screen

Task 28 Display winner.

Task 29 Display round history.

------------------------------------------------------------------------

## Phase 11 -- Enhancements

Task 30 Add QR code room join.

Task 31 Add mobile responsive UI.

Task 32 Add small UI animations.
