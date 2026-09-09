insert into public.economic_event_series (
  series_key, name, country, currency, category, event_kind, frequency, unit,
  official_source_name, official_source_url, source_connector, base_impact_score,
  ranking_notes, is_active, metadata
)
select
  item.series_key, item.name, item.country, item.currency, item.category, item.event_kind,
  item.frequency, item.unit, item.source_name, item.source_url, item.connector, item.impact,
  item.notes, true, item.metadata::jsonb
from (values
  ('eur-national-at','Austria National Statistical Releases','Austria','EUR','National Statistics','data','Irregular',null,'Statistics Austria','https://www.statistik.at/en/','euro-national',55,'Official Austria release-calendar events; numeric values are not copied until a public feed is verified.'::text,'{"calendar_only":true,"values_not_synced":true,"calendar_url":"https://www.statistik.at/en/"}'::text),
  ('eur-national-be','Belgium National Statistical Releases','Belgium','EUR','National Statistics','data','Irregular',null,'Statbel','https://statbel.fgov.be/en/','euro-national',55,'Official Belgium release-calendar events; numeric values are not copied until a public feed is verified.'::text,'{"calendar_only":true,"values_not_synced":true,"calendar_url":"https://statbel.fgov.be/en/"}'::text),
  ('eur-national-bg','Bulgaria National Statistical Releases','Bulgaria','EUR','National Statistics','data','Irregular',null,'National Statistical Institute of Bulgaria','https://www.nsi.bg/en/','euro-national',55,'Official Bulgaria release-calendar events; numeric values are not copied until a public feed is verified.'::text,'{"calendar_only":true,"values_not_synced":true,"calendar_url":"https://www.nsi.bg/en/calendar"}'::text),
  ('eur-national-nl','Netherlands National Statistical Releases','Netherlands','EUR','National Statistics','data','Irregular',null,'Statistics Netherlands (CBS)','https://www.cbs.nl/en-gb','euro-national',70,'Official Netherlands release-calendar and news events; actual/previous values are attached from verified official Eurostat country series where supported.'::text,'{"calendar_only":false,"values_source":"official_eurostat_country_statistics_api","calendar_url":"https://www.cbs.nl/en-gb/publication-calendar","release_url":"https://www.cbs.nl/en-gb/news"}'::text),
  ('eur-national-es','Spain National Statistical Releases','Spain','EUR','National Statistics','data','Irregular',null,'National Statistics Institute of Spain (INE)','https://www.ine.es/en/','euro-national',70,'Official Spain release-calendar and press-release events; actual/previous values are attached from verified official Eurostat country series where supported.'::text,'{"calendar_only":false,"values_source":"official_eurostat_country_statistics_api","calendar_url":"https://www.ine.es/dynt3/Calendario/en/calenHTML.htm","release_url":"https://www.ine.es/dyngs/Prensa/en/notasPrensa.htm"}'::text),
  ('eur-national-it','Italy National Statistical Releases','Italy','EUR','National Statistics','data','Irregular',null,'Italian National Institute of Statistics (Istat)','https://www.istat.it/en/','euro-national',70,'Official Italy press-calendar and press-release events; actual/previous values are attached from verified official Eurostat country series where supported.'::text,'{"calendar_only":false,"values_source":"official_eurostat_country_statistics_api","calendar_url":"https://www.istat.it/en/information-and-services-for-users/journalists/press-releases/press-calendar/","release_url":"https://www.istat.it/en/information-and-services-for-users/journalists/press-releases/"}'::text),
  ('eur-national-ee','Estonia National Statistical Releases','Estonia','EUR','National Statistics','data','Irregular',null,'Statistics Estonia','https://stat.ee/en/','euro-national',50,'Official Estonia release-calendar events; numeric values are not copied until a public feed is verified.'::text,'{"calendar_only":true,"values_not_synced":true,"calendar_url":"https://stat.ee/en/calendar"}'::text),
  ('eur-national-fi','Finland National Statistical Releases','Finland','EUR','National Statistics','data','Irregular',null,'Statistics Finland','https://stat.fi/en/','euro-national',60,'Official Finland release-calendar events; numeric values are not copied until a public feed is verified.'::text,'{"calendar_only":true,"values_not_synced":true,"calendar_url":"https://stat.fi/en/future-releases"}'::text),
  ('eur-national-ie','Ireland National Statistical Releases','Ireland','EUR','National Statistics','data','Irregular',null,'Central Statistics Office (CSO)','https://www.cso.ie/en/','euro-national',60,'Official Ireland release-calendar events; numeric values are not copied until a public feed is verified.'::text,'{"calendar_only":true,"values_not_synced":true,"calendar_url":"https://www.cso.ie/en/csolatestnews/releasecalendar/"}'::text),
  ('eur-national-si','Slovenia National Statistical Releases','Slovenia','EUR','National Statistics','data','Irregular',null,'Statistical Office of the Republic of Slovenia','https://www.stat.si/StatWeb/en/','euro-national',55,'Official Slovenia release-calendar events; numeric values are not copied until a public feed is verified.'::text,'{"calendar_only":true,"values_not_synced":true,"calendar_url":"https://www.stat.si/StatWeb/en/releasecal"}'::text)
) as item(series_key,name,country,currency,category,event_kind,frequency,unit,source_name,source_url,connector,impact,notes,metadata)
on conflict (series_key) do update set
  name = excluded.name,
  country = excluded.country,
  currency = excluded.currency,
  category = excluded.category,
  event_kind = excluded.event_kind,
  frequency = excluded.frequency,
  unit = excluded.unit,
  official_source_name = excluded.official_source_name,
  official_source_url = excluded.official_source_url,
  source_connector = excluded.source_connector,
  base_impact_score = excluded.base_impact_score,
  ranking_notes = excluded.ranking_notes,
  is_active = excluded.is_active,
  metadata = excluded.metadata,
  updated_at = now();

update public.economic_event_series
set is_active = false,
    updated_at = now()
where series_key in (
  'eur-national-hr', 'eur-national-cy', 'eur-national-gr', 'eur-national-lv',
  'eur-national-lt', 'eur-national-lu', 'eur-national-pt', 'eur-national-sk',
  'eur-national-mt'
);
