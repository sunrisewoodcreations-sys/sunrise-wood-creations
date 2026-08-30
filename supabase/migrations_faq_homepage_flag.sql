-- Lets an admin choose, per FAQ, whether it should also appear in the
-- homepage's FAQ teaser section — separate from `is_public` (which
-- controls the full FAQ/product-page listing) and separate from
-- `category` (which controls which product page it shows on). A
-- question can be public and categorized without ever appearing on
-- the homepage, and vice versa.
--
-- Defaults to false so every existing FAQ keeps its current behavior
-- exactly as-is — nothing is added to the homepage automatically,
-- an admin has to opt each one in explicitly.
alter table faq_questions
  add column if not exists show_on_homepage boolean not null default false;
