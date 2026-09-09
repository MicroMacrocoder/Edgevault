Verification baseline: Edgevault(6).zip, with recorded synchronization results through 2026-09-04. This is a living project reference. Update it in the same session whenever a feature, fix, or architecture decision is completed.

Data & Content Rules

Use official or primary sources for economic data, release schedules, reports, speeches, transcripts, and minutes.

Every economic release must be shown separately. Never group separate releases into one calendar row, including Treasury auctions.

Every release must include a one-click official source link. Where a value cannot be copied into EdgeVault, the link must take the user directly to the official report or result page whenever the publisher provides one.

Confirmed licensing rule: Institute for Supply Management (ISM) numeric data must not be redistributed outside the ISM platform. EdgeVault therefore stores and displays a calendar-only entry for ISM: event name, date/time, release status, and direct official-source link. EdgeVault must never fetch, store, or display ISM numeric values.

Treat S&P Global PMI as subject to the same restriction until licensing is confirmed otherwise. S&P Global PMI entries are calendar-only and must never fetch, store, or display the actual numeric values.

The Conference Board's data terms require permission for reuse and may involve fees. EdgeVault therefore keeps Conference Board releases calendar-only with direct official links and does not redistribute the numeric values.

University of Michigan entries currently use the calendar/link workflow; their numeric values are not copied into EdgeVault unless redistribution rights are separately verified.

Chicago PMI is calendar-only because the official report is subscriber/proprietary data and the public value-retrieval workflow is not available in the connector. Keep the official Chicago PMI source link.

For sources with an authorized numeric feed, store the numeric value, previous value, revision information, unit, release status, and official source metadata.

For scheduled events, show the scheduled release and official source link without inventing an actual value. After a release, refresh the event so the released value or direct report link replaces the scheduled representation.

For speeches and live events, show the official live link while the speech/event is in progress. After release, remove the live-only state and retain the archived official speech, transcript, minutes, or report link. EdgeVault may also store the official transcript/report content when the source permits it.

Speech reports must be grouped by currency for Market Intelligence. Economic calendar releases remain separate rows; grouping by currency applies to Market Intelligence interpretation, not to the calendar display.

Market Intelligence must distinguish economic releases, speeches, transcripts, minutes, and other event kinds while grouping their effects by currency.

Never use a mock or unofficial value to fill a missing official release value.

Sources with Redistribution Restrictions

These labels describe the current implementation rule, not a legal opinion. Unrestricted / unconfirmed - functionality gap means no known restriction has been confirmed for the project, but source-specific terms must still be checked before a new numeric fetcher or transcript redistributor is built.

Restricted

Institute for Supply Management (ISM) — confirmed restriction on redistributing numeric PMI values. Use calendar metadata and a direct official link only. ISM PMI reports

The Conference Board — official terms require permission for reuse and may impose fees; data is not freely available for databasing, redistribution, publishing, or public posting. Use calendar metadata and direct official report links only. Conference Board Consumer Confidence

Presumed restricted

S&P Global PMI — treat the underlying numeric PMI data as restricted until licensing is confirmed; the official release page directs users seeking underlying data to contact S&P Global. S&P Global PMI releases

University of Michigan Surveys of Consumers — survey data is copyrighted and published/reprinted with permission; retain the calendar and direct report-link workflow until redistribution rights are verified. UMich reports

Chicago PMI / ISM Chicago / MNI Indicators — the official report is subscriber-only and MNI describes the Chicago PMI data as proprietary. ISM Chicago report · MNI data

Eurozone PMI — presume the same restriction for commercial PMI data, including S&P Global/HCOB PMI, until the exact publisher and redistribution licence are verified. S&P Global PMI

Unrestricted / unconfirmed - functionality gap

Current EdgeVault sources:

U.S. Bureau of Labor Statistics (BLS) — BLS data

U.S. Bureau of Economic Analysis (BEA) — BEA

Board of Governors of the Federal Reserve System — Federal Reserve

U.S. Census Bureau — Census economic indicators

U.S. Department of Labor, Employment and Training Administration (DOL) — DOL ETA

U.S. Department of the Treasury — Treasury release calendar

ADP Research — ADP National Employment Report

National Association of REALTORS (NAR) — NAR housing statistics

Federal Reserve Regional Surveys — New York Fed Empire State Survey

Eurostat — Eurostat release calendar

European Commission DG ECFIN — Business and Consumer Surveys

Planned EUR sources:

ECB statistical releases — ECB statistics

ECB monetary-policy releases — ECB press releases

ECB speeches and transcripts — ECB speeches

ECB accounts/minutes and press conferences — ECB press conferences

Destatis — Germany — Federal Statistical Office of Germany

INSEE — France — French National Institute of Statistics

Istat — Italy — Italian National Institute of Statistics

INE — Spain — Spanish National Statistics Institute

CBS — Netherlands — Statistics Netherlands

Other euro-area national statistical offices — European Statistical System

Deutsche Bundesbank speeches and transcripts — Bundesbank speeches

Banque de France speeches and transcripts — Banque de France speeches

Banca d'Italia speeches and interventions — Banca d'Italia interventions

Banco de España speeches and interventions — Banco de España interventions

De Nederlandsche Bank speeches and transcripts — DNB speeches

Oesterreichische Nationalbank speeches and central-bank communication — OeNB communication

Other euro-area central-bank speeches and transcripts — European System of Central Banks

Status Legend

Every feature and source status in this file must use exactly one of these three statuses and no other status labels:

Fully done — verified by reading the actual fetch code and/or a real synchronization log showing real values returned, not just that a calendar entry exists.

Calendar-only — shows a date/event but no real numeric value, either because of a licensing restriction or because the value fetch is not built yet.

Not started — does not exist in the codebase at all yet.

Never mark anything Fully done based only on a plan, intention, or partial implementation.

Current Status — Economic Calendar

The source statuses below were checked against the current connector code. Recorded worker results included BLS, BEA, Federal Reserve, Census, DOL, Treasury, University of Michigan, ISM, Conference Board, ADP, NAR, Eurostat, and Regional Federal Reserve synchronization. The Regional Federal Reserve connector is fail-forward: a temporary HTTP 504 is logged as a warning so later sources, including Eurostat, still synchronize.

Source

Status

Verification basis

Official source

U.S. Bureau of Labor Statistics (BLS)

Fully done

Calendar and recent-history fetchers are implemented; worker results showed calendar synchronization and real historical observations.

BLS data

U.S. Bureau of Economic Analysis (BEA)

Fully done

Calendar and BEA API value/history fetchers are implemented; worker results showed calendar and history synchronization.

BEA

Board of Governors of the Federal Reserve System (Fed)

Fully done

FOMC calendar, decisions, press conferences, minutes/report links, official speeches, and transcript synchronization are implemented; recorded worker results included Fed calendar and transcript synchronization.

Federal Reserve

U.S. Census Bureau

Fully done

Calendar and Census dataset value fetchers are implemented; worker results showed calendar and history synchronization with real observations.

Census economic indicators

U.S. Department of Labor, Employment and Training Administration (DOL)

Fully done

Jobless-claims calendar and history fetchers are implemented; worker results showed DOL calendar and history synchronization.

DOL ETA

U.S. Department of the Treasury

Fully done

Treasury release calendar and separate auction records are implemented with auction metrics and official record links; worker results showed Treasury synchronization.

Treasury release calendar

University of Michigan Surveys of Consumers (UMich)

Calendar-only

The connector explicitly sets values_not_synced and stores the official report link; it does not copy survey numeric values.

UMich reports

Institute for Supply Management (ISM)

Calendar-only

The connector explicitly sets values_not_synced; released events receive the direct ISM report URL and scheduled events receive the official schedule link.

ISM release calendar

The Conference Board

Calendar-only

The connector explicitly sets values_not_synced; the publisher's data terms require permission for reuse and may impose fees, so numeric values are not redistributed. Direct official report pages are retained.

Consumer Confidence, U.S. Leading Indicators, Conference Board data terms

ADP Research

Fully done

The connector fetches the official ADP JSON and history CSV and maps real private-employment values into events.

ADP Employment Report

National Association of REALTORS (NAR)

Fully done

The connector fetches official release pages and parses Existing Home Sales and Pending Home Sales values and previous values.

NAR release schedule

Federal Reserve Regional Surveys

Fully done

New York and Philadelphia fetch official CSV/report values; Dallas, Richmond, and Kansas City connectors fetch official survey values. Recorded results included real index values.

Regional Fed connectors

S&P Global Manufacturing PMI

Calendar-only

The connector uses the official release schedule/link-only workflow and explicitly marks values as not synced.

S&P Global release dates

Chicago PMI (Business Barometer)

Calendar-only

The connector creates separate calendar events and explicitly marks values as not synced; it retains the official source page. The report is subscriber/proprietary, so numeric redistribution is not assumed.

ISM Chicago / MNI Indicators

Eurostat connector

Fully done

The connector contains separate release mappings and an official Eurostat Statistics API value workflow; the recorded synchronization returned fetched=204, synced=204, and valueBacked=143. Individual Eurostat series are listed below because their statuses differ.

Eurostat release calendar

Eurostat is broken down below because the code contains both value-backed and calendar-only series. The value-backed entries use the official Eurostat Statistics API through src/lib/eurostatEconomicData.ts. Unmapped official Eurostat releases are retained through the generic calendar-only fallback with their release title, date, status, and official release or Data Browser link.

Eurostat series

Status

Code verification

Euro Area Flash CPI YoY

Fully done

Numeric configuration: prc_hicp_minr, annual percentage change.

Euro Area Flash CPI MoM

Fully done

Numeric configuration: prc_hicp_minr, monthly percentage change.

Euro Area CPI YoY

Fully done

Numeric configuration: prc_hicp_minr, annual percentage change.

Euro Area CPI MoM

Fully done

Numeric configuration: prc_hicp_minr, monthly percentage change.

Euro Area GDP QoQ

Fully done

Numeric configuration: namq_10_gdp, seasonally adjusted quarter-on-quarter change.

Euro Area Employment Change QoQ

Fully done

Numeric configuration: namq_10_a10_e, seasonally adjusted employment change.

Euro Area Unemployment Rate

Fully done

Numeric configuration: une_rt_m, seasonally adjusted total unemployment rate.

Euro Area Industrial Production MoM

Fully done

Numeric configuration: sts_inpr_m, seasonally adjusted production change.

Euro Area Retail Sales MoM

Fully done

Numeric configuration: sts_trtu_m, seasonally adjusted volume-sales change.

Euro Area PPI MoM

Fully done

Numeric configuration: sts_inppd_m, producer-price change.

Euro Area Construction Output MoM

Fully done

Numeric configuration: sts_copr_m, seasonally adjusted construction production change.

Euro Area Labour Cost YoY

Fully done

Numeric configuration: lc_lci_r2_q, labour-cost change.

Euro Area House Price Index

Fully done

Numeric configuration: prc_hpi_q, total-purchase house-price change.

Euro Area Services Production

Fully done

Numeric configuration: sts_sepr_m, services production change.

Euro Area Building Permits

Fully done

Numeric configuration: sts_cobp_m, building-permit index change.

Euro Area Trade Balance

Fully done

Numeric configuration: ext_st_easitc, monthly extra-euro-area balance for total goods (EA21 / EXT_EA21 / BAL_RT / TRD_VAL).

Euro Area Current Account

Fully done

Numeric configuration: bop_eu6_q, quarterly seasonally and calendar-adjusted current-account balance (EA21 / EXT_EA21 / CA / SCA / BAL).

Euro Area Job Vacancy Rate

Fully done

Numeric configuration: jvs_q_nace2, unadjusted B-S aggregate job-vacancy rate (JVR).

Euro Area 3-Month Interest Rate

Fully done

Numeric configuration: irt_st_m, Euro Area (EA) 3-month rate (IRT_M3).

Euro Area Long-Term Government Bond Yield

Fully done

Numeric configuration: irt_lt_mcby_m, Euro Area (EA) EMU convergence-criterion bond yield (MCBY).

Eurostat Calendar-only fallback

Calendar-only

Any official Eurostat release authored by estat that is not mapped to a value-backed series is retained as a separate calendar event under the generic Eurostat Calendar-only Release series. Its numeric values are never invented or fetched; the event keeps the original title, period, theme, dataset code, and an official Eurostat release or Data Browser link.

Roadmap — EUR Coverage

Work on EUR coverage in this priority order:

European Commission DG ECFIN Business and Consumer Surveys

Fully done

The connector now imports the official annual DG ECFIN release schedule and retains separate EUR calendar events for the monthly Flash Consumer Confidence Indicator and the full Business and Consumer Survey release. The full release is split into Economic Sentiment (ESI), Employment Expectations (EEI), Industrial Confidence, Services Confidence, Consumer Confidence, Retail Trade Confidence, Construction Confidence, Economic Uncertainty (EUI), Labour Hoarding (LHI), and Business Climate (BCI). Numeric history for the ten full-release indicators is loaded from the Commission's official BCS bulk ZIP/XLSX files. Flash Consumer Confidence remains Calendar-only because the official bulk files do not expose a separate flash time series. Scheduled events link to the official annual schedule PDF; after a release appears on the Commission's latest-releases page, the next sync replaces that link with the direct official release PDF. The schedule PDF parser loads pdfjs-dist 4.10.38 at Node runtime, next.config.mjs uses Next.js 14's serverComponentsExternalPackages setting, and outputFileTracingIncludes forces pdf.worker.mjs into the deployed function so the parser's fake-worker fallback can load successfully.

European Central Bank releases: interest-rate decisions, monetary-policy press conferences, introductory statements, press-conference Q&A transcripts, accounts/minutes, other Governing Council decisions, related monetary-policy releases, and Executive Board speeches/transcripts. Implemented by `src/lib/ecbEconomicData.ts`, `src/lib/ecbSpeechTranscripts.ts`, and `supabase_ecb_series_v1.sql`. Direct publication links replace the official meeting-calendar link when a release is published.

Eurozone PMI releases

Calendar-only

The connector covers separate Eurozone HCOB/S&P Global Manufacturing, Services, and Composite PMI releases in both Flash and Final form. It stores EUR-labelled release events and does not copy PMI numeric values because the publisher data is treated as restricted. Verified releases use their direct official S&P Global Eurozone report page; scheduled releases use the official release calendar, and released items without a verified opaque report ID use the official release index rather than an invented URL. The HCOB PMI page is retained in event metadata as the sponsoring source.

ECB statistical releases

Calendar-only

The connector parses the official ECB Statistical Calendar and keeps each release as a separate EUR event. Named series cover HICP, balance of payments, bank rates, monetary developments, Bank Lending Survey, government finance, investment funds, and payments, with a fallback for other official ECB statistical releases. The calendar event links to a matched official ECB press release when the ECB RSS identifies one; otherwise it links to the official statistical calendar. Multidimensional Data Portal values are not collapsed into a single calendar value without a verified series definition.

National euro-area statistical releases

Calendar-only

The active national EUR connector covers official calendar and release sources for Austria, Belgium, Bulgaria, Estonia, Finland, Ireland, Slovenia, the Netherlands, Spain, and Italy. The Netherlands uses the CBS publication calendar and news pages; Spain uses the INE statistics-availability calendar and press releases; Italy uses the Istat press calendar and press releases. It reads each office's official release calendar and published-release index in parallel, labels every event with the issuing country and EUR, and stores the direct official release link when the office exposes one. Scheduled entries use the office calendar link; a later synchronization replaces that link with the published release link. Supported releases for the major Netherlands, Spain, and Italy connectors now attach actual and previous values from verified official Eurostat country series; the other active countries and unsupported titles remain link-only. Forecasts remain empty because no licensed consensus forecast provider is included. Croatia, Cyprus, Greece, Latvia, Lithuania, Luxembourg, Malta, Portugal, and Slovakia remain intentionally inactive because their first-pass calendars were not reliably parseable.

National releases, in this order: Germany, France, Italy, Spain, Netherlands, then other euro-area members.

EUR central-bank speeches and transcripts, including ECB Executive Board and Governing Council members and relevant national central-bank officials.

Infrastructure

Repo path: C:/Users/DELL/OneDrive/Documents/Edgevault

Git branch: recovery/edgevault-working

VPS worker id: london-mt5-01

VPS agent path: C:\Users\Administrator\Desktop\EdgeVault_Hosted_MT5_Agent

VPS Python path: C:\Users\Administrator\AppData\Local\Python\pythoncore-3.13-64\python.exe

Worker log path: C:\Users\Administrator\Desktop\EdgeVault_Hosted_MT5_Agent\edgevault-economic-worker.log

Scheduled tasks: EdgeVault Economic Worker, EdgeVault MT5 Worker

Supabase tables for MT5 history: mt5_account_snapshots, mt5_deals, mt5_orders, mt5_positions, mt5_sync_state, mt5_trade_records

Workflow Rules

Use Git Bash for repository commands. Label PowerShell commands separately whenever PowerShell is used.

Before any push, run the type-check, git diff --check, and git diff --cached --check; review the staged file list and stage only intended files. Never use blind git add ..

Test locally and on the VPS before pushing to production. Do not push until the feature is tested and confirmed working.

When replacing the VPS economic worker: stop the scheduled task, replace the exact canonical worker file, compile it with py_compile, verify that compilation passed, restart the task, and inspect the worker log.

When checking worker logs, always check the timestamp on every error line before reporting it as current. A stale error from an earlier run in the same log file is not the same as a current failure.

When reporting a source's calendar synchronization as successful from worker logs, explicitly distinguish fetched=X synced=X from numeric-value verification. That line confirms calendar entries were fetched and stored; it does not prove that actual or previous numeric values were retrieved for every event. Numeric values must be verified separately from the fetch code or value-backed sync result.

The normal worker handoff is to copy the worker code from EdgeVault and paste it into the canonical VPS file. Do not create competing worker files or update a nested folder by mistake.

Never give line-by-line edits, diffs, or partial snippets for a file that already exists. Always provide the complete full replacement content of every changed file, with nothing omitted or abbreviated, so it can be copied or extracted as-is without manual merging.

When a task changes more than one file, package every changed file into one downloadable ZIP while preserving the correct repository paths, such as src/lib/eurostatEconomicData.ts. Do not paste files one by one unless explicitly asked.

Always list every file included in a ZIP with its full path so the contents can be confirmed before extraction.

Every time a feature is finished, a bug is fixed, or an architecture decision is made, update this file in the same session. Do not wait to be asked.

If a status or statement becomes wrong, correct it in place immediately. This file must reflect the actual current code and verified runtime state, not an intention, plan, or stale log line.

Keep the status vocabulary limited to the three statuses in Status Legend: Fully done, Calendar-only, and Not started.

This file is a permanent living reference for any AI assistant or developer opening the repository; it is not a chat summary.

The full-file-only and ZIP-packaged workflow applies to PROJECT_NOTES.md itself. Regenerate and provide the complete file whenever it changes; never provide a partial patch for it.

Non-Negotiable Architecture Rules

DXY Master EA: DXY is the only analysis source. Follower pairs must not generate their own market structure, targets, invalidation, Fair Value Gaps, liquidity voids, or entry analysis.

DXY Master EA activation balance threshold: $500.

DXY Master EA entry 1 raw lot: (activation balance / 500) * 0.02, truncated to the broker's volume step.

DXY Master EA entry 2: entry 1 multiplied by 1.5.

MicroMacro Bias Indicator: visual market-structure tool only. Never add trade execution, stop-loss/take-profit, mitigation, invalidation lifecycle, or trade-management logic to it.
