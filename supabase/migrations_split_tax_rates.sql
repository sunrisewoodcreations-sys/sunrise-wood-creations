-- Splits the old single "tax set-aside %" into two separate, clearly
-- labeled rates: Michigan's real flat state income tax rate (accurate
-- and calculable — 4.25% as of the 2026 tax year), and a federal rate
-- you set yourself (federal income tax genuinely depends on your total
-- income and filing status, so it stays an adjustable estimate).
alter table report_settings add column if not exists michigan_income_tax_percent numeric not null default 4.25;
alter table report_settings add column if not exists federal_income_tax_percent numeric not null default 15.3;
