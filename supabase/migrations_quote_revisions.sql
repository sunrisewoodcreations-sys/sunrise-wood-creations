-- Quote revisions. Deliberately minimal: one new column, no new
-- tables. quote_number + quote_year already uniquely identify a
-- "lineage" of a quote across every revision, so that's reused
-- directly as the grouping key instead of adding a new link column.
-- viewed_at already exists per row, and since each revision is its own
-- row, per-revision view tracking comes for free with no new column.
alter table quotes add column if not exists revision_number integer not null default 1;
