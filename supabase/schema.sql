-- Owlery schema for a two-person project. Paste into Supabase > SQL Editor and run once.
-- Safe to re-run: everything uses "if not exists" / "or replace".
-- Before running, in Authentication > Providers > Email: turn OFF "Allow new users to sign up",
-- then invite the two of you from Authentication > Users. That is what keeps strangers out.

create table if not exists couple_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  slot    text not null unique check (slot in ('a','b')),
  name    text not null
);

create or replace function my_slot() returns text
language sql stable security definer set search_path = public as
$$ select slot from couple_members where user_id = auth.uid() $$;

create table if not exists events (
  id text primary key, who text not null check (who in ('a','b')), day date not null,
  s int not null check (s between 0 and 1440), e int not null check (e between 0 and 1440 and e > s),
  title text not null check (char_length(title) <= 40), descr text not null default '' check (char_length(descr) <= 160),
  kind text not null default 'busy' check (kind in ('busy','maybe')), created_at timestamptz not null default now()
);
create table if not exists day_plans (
  day date primary key, type text not null default '' , note text not null default '' check (char_length(note) <= 200),
  dinner_chosen text not null default '', votes jsonb not null default '{"a":"","b":""}'
);
create table if not exists meals ( name text primary key check (char_length(name) <= 30) );
create table if not exists pings (
  id bigint primary key, by text not null check (by in ('a','b')),
  t timestamptz not null default now(), body text not null default '' check (char_length(body) <= 140),
  mood text not null default '', gif text not null default '', photo text not null default ''
);
create table if not exists notes (
  id bigint primary key, by text not null check (by in ('a','b')),
  t timestamptz not null default now(), body text not null default '' check (char_length(body) <= 160),
  img text not null default '', read boolean not null default false
);
create table if not exists bible (
  day date not null, who text not null check (who in ('a','b')), passage text not null default '', done boolean not null default false,
  primary key (day, who)
);
-- filled from Lock In (counts only: no task titles leave Lock In)
create table if not exists plate (
  day date not null, who text not null check (who in ('a','b')), total int not null default 0, done int not null default 0,
  updated_at timestamptz not null default now(), primary key (day, who)
);

-- Shared little settings (for example the "next visit" countdown).
create table if not exists settings ( key text primary key, value jsonb );

-- Upgrades for tables created by an earlier version of this file (safe to run again):
alter table events add column if not exists rep  text   not null default 'none';
alter table events add column if not exists days int[]  not null default '{}';
alter table events add column if not exists skip date[] not null default '{}';
alter table events add column if not exists until date;
alter table notes  add column if not exists kind text   not null default '';
-- the app makes its own ids so a note or owl post can be saved offline and synced later
alter table pings alter column id drop identity if exists;
alter table notes alter column id drop identity if exists;

-- Row level security: only the two members can touch anything; you can only write your own rows.
do $$ declare t text; begin
  foreach t in array array['couple_members','events','day_plans','meals','pings','notes','bible','plate','settings'] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

drop policy if exists read_members on couple_members;
create policy read_members on couple_members for select using (my_slot() is not null);

-- shared-edit tables (either of you can change them)
do $$ declare t text; begin
  foreach t in array array['day_plans','meals','settings'] loop
    execute format('drop policy if exists shared_all on %I', t);
    execute format('create policy shared_all on %I for all using (my_slot() is not null) with check (my_slot() is not null)', t);
  end loop;
end $$;

-- own-row tables
do $$ declare t text; c text; begin
  for t, c in select * from (values ('events','who'),('pings','by'),('bible','who'),('plate','who')) v(t,c) loop
    execute format('drop policy if exists own_read on %I', t);
    execute format('drop policy if exists own_write on %I', t);
    execute format('create policy own_read on %I for select using (my_slot() is not null)', t);
    execute format('create policy own_write on %I for all using (%I = my_slot()) with check (%I = my_slot())', t, c, c);
  end loop;
end $$;

-- notes: read both ways, send as yourself, and only the recipient may mark a note read
drop policy if exists notes_read on notes; drop policy if exists notes_send on notes; drop policy if exists notes_mark on notes; drop policy if exists notes_del on notes;
create policy notes_read on notes for select using (my_slot() is not null);
create policy notes_send on notes for insert with check (by = my_slot());
create policy notes_mark on notes for update using (by <> my_slot() and my_slot() is not null) with check (by <> my_slot());
create policy notes_del  on notes for delete using (by = my_slot());

-- live updates between your two phones
do $$ declare t text; begin
  foreach t in array array['events','day_plans','meals','pings','notes','bible','plate','settings'] loop
    begin execute format('alter publication supabase_realtime add table %I', t);
    exception when duplicate_object then null; end;
  end loop;
end $$;

-- Let signed-in users (and ONLY signed-in users, never the anonymous role) reach these tables.
-- Some Supabase projects no longer expose new tables automatically, so grant it explicitly.
-- Row level security above still decides which rows each of you can see or change.
revoke all on couple_members, events, day_plans, meals, pings, notes, bible, plate, settings from anon;
grant select on couple_members to authenticated;
grant select, insert, update, delete on events, day_plans, meals, pings, notes, bible, plate, settings to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on function my_slot() to authenticated;

-- LAST STEP. First create both accounts: Authentication > Users > Add user > Create new user
-- (tick "Auto Confirm User" and choose your own passwords there; they never need to be shared).
-- Then run this once, replacing the two emails with the ones you used. It looks the accounts up for you:
--
-- insert into couple_members (user_id, slot, name)
--   select id, 'a', 'YOUR-NAME'    from auth.users where email = 'YOUR-EMAIL-HERE'
--   union all
--   select id, 'b', 'PARTNER-NAME' from auth.users where email = 'PARTNER-EMAIL-HERE'
-- on conflict do nothing;
