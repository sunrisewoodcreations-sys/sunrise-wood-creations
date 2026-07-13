-- Lets a saved product (like "36x18x18 Cedar Planter Box") know how
-- many pickets it uses by default, so new orders linked to it get
-- costed automatically instead of you entering it by hand each time.
alter table products add column if not exists default_pickets_used integer not null default 0;
