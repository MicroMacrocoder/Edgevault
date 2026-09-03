-- Remove the old grouped Treasury auction calendar rows.
-- The updated sync creates one row per official auction/CUSIP.
delete from public.economic_events
where external_id like 'treasury:015-BFS-2014Q3-045:%';
