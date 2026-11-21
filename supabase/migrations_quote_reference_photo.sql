-- Optional reference photo a customer can attach to a quote request.
alter table quote_requests add column if not exists reference_photo_url text;
