-- Admin-only tracking of outsourced cornhole tops and frames.
alter table orders add column if not exists tops_status text not null default 'not_ordered'
  check (tops_status in ('not_ordered','ordered','shipped','received'));
alter table orders add column if not exists frames_status text not null default 'not_ordered'
  check (frames_status in ('not_ordered','ordered','shipped','received'));
alter table orders add column if not exists tops_status_at timestamptz;
alter table orders add column if not exists frames_status_at timestamptz;
