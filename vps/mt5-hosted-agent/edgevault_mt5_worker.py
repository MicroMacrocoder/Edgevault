from __future__ import annotations

import configparser
import hashlib
import json
import logging
import os
import re
import shutil
import ssl
import subprocess
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import certifi
import psutil


AGENT_DIR = Path(__file__).resolve().parent
LOG = logging.getLogger("edgevault-mt5-worker")


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
    value = next(
        (os.getenv(candidate, "").strip() for candidate in (name, *aliases) if os.getenv(candidate, "").strip()),
        "",
    )
    if not value:
        raise RuntimeError(f"Missing {name} in {AGENT_DIR / '.env'}")
    return value


BASE_URL = required_env("EDGEVAULT_BASE_URL", "EDGEVAULT_API_BASE").rstrip("/")
WORKER_SECRET = required_env("EDGEVAULT_WORKER_SECRET", "MT5_WORKER_SECRET")
WORKER_ID = os.getenv("EDGEVAULT_WORKER_ID", "london-mt5-01").strip()
SLOT_ROOT = Path(os.getenv("MT5_SLOT_ROOT", r"C:\EdgeVaultMT5").strip())
SLOT_NAMES = [item.strip() for item in os.getenv("MT5_SLOT_NAMES", "Slot01").split(",") if item.strip()]
SERVER_DATABASE_VALUE = os.getenv("MT5_SERVER_DATABASE", "").strip()
SERVER_DATABASE_PATH = Path(SERVER_DATABASE_VALUE) if SERVER_DATABASE_VALUE else None
POLL_SECONDS = max(1, int(os.getenv("POLL_SECONDS", "3")))
CONNECT_TIMEOUT_SECONDS = max(30, int(os.getenv("CONNECT_TIMEOUT_SECONDS", "150")))
DISCOVERY_TIMEOUT_SECONDS = max(30, int(os.getenv("DISCOVERY_TIMEOUT_SECONDS", "120")))
SSL_CONTEXT = ssl.create_default_context(cafile=certifi.where())
CACHE_DIR = AGENT_DIR / "server-cache"


@dataclass
class ActiveSession:
    slot_name: str
    job_id: str
    account_id: str
    expected_login: str
    result_path: Path
    sync_path: Path
    config_path: Path
    process: Any
    last_result_mtime_ns: int = 0
    connected: bool = False
    started_at: float = 0.0


@dataclass
class RestoredTerminalProcess:
    process: psutil.Process

    def poll(self) -> int | None:
        try:
            if self.process.is_running() and self.process.status() != psutil.STATUS_ZOMBIE:
                return None
        except (psutil.AccessDenied, psutil.NoSuchProcess):
            pass
        return 0


def api_request(path: str, payload: dict[str, Any]) -> dict[str, Any]:
    request = urllib.request.Request(
        f"{BASE_URL}{path}",
        data=json.dumps(payload).encode("utf-8"),
        method="POST",
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Cache-Control": "no-store",
            "x-edgevault-mt5-worker-secret": WORKER_SECRET,
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=30, context=SSL_CONTEXT) as response:
            body = response.read().decode("utf-8")
    except urllib.error.HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"EdgeVault returned HTTP {error.code}: {body}") from error
    except urllib.error.URLError as error:
        raise RuntimeError(f"Could not reach EdgeVault: {error.reason}") from error
    data = json.loads(body)
    if not data.get("success"):
        raise RuntimeError(data.get("message") or "EdgeVault request failed.")
    return data


def claim_job(
    active_account_ids: list[str] | None = None,
    has_free_slot: bool = True,
) -> dict[str, Any] | None:
    return api_request(
        "/api/mt5/worker/jobs",
        {
            "workerId": WORKER_ID,
            "hasFreeSlot": has_free_slot,
            "activeAccountIds": active_account_ids or [],
        },
    ).get("job")


def post_result(job_id: str, slot_name: str, success: bool, message: str, account_info: dict[str, Any] | None = None) -> None:
    api_request(
        "/api/mt5/worker/result",
        {
            "jobId": job_id,
            "success": success,
            "message": message,
            "accountInfo": account_info or {},
            "terminalSlot": slot_name,
            "workerId": WORKER_ID,
        },
    )


def post_sync(session: ActiveSession, payload: dict[str, Any]) -> None:
    payload["workerId"] = WORKER_ID
    payload["accountId"] = session.account_id
    payload["login"] = session.expected_login
    api_request("/api/mt5/worker/sync", payload)


def stop_slot_terminal(terminal_path: Path) -> None:
    target = os.path.normcase(str(terminal_path.resolve()))
    for process in psutil.process_iter(["pid", "exe"]):
        try:
            executable = process.info.get("exe")
            if executable and os.path.normcase(str(Path(executable).resolve())) == target:
                LOG.info("Stopping old terminal process %s for %s", process.pid, terminal_path)
                process.terminate()
                try:
                    process.wait(timeout=15)
                except psutil.TimeoutExpired:
                    process.kill()
        except (psutil.AccessDenied, psutil.NoSuchProcess, OSError):
            continue


def file_contains_server(path: Path, server_name: str) -> bool:
    try:
        content = path.read_bytes().lower()
    except OSError:
        return False
    needles = [
        server_name.encode("utf-8", errors="ignore").lower(),
        server_name.encode("utf-16-le", errors="ignore").lower(),
    ]
    return any(needle and needle in content for needle in needles)


def terminal_data_directories() -> list[Path]:
    directories: list[Path] = []
    appdata = os.getenv("APPDATA", "").strip()
    if appdata:
        terminal_root = Path(appdata) / "MetaQuotes" / "Terminal"
        if terminal_root.exists():
            directories.extend(path for path in terminal_root.iterdir() if path.is_dir())
    directories.extend(SLOT_ROOT / name for name in SLOT_NAMES)
    return directories


def data_directory_knows_server(data_dir: Path, server_name: str) -> bool:
    servers_file = data_dir / "config" / "servers.dat"
    if not servers_file.exists():
        return False
    if file_contains_server(servers_file, server_name):
        return True
    logs_dir = data_dir / "logs"
    if not logs_dir.exists():
        return False
    try:
        recent_logs = sorted(
            (path for path in logs_dir.glob("*.log") if path.is_file()),
            key=lambda path: path.stat().st_mtime,
            reverse=True,
        )[:30]
    except OSError:
        return False
    return any(file_contains_server(path, server_name) for path in recent_logs)


def server_cache_path(server_name: str) -> Path:
    digest = hashlib.sha256(server_name.casefold().encode("utf-8")).hexdigest()[:20]
    return CACHE_DIR / f"{digest}.servers.dat"


def cache_server_database(source: Path, server_name: str) -> None:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    target = server_cache_path(server_name)
    shutil.copy2(source, target)
    index_path = CACHE_DIR / "index.json"
    try:
        index = json.loads(index_path.read_text(encoding="utf-8")) if index_path.exists() else {}
    except (OSError, json.JSONDecodeError):
        index = {}
    index[server_name.casefold()] = {
        "server": server_name,
        "file": target.name,
        "cachedAt": int(time.time()),
    }
    index_path.write_text(json.dumps(index, indent=2), encoding="utf-8")


def normalize_discovery_text(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", value.casefold())


def write_discovery_controls(process_id: int, controls: list[str]) -> Path:
    diagnostics_dir = AGENT_DIR / "discovery-diagnostics"
    diagnostics_dir.mkdir(parents=True, exist_ok=True)
    path = diagnostics_dir / f"controls-{process_id}-{int(time.time())}.txt"
    path.write_text("\n".join(controls), encoding="utf-8")
    return path


def discover_server_database(slot_path: Path, broker_name: str, server_name: str) -> None:
    """Use MT5's own broker directory to download metadata for an unknown server."""
    if os.name != "nt":
        raise RuntimeError("Automatic MT5 server discovery must run on the Windows VPS.")

    from pywinauto import Desktop
    from pywinauto.keyboard import send_keys
    import win32con
    import win32gui

    terminal_path = slot_path / "terminal64.exe"
    servers_file = slot_path / "config" / "servers.dat"
    stop_slot_terminal(terminal_path)
    LOG.info(
        "Discovering %s server %s through the MetaTrader broker directory",
        broker_name,
        server_name,
    )
    process = subprocess.Popen(
        [str(terminal_path), "/portable"],
        cwd=str(slot_path),
        creationflags=subprocess.CREATE_NEW_PROCESS_GROUP,
    )
    controls_seen: list[str] = []
    try:
        deadline = time.monotonic() + DISCOVERY_TIMEOUT_SECONDS
        main_window = None
        while time.monotonic() < deadline and process.poll() is None:
            windows = Desktop(backend="win32").windows(process=process.pid, visible_only=False)
            candidates = [window for window in windows if window.handle and window.class_name() != "#32770"]
            if candidates:
                main_window = max(candidates, key=lambda window: window.rectangle().width() * window.rectangle().height())
                break
            time.sleep(1)
        if main_window is None:
            raise RuntimeError("MT5 started, but its main window was not available to the discovery worker.")

        win32gui.SendMessage(main_window.handle, win32con.WM_COMMAND, 32919, 0)
        dialog_handle = None
        while time.monotonic() < deadline and process.poll() is None:
            for window in Desktop(backend="win32").windows(process=process.pid, visible_only=False):
                title = window.window_text().strip()
                if title:
                    controls_seen.append(f"WINDOW | {window.class_name()} | {title}")
                if window.handle != main_window.handle and (
                    "open an account" in title.casefold() or window.class_name() == "#32770"
                ):
                    dialog_handle = window.handle
                    break
            if dialog_handle:
                break
            time.sleep(1)
        if not dialog_handle:
            raise RuntimeError("MT5 did not open its broker-search window.")

        dialog = Desktop(backend="uia").window(handle=dialog_handle)
        server_key = normalize_discovery_text(server_name)
        brand_key = normalize_discovery_text(broker_name)

        # MT5 officially accepts a company name or server address in this box.
        # Try the exact assigned server first so multi-entity brokers such as
        # Exness resolve to the correct company rather than the first brand hit.
        discovery_terms = [server_name, broker_name]
        for term in dict.fromkeys(item.strip() for item in discovery_terms if item.strip()):
            edits = [control for control in dialog.descendants(control_type="Edit") if control.is_enabled()]
            if not edits:
                raise RuntimeError("The MT5 broker-search window opened without an editable search field.")
            search_box = edits[0]
            search_box.set_edit_text(term)
            buttons = [control for control in dialog.descendants(control_type="Button") if control.is_enabled()]
            search_buttons = [
                button for button in buttons
                if any(word in button.window_text().casefold() for word in ("find", "search", "broker"))
            ]
            if search_buttons:
                search_buttons[0].invoke()
            else:
                search_box.set_focus()
                send_keys("{ENTER}")

            search_deadline = min(deadline, time.monotonic() + 25)
            chosen = None
            while time.monotonic() < search_deadline and process.poll() is None:
                result_controls = []
                for control_type in ("ListItem", "DataItem", "TreeItem"):
                    result_controls.extend(dialog.descendants(control_type=control_type))
                for control in result_controls:
                    text = control.window_text().strip()
                    if text:
                        controls_seen.append(f"RESULT | {control_type} | {text}")
                    normalized = normalize_discovery_text(text)
                    if normalized and (server_key in normalized or brand_key in normalized or normalized in server_key):
                        chosen = control
                        break
                if chosen:
                    break
                if servers_file.exists() and file_contains_server(servers_file, server_name):
                    cache_server_database(servers_file, server_name)
                    LOG.info("MT5 downloaded metadata for %s", server_name)
                    return
                time.sleep(1)

            if chosen:
                try:
                    chosen.select()
                except Exception:
                    chosen.invoke()
                buttons = [control for control in dialog.descendants(control_type="Button") if control.is_enabled()]
                next_buttons = [
                    button for button in buttons
                    if button.window_text().strip().casefold() in {"next", "next >", "finish"}
                ]
                if next_buttons:
                    next_buttons[0].invoke()
                else:
                    try:
                        chosen.double_click_input()
                    except Exception:
                        chosen.invoke()

            metadata_deadline = min(deadline, time.monotonic() + 30)
            while time.monotonic() < metadata_deadline and process.poll() is None:
                if servers_file.exists() and file_contains_server(servers_file, server_name):
                    cache_server_database(servers_file, server_name)
                    LOG.info("MT5 discovered and cached server %s", server_name)
                    return
                time.sleep(1)

        diagnostic_path = write_discovery_controls(process.pid, controls_seen)
        raise RuntimeError(
            f'MetaTrader searched its broker directory but did not return the exact server "{server_name}". '
            f"Discovery controls were saved to {diagnostic_path}."
        )
    finally:
        try:
            process.terminate()
            process.wait(timeout=15)
        except (subprocess.TimeoutExpired, OSError):
            try:
                process.kill()
            except OSError:
                pass


def provision_server_database(slot_path: Path, broker_name: str, server_name: str) -> None:
    target = slot_path / "config" / "servers.dat"
    if target.exists() and file_contains_server(target, server_name):
        return
    if SERVER_DATABASE_PATH:
        if not SERVER_DATABASE_PATH.exists():
            raise RuntimeError(
                f"Configured MT5 server database does not exist: {SERVER_DATABASE_PATH}"
            )
        if SERVER_DATABASE_PATH.stat().st_size == 0:
            raise RuntimeError(
                f"Configured MT5 server database is empty: {SERVER_DATABASE_PATH}"
            )
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(SERVER_DATABASE_PATH, target)
        LOG.info(
            "Provisioned the verified MT5 server database for %s / %s",
            broker_name,
            server_name,
        )
        return
    cached = server_cache_path(server_name)
    if cached.exists() and file_contains_server(cached, server_name):
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(cached, target)
        LOG.info("Loaded cached broker server metadata for %s", server_name)
        return
    for data_dir in terminal_data_directories():
        source = data_dir / "config" / "servers.dat"
        if data_dir.resolve() == slot_path.resolve() or not source.exists():
            continue
        if not data_directory_knows_server(data_dir, server_name):
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)
        cache_server_database(source, server_name)
        LOG.info("Provisioned broker server metadata for %s", server_name)
        return
    discover_server_database(slot_path, broker_name, server_name)
    if not target.exists() or not file_contains_server(target, server_name):
        raise RuntimeError(f'MT5 discovery completed without installing metadata for "{server_name}".')


def write_preset(slot_path: Path, job: dict[str, Any]) -> None:
    preset_dir = slot_path / "MQL5" / "Presets"
    preset_dir.mkdir(parents=True, exist_ok=True)
    (preset_dir / "EdgeVaultBridge.set").write_text(
        "\n".join([
            f"EdgeVaultJobId={job['id']}",
            f"EdgeVaultAccountId={job['accountId']}",
            f"EdgeVaultWorkerId={WORKER_ID}",
            f"EdgeVaultExpectedLogin={job['login']}",
            f"EdgeVaultTerminalSlot={slot_path.name}",
            "EdgeVaultResultFile=edgevault_bridge_result.json",
            "EdgeVaultSyncFile=edgevault_mt5_sync.json",
            f"EdgeVaultConnectTimeoutSeconds={CONNECT_TIMEOUT_SECONDS}",
            "EdgeVaultSnapshotSeconds=5",
            "EdgeVaultHistoryBatchSize=200",
            "EdgeVaultIncrementalSyncSeconds=10",
            "EdgeVaultHistoryOverlapSeconds=300",
            "",
        ]),
        encoding="utf-8",
    )


def write_terminal_config(slot_path: Path, job: dict[str, Any]) -> Path:
    runtime_dir = slot_path / "EdgeVaultRuntime"
    runtime_dir.mkdir(parents=True, exist_ok=True)
    config_path = runtime_dir / f"connect-{job['id']}.ini"
    config = configparser.ConfigParser(interpolation=None)
    config.optionxform = str
    config["Common"] = {
        "Login": str(job["login"]), "Server": str(job["server"]),
        "Password": str(job["password"]), "KeepPrivate": "0",
        "NewsEnable": "0", "CertInstall": "0",
    }
    config["Experts"] = {
        "AllowLiveTrading": "0", "AllowDllImport": "0", "Enabled": "1",
        "Account": "0", "Profile": "0",
    }
    config["StartUp"] = {
        "Expert": "EdgeVaultBridge", "ExpertParameters": "EdgeVaultBridge.set",
        "Symbol": "EURUSD", "Period": "M1", "ShutdownTerminal": "0",
    }
    with config_path.open("w", encoding="utf-8", newline="\r\n") as file:
        config.write(file, space_around_delimiters=False)
    return config_path


def read_preset_values(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values
    for raw_line in path.read_text(encoding="utf-8-sig").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip()
    return values


def find_running_terminal(terminal_path: Path) -> psutil.Process | None:
    target = os.path.normcase(str(terminal_path.resolve()))
    for process in psutil.process_iter(["pid", "exe"]):
        try:
            executable = process.info.get("exe")
            if executable and os.path.normcase(str(Path(executable).resolve())) == target:
                return process
        except (psutil.AccessDenied, psutil.NoSuchProcess, OSError):
            continue
    return None


def restore_running_sessions() -> dict[str, ActiveSession]:
    sessions: dict[str, ActiveSession] = {}
    for slot_name in SLOT_NAMES:
        slot_path = SLOT_ROOT / slot_name
        terminal_process = find_running_terminal(slot_path / "terminal64.exe")
        if terminal_process is None:
            continue
        preset = read_preset_values(slot_path / "MQL5" / "Presets" / "EdgeVaultBridge.set")
        account_id = preset.get("EdgeVaultAccountId", "").strip()
        expected_login = preset.get("EdgeVaultExpectedLogin", "").strip()
        job_id = preset.get("EdgeVaultJobId", "").strip()
        if not account_id or not expected_login or not job_id:
            LOG.warning(
                "%s is running without complete EdgeVault v3 session metadata; it will not be treated as a free slot.",
                slot_name,
            )
            continue
        result_path = slot_path / "MQL5" / "Files" / preset.get(
            "EdgeVaultResultFile", "edgevault_bridge_result.json"
        )
        sync_path = slot_path / "MQL5" / "Files" / preset.get(
            "EdgeVaultSyncFile", "edgevault_mt5_sync.json"
        )
        connected = False
        try:
            snapshot = json.loads(result_path.read_text(encoding="utf-8-sig"))
            account_info = snapshot.get("accountInfo") or {}
            connected = snapshot.get("success") is True and str(account_info.get("login") or "") == expected_login
        except (FileNotFoundError, OSError, json.JSONDecodeError):
            pass
        sessions[slot_name] = ActiveSession(
            slot_name=slot_name,
            job_id=job_id,
            account_id=account_id,
            expected_login=expected_login,
            result_path=result_path,
            sync_path=sync_path,
            config_path=slot_path / "EdgeVaultRuntime" / f"connect-{job_id}.ini",
            process=RestoredTerminalProcess(terminal_process),
            connected=connected,
            started_at=time.monotonic(),
        )
        LOG.info("Restored %s session for MT5 login %s", slot_name, expected_login)
    return sessions


def start_job(job: dict[str, Any], slot_name: str) -> ActiveSession:
    slot_path = SLOT_ROOT / slot_name
    terminal_path = slot_path / "terminal64.exe"
    expert_path = slot_path / "MQL5" / "Experts" / "EdgeVaultBridge.ex5"
    result_path = slot_path / "MQL5" / "Files" / "edgevault_bridge_result.json"
    sync_path = slot_path / "MQL5" / "Files" / "edgevault_mt5_sync.json"
    if not terminal_path.exists():
        raise RuntimeError(f"Missing terminal: {terminal_path}")
    if not expert_path.exists():
        raise RuntimeError(f"Missing compiled terminal bridge: {expert_path}")
    stop_slot_terminal(terminal_path)
    provision_server_database(slot_path, str(job["broker"]), str(job["server"]))
    result_path.parent.mkdir(parents=True, exist_ok=True)
    result_path.unlink(missing_ok=True)
    sync_path.unlink(missing_ok=True)
    write_preset(slot_path, job)
    config_path = write_terminal_config(slot_path, job)
    LOG.info("Launching %s for MT5 login %s on server %s", slot_name, job["login"], job["server"])
    process = subprocess.Popen(
        [str(terminal_path), f"/config:{config_path}", "/portable"],
        cwd=str(slot_path), creationflags=subprocess.CREATE_NEW_PROCESS_GROUP,
    )
    return ActiveSession(
        slot_name=slot_name, job_id=str(job["id"]), account_id=str(job["accountId"]),
        expected_login=str(job["login"]), result_path=result_path, sync_path=sync_path,
        config_path=config_path, process=process, started_at=time.monotonic(),
    )


def read_new_snapshot(session: ActiveSession) -> dict[str, Any] | None:
    try:
        stat = session.result_path.stat()
    except FileNotFoundError:
        return None
    if stat.st_mtime_ns <= session.last_result_mtime_ns:
        return None
    raw = session.result_path.read_text(encoding="utf-8-sig").strip()
    if not raw:
        return None
    snapshot = json.loads(raw)
    session.last_result_mtime_ns = stat.st_mtime_ns
    return snapshot


def forward_snapshots(sessions: dict[str, ActiveSession]) -> None:
    for slot_name, session in list(sessions.items()):
        if session.process.poll() is not None:
            if not session.connected:
                post_result(session.job_id, slot_name, False, "The MT5 terminal closed before the account connected.")
            session.config_path.unlink(missing_ok=True)
            del sessions[slot_name]
            continue
        try:
            snapshot = read_new_snapshot(session)
        except (OSError, json.JSONDecodeError) as error:
            LOG.warning("Could not read %s snapshot: %s", slot_name, error)
            continue
        if not snapshot:
            if (
                not session.connected
                and session.started_at > 0
                and time.monotonic() - session.started_at >= CONNECT_TIMEOUT_SECONDS
            ):
                message = (
                    "The MT5 terminal opened, but the EdgeVault bridge did not return "
                    f"a connection result within {CONNECT_TIMEOUT_SECONDS} seconds."
                )
                post_result(session.job_id, slot_name, False, message)
                LOG.error("%s connection timed out: no bridge result file", slot_name)
                session.config_path.unlink(missing_ok=True)
                stop_slot_terminal(SLOT_ROOT / slot_name / "terminal64.exe")
                del sessions[slot_name]
            continue
        success = snapshot.get("success") is True
        account_info = snapshot.get("accountInfo") or {}
        actual_login = str(account_info.get("login") or "")
        if success and actual_login != session.expected_login:
            success = False
            snapshot["message"] = f"MT5 opened login {actual_login or 'unknown'} instead of requested login {session.expected_login}."
        post_result(
            session.job_id, slot_name, success,
            str(snapshot.get("message") or "MT5 terminal bridge updated."), account_info,
        )
        session.connected = success
        LOG.info("Forwarded %s snapshot for job %s", slot_name, session.job_id)
        if success:
            session.config_path.unlink(missing_ok=True)
        if not success:
            session.config_path.unlink(missing_ok=True)
            stop_slot_terminal(SLOT_ROOT / slot_name / "terminal64.exe")
            del sessions[slot_name]


def forward_sync_batches(sessions: dict[str, ActiveSession]) -> None:
    for slot_name, session in list(sessions.items()):
        if not session.connected or not session.sync_path.exists():
            continue
        try:
            raw = session.sync_path.read_text(encoding="utf-8-sig").strip()
            if not raw:
                continue
            payload = json.loads(raw)
            if not isinstance(payload, dict):
                raise ValueError("MT5 sync payload must be a JSON object.")
            post_sync(session, payload)
            session.sync_path.unlink(missing_ok=True)
            LOG.info("Forwarded %s MT5 history batch for account %s", slot_name, session.account_id)
        except (OSError, ValueError, json.JSONDecodeError) as error:
            LOG.warning("Could not read %s MT5 history batch: %s", slot_name, error)
        except Exception as error:
            LOG.warning(
                "Could not forward %s MT5 history batch; retaining it for retry: %s",
                slot_name,
                error,
            )


def validate_slots() -> None:
    if not SLOT_NAMES:
        raise RuntimeError("MT5_SLOT_NAMES must contain at least one terminal slot.")
    for slot_name in SLOT_NAMES:
        terminal_path = SLOT_ROOT / slot_name / "terminal64.exe"
        if not terminal_path.exists():
            raise RuntimeError(f"Missing terminal slot executable: {terminal_path}")


def main() -> int:
    logging.basicConfig(
        level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s",
        handlers=[logging.StreamHandler(sys.stdout), logging.FileHandler(AGENT_DIR / "edgevault-worker.log", encoding="utf-8")],
    )
    validate_slots()
    sessions = restore_running_sessions()
    LOG.info("EdgeVault hosted MT5 worker started as %s", WORKER_ID)
    while True:
        try:
            forward_snapshots(sessions)
            forward_sync_batches(sessions)
            free_slot = next(
                (
                    name
                    for name in SLOT_NAMES
                    if name not in sessions
                    and find_running_terminal(SLOT_ROOT / name / "terminal64.exe") is None
                ),
                None,
            )
            job = claim_job(
                active_account_ids=[session.account_id for session in sessions.values()],
                has_free_slot=free_slot is not None,
            )
            if job:
                action = str(job.get("action") or "connect").strip().lower()
                account_id = str(job.get("accountId") or "").strip()
                matching_slot = next(
                    (
                        name
                        for name, session in sessions.items()
                        if session.account_id == account_id
                    ),
                    None,
                )

                if action == "disconnect":
                    target_slot = matching_slot
                    configured_slot = str(job.get("terminalSlot") or "").strip()
                    if not target_slot and configured_slot in SLOT_NAMES:
                        configured_session = sessions.get(configured_slot)
                        if configured_session and configured_session.account_id == account_id:
                            target_slot = configured_slot
                        elif configured_session is None:
                            preset = read_preset_values(
                                SLOT_ROOT / configured_slot / "MQL5" / "Presets" / "EdgeVaultBridge.set"
                            )
                            if preset.get("EdgeVaultAccountId", "").strip() == account_id:
                                target_slot = configured_slot

                    if target_slot:
                        previous_session = sessions.pop(target_slot, None)
                        if previous_session:
                            previous_session.config_path.unlink(missing_ok=True)
                        stop_slot_terminal(SLOT_ROOT / target_slot / "terminal64.exe")
                        LOG.info("Released %s from account %s", target_slot, account_id)
                    else:
                        LOG.info("Account %s had no running MT5 slot to release", account_id)

                    post_result(
                        str(job.get("id") or ""),
                        target_slot or configured_slot,
                        True,
                        "MT5 account disconnected. Its saved Trade Log was retained.",
                    )
                    continue

                if action != "connect":
                    post_result(
                        str(job.get("id") or ""),
                        "",
                        False,
                        f"Unsupported MT5 worker action: {action}",
                    )
                    continue

                target_slot = matching_slot or free_slot

                if not target_slot:
                    raise RuntimeError(
                        "The worker claimed a job without an available or matching terminal slot."
                    )

                previous_session = sessions.pop(target_slot, None)
                if previous_session:
                    LOG.info(
                        "Replacing %s job %s with newer job %s for account %s",
                        target_slot,
                        previous_session.job_id,
                        job.get("id"),
                        job.get("accountId"),
                    )
                    previous_session.config_path.unlink(missing_ok=True)
                    stop_slot_terminal(SLOT_ROOT / target_slot / "terminal64.exe")

                try:
                    sessions[target_slot] = start_job(job, target_slot)
                except Exception as error:
                    LOG.exception("Could not start MT5 job %s", job.get("id"))
                    post_result(str(job.get("id") or ""), target_slot, False, str(error))
        except KeyboardInterrupt:
            LOG.info("Worker stopped by administrator.")
            return 0
        except Exception:
            LOG.exception("Worker loop failed; retrying")
        time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    raise SystemExit(main())
