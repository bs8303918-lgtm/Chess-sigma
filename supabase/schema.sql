create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  elo integer not null default 1200,
  aura_points integer not null default 0,
  current_title text not null default 'Fresh Sigma',
  created_at timestamptz not null default now()
);

create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  rarity text not null check (rarity in ('Common', 'Rare', 'Epic', 'Legendary')),
  image_url text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.user_cards (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  card_id uuid not null references public.cards(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.games (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  pgn text not null,
  result text not null check (result in ('white', 'black', 'draw')),
  verdict text not null,
  title text not null,
  aura_delta integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.matchmaking_queue (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  time_control text not null check (time_control in ('10|0', '3|2', '5|5')),
  created_at timestamptz not null default now(),
  unique (user_id, time_control)
);

create table if not exists public.online_matches (
  id uuid primary key default gen_random_uuid(),
  white_user_id uuid not null references public.profiles(id) on delete cascade,
  black_user_id uuid not null references public.profiles(id) on delete cascade,
  time_control text not null check (time_control in ('10|0', '3|2', '5|5')),
  status text not null default 'active' check (status in ('active', 'finished', 'aborted')),
  result text check (result in ('white', 'black', 'draw')),
  pgn text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

alter table public.profiles enable row level security;
alter table public.cards enable row level security;
alter table public.user_cards enable row level security;
alter table public.games enable row level security;
alter table public.matchmaking_queue enable row level security;
alter table public.online_matches enable row level security;

create policy "profiles_select_self" on public.profiles
for select using (auth.uid() = id);

create policy "profiles_update_self" on public.profiles
for update using (auth.uid() = id);

create policy "profiles_insert_self" on public.profiles
for insert with check (auth.uid() = id);

create policy "cards_public_read" on public.cards
for select using (true);

create policy "user_cards_select_self" on public.user_cards
for select using (auth.uid() = user_id);

create policy "user_cards_insert_self" on public.user_cards
for insert with check (auth.uid() = user_id);

create policy "games_select_self" on public.games
for select using (auth.uid() = user_id);

create policy "games_insert_self" on public.games
for insert with check (auth.uid() = user_id);

create policy "queue_select_self" on public.matchmaking_queue
for select using (auth.uid() = user_id);

create policy "queue_insert_self" on public.matchmaking_queue
for insert with check (auth.uid() = user_id);

create policy "queue_delete_self" on public.matchmaking_queue
for delete using (auth.uid() = user_id);

create policy "matches_select_players" on public.online_matches
for select using (auth.uid() = white_user_id or auth.uid() = black_user_id);

create policy "matches_insert_players" on public.online_matches
for insert with check (auth.uid() = white_user_id or auth.uid() = black_user_id);

create policy "matches_update_players" on public.online_matches
for update using (auth.uid() = white_user_id or auth.uid() = black_user_id);

create or replace function public.join_matchmaking(p_time_control text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_uid uuid := auth.uid();
  opponent_id uuid;
  match_id uuid;
  current_is_white boolean;
begin
  if current_uid is null then
    raise exception 'Unauthorized';
  end if;

  insert into public.matchmaking_queue (user_id, time_control)
  values (current_uid, p_time_control)
  on conflict (user_id, time_control) do update set created_at = now();

  select user_id into opponent_id
  from public.matchmaking_queue
  where time_control = p_time_control and user_id <> current_uid
  order by created_at asc
  limit 1;

  if opponent_id is null then
    return null;
  end if;

  current_is_white := random() > 0.5;
  insert into public.online_matches (white_user_id, black_user_id, time_control)
  values (
    case when current_is_white then current_uid else opponent_id end,
    case when current_is_white then opponent_id else current_uid end,
    p_time_control
  )
  returning id into match_id;

  delete from public.matchmaking_queue where user_id in (current_uid, opponent_id) and time_control = p_time_control;
  return match_id;
end;
$$;

insert into public.cards (name, rarity, image_url) values
('Sigma Knight', 'Common', 'https://images.unsplash.com/photo-1528819622765-d6bcf132f793?auto=format&fit=crop&w=900&q=80'),
('Aura Bishop', 'Common', 'https://images.unsplash.com/photo-1586165368502-1bad197a6461?auto=format&fit=crop&w=900&q=80'),
('Risk Rook', 'Rare', 'https://images.unsplash.com/photo-1611195974226-a6a9be9dd763?auto=format&fit=crop&w=900&q=80'),
('Skubidu Queen', 'Epic', 'https://images.unsplash.com/photo-1560179406-1c6c60e0dc76?auto=format&fit=crop&w=900&q=80'),
('GigaChad King', 'Legendary', 'https://images.unsplash.com/photo-1594752730019-5af2f2c4f808?auto=format&fit=crop&w=900&q=80')
on conflict (name) do nothing;
