# Guess the Number — two-player realtime game

A lightweight browser game for two people in the same Supabase room. Players share a room code, each submits guesses from **0–20**, and the first correct guess gets a point. A correct answer immediately creates the next round and broadcasts the refreshed scoreboard to both browsers.

## What you need

- A [Supabase](https://supabase.com) project.
- An existing `public.rooms` table with these columns: `id`, `room_code`, `player1_name`, `player2_name`, `secret_number`, `player1_score`, and `player2_score`.
- Realtime enabled for `public.rooms` (as noted in the project setup).

## Supabase setup

1. In the Supabase SQL Editor, run `supabase/migrations/20260918000000_multiplayer_rooms.sql`. It adds `round_number` and `last_winner`, validation constraints, a unique room-code constraint, and the Row Level Security policies required by the browser client.
2. Confirm that `rooms` is included in the `supabase_realtime` publication. In the dashboard, open **Database → Replication** and enable the table if necessary.
3. Go to **Project Settings → API** and copy the Project URL plus the **anon / publishable** key.
4. In `app.js`, replace `YOUR_SUPABASE_URL` and `YOUR_SUPABASE_ANON_KEY` with those values.

> **Security:** only the project URL and anon/publishable key belong in `app.js`. Never expose a `service_role` key in browser code. The included policies make this simple no-login shared-room demo work. For a production game, add Supabase Auth and move the score-changing operation to a database RPC function so the server can enforce player identity.

## Run locally

This is a static frontend, so serve the repository directory with any static server. For example:

```bash
python3 -m http.server 4173
```

Then open [http://localhost:4173](http://localhost:4173) in two browser windows (or on two devices), enter the same room code, and use different names. The first visitor creates the room; the second visitor fills the open player slot.

## Game flow

1. Use the automatically generated room code or type your own, then enter a name.
2. Share that code with one other player.
3. Once both players join, each can guess a whole number from 0 through 20.
4. A lower or higher guess receives immediate feedback. The first correct guess increments that player’s score, advances the round, and generates a new secret number.
