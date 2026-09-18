-- Adds state needed for repeatable rounds to the existing public.rooms table.
-- This game uses the Supabase anon key in the browser; never put a service-role key there.
alter table public.rooms
  add column if not exists round_number integer not null default 1,
  add column if not exists last_winner text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'rooms_room_code_unique') then
    alter table public.rooms add constraint rooms_room_code_unique unique (room_code);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'rooms_secret_number_range') then
    alter table public.rooms add constraint rooms_secret_number_range check (secret_number between 0 and 20);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'rooms_player1_score_nonnegative') then
    alter table public.rooms add constraint rooms_player1_score_nonnegative check (player1_score >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'rooms_player2_score_nonnegative') then
    alter table public.rooms add constraint rooms_player2_score_nonnegative check (player2_score >= 0);
  end if;
end $$;

-- The browser needs to create, discover, join, and update rooms. These policies are
-- deliberately limited to this demo's shared-room model; use Supabase Auth and an
-- RPC function for production-grade identity and server-enforced score validation.
alter table public.rooms enable row level security;

drop policy if exists "public can read game rooms" on public.rooms;
drop policy if exists "public can create game rooms" on public.rooms;
drop policy if exists "public can update game rooms" on public.rooms;
create policy "public can read game rooms" on public.rooms for select to anon, authenticated using (true);
create policy "public can create game rooms" on public.rooms for insert to anon, authenticated with check (
  room_code ~ '^[A-Z0-9]{1,8}$' and secret_number between 0 and 20
);
create policy "public can update game rooms" on public.rooms for update to anon, authenticated using (true) with check (
  secret_number between 0 and 20 and player1_score >= 0 and player2_score >= 0
);
