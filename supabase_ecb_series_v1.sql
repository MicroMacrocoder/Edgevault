insert into public.economic_event_series (
  series_key, name, country, currency, category, event_kind, frequency, unit,
  official_source_name, official_source_url, source_connector, base_impact_score,
  ranking_notes, is_active, metadata
)
values
  (
    'eur-ecb-monetary-policy-decision',
    'ECB Monetary Policy Decision', 'Euro Area', 'EUR', 'Monetary Policy', 'decision',
    'Every six weeks', null, 'European Central Bank',
    'https://www.ecb.europa.eu/press/govcdec/mopo/html/index.en.html', 'ecb', 100,
    'Governing Council decision on ECB interest rates and other monetary-policy instruments.', true,
    '{"release_family":"ECB monetary policy","direct_publication_links":true}'::jsonb
  ),
  (
    'eur-ecb-monetary-policy-statement',
    'ECB Monetary Policy Statement and Q&A', 'Euro Area', 'EUR', 'Monetary Policy', 'document',
    'Every six weeks', null, 'European Central Bank',
    'https://www.ecb.europa.eu/press/press_conference/monetary-policy-statement/html/index.en.html', 'ecb', 100,
    'President and Vice-President explanation of the decision with the official journalist Q&A transcript.', true,
    '{"release_family":"ECB monetary policy","contains_qa_transcript":true,"direct_publication_links":true}'::jsonb
  ),
  (
    'eur-ecb-press-conference',
    'ECB Monetary Policy Press Conference', 'Euro Area', 'EUR', 'Monetary Policy', 'speech',
    'Every six weeks', null, 'European Central Bank',
    'https://www.ecb.europa.eu/press/press_conference/html/index.en.html', 'ecb', 100,
    'Press conference following Governing Council monetary-policy decisions; the linked official Q&A page is archived separately as a transcript.', true,
    '{"release_family":"ECB monetary policy","transcript_connector":"ecb","direct_publication_links":true}'::jsonb
  ),
  (
    'eur-ecb-monetary-policy-release',
    'ECB Combined Monetary Policy Decisions and Statement', 'Euro Area', 'EUR', 'Monetary Policy', 'document',
    'Every six weeks', null, 'European Central Bank',
    'https://www.ecb.europa.eu/press/press_conference/monetary-policy-statement/html/index.en.html', 'ecb', 95,
    'Official combined decision-and-statement release, retained as a separate document event.', true,
    '{"release_family":"ECB monetary policy","document_format":"official_pdf","direct_publication_links":true}'::jsonb
  ),
  (
    'eur-ecb-monetary-policy-accounts',
    'ECB Monetary Policy Account', 'Euro Area', 'EUR', 'Monetary Policy', 'minutes',
    'Every six weeks, published about four weeks later', null, 'European Central Bank',
    'https://www.ecb.europa.eu/press/accounts/html/index.en.html', 'ecb', 85,
    'Official accounts of Governing Council monetary-policy meetings, including the discussion and decisions.', true,
    '{"release_family":"ECB monetary policy","document_type":"account","direct_publication_links":true}'::jsonb
  ),
  (
    'eur-ecb-other-governing-council-decision',
    'ECB Governing Council Other Decisions', 'Euro Area', 'EUR', 'Monetary Policy', 'decision',
    'As published', null, 'European Central Bank',
    'https://www.ecb.europa.eu/press/govcdec/otherdec/html/index.en.html', 'ecb', 65,
    'Other Governing Council decisions published separately from interest-rate decisions.', true,
    '{"release_family":"ECB Governing Council decisions","direct_publication_links":true}'::jsonb
  ),
  (
    'eur-ecb-central-bank-speech',
    'ECB Executive Board Speeches', 'Euro Area', 'EUR', 'Central Bank Communication', 'speech',
    'As published', null, 'European Central Bank',
    'https://www.ecb.europa.eu/press/key/html/index.en.html', 'ecb', 80,
    'Official ECB Executive Board speeches from the ECB press RSS feed, with official HTML/PDF text archived when available.', true,
    '{"release_family":"ECB speeches","transcript_connector":"ecb","archive_url":"https://www.ecb.europa.eu/press/key/html/index.en.html","direct_document_links":true}'::jsonb
  )
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

