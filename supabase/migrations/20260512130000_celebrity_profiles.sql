alter table public.profiles
  add column if not exists is_celebrity boolean not null default false,
  add column if not exists celebrity_score integer not null default 0;

create index if not exists profiles_celebrity_score_idx
  on public.profiles (is_celebrity, celebrity_score desc);
