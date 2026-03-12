# Avalon Realtime Assistant -- TRD

## 1. Project Overview

Avalon Realtime Assistant is a PWA tool that synchronizes gameplay for
the social deduction board game *The Resistance: Avalon*.

Goals: - No installation required - Players join using room code or QR -
Supports 5--10 players - Automates rule enforcement - Real‑time
synchronization

------------------------------------------------------------------------

## 2. System Architecture

PWA Client (React + Vite + TypeScript) │ │ Realtime Sync ▼ Firebase
Realtime Database │ │ Hosting ▼ Cloudflare Pages

Technology stack:

Frontend - React - Vite - TypeScript - TailwindCSS

Backend - Firebase Realtime Database

Hosting - Cloudflare Pages

PWA - vite-plugin-pwa

------------------------------------------------------------------------

## 3. Core Features

1.  Create room
2.  Join room
3.  Player ready system
4.  Role distribution
5.  Leader rotation
6.  Team selection
7.  Team voting
8.  Mission voting
9.  Mission resolution
10. Fourth round double fail rule
11. Assassin phase
12. Game result screen

------------------------------------------------------------------------

## 4. Game State Machine

States:

LOBBY ROLE_REVEAL TEAM_SELECTION TEAM_VOTING MISSION_VOTING ROUND_RESULT
ASSASSINATION GAME_END

Flow:

LOBBY → ROLE_REVEAL → TEAM_SELECTION → TEAM_VOTING → MISSION_VOTING →
ROUND_RESULT → TEAM_SELECTION

If GOOD wins 3 missions → ASSASSINATION

------------------------------------------------------------------------

## 5. Database Schema

rooms/ roomId hostId state round leaderIndex players roles team votes
missionVotes history score result

Player:

id name ready role

Example:

players: p1: name: Robin ready: true role: Merlin

------------------------------------------------------------------------

## 6. Mission Configuration

  Players   R1   R2   R3   R4   R5
  --------- ---- ---- ---- ---- ----
  5         2    3    2    3    3
  6         2    3    4    3    4
  7         2    3    3    4    4
  8         3    4    4    5    5
  9         3    4    4    5    5
  10        3    4    4    5    5

------------------------------------------------------------------------

## 7. Special Rule

If:

round == 4 AND playerCount \>= 7

Then mission fails only if:

failVotes \>= 2

Otherwise:

failVotes \>= 1

------------------------------------------------------------------------

## 8. Role Assignment

Roles generated based on player count.

Algorithm:

roles = generateRoleList(playerCount) shuffle(roles) assign sequentially

------------------------------------------------------------------------

## 9. Leader Rotation

leaderIndex = (leaderIndex + 1) % players.length

------------------------------------------------------------------------

## 10. Mission Resolution

if round == 4 and playerCount \>= 7: failVotes \>= 2 → mission fail
else: failVotes \>= 1 → mission fail

------------------------------------------------------------------------

## 11. Assassination Phase

If goodWins == 3:

Assassin selects target.

if target == Merlin: Evil wins else: Good wins

------------------------------------------------------------------------

## 12. UI Pages

Home Lobby Role Reveal Game Screen Result

------------------------------------------------------------------------

## 13. Deployment

Build:

npm run build

Deploy to Cloudflare Pages
