# EdgeVault Project Notes

Verification baseline: `Edgevault(6).zip`, with recorded synchronization results through 2026-09-04. This is a living project reference. Update it in the same session whenever a feature, fix, or architecture decision is completed.

## Data & Content Rules

- Use official or primary sources for economic data, release schedules, reports, speeches, transcripts, and minutes.
- Every economic release must be shown separately. Never group separate releases into one calendar row, including Treasury auctions.
- Every release must include a one-click official source link. Where a value cannot be copied into EdgeVault, the link must take the user directly to the official report or result page whenever the publisher provides one.
- Confirmed licensing rule: Institute for Supply Management (ISM) numeric data must not be redistributed outside the ISM platform. EdgeVault therefore stores and displays a calendar-only entry for ISM: event name, date/time, release status, and direct official-source link. EdgeVault must never fetch, store, or display ISM numeric values.
- Treat S&P Global PMI as subject to the same restriction until licensing is confirmed otherwise. S&P Global PMI entries are calendar-only and must never fetch, store, or display the actual numeric values.
- Conference Board and University of Michigan entries use the same calendar/link workflow because their numeric values are not copied into EdgeVault. The official report link is updated after release when the direct report can be identified.
- Chicago PMI is calendar-only because the public official value retrieval workflow is not available in the connector. Keep the official Chicago PMI source link.
- For sources with an authorized numeric feed, store the numeric value, previous value, revision information, unit, release status, and official source metadata.
- For scheduled events, show the scheduled release and official source link without inventing an actual value. After a release, refresh the event so the released value or direct report link replaces the scheduled representation.
- For speeches and live events, show the official live link while the speech/event is in progress. After release, remove the live-only state and retain the archived official speech, transcript, minutes, or report link. EdgeVault may also store the official transcript/report content when the source permits it.
- Speech reports must be grouped by currency for Market Intelligence. Economic calendar releases remain separate rows; grouping by currency applies to Market Intelligence interpretation, not to the calendar display.
- Market Intelligence must distinguish economic releases, speeches, transcripts, minutes, and other event kinds while grouping their effects by currency.
- Never use a mock or unofficial value to fill a missing official release value.

## Status Legend

Every feature and source status in this file must use exactly one of these three statuses and no other status labels:

- **Fully done** — verified by reading the actual fetch code and/or a real synchronization log showing real values returned, not just that a calendar entry exists.
- **Calendar-only** — shows a date/event but no real numeric value, either because of a licensing restriction or because the value fetch is not built yet.
- **Not started** — does not exist in the codebase at all yet.

Never mark anything **Fully done** based only on a plan, intention, or partial implementation.

## Current Status — Economic Calendar

The source statuses below were checked against the current connector code. Recorded worker results included BLS, BEA, Federal Reserve, Census, DOL, Treasury, University of Michigan, ISM, Conference Board, ADP, NAR, Eurostat, and Regional Federal Reserve synchronization. The Regional Federal Reserve connector is fail-forward: a temporary HTTP 504 is logged as a warning so later sources, including Eurostat, still synchronize.

| Source | Status | Verification basis | Official source |
|---|---|---|---|
| U.S. Bureau of Labor Statistics (BLS) | **Fully done** | Calendar and recent-history fetchers are implemented; worker results showed calendar synchronization and real historical observations. | [BLS data](https://www.bls.gov/data/) |
| U.S. Bureau of Economic Analysis (BEA) | **Fully done** | Calendar and BEA API value/history fetchers are implemented; worker results showed calendar and history synchronization. | [BEA](https://www.bea.gov/) |
| Board of Governors of the Federal Reserve System (Fed) | **Fully done** | FOMC calendar, decisions, press conferences, minutes/report links, official speeches, and transcript synchronization are implemented; recorded worker results included Fed calendar and transcript synchronization. | [Federal Reserve](https://www.federalreserve.gov/) |
| U.S. Census Bureau | **Fully done** | Calendar and Census dataset value fetchers are implemented; worker results showed calendar and history synchronization with real observations. | [Census economic indicators](https://www.census.gov/economic-indicators/) |
| U.S. Department of Labor, Employment and Training Administration (DOL) | **Fully done** | Jobless-claims calendar and history fetchers are implemented; worker results showed DOL calendar and history synchronization. | [DOL ETA](https://oui.doleta.gov/unemploy/) |
| U.S. Department of the Treasury | **Fully done** | Treasury release calendar and separate auction records are implemented with auction metrics and official record links; worker results showed Treasury synchronization. | [Treasury release calendar](https://fiscaldata.treasury.gov/release-calendar/) |
| University of Michigan Surveys of Consumers (UMich) | **Calendar-only** | The connector explicitly sets `values_not_synced` and stores the official report link; it does not copy survey numeric values. | [UMich reports](https://data.sca.isr.umich.edu/reports.php) |
| Institute for Supply Management (ISM) | **Calendar-only** | The connector explicitly sets `values_not_synced`; released events receive the direct ISM report URL and scheduled events receive the official schedule link. | [ISM release calendar](https://www.ismworld.org/supply-management-news-and-reports/reports/rob-report-calendar/) |
| The Conference Board | **Calendar-only** | The connector explicitly sets `values_not_synced` and stores the direct official report page for Consumer Confidence and the Leading Economic Index. | [Consumer Confidence](https://www.conference-board.org/topics/consumer-confidence/), [U.S. Leading Indicators](https://www.conference-board.org/topics/us-leading-indicators/) |
| ADP Research | **Fully done** | The connector fetches the official ADP JSON and history CSV and maps real private-employment values into events. | [ADP Employment Report](https://adpemploymentreport.com/) |
| National Association of REALTORS (NAR) | **Fully done** | The connector fetches official release pages and parses Existing Home Sales and Pending Home Sales values and previous values. | [NAR release schedule](https://www.nar.realtor/press-releases/nar-statistical-news-release-schedule) |
| Federal Reserve Regional Surveys | **Fully done** | New York and Philadelphia fetch official CSV/report values; Dallas, Richmond, and Kansas City connectors fetch official survey values. Recorded results included real index values. | [Regional Fed connectors](https://www.newyorkfed.org/survey/empire/empiresurvey_overview.html) |
| S&P Global Manufacturing PMI | **Calendar-only** | The connector uses the official release schedule/link-only workflow and explicitly marks values as not synced. | [S&P Global release dates](https://www.pmi.spglobal.com/Public/Release/ReleaseDates) |
| Chicago PMI (Business Barometer) | **Calendar-only** | The connector creates separate calendar events and explicitly marks values as not synced; it retains the official source page. | [ISM Chicago / MNI Indicators](https://chicago.ismworld.org/news-publications/reports/research-survey/) |
| Eurostat connector | **Fully done** | The connector contains separate release mappings and an official Eurostat Statistics API value workflow; the recorded synchronization returned `fetched=204`, `synced=204`, and `valueBacked=143`. Individual Eurostat series are listed below because their statuses differ. | [Eurostat release calendar](https://ec.europa.eu/eurostat/news/release-calendar) |

Eurostat is broken down below because the code contains both value-backed and calendar-only series. The value-backed entries use the official Eurostat Statistics API through `src/lib/eurostatEconomicData.ts`. The calendar-only entries have release mappings and official Data Browser links but no entry in the connector's `VALUE_CONFIGS` map.

| Eurostat series | Status | Code verification |
|---|---|---|
| Euro Area Flash CPI YoY | **Fully done** | Numeric configuration: `prc_hicp_minr`, annual percentage change. |
| Euro Area Flash CPI MoM | **Fully done** | Numeric configuration: `prc_hicp_minr`, monthly percentage change. |
| Euro Area CPI YoY | **Fully done** | Numeric configuration: `prc_hicp_minr`, annual percentage change. |
| Euro Area CPI MoM | **Fully done** | Numeric configuration: `prc_hicp_minr`, monthly percentage change. |
| Euro Area GDP QoQ | **Fully done** | Numeric configuration: `namq_10_gdp`, seasonally adjusted quarter-on-quarter change. |
| Euro Area Employment Change QoQ | **Fully done** | Numeric configuration: `namq_10_a10_e`, seasonally adjusted employment change. |
| Euro Area Unemployment Rate | **Fully done** | Numeric configuration: `une_rt_m`, seasonally adjusted total unemployment rate. |
| Euro Area Industrial Production MoM | **Fully done** | Numeric configuration: `sts_inpr_m`, seasonally adjusted production change. |
| Euro Area Retail Sales MoM | **Fully done** | Numeric configuration: `sts_trtu_m`, seasonally adjusted volume-sales change. |
| Euro Area PPI MoM | **Fully done** | Numeric configuration: `sts_inppd_m`, producer-price change. |
| Euro Area Construction Output MoM | **Fully done** | Numeric configuration: `sts_copr_m`, seasonally adjusted construction production change. |
| Euro Area Labour Cost YoY | **Fully done** | Numeric configuration: `lc_lci_r2_q`, labour-cost change. |
| Euro Area House Price Index | **Fully done** | Numeric configuration: `prc_hpi_q`, total-purchase house-price change. |
| Euro Area Services Production | **Fully done** | Numeric configuration: `sts_sepr_m`, services production change. |
| Euro Area Building Permits | **Fully done** | Numeric configuration: `sts_cobp_m`, building-permit index change. |
| Euro Area Trade Balance | **Calendar-only** | Release mapping exists for `ext_st_27_2020msbec`, but no numeric `VALUE_CONFIGS` entry exists. |
| Euro Area Current Account | **Calendar-only** | Release mapping exists for `bop_c6_q`, but no numeric `VALUE_CONFIGS` entry exists. |
| Euro Area Job Vacancy Rate | **Calendar-only** | Release mapping exists for `jvs_q_nace2`, but no numeric `VALUE_CONFIGS` entry exists. |
| Euro Area 3-Month Interest Rate | **Calendar-only** | Release mapping exists for `irt_euryld_m`, but no numeric `VALUE_CONFIGS` entry exists. |
| Euro Area Long-Term Government Bond Yield | **Calendar-only** | Release mapping exists for `irt_lt_mcby_m`, but no numeric `VALUE_CONFIGS` entry exists. |

## Roadmap — EUR Coverage

Work on EUR coverage in this priority order:

1. European Commission surveys, including business and consumer confidence surveys.
2. European Central Bank releases: interest-rate decisions, monetary-policy press conferences, introductory statements, press-conference Q&A transcripts, accounts/minutes, and related monetary-policy releases.
3. Eurozone PMI releases, with numeric values only where the official source permits redistribution; otherwise use the calendar-only direct-link workflow.
4. National releases, in this order: Germany, France, Italy, Spain, Netherlands, then other euro-area members.
5. EUR central-bank speeches and transcripts, including ECB Executive Board and Governing Council members and relevant national central-bank officials.

## Infrastructure

- Repo path: `C:/Users/DELL/OneDrive/Documents/Edgevault`
- Git branch: `recovery/edgevault-working`
- VPS worker id: `london-mt5-01`
- VPS agent path: `C:\Users\Administrator\Desktop\EdgeVault_Hosted_MT5_Agent`
- VPS Python path: `C:\Users\Administrator\AppData\Local\Python\pythoncore-3.13-64\python.exe`
- Worker log path: `C:\Users\Administrator\Desktop\EdgeVault_Hosted_MT5_Agent\edgevault-economic-worker.log`
- Scheduled tasks: `EdgeVault Economic Worker`, `EdgeVault MT5 Worker`
- Supabase tables for MT5 history: `mt5_account_snapshots`, `mt5_deals`, `mt5_orders`, `mt5_positions`, `mt5_sync_state`, `mt5_trade_records`

## Workflow Rules

- Use Git Bash for repository commands. Label PowerShell commands separately whenever PowerShell is used.
- Before any push, run the type-check, `git diff --check`, and `git diff --cached --check`; review the staged file list and stage only intended files. Never use blind `git add .`.
- Test locally and on the VPS before pushing to production. Do not push until the feature is tested and confirmed working.
- When replacing the VPS economic worker: stop the scheduled task, replace the exact canonical worker file, compile it with `py_compile`, verify that compilation passed, restart the task, and inspect the worker log.
- When checking worker logs, always check the timestamp on every error line before reporting it as current. A stale error from an earlier run in the same log file is not the same as a current failure.
- The normal worker handoff is to copy the worker code from EdgeVault and paste it into the canonical VPS file. Do not create competing worker files or update a nested folder by mistake.
- Never give line-by-line edits, diffs, or partial snippets for a file that already exists. Always provide the complete full replacement content of every changed file, with nothing omitted or abbreviated, so it can be copied or extracted as-is without manual merging.
- When a task changes more than one file, package every changed file into one downloadable ZIP while preserving the correct repository paths, such as `src/lib/eurostatEconomicData.ts`. Do not paste files one by one unless explicitly asked.
- Always list every file included in a ZIP with its full path so the contents can be confirmed before extraction.
- Every time a feature is finished, a bug is fixed, or an architecture decision is made, update this file in the same session. Do not wait to be asked.
- If a status or statement becomes wrong, correct it in place immediately. This file must reflect the actual current code and verified runtime state, not an intention, plan, or stale log line.
- Keep the status vocabulary limited to the three statuses in **Status Legend**: **Fully done**, **Calendar-only**, and **Not started**.
- This file is a permanent living reference for any AI assistant or developer opening the repository; it is not a chat summary.
- The full-file-only and ZIP-packaged workflow applies to `PROJECT_NOTES.md` itself. Regenerate and provide the complete file whenever it changes; never provide a partial patch for it.

## Non-Negotiable Architecture Rules

- DXY Master EA: DXY is the only analysis source. Follower pairs must not generate their own market structure, targets, invalidation, Fair Value Gaps, liquidity voids, or entry analysis.
- DXY Master EA activation balance threshold: `$500`.
- DXY Master EA entry 1 raw lot: `(activation balance / 500) * 0.02`, truncated to the broker's volume step.
- DXY Master EA entry 2: entry 1 multiplied by `1.5`.
- MicroMacro Bias Indicator: visual market-structure tool only. Never add trade execution, stop-loss/take-profit, mitigation, invalidation lifecycle, or trade-management logic to it.