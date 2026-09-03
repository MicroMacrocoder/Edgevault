from __future__ import annotations

import json
import logging
import os
import ssl
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Any

import certifi


AGENT_DIR = Path(__file__).resolve().parent
LOG = logging.getLogger("edgevault-economic-worker")
STATE_PATH = AGENT_DIR / "economic-worker-state.json"


def load_env(path: Path) -> None:
    if not path.exists():
        return
    for raw_line in path.read_text(encoding="utf-8-sig").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


load_env(AGENT_DIR / ".env")


def required_env(name: str, *aliases: str) -> str:
    for candidate in (name, *aliases):
        value = os.getenv(candidate, "").strip()
        if value:
            return value
    raise RuntimeError(f"Missing {name} in {AGENT_DIR / '.env'}")


BASE_URL = required_env("EDGEVAULT_BASE_URL", "EDGEVAULT_API_BASE").rstrip("/")
CRON_SECRET = required_env("EDGEVAULT_CRON_SECRET", "CRON_SECRET")
CALENDAR_REFRESH_SECONDS = max(
    900, int(os.getenv("ECONOMIC_CALENDAR_REFRESH_SECONDS", "21600"))
)
EVENT_REFRESH_SECONDS = max(
    60, int(os.getenv("ECONOMIC_EVENT_REFRESH_SECONDS", "300"))
)
FULL_HISTORY_SECONDS = max(
    21600, int(os.getenv("ECONOMIC_FULL_HISTORY_SECONDS", "86400"))
)
RELEASE_RETRY_SECONDS = (30, 60, 120, 300, 600, 900)
SSL_CONTEXT = ssl.create_default_context(cafile=certifi.where())


@dataclass
class ReleaseWatch:
    source: str
    event_time: datetime
    next_attempt_at: datetime
    attempts: int = 0


def configure_logging() -> None:
    formatter = logging.Formatter("%(asctime)s %(levelname)s %(message)s")
    LOG.setLevel(logging.INFO)

    console = logging.StreamHandler()
    console.setFormatter(formatter)
    LOG.addHandler(console)

    file_handler = RotatingFileHandler(
        AGENT_DIR / "edgevault-economic-worker.log",
        maxBytes=5_000_000,
        backupCount=3,
        encoding="utf-8",
    )
    file_handler.setFormatter(formatter)
    LOG.addHandler(file_handler)


def parse_iso(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc)


def request_json(
    path: str,
    *,
    method: str = "GET",
    authorized: bool = False,
    timeout: int = 180,
) -> dict[str, Any]:
    headers = {
        "Accept": "application/json",
        "Cache-Control": "no-store",
        "User-Agent": "EdgeVault-Economic-Worker/1.0",
    }
    data = None
    if method == "POST":
        headers["Content-Type"] = "application/json"
        data = b"{}"
    if authorized:
        headers["Authorization"] = f"Bearer {CRON_SECRET}"

    request = urllib.request.Request(
        f"{BASE_URL}{path}", data=data, method=method, headers=headers
    )
    try:
        with urllib.request.urlopen(
            request, timeout=timeout, context=SSL_CONTEXT
        ) as response:
            body = response.read().decode("utf-8")
    except urllib.error.HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"EdgeVault returned HTTP {error.code}: {body}") from error
    except urllib.error.URLError as error:
        raise RuntimeError(f"Could not reach EdgeVault: {error.reason}") from error

    payload = json.loads(body)
    if not isinstance(payload, dict):
        raise RuntimeError("EdgeVault returned an invalid JSON response.")
    return payload


def synchronize_calendar() -> dict[str, Any]:
    bls_result = request_json(
        "/api/economic-events/sync/bls", method="POST", authorized=True
    )
    LOG.info(
        "BLS calendar synchronized: fetched=%s synced=%s",
        bls_result.get("fetched"),
        bls_result.get("synced"),
    )
    bea_result = request_json(
        "/api/economic-events/sync/bea", method="POST", authorized=True
    )
    LOG.info(
        "BEA calendar synchronized: fetched=%s synced=%s",
        bea_result.get("fetched"),
        bea_result.get("synced"),
    )
    fed_result = request_json(
        "/api/economic-events/sync/fed", method="POST", authorized=True
    )
    LOG.info(
        "Federal Reserve calendar synchronized: fetched=%s synced=%s",
        fed_result.get("fetched"),
        fed_result.get("synced"),
    )
    census_result = request_json(
        "/api/economic-events/sync/census", method="POST", authorized=True
    )
    LOG.info(
        "Census calendar synchronized: fetched=%s synced=%s",
        census_result.get("fetched"),
        census_result.get("synced"),
    )
    dol_result = request_json(
        "/api/economic-events/sync/dol", method="POST", authorized=True
    )
    LOG.info(
        "DOL calendar synchronized: fetched=%s synced=%s",
        dol_result.get("fetched"),
        dol_result.get("synced"),
    )
    return {
        "bls": bls_result,
        "bea": bea_result,
        "fed": fed_result,
        "census": census_result,
        "dol": dol_result,
    }


def synchronize_history(mode: str, force_link: bool = False) -> dict[str, Any]:
    query = urllib.parse.urlencode(
        {"mode": mode, "forceLink": "1" if force_link else "0"}
    )
    result = request_json(
        f"/api/economic-events/sync/bls/history?{query}",
        method="POST",
        authorized=True,
        timeout=240,
    )
    LOG.info(
        "BLS %s history synchronized: synced=%s inserted=%s revised=%s events=%s",
        mode,
        result.get("synced"),
        result.get("inserted"),
        result.get("revised"),
        result.get("calendarEventsUpdated"),
    )
    return result


def synchronize_bea_history() -> dict[str, Any]:
    result = request_json(
        "/api/economic-events/sync/bea/history",
        method="POST",
        authorized=True,
        timeout=240,
    )
    LOG.info(
        "BEA history synchronized: synced=%s inserted=%s revised=%s events=%s",
        result.get("synced"),
        result.get("inserted"),
        result.get("revised"),
        result.get("calendarEventsUpdated"),
    )
    return result


def synchronize_census_history() -> dict[str, Any]:
    result = request_json(
        "/api/economic-events/sync/census/history",
        method="POST",
        authorized=True,
        timeout=240,
    )
    LOG.info(
        "Census history synchronized: synced=%s inserted=%s revised=%s events=%s",
        result.get("synced"),
        result.get("inserted"),
        result.get("revised"),
        result.get("calendarEventsUpdated"),
    )
    return result


def synchronize_dol_history() -> dict[str, Any]:
    result = request_json(
        "/api/economic-events/sync/dol/history",
        method="POST",
        authorized=True,
        timeout=240,
    )
    LOG.info(
        "DOL history synchronized: synced=%s inserted=%s revised=%s events=%s",
        result.get("synced"),
        result.get("inserted"),
        result.get("revised"),
        result.get("calendarEventsUpdated"),
    )
    return result


def fetch_upcoming_release_times(source_agency: str) -> list[datetime]:
    now = datetime.now(timezone.utc)
    query = urllib.parse.urlencode(
        {
            "currency": "USD",
            "from": (now - timedelta(minutes=30)).isoformat(),
            "to": (now + timedelta(days=8)).isoformat(),
            "limit": "500",
        }
    )
    payload = request_json(f"/api/economic-events?{query}")
    release_times: set[datetime] = set()
    for event in payload.get("events", []):
        if event.get("source_agency") != source_agency:
            continue
        event_time = event.get("event_time")
        if not event_time:
            continue
        release_times.add(parse_iso(event_time))
    return sorted(release_times)


def load_completed_releases() -> dict[str, str]:
    if not STATE_PATH.exists():
        return {}
    try:
        payload = json.loads(STATE_PATH.read_text(encoding="utf-8"))
        completed = payload.get("completedReleases", {})
        return completed if isinstance(completed, dict) else {}
    except (OSError, ValueError, TypeError):
        LOG.warning("Could not read %s; starting with empty release state.", STATE_PATH)
        return {}


def save_completed_releases(completed: dict[str, str]) -> None:
    cutoff = datetime.now(timezone.utc) - timedelta(days=30)
    retained = {
        event_time: completed_at
        for event_time, completed_at in completed.items()
        if parse_iso(event_time) >= cutoff
    }
    temporary = STATE_PATH.with_suffix(".tmp")
    temporary.write_text(
        json.dumps({"completedReleases": retained}, indent=2), encoding="utf-8"
    )
    temporary.replace(STATE_PATH)


def refresh_release_watches(
    watches: dict[str, ReleaseWatch], completed: dict[str, str]
) -> None:
    now = datetime.now(timezone.utc)
    sources = {
        "bls": "U.S. Bureau of Labor Statistics",
        "bea": "U.S. Bureau of Economic Analysis",
        "census": "U.S. Census Bureau",
        "dol": "U.S. Department of Labor, Employment and Training Administration",
    }
    for source, source_agency in sources.items():
        for event_time in fetch_upcoming_release_times(source_agency):
            key = f"{source}:{event_time.isoformat()}"
            if key in completed or key in watches:
                continue
            if event_time < now - timedelta(minutes=30):
                continue
            watches[key] = ReleaseWatch(
                source=source,
                event_time=event_time,
                next_attempt_at=max(now, event_time + timedelta(seconds=30)),
            )
    LOG.info("Watching %s upcoming economic release times.", len(watches))


def process_release_watches(
    watches: dict[str, ReleaseWatch], completed: dict[str, str]
) -> None:
    now = datetime.now(timezone.utc)
    for key, watch in list(watches.items()):
        if now < watch.next_attempt_at:
            continue

        if watch.source == "bls":
            result = synchronize_history("recent")
        elif watch.source == "bea":
            result = synchronize_bea_history()
        elif watch.source == "census":
            result = synchronize_census_history()
        else:
            result = synchronize_dol_history()
        changed = int(result.get("inserted") or 0) + int(result.get("revised") or 0)
        watch.attempts += 1

        if changed > 0:
            completed[key] = now.isoformat()
            watches.pop(key, None)
            save_completed_releases(completed)
            LOG.info("Captured %s release %s after %s attempts.", watch.source, key, watch.attempts)
            continue

        if watch.attempts >= len(RELEASE_RETRY_SECONDS):
            completed[key] = now.isoformat()
            watches.pop(key, None)
            save_completed_releases(completed)
            LOG.warning("No new %s values found for release %s after all retries.", watch.source, key)
            continue

        watch.next_attempt_at = now + timedelta(
            seconds=RELEASE_RETRY_SECONDS[watch.attempts]
        )


def main() -> None:
    configure_logging()
    LOG.info("EdgeVault economic worker started.")

    completed = load_completed_releases()
    watches: dict[str, ReleaseWatch] = {}
    now_monotonic = time.monotonic()
    next_calendar_refresh = now_monotonic
    next_event_refresh = now_monotonic
    next_full_history = now_monotonic + FULL_HISTORY_SECONDS
    startup_history_pending = True

    while True:
        try:
            now_monotonic = time.monotonic()

            if now_monotonic >= next_calendar_refresh:
                synchronize_calendar()
                next_calendar_refresh = now_monotonic + CALENDAR_REFRESH_SECONDS
                next_event_refresh = now_monotonic

            if startup_history_pending:
                synchronize_history("recent", force_link=True)
                synchronize_bea_history()
                synchronize_census_history()
                synchronize_dol_history()
                startup_history_pending = False

            if now_monotonic >= next_full_history:
                synchronize_history("full")
                synchronize_bea_history()
                synchronize_census_history()
                synchronize_dol_history()
                next_full_history = now_monotonic + FULL_HISTORY_SECONDS

            if now_monotonic >= next_event_refresh:
                refresh_release_watches(watches, completed)
                next_event_refresh = now_monotonic + EVENT_REFRESH_SECONDS

            process_release_watches(watches, completed)
        except KeyboardInterrupt:
            LOG.info("Economic worker stopped by administrator.")
            return
        except Exception:
            LOG.exception("Economic worker cycle failed; retrying in 30 seconds.")
            time.sleep(30)
            continue

        time.sleep(1)


if __name__ == "__main__":
    main()
