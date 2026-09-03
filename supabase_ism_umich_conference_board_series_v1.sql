insert into public.economic_event_series (
  series_key, name, country, currency, category, event_kind, frequency, unit,
  official_source_name, official_source_url, source_connector, base_impact_score,
  ranking_notes, is_active, metadata
)
values
  (
    'us-umich-consumer-sentiment-preliminary',
    'Michigan Consumer Sentiment Preliminary', 'United States', 'USD',
    'Consumer Confidence', 'data', 'Monthly', 'Index',
    'University of Michigan Surveys of Consumers',
    'https://data.sca.isr.umich.edu/survey-info.php', 'umich', 65,
    'Preliminary University of Michigan consumer sentiment release schedule and official report link.',
    true, jsonb_build_object('reports_url', 'https://data.sca.isr.umich.edu/reports.php')
  ),
  (
    'us-umich-consumer-sentiment-final',
    'Michigan Consumer Sentiment Final', 'United States', 'USD',
    'Consumer Confidence', 'data', 'Monthly', 'Index',
    'University of Michigan Surveys of Consumers',
    'https://data.sca.isr.umich.edu/survey-info.php', 'umich', 60,
    'Final University of Michigan consumer sentiment release schedule and official report link.',
    true, jsonb_build_object('reports_url', 'https://data.sca.isr.umich.edu/reports.php')
  ),
  (
    'us-ism-manufacturing-pmi',
    'ISM Manufacturing PMI', 'United States', 'USD',
    'Business Survey', 'data', 'Monthly', '%',
    'Institute for Supply Management',
    'https://www.ismworld.org/supply-management-news-and-reports/reports/rob-report-calendar/', 'ism', 70,
    'Monthly ISM Manufacturing PMI release and official report page.',
    true, jsonb_build_object('report_type', 'manufacturing')
  ),
  (
    'us-ism-services-pmi',
    'ISM Services PMI', 'United States', 'USD',
    'Business Survey', 'data', 'Monthly', '%',
    'Institute for Supply Management',
    'https://www.ismworld.org/supply-management-news-and-reports/reports/rob-report-calendar/', 'ism', 65,
    'Monthly ISM Services PMI release and official report page.',
    true, jsonb_build_object('report_type', 'services')
  ),
  (
    'us-conference-board-consumer-confidence',
    'Conference Board Consumer Confidence', 'United States', 'USD',
    'Confidence & Leading Indicators', 'data', 'Monthly', 'Index',
    'The Conference Board',
    'https://www.conference-board.org/topics/consumer-confidence/', 'conference-board', 65,
    'Monthly U.S. Consumer Confidence report and official report page.',
    true, jsonb_build_object('indicator', 'consumer-confidence')
  ),
  (
    'us-conference-board-us-lei',
    'Conference Board U.S. Leading Economic Index', 'United States', 'USD',
    'Confidence & Leading Indicators', 'data', 'Monthly', 'Index',
    'The Conference Board',
    'https://www.conference-board.org/topics/us-leading-indicators/', 'conference-board', 60,
    'Monthly U.S. Leading Economic Index report and official report page.',
    true, jsonb_build_object('indicator', 'us-leading-economic-index')
  )
on conflict (series_key) do update set
  name = excluded.name,
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
