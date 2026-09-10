-- EUR national central-bank speeches and official transcripts.
-- Run this entire file in the Supabase SQL editor before the sync endpoint.

insert into public.economic_event_series (
  series_key, name, country, currency, category, event_kind, frequency, unit,
  official_source_name, official_source_url, source_connector, base_impact_score,
  ranking_notes, is_active, metadata
)
values
  (
    'eur-national-cb-de-speech', 'Deutsche Bundesbank Speeches', 'Germany', 'EUR',
    'Central Bank Communication', 'speech', 'As published', null,
    'Deutsche Bundesbank', 'https://www.bundesbank.de/en/press/speeches',
    'euro-national-central-bank', 75,
    'Official speeches by current and past members of the Bundesbank Executive Board.', true,
    '{"archive_url":"https://www.bundesbank.de/en/press/speeches","transcript_connector":"euro-national-central-bank","direct_publication_links":true}'::jsonb
  ),
  (
    'eur-national-cb-fr-speech', 'Banque de France Governor Interventions', 'France', 'EUR',
    'Central Bank Communication', 'speech', 'As published', null,
    'Banque de France', 'https://www.banque-france.fr/en/governor-interventions',
    'euro-national-central-bank', 75,
    'Official governor interventions and speeches published by the Banque de France.', true,
    '{"archive_url":"https://www.banque-france.fr/en/governor-interventions","transcript_connector":"euro-national-central-bank","direct_publication_links":true}'::jsonb
  ),
  (
    'eur-national-cb-it-speech', 'Banca d’Italia Speeches', 'Italy', 'EUR',
    'Central Bank Communication', 'speech', 'As published', null,
    'Banca d’Italia', 'https://www.bancaditalia.it/pubblicazioni/menu/interventi-memorie.html?com.dotmarketing.htmlpage.language=1',
    'euro-national-central-bank', 75,
    'Official speeches by the Governor, Directorate members, and other Banca d’Italia officials.', true,
    '{"archive_url":"https://www.bancaditalia.it/pubblicazioni/menu/interventi-memorie.html?com.dotmarketing.htmlpage.language=1","transcript_connector":"euro-national-central-bank","direct_publication_links":true}'::jsonb
  ),
  (
    'eur-national-cb-es-speech', 'Banco de España Speeches', 'Spain', 'EUR',
    'Central Bank Communication', 'speech', 'As published', null,
    'Banco de España', 'https://www.bde.es/wbe/en/noticias-eventos/actualidad-banco-espana/intervenciones-publicas/',
    'euro-national-central-bank', 75,
    'Official public speeches by current members of the Banco de España governing bodies.', true,
    '{"archive_url":"https://www.bde.es/wbe/en/noticias-eventos/actualidad-banco-espana/intervenciones-publicas/","transcript_connector":"euro-national-central-bank","direct_publication_links":true}'::jsonb
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

create table if not exists public.economic_speech_transcripts (
  id uuid primary key default gen_random_uuid(),
  economic_event_id uuid not null references public.economic_events(id) on delete cascade,
  external_id text not null unique,
  currency text not null,
  source_agency text not null,
  speaker text,
  title text not null,
  transcript_type text not null default 'official'
    check (transcript_type = 'official'),
  transcript_status text not null default 'unavailable'
    check (transcript_status in ('published', 'unavailable')),
  transcript_text text,
  source_url text not null,
  live_url text,
  source_published_at timestamptz,
  fetched_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists economic_speech_transcripts_event_uidx
  on public.economic_speech_transcripts (economic_event_id);

create index if not exists economic_speech_transcripts_currency_time_idx
  on public.economic_speech_transcripts (currency, source_published_at desc);

alter table public.economic_speech_transcripts enable row level security;

drop policy if exists "Authenticated users can read speech transcripts"
  on public.economic_speech_transcripts;
create policy "Authenticated users can read speech transcripts"
  on public.economic_speech_transcripts
  for select
  to authenticated
  using (true);

create or replace function public.set_economic_speech_transcripts_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists economic_speech_transcripts_updated_at
  on public.economic_speech_transcripts;
create trigger economic_speech_transcripts_updated_at
before update on public.economic_speech_transcripts
for each row execute function public.set_economic_speech_transcripts_updated_at();
