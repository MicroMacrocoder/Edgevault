insert into public.economic_event_series (
  series_key, name, country, currency, category, event_kind, frequency, unit,
  official_source_name, official_source_url, source_connector, base_impact_score,
  ranking_notes, is_active, metadata
)
select
  item.series_key, item.name, 'Euro Area', 'EUR', item.category, 'data', item.frequency,
  item.unit, 'Eurostat', 'https://ec.europa.eu/eurostat/news/release-calendar', 'eurostat', item.impact,
  item.notes, true, item.metadata::jsonb
from (values
  ('eur-flash-hicp-yoy','Euro Area Flash CPI YoY','Inflation','Monthly','%',90,'Flash annual inflation estimate.', '{"dataset_code":"prc_hicp_minr","numeric_values":true,"link_only":false}'::text),
  ('eur-flash-hicp-mom','Euro Area Flash CPI MoM','Inflation','Monthly','%',85,'Flash monthly inflation estimate.', '{"dataset_code":"prc_hicp_minr","numeric_values":true,"link_only":false}'::text),
  ('eur-hicp-yoy','Euro Area CPI YoY','Inflation','Monthly','%',90,'Euro-area harmonised annual inflation.', '{"dataset_code":"prc_hicp_minr","numeric_values":true,"link_only":false}'::text),
  ('eur-hicp-mom','Euro Area CPI MoM','Inflation','Monthly','%',85,'Euro-area harmonised monthly inflation.', '{"dataset_code":"prc_hicp_minr","numeric_values":true,"link_only":false}'::text),
  ('eur-gdp-qoq','Euro Area GDP QoQ','Growth','Quarterly','%',90,'Euro-area quarterly GDP growth.', '{"dataset_code":"namq_10_gdp","numeric_values":true,"link_only":false}'::text),
  ('eur-employment-change-qoq','Euro Area Employment Change QoQ','Labour','Quarterly','%',75,'Euro-area quarterly employment change.', '{"dataset_code":"namq_10_a10_e","numeric_values":true,"link_only":false}'::text),
  ('eur-unemployment-rate','Euro Area Unemployment Rate','Labour','Monthly','%',85,'Euro-area unemployment rate.', '{"dataset_code":"une_rt_m","numeric_values":true,"link_only":false}'::text),
  ('eur-industrial-production-mom','Euro Area Industrial Production MoM','Production','Monthly','%',75,'Euro-area industrial output change.', '{"dataset_code":"sts_inpr_m","numeric_values":true,"link_only":false}'::text),
  ('eur-retail-sales-mom','Euro Area Retail Sales MoM','Consumption','Monthly','%',70,'Euro-area retail trade volume change.', '{"dataset_code":"sts_trtu_m","numeric_values":true,"link_only":false}'::text),
  ('eur-ppi-mom','Euro Area PPI MoM','Inflation','Monthly','%',75,'Euro-area industrial producer-price change.', '{"dataset_code":"sts_inppd_m","numeric_values":true,"link_only":false}'::text),
  ('eur-trade-balance','Euro Area Trade Balance','Trade','Monthly','EUR million',70,'Euro-area international trade balance.', '{"dataset_code":"ext_st_27_2020msbec","link_only":true}'::text),
  ('eur-current-account','Euro Area Current Account','Trade','Quarterly','EUR million',70,'Euro-area balance of payments current account.', '{"dataset_code":"bop_c6_q","link_only":true}'::text),
  ('eur-construction-output-mom','Euro Area Construction Output MoM','Construction','Monthly','%',55,'Euro-area construction production.', '{"dataset_code":"sts_copr_m","numeric_values":true,"link_only":false}'::text),
  ('eur-labour-cost-yoy','Euro Area Labour Cost YoY','Labour','Quarterly','%',70,'Euro-area labour-cost index.', '{"dataset_code":"lc_lci_r2_q","numeric_values":true,"link_only":false}'::text),
  ('eur-job-vacancy-rate','Euro Area Job Vacancy Rate','Labour','Quarterly','%',55,'Euro-area job-vacancy rate.', '{"dataset_code":"jvs_q_nace2","numeric_values":true,"link_only":false}'::text),
  ('eur-house-price-index','Euro Area House Price Index','Housing','Quarterly','Index',50,'Euro-area residential property prices.', '{"dataset_code":"prc_hpi_q","numeric_values":true,"link_only":false}'::text),
  ('eur-services-production','Euro Area Services Production','Production','Monthly','%',55,'Euro-area services production.', '{"dataset_code":"sts_sepr_m","numeric_values":true,"link_only":false}'::text),
  ('eur-building-permits','Euro Area Building Permits','Housing','Monthly','Index',50,'Euro-area building permits.', '{"dataset_code":"sts_cobp_m","numeric_values":true,"link_only":false}'::text),
  ('eur-three-month-interest-rate','Euro Area 3-Month Interest Rate','Interest Rates','Monthly','%',45,'Euro-area three-month interest rate.', '{"dataset_code":"irt_st_m","numeric_values":true,"link_only":false,"interest_rate":"IRT_M3","geo":"EA"}'::text),
  ('eur-long-term-government-bond-yield','Euro Area Long-Term Government Bond Yield','Interest Rates','Monthly','%',40,'Euro-area long-term government bond yield.', '{"dataset_code":"irt_lt_mcby_m","numeric_values":true,"link_only":false,"interest_rate":"MCBY","geo":"EA"}'::text),
  ('eur-eurostat-calendar-only','Eurostat Calendar-only Release','Other','Irregular',null,20,'Unmapped official Eurostat release retained as calendar metadata with an official source link.', '{"calendar_only":true,"link_only":true}'::text)
) as item(series_key,name,category,frequency,unit,impact,notes,metadata)
on conflict (series_key) do update set
  name = excluded.name, category = excluded.category, event_kind = excluded.event_kind,
  frequency = excluded.frequency, unit = excluded.unit,
  official_source_name = excluded.official_source_name,
  official_source_url = excluded.official_source_url,
  source_connector = excluded.source_connector, base_impact_score = excluded.base_impact_score,
  ranking_notes = excluded.ranking_notes, is_active = excluded.is_active,
  metadata = excluded.metadata, updated_at = now();
