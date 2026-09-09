insert into public.economic_event_series (
  series_key, name, country, currency, category, event_kind, frequency, unit,
  official_source_name, official_source_url, source_connector, base_impact_score,
  ranking_notes, is_active, metadata
)
select
  item.series_key, item.name, 'Euro Area', 'EUR', item.category, 'data', 'Monthly',
  item.unit, 'European Commission DG ECFIN Business and Consumer Surveys',
  'https://economy-finance.ec.europa.eu/economic-forecast-and-surveys/business-and-consumer-surveys/latest-business-and-consumer-surveys_en',
  'european-commission', item.impact, item.notes, true, item.metadata::jsonb
from (values
  ('eur-ecfin-flash-consumer-confidence','Euro Area Flash Consumer Confidence Indicator','Surveys','%',70,'Monthly flash CCI release; calendar-only because the official bulk files do not provide a separate flash time series.','{"calendar_only":true,"link_only":true}'::text),
  ('eur-ecfin-economic-sentiment','Euro Area Economic Sentiment Indicator','Surveys','Index',85,'Monthly seasonally adjusted euro-area ESI.','{"numeric_values":true,"link_only":false,"source_file":"main_indicators_sa_nace2.zip","source_series":"EA.ESI"}'::text),
  ('eur-ecfin-employment-expectations','Euro Area Employment Expectations Indicator','Surveys','Index',75,'Monthly seasonally adjusted euro-area EEI.','{"numeric_values":true,"link_only":false,"source_file":"main_indicators_sa_nace2.zip","source_series":"EA.EEI"}'::text),
  ('eur-ecfin-industrial-confidence','Euro Area Industrial Confidence','Surveys','%',70,'Monthly seasonally adjusted industrial confidence balance.','{"numeric_values":true,"link_only":false,"source_file":"main_indicators_sa_nace2.zip","source_series":"EA.INDU"}'::text),
  ('eur-ecfin-services-confidence','Euro Area Services Confidence','Surveys','%',70,'Monthly seasonally adjusted services confidence balance.','{"numeric_values":true,"link_only":false,"source_file":"main_indicators_sa_nace2.zip","source_series":"EA.SERV"}'::text),
  ('eur-ecfin-consumer-confidence','Euro Area Consumer Confidence','Surveys','%',70,'Monthly seasonally adjusted consumer confidence balance.','{"numeric_values":true,"link_only":false,"source_file":"main_indicators_sa_nace2.zip","source_series":"EA.CONS"}'::text),
  ('eur-ecfin-retail-confidence','Euro Area Retail Trade Confidence','Surveys','%',65,'Monthly seasonally adjusted retail trade confidence balance.','{"numeric_values":true,"link_only":false,"source_file":"main_indicators_sa_nace2.zip","source_series":"EA.RETA"}'::text),
  ('eur-ecfin-construction-confidence','Euro Area Construction Confidence','Surveys','%',60,'Monthly seasonally adjusted construction confidence balance.','{"numeric_values":true,"link_only":false,"source_file":"main_indicators_sa_nace2.zip","source_series":"EA.BUIL"}'::text),
  ('eur-ecfin-economic-uncertainty','Euro Area Economic Uncertainty Indicator','Surveys','Index',65,'Monthly euro-area economic uncertainty indicator.','{"numeric_values":true,"link_only":false,"source_file":"uncertainty_total_nsa_nace2.zip","source_series":"EA.UNC"}'::text),
  ('eur-ecfin-labour-hoarding','Euro Area Labour Hoarding Indicator','Surveys','%',55,'Monthly seasonally adjusted euro-area labour hoarding indicator.','{"numeric_values":true,"link_only":false,"source_file":"labourhoarding_total_sa_nace2.zip","source_series":"EA.LH"}'::text),
  ('eur-ecfin-business-climate','Euro Area Business Climate Indicator','Surveys','Index',65,'Monthly seasonally adjusted euro-area manufacturing BCI.','{"numeric_values":true,"link_only":false,"source_file":"industry_total_sa_nace2.zip","source_series":"Euro area Business Climate Indicator"}'::text)
) as item(series_key,name,category,unit,impact,notes,metadata)
on conflict (series_key) do update set
  name = excluded.name, country = excluded.country, currency = excluded.currency,
  category = excluded.category, event_kind = excluded.event_kind,
  frequency = excluded.frequency, unit = excluded.unit,
  official_source_name = excluded.official_source_name,
  official_source_url = excluded.official_source_url,
  source_connector = excluded.source_connector,
  base_impact_score = excluded.base_impact_score,
  ranking_notes = excluded.ranking_notes, is_active = excluded.is_active,
  metadata = excluded.metadata, updated_at = now();
