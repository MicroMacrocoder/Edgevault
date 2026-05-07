"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  supabase,
  getSingleTradeLogTemplate,
  getTradeLogRows,
  saveTradeLogRowToSupabase,
  deleteTradeLogRowFromSupabase,
} from "../../../lib/supabase";

export default function TradeLogDetailPage() {
  const params = useParams();
  const tradeLogId = params?.id;

  const [currentUser, setCurrentUser] = useState(null);
  const [tradeLog, setTradeLog] = useState(null);
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [isSavingRows, setIsSavingRows] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [checkedRowIds, setCheckedRowIds] = useState([]);
  const [isImportingMt5, setIsImportingMt5] = useState(false);
  const [sortOrder, setSortOrder] = useState("newest");

  const [showMt5ImportPanel, setShowMt5ImportPanel] = useState(false);
  const [mt5ImportFromDate, setMt5ImportFromDate] = useState("");
  const [mt5ImportToDate, setMt5ImportToDate] = useState("");

  const [mt5CsvFile, setMt5CsvFile] = useState(null);
  const [isImportingCsv, setIsImportingCsv] = useState(false);

  const [selectedSessionTimezone, setSelectedSessionTimezone] = useState("UTC");

  const fallbackTimezones = [
    "UTC",
    "Africa/Lagos",
    "Africa/Cairo",
    "Africa/Johannesburg",
    "America/New_York",
    "America/Chicago",
    "America/Los_Angeles",
    "America/Toronto",
    "America/Sao_Paulo",
    "Europe/London",
    "Europe/Athens",
    "Europe/Paris",
    "Europe/Berlin",
    "Asia/Dubai",
    "Asia/Tokyo",
    "Asia/Shanghai",
    "Asia/Singapore",
    "Asia/Kolkata",
    "Australia/Sydney",
  ];

  const availableSessionTimezones =
    typeof Intl !== "undefined" &&
    typeof Intl.supportedValuesOf === "function"
      ? ["UTC", ...Intl.supportedValuesOf("timeZone")]
      : fallbackTimezones;

  const hiddenHeaderNames = [
    "Live Price",
    "Floating P/L",
    "Swap",
    "Commission",
    "Trade Comment",
    "SL/TP Source",
  ];

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (mounted) {
        setIsLoading(true);
        setMessage("");
      }

      const { data } = await supabase.auth.getSession();
      const user = data?.session?.user ?? null;

      if (mounted) {
        setCurrentUser(user);
      }

      if (user) {
        const { error: templateError, template } = await getSingleTradeLogTemplate(
          user.id,
          tradeLogId
        );

        if (templateError) {
          if (mounted) {
            setTradeLog(null);
            setRows([]);
            setMessage("Could not load this trade log.");
            setIsLoading(false);
          }
          return;
        }

        const { error: rowsError, rows: loadedRows } = await getTradeLogRows(
          user.id,
          tradeLogId
        );

        if (rowsError) {
          if (mounted) {
            setTradeLog(template || null);
            setRows([]);
            setMessage("Trade log loaded, but rows could not be loaded.");
            setIsLoading(false);
          }
          return;
        }

        if (mounted) {
          setTradeLog(template || null);
          setRows(loadedRows || []);
          setIsLoading(false);
        }

        return;
      }

      const guestLogs = JSON.parse(localStorage.getItem("guestTradeLogs")) || [];
      const found = guestLogs.find((item) => String(item.id) === String(tradeLogId));
      const guestRows = JSON.parse(localStorage.getItem(`rows-${tradeLogId}`)) || [];

      if (mounted) {
        setTradeLog(found || null);
        setRows(guestRows);
        setIsLoading(false);
      }
    }

    load();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setCurrentUser(session?.user ?? null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [tradeLogId]);

  useEffect(() => {
    const savedTimezone = localStorage.getItem("tradeLogSessionTimezone");

    if (savedTimezone) {
      setSelectedSessionTimezone(savedTimezone);
    }
  }, []);

  function handleSessionTimezoneChange(timezoneValue) {
    setSelectedSessionTimezone(timezoneValue);
    localStorage.setItem("tradeLogSessionTimezone", timezoneValue);
  }

  function normalizeHeaderName(headerName) {
    if (headerName === "Lot Size") return "Volume";
    if (headerName === "Entry Date") return "Entry Time";
    if (headerName === "Exit Date") return "Exit Time";
    return headerName;
  }

  function normalizeHeadersList(headersList) {
    const normalized = (headersList || []).map((header) => ({
      ...header,
      name: normalizeHeaderName(header.name),
    }));

    const seen = new Set();

    return normalized.filter((header) => {
      if (hiddenHeaderNames.includes(header.name)) return false;

      const key = `${header.name}-${header.group || "group"}`.toLowerCase();

      if (seen.has(key)) return false;

      seen.add(key);
      return true;
    });
  }

  function padNumber(value) {
    return String(value).padStart(2, "0");
  }

  function formatDateToCustomDisplay(dateObject, timezoneName = selectedSessionTimezone) {
    if (!dateObject) return "";

    try {
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: timezoneName || "UTC",
        weekday: "short",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });

      const parts = formatter.formatToParts(dateObject);

      const weekday = parts
        .find((part) => part.type === "weekday")
        ?.value?.toUpperCase();

      const year = parts.find((part) => part.type === "year")?.value;
      const month = parts.find((part) => part.type === "month")?.value;
      const day = parts.find((part) => part.type === "day")?.value;
      const hour = parts.find((part) => part.type === "hour")?.value;
      const minute = parts.find((part) => part.type === "minute")?.value;

      return `${weekday} (${year}-${month}-${day} ${hour}:${minute})`;
    } catch (error) {
      return "";
    }
  }

  function parseDateTimeValue(dateTimeString) {
    if (!dateTimeString) return null;

    const directDate = new Date(dateTimeString);

    if (!Number.isNaN(directDate.getTime())) {
      return directDate;
    }

    const cleanedValue = String(dateTimeString).replace(/\./g, "-");
    const cleanedDate = new Date(cleanedValue);

    if (!Number.isNaN(cleanedDate.getTime())) {
      return cleanedDate;
    }

    return null;
  }

  function buildCombinedDateTime(dateValue, timeValue) {
    if (!dateValue && !timeValue) return "";

    if (dateValue && timeValue) {
      const combinedText = `${dateValue} ${timeValue}`;
      const parsedCombined = parseDateTimeValue(combinedText);

      if (parsedCombined) {
        return parsedCombined.toISOString();
      }

      return combinedText;
    }

    const singleValue = timeValue || dateValue;
    const parsedSingle = parseDateTimeValue(singleValue);

    if (parsedSingle) {
      return parsedSingle.toISOString();
    }

    return singleValue;
  }

  function formatTradePrice(symbol, value) {
    if (value === "" || value === null || value === undefined) return "";

    const numberValue = Number(String(value).replace(/,/g, "").trim());

    if (Number.isNaN(numberValue)) return value;

    const cleanSymbol = String(symbol || "").toUpperCase();

    if (cleanSymbol.includes("JPY")) {
      return Number(numberValue.toFixed(3)).toString();
    }

    if (cleanSymbol.includes("XAU") || cleanSymbol.includes("GOLD")) {
      return Number(numberValue.toFixed(3)).toString();
    }

    if (cleanSymbol.includes("XAG") || cleanSymbol.includes("SILVER")) {
      return Number(numberValue.toFixed(4)).toString();
    }

    if (
      cleanSymbol.includes("US30") ||
      cleanSymbol.includes("NAS") ||
      cleanSymbol.includes("SPX") ||
      cleanSymbol.includes("GER") ||
      cleanSymbol.includes("UK100")
    ) {
      return Number(numberValue.toFixed(2)).toString();
    }

    return Number(numberValue.toFixed(5)).toString();
  }

  function getAutomaticFormulaKey(header) {
    if (header?.formulaKey) return header.formulaKey;

    const name = String(header?.name || "").trim().toLowerCase();

    if (name === "entry market session") return "entry_market_session";
    if (name === "exit market session") return "exit_market_session";
    if (name === "entry ict session") return "entry_ict_session";
    if (name === "exit ict session") return "exit_ict_session";

    if (name === "trade duration") return "trade_duration";
    if (name === "sl pips") return "sl_pips";
    if (name === "tp pips") return "tp_pips";
    if (name === "result pips") return "result_pips";
    if (name === "planned r:r") return "planned_rr";
    if (name === "actual r:r") return "actual_rr";

    return "";
  }

  function isCustomAutomaticHeader(header) {
    return header?.group === "custom_automatic" || header?.type === "custom_auto";
  }

  function cleanNumber(value) {
    if (value === "" || value === null || value === undefined) return null;

    const cleaned = String(value).replace(/,/g, "").replace(/\s+/g, "").trim();
    const numberValue = Number(cleaned);

    if (Number.isNaN(numberValue)) return null;

    return numberValue;
  }

  function getPipMultiplier(symbol) {
    const cleanSymbol = String(symbol || "").toUpperCase();

    if (cleanSymbol.includes("JPY")) return 100;

    if (cleanSymbol.includes("XAU") || cleanSymbol.includes("GOLD")) {
      return 10;
    }

    if (cleanSymbol.includes("XAG") || cleanSymbol.includes("SILVER")) {
      return 100;
    }

    if (
      cleanSymbol.includes("US30") ||
      cleanSymbol.includes("NAS") ||
      cleanSymbol.includes("SPX") ||
      cleanSymbol.includes("GER") ||
      cleanSymbol.includes("UK100")
    ) {
      return 1;
    }

    return 10000;
  }

  function formatCalculatedNumber(value, decimals = 2) {
    if (value === "" || value === null || value === undefined) return "";

    const numberValue = Number(value);

    if (Number.isNaN(numberValue)) return "";

    return Number(numberValue.toFixed(decimals)).toString();
  }

  function calculateTradeDuration(entryTimeValue, exitTimeValue) {
    const entryTime = parseDateTimeValue(entryTimeValue);
    const exitTime = parseDateTimeValue(exitTimeValue);

    if (!entryTime || !exitTime) return "";

    const diffMs = exitTime.getTime() - entryTime.getTime();

    if (diffMs < 0) return "";

    const totalSeconds = Math.floor(diffMs / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    }

    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    }

    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }

    return `${seconds}s`;
  }

  function normalizeRowDataWithoutFormulas(rowData) {
    if (!rowData) return {};

    const normalizedData = { ...rowData };

    if (
      normalizedData["Volume"] === undefined &&
      normalizedData["Lot Size"] !== undefined
    ) {
      normalizedData["Volume"] = normalizedData["Lot Size"];
    }

    const normalizedEntryTime = buildCombinedDateTime(
      normalizedData["Entry Date"],
      normalizedData["Entry Time"]
    );

    if (normalizedEntryTime) {
      normalizedData["Entry Time"] = normalizedEntryTime;
    }

    const normalizedExitTime = buildCombinedDateTime(
      normalizedData["Exit Date"],
      normalizedData["Exit Time"]
    );

    if (normalizedExitTime) {
      normalizedData["Exit Time"] = normalizedExitTime;
    }

    const symbol = normalizedData.Symbol || normalizedData.symbol || "";

    const priceFields = [
      "Entry Price",
      "Exit Price",
      "Stop Loss",
      "Take Profit",
      "Live Price",
    ];

    priceFields.forEach((fieldName) => {
      if (normalizedData[fieldName] !== undefined) {
        normalizedData[fieldName] = formatTradePrice(
          symbol,
          normalizedData[fieldName]
        );
      }
    });

    return normalizedData;
  }

  function calculatePipValues(rowData) {
    const normalizedData = normalizeRowDataWithoutFormulas(rowData);

    const symbol = normalizedData.Symbol || "";
    const direction = String(normalizedData.Direction || "").toUpperCase();

    const entryPrice = cleanNumber(normalizedData["Entry Price"]);
    const stopLoss = cleanNumber(normalizedData["Stop Loss"]);
    const takeProfit = cleanNumber(normalizedData["Take Profit"]);
    const exitPrice = cleanNumber(normalizedData["Exit Price"]);

    if (entryPrice === null || !direction) {
      return {
        slPips: "",
        tpPips: "",
        resultPips: "",
      };
    }

    const pipMultiplier = getPipMultiplier(symbol);

    let slDistance = null;
    let tpDistance = null;
    let resultDistance = null;

    if (direction === "BUY") {
      if (stopLoss !== null) slDistance = entryPrice - stopLoss;
      if (takeProfit !== null) tpDistance = takeProfit - entryPrice;
      if (exitPrice !== null) resultDistance = exitPrice - entryPrice;
    }

    if (direction === "SELL") {
      if (stopLoss !== null) slDistance = stopLoss - entryPrice;
      if (takeProfit !== null) tpDistance = entryPrice - takeProfit;
      if (exitPrice !== null) resultDistance = entryPrice - exitPrice;
    }

    return {
      slPips:
        slDistance !== null
          ? formatCalculatedNumber(slDistance * pipMultiplier, 2)
          : "",
      tpPips:
        tpDistance !== null
          ? formatCalculatedNumber(tpDistance * pipMultiplier, 2)
          : "",
      resultPips:
        resultDistance !== null
          ? formatCalculatedNumber(resultDistance * pipMultiplier, 2)
          : "",
    };
  }
 function parseMt5TimeAsUtcDate(dateTimeValue) {
    if (!dateTimeValue) return null;

    const rawValue = String(dateTimeValue).trim();

    const isoDate = new Date(rawValue);

    if (!Number.isNaN(isoDate.getTime()) && rawValue.includes("T")) {
      return isoDate;
    }

    const match = rawValue.match(
      /^(\d{4})[.-](\d{2})[.-](\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?/
    );

    if (match) {
      const year = Number(match[1]);
      const month = Number(match[2]) - 1;
      const day = Number(match[3]);
      const hour = Number(match[4]);
      const minute = Number(match[5]);
      const second = Number(match[6] || 0);

      return new Date(Date.UTC(year, month, day, hour, minute, second));
    }

    const fallbackDate = new Date(rawValue);

    if (!Number.isNaN(fallbackDate.getTime())) {
      return fallbackDate;
    }

    return null;
  }

  function getMinutesFromDateTimeValue(dateTimeValue, timezoneName = "UTC") {
    const parsedDate = parseMt5TimeAsUtcDate(dateTimeValue);

    if (!parsedDate) return null;

    try {
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: timezoneName,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });

      const parts = formatter.formatToParts(parsedDate);

      const hour = Number(parts.find((part) => part.type === "hour")?.value);
      const minute = Number(parts.find((part) => part.type === "minute")?.value);

      if (Number.isNaN(hour) || Number.isNaN(minute)) return null;

      return hour * 60 + minute;
    } catch (error) {
      return null;
    }
  }

  function getWeekdayMinutesFromDateTime(dateTimeValue, timezoneName = "UTC") {
    const parsedDate = parseMt5TimeAsUtcDate(dateTimeValue);

    if (!parsedDate) return null;

    try {
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: timezoneName,
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });

      const parts = formatter.formatToParts(parsedDate);
      const weekday = parts.find((part) => part.type === "weekday")?.value;
      const hour = Number(parts.find((part) => part.type === "hour")?.value);
      const minute = Number(parts.find((part) => part.type === "minute")?.value);

      const dayIndexMap = {
        Sun: 0,
        Mon: 1,
        Tue: 2,
        Wed: 3,
        Thu: 4,
        Fri: 5,
        Sat: 6,
      };

      const dayIndex = dayIndexMap[weekday];

      if (dayIndex === undefined || Number.isNaN(hour) || Number.isNaN(minute)) {
        return null;
      }

      return dayIndex * 1440 + hour * 60 + minute;
    } catch (error) {
      return null;
    }
  }

  function getWeeklyRangeFromOffsetRule(rule) {
    if (!rule.startDate || !rule.anchorTime) return null;

    const startDate = new Date(`${rule.startDate}T${rule.anchorTime}:00`);

    if (Number.isNaN(startDate.getTime())) return null;

    const startDay = startDate.getDay();
    const startHour = startDate.getHours();
    const startMinute = startDate.getMinutes();

    const startWeeklyMinutes = startDay * 1440 + startHour * 60 + startMinute;

    const offsetHours = Number(rule.offsetHours || 0);
    const offsetMinutes = Number(rule.offsetMinutes || 0);
    const offsetSeconds = Number(rule.offsetSeconds || 0);

    const offsetTotalMinutes = offsetHours * 60 + offsetMinutes + offsetSeconds / 60;

    let endWeeklyMinutes =
      rule.offsetDirection === "minus"
        ? startWeeklyMinutes - offsetTotalMinutes
        : startWeeklyMinutes + offsetTotalMinutes;

    const weekMinutes = 7 * 1440;

    endWeeklyMinutes =
      ((endWeeklyMinutes % weekMinutes) + weekMinutes) % weekMinutes;

    return {
      startMinutes: startWeeklyMinutes,
      endMinutes: endWeeklyMinutes,
    };
  }

  function parseTimeTextToMinutes(timeText) {
    if (!timeText) return null;

    const match = String(timeText).trim().match(/^(\d{1,2}):(\d{2})$/);

    if (!match) return null;

    const hours = Number(match[1]);
    const minutes = Number(match[2]);

    if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;

    return hours * 60 + minutes;
  }

  function isTimeInsideRange(currentMinutes, startMinutes, endMinutes) {
    if (currentMinutes === null) return false;

    if (startMinutes <= endMinutes) {
      return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    }

    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }

  function isWeeklyTimeInsideRange(currentMinutes, startMinutes, endMinutes) {
    if (currentMinutes === null) return false;

    if (startMinutes <= endMinutes) {
      return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    }

    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }

  function getRegularMarketSession(dateTimeValue) {
    const currentMinutes = getMinutesFromDateTimeValue(
      dateTimeValue,
      selectedSessionTimezone
    );

    if (currentMinutes === null) return "";

    const sessions = [
      {
        name: "Sydney",
        start: 17 * 60,
        end: 2 * 60,
      },
      {
        name: "Asia",
        start: 19 * 60,
        end: 4 * 60,
      },
      {
        name: "London",
        start: 3 * 60,
        end: 12 * 60,
      },
      {
        name: "New York",
        start: 8 * 60,
        end: 17 * 60,
      },
    ];

    const activeSessions = sessions
      .filter((session) =>
        isTimeInsideRange(currentMinutes, session.start, session.end)
      )
      .map((session) => session.name);

    return activeSessions.join("/");
  }

  function getIctMarketSession(dateTimeValue) {
    const currentMinutes = getMinutesFromDateTimeValue(
      dateTimeValue,
      selectedSessionTimezone
    );

    if (currentMinutes === null) return "";

    const sessions = [
      {
        name: "ICT Asia",
        start: 19 * 60,
        end: 0,
      },
      {
        name: "ICT London",
        start: 2 * 60,
        end: 5 * 60,
      },
      {
        name: "ICT New York",
        start: 7 * 60,
        end: 16 * 60,
      },
    ];

    const matchedSession = sessions.find((session) =>
      isTimeInsideRange(currentMinutes, session.start, session.end)
    );

    return matchedSession ? matchedSession.name : "";
  }

  function calculateCustomAutomaticHeaderValue(rowData, header) {
    const sourceField = header?.sourceField || "";
    const sourceValue = rowData?.[sourceField];

    if (!sourceField || !sourceValue) {
      return header?.defaultValue || "";
    }

    const rules = header?.rules || [];

    for (const rule of rules) {
      if (rule.ruleType === "time_range") {
        const ruleTimezone = rule.ruleTimezone || "UTC";
        const sourceMinutes = getMinutesFromDateTimeValue(
          sourceValue,
          ruleTimezone
        );

        if (sourceMinutes === null) continue;

        const startMinutes = parseTimeTextToMinutes(rule.startTime);
        const endMinutes = parseTimeTextToMinutes(rule.endTime);

        if (startMinutes === null || endMinutes === null) continue;

        const isInsideRange = isTimeInsideRange(
          sourceMinutes,
          startMinutes,
          endMinutes
        );

        if (isInsideRange) {
          return rule.outputValue || "";
        }
      }

      if (rule.ruleType === "time_offset_range") {
        const ruleTimezone = rule.ruleTimezone || "UTC";
        const sourceWeeklyMinutes = getWeekdayMinutesFromDateTime(
          sourceValue,
          ruleTimezone
        );

        if (sourceWeeklyMinutes === null) continue;

        const weeklyRange = getWeeklyRangeFromOffsetRule(rule);

        if (!weeklyRange) continue;

        const isInsideWeeklyRange = isWeeklyTimeInsideRange(
          sourceWeeklyMinutes,
          weeklyRange.startMinutes,
          weeklyRange.endMinutes
        );

        if (isInsideWeeklyRange) {
          return rule.outputValue || "";
        }
      }
    }

    return header?.defaultValue || "";
  }

  function applyAutomaticFormulasToRow(rowData, selectedHeadersList) {
    const updatedData = normalizeRowDataWithoutFormulas(rowData);
    const pipValues = calculatePipValues(updatedData);

    for (const header of selectedHeadersList || []) {
      if (isCustomAutomaticHeader(header)) {
        updatedData[header.name] = calculateCustomAutomaticHeaderValue(
          updatedData,
          header
        );

        continue;
      }

      const formulaKey = getAutomaticFormulaKey(header);

      if (!formulaKey) continue;

      if (formulaKey === "entry_market_session") {
        updatedData[header.name] = getRegularMarketSession(updatedData["Entry Time"]);
      }

      if (formulaKey === "exit_market_session") {
        updatedData[header.name] = getRegularMarketSession(updatedData["Exit Time"]);
      }

      if (formulaKey === "entry_ict_session") {
        updatedData[header.name] = getIctMarketSession(updatedData["Entry Time"]);
      }

      if (formulaKey === "exit_ict_session") {
        updatedData[header.name] = getIctMarketSession(updatedData["Exit Time"]);
      }

      if (formulaKey === "trade_duration") {
        updatedData[header.name] = calculateTradeDuration(
          updatedData["Entry Time"],
          updatedData["Exit Time"]
        );
      }

      if (formulaKey === "sl_pips") {
        updatedData[header.name] = pipValues.slPips;
      }

      if (formulaKey === "tp_pips") {
        updatedData[header.name] = pipValues.tpPips;
      }

      if (formulaKey === "result_pips") {
        updatedData[header.name] = pipValues.resultPips;
      }

      if (formulaKey === "planned_rr") {
        const slPips = cleanNumber(pipValues.slPips);
        const tpPips = cleanNumber(pipValues.tpPips);

        updatedData[header.name] =
          slPips && tpPips
            ? `1:${formatCalculatedNumber(tpPips / slPips, 2)}`
            : "";
      }

      if (formulaKey === "actual_rr") {
        const slPips = cleanNumber(pipValues.slPips);
        const resultPips = cleanNumber(pipValues.resultPips);

        updatedData[header.name] =
          slPips && resultPips !== null
            ? formatCalculatedNumber(resultPips / slPips, 2)
            : "";
      }
    }

    return updatedData;
  }

  function applyAutomaticFormulasToRows(rowList, selectedHeadersList) {
    return (rowList || []).map((row) => ({
      ...row,
      rowData: applyAutomaticFormulasToRow(row.rowData, selectedHeadersList),
    }));
  }

  function normalizeRowData(rowData) {
    return applyAutomaticFormulasToRow(rowData, headers);
  }

  function getDisplayValue(headerName, rowData) {
    const normalizedHeader = normalizeHeaderName(headerName);
    const normalizedRowData = normalizeRowData(rowData);

    if (normalizedHeader === "Entry Time" || normalizedHeader === "Exit Time") {
      const rawValue = normalizedRowData?.[normalizedHeader];

      if (!rawValue) return "";

      const parsedDate = parseMt5TimeAsUtcDate(rawValue);

      if (!parsedDate) return rawValue;

      return formatDateToCustomDisplay(parsedDate, selectedSessionTimezone);
    }

    return normalizedRowData?.[normalizedHeader] ?? "";
  }

  function getRowSortTime(row) {
    const normalizedRowData = normalizeRowDataWithoutFormulas(row.rowData);
    const exitTime = parseDateTimeValue(normalizedRowData["Exit Time"]);
    const entryTime = parseDateTimeValue(normalizedRowData["Entry Time"]);

    if (exitTime) return exitTime.getTime();
    if (entryTime) return entryTime.getTime();

    return 0;
  }

  function sortRows(rowList) {
    const copiedRows = [...(rowList || [])];

    copiedRows.sort((a, b) => {
      const aTime = getRowSortTime(a);
      const bTime = getRowSortTime(b);

      if (sortOrder === "oldest") {
        return aTime - bTime;
      }

      return bTime - aTime;
    });

    return copiedRows;
  }

  function renumberRows(rowList) {
    return rowList.map((row, index) => ({
      ...row,
      rowData: {
        ...normalizeRowData(row.rowData),
        "S/N": index + 1,
      },
    }));
  }

  const headers = useMemo(
    () => normalizeHeadersList(tradeLog?.headers || []),
    [tradeLog]
  );

  const displayRows = useMemo(() => {
    const rowsWithFormulas = applyAutomaticFormulasToRows(rows, headers);
    return renumberRows(sortRows(rowsWithFormulas));
  }, [rows, headers, sortOrder, selectedSessionTimezone]);

  async function refreshTradeLogRowsSilently() {
    if (
      !currentUser?.id ||
      !tradeLogId ||
      isEditMode ||
      isSavingRows ||
      isImportingMt5 ||
      isImportingCsv
    ) {
      return;
    }

    const { rows: refreshedRows, error } = await getTradeLogRows(
      currentUser.id,
      tradeLogId
    );

    if (error) {
      console.log("AUTO REFRESH TRADE LOG ROWS ERROR:", error);
      return;
    }

    setRows(refreshedRows || []);
  }

  useEffect(() => {
    if (!currentUser?.id || !tradeLogId) return;

    const refreshInterval = setInterval(() => {
      refreshTradeLogRowsSilently();
    }, 5000);

    return () => clearInterval(refreshInterval);
  }, [
    currentUser?.id,
    tradeLogId,
    isEditMode,
    isSavingRows,
    isImportingMt5,
    isImportingCsv,
  ]);

  async function persistRows(updatedRows) {
    if (!currentUser) {
      localStorage.setItem(`rows-${tradeLogId}`, JSON.stringify(updatedRows));
      return { ok: true };
    }

    for (const row of updatedRows) {
      const result = await saveTradeLogRowToSupabase(
        currentUser.id,
        tradeLogId,
        row
      );

      if (result?.error) {
        return { ok: false };
      }
    }

    return { ok: true };
  }

  function handleAddRow() {
    const newRow = {
      id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      rowData: applyAutomaticFormulasToRow(
        {
          "S/N": rows.length + 1,
          "Entry Time": new Date().toISOString(),
        },
        headers
      ),
    };

    setRows((previousRows) => [newRow, ...previousRows]);
    setMessage("");
  }

  function handleChange(rowId, headerName, value) {
    if (!isEditMode) return;

    const normalizedHeaderName = normalizeHeaderName(headerName);

    setRows((previousRows) =>
      previousRows.map((row) =>
        row.id === rowId
          ? {
              ...row,
              rowData: applyAutomaticFormulasToRow(
                {
                  ...normalizeRowDataWithoutFormulas(row.rowData),
                  [normalizedHeaderName]: value,
                },
                headers
              ),
            }
          : row
      )
    );
  }

  function handleToggleEditMode() {
    setIsEditMode((previousValue) => !previousValue);
    setCheckedRowIds([]);
    setMessage("");
  }

  function handleToggleRowCheckbox(rowId) {
    if (!isEditMode) return;

    setCheckedRowIds((previousIds) =>
      previousIds.includes(rowId)
        ? previousIds.filter((id) => id !== rowId)
        : [...previousIds, rowId]
    );
  }

  async function handleDeleteSelectedRows() {
    if (checkedRowIds.length === 0) {
      setMessage("Select at least one row to delete.");
      return;
    }

    try {
      if (!currentUser) {
        const updatedRows = rows.filter((row) => !checkedRowIds.includes(row.id));

        setRows(updatedRows);
        localStorage.setItem(`rows-${tradeLogId}`, JSON.stringify(updatedRows));
        setCheckedRowIds([]);
        setMessage("Selected guest rows deleted.");
        return;
      }

      for (const rowId of checkedRowIds) {
        const result = await deleteTradeLogRowFromSupabase(
          currentUser.id,
          tradeLogId,
          rowId
        );

        if (result?.error) {
          setMessage("Error deleting one or more rows.");
          return;
        }
      }

      const updatedRows = rows.filter((row) => !checkedRowIds.includes(row.id));

      setRows(updatedRows);
      setCheckedRowIds([]);
      setMessage("Selected rows deleted.");
    } catch (error) {
      console.log("DELETE TRADE LOG ROWS ERROR:", error);
      setMessage("Something went wrong while deleting rows.");
    }
  }
 async function handleSave() {
    if (!tradeLog) return;

    setIsSavingRows(true);
    setMessage("");

    try {
      const rowsWithFormulas = applyAutomaticFormulasToRows(rows, headers);
      const sortedAndRenumberedRows = renumberRows(sortRows(rowsWithFormulas));

      setRows(sortedAndRenumberedRows);

      const saveResult = await persistRows(sortedAndRenumberedRows);

      if (!saveResult.ok) {
        setMessage("Error saving one or more rows.");
        setIsSavingRows(false);
        return;
      }

      setMessage(
        currentUser ? "Rows saved successfully." : "Saved locally in guest mode."
      );
      setIsEditMode(false);
      setCheckedRowIds([]);
    } catch (error) {
      console.log("SAVE TRADE LOG ROWS ERROR:", error);
      setMessage("Something went wrong while saving rows.");
    } finally {
      setIsSavingRows(false);
    }
  }

  function handleClickImportMt5Button() {
    setShowMt5ImportPanel((previousValue) => !previousValue);
    setMessage("");
  }

  async function handleRunMt5Import() {
    setIsImportingMt5(true);
    setMessage("");

    try {
      if (!currentUser?.id) {
        setMessage("You need to be logged in to import MT5 trades.");
        setIsImportingMt5(false);
        return;
      }

      const response = await fetch("http://127.0.0.1:5001/import-mt5-trades", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: currentUser.id,
          tradeLogId,
          importMode: true,
          importType: "both",
          fromDate: mt5ImportFromDate,
          toDate: mt5ImportToDate,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        setMessage(data.message || "MT5 import failed.");
        setIsImportingMt5(false);
        return;
      }

      setMessage(data.message || "MT5 import completed.");

      const { rows: refreshedRows, error: refreshError } = await getTradeLogRows(
        currentUser.id,
        tradeLogId
      );

      if (refreshError) {
        setMessage("Import finished, but rows could not be refreshed.");
        setIsImportingMt5(false);
        return;
      }

      setRows(applyAutomaticFormulasToRows(refreshedRows || [], headers));
    } catch (error) {
      console.log("MT5 IMPORT ERROR:", error);
      setMessage("Could not reach MT5 connector. Open connector first, then try again.");
    } finally {
      setIsImportingMt5(false);
    }
  }

  function parseCsvLine(line) {
    const result = [];
    let current = "";
    let insideQuotes = false;

    for (let index = 0; index < line.length; index++) {
      const character = line[index];

      if (character === '"' && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else if (character === '"') {
        insideQuotes = !insideQuotes;
      } else if (character === "," && !insideQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += character;
      }
    }

    result.push(current.trim());
    return result;
  }

  function parseCsvText(csvText) {
    const lines = csvText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length < 2) return [];

    const csvHeaders = parseCsvLine(lines[0]).map((header) =>
      header.trim().replaceAll('"', "")
    );

    return lines.slice(1).map((line) => {
      const values = parseCsvLine(line).map((value) =>
        value.trim().replaceAll('"', "")
      );

      const row = {};

      csvHeaders.forEach((header, index) => {
        row[header] = values[index] || "";
      });

      return row;
    });
  }

  function getCellText(cell) {
    return cell?.textContent?.replace(/\s+/g, " ").trim() || "";
  }

  function makeUniqueMt5HeaderNames(rawHeaders) {
    let timeCount = 0;
    let priceCount = 0;

    return rawHeaders.map((header) => {
      const cleanedHeader = String(header || "").trim();

      if (cleanedHeader.toLowerCase() === "time") {
        timeCount += 1;
        return timeCount === 1 ? "Entry Time" : "Exit Time";
      }

      if (cleanedHeader.toLowerCase() === "price") {
        priceCount += 1;
        return priceCount === 1 ? "Entry Price" : "Exit Price";
      }

      if (cleanedHeader === "S / L" || cleanedHeader === "S/L") {
        return "Stop Loss";
      }

      if (cleanedHeader === "T / P" || cleanedHeader === "T/P") {
        return "Take Profit";
      }

      if (cleanedHeader.toLowerCase() === "profi") {
        return "Profit/Loss Amount";
      }

      if (cleanedHeader.toLowerCase() === "profit") {
        return "Profit/Loss Amount";
      }

      if (cleanedHeader.toLowerCase() === "position") {
        return "Position";
      }

      return cleanedHeader;
    });
  }

  function parseMt5HtmlReport(htmlText) {
    const parser = new DOMParser();
    const documentObject = parser.parseFromString(htmlText, "text/html");

    const reportText =
      documentObject.body?.innerText ||
      documentObject.body?.textContent ||
      "";

    const lines = reportText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const positionsStartIndex = lines.findIndex(
      (line) => line.toLowerCase() === "positions"
    );

    const ordersStartIndex = lines.findIndex(
      (line) => line.toLowerCase() === "orders"
    );

    if (positionsStartIndex === -1 || ordersStartIndex === -1) {
      return [];
    }

    const positionLines = lines.slice(positionsStartIndex + 1, ordersStartIndex);

    function isDateTimeLine(value) {
      return /^\d{4}\.\d{2}\.\d{2}\s+\d{2}:\d{2}:\d{2}$/.test(
        String(value || "")
      );
    }

    function isValidPositionRowStart(index) {
      const entryTime = positionLines[index];
      const position = positionLines[index + 1];
      const symbol = positionLines[index + 2];
      const type = String(positionLines[index + 3] || "").toLowerCase();

      return (
        isDateTimeLine(entryTime) &&
        /^\d+$/.test(String(position || "")) &&
        Boolean(symbol) &&
        (type === "buy" || type === "sell")
      );
    }

    const parsedRows = [];
    let index = 0;

    while (index < positionLines.length) {
      if (!isValidPositionRowStart(index)) {
        index += 1;
        continue;
      }

      const entryTime = positionLines[index];
      const position = positionLines[index + 1];
      const symbol = positionLines[index + 2];
      const type = positionLines[index + 3];
      const volume = positionLines[index + 4];
      const entryPrice = positionLines[index + 5];
      const stopLoss = positionLines[index + 6];

      let cursor = index + 7;
      let takeProfit = "";

      if (!isDateTimeLine(positionLines[cursor])) {
        takeProfit = positionLines[cursor] || "";
        cursor += 1;
      }

      const exitTime = positionLines[cursor] || "";
      const exitPrice = positionLines[cursor + 1] || "";
      const commission = positionLines[cursor + 2] || "";
      const swap = positionLines[cursor + 3] || "";
      const profit = positionLines[cursor + 4] || "";

      parsedRows.push({
        "Entry Time": entryTime,
        Position: position,
        Symbol: symbol,
        Type: type,
        Volume: volume,
        "Entry Price": entryPrice,
        "Stop Loss": stopLoss,
        "Take Profit": takeProfit,
        "Exit Time": exitTime,
        "Exit Price": exitPrice,
        Commission: commission,
        Swap: swap,
        "Profit/Loss Amount": profit,
      });

      index = cursor + 5;
    }

    return parsedRows;
  }

  function parseImportedTradeFile(fileText, fileName) {
    const lowerFileName = String(fileName || "").toLowerCase();

    if (lowerFileName.endsWith(".html") || lowerFileName.endsWith(".htm")) {
      return parseMt5HtmlReport(fileText);
    }

    return parseCsvText(fileText);
  }

  function pickValue(row, possibleNames) {
    for (const name of possibleNames) {
      if (row[name] !== undefined && row[name] !== "") {
        return row[name];
      }
    }

    return "";
  }

  function normalizeDirection(typeValue) {
    const type = String(typeValue || "").toLowerCase();

    if (type.includes("buy")) return "BUY";
    if (type.includes("sell")) return "SELL";

    return String(typeValue || "").toUpperCase();
  }

  function mapMt5ReportRowToTradeLogRow(reportRow, index) {
    const ticket = pickValue(reportRow, ["Ticket", "Order", "Position", "Deal"]);
    const symbol = pickValue(reportRow, ["Symbol", "Item"]);
    const type = pickValue(reportRow, ["Type", "Direction"]);
    const volume = pickValue(reportRow, ["Volume", "Size", "Lots"]);
    const entryTime = pickValue(reportRow, ["Open Time", "Entry Time", "Time"]);
    const exitTime = pickValue(reportRow, ["Close Time", "Exit Time"]);
    const entryPrice = pickValue(reportRow, ["Open Price", "Entry Price", "Price"]);
    const exitPrice = pickValue(reportRow, ["Close Price", "Exit Price"]);
    const stopLoss = pickValue(reportRow, [
      "S/L",
      "S / L",
      "SL",
      "Stop Loss",
      "StopLoss",
    ]);
    const takeProfit = pickValue(reportRow, [
      "T/P",
      "T / P",
      "TP",
      "Take Profit",
      "TakeProfit",
    ]);
    const profit = pickValue(reportRow, [
      "Profit",
      "Profi",
      "Profit/Loss",
      "Profit/Loss Amount",
    ]);
    const commission = pickValue(reportRow, ["Commission"]);
    const swap = pickValue(reportRow, ["Swap"]);
    const comment = pickValue(reportRow, ["Comment"]);

    return {
      id: `row-mt5-report-${ticket || Date.now()}-${index}`,
      rowData: applyAutomaticFormulasToRow(
        {
          "S/N": index + 1,
          mt5_ticket: ticket,
          mt5_identifier: ticket,
          mt5_source: "MT5 Report Import",
          sync_status: exitTime ? "closed" : "open",
          Symbol: symbol,
          Direction: normalizeDirection(type),
          Volume: volume,
          "Entry Time": entryTime,
          "Entry Price": entryPrice,
          "Stop Loss": stopLoss,
          "Take Profit": takeProfit,
          "Exit Time": exitTime,
          "Exit Price": exitPrice,
          "Profit/Loss Amount": profit,
          Commission: commission,
          Swap: swap,
          "Trade Comment": comment,
          "SL/TP Source": "mt5_report_import",
        },
        headers
      ),
    };
  }

  async function handleImportMt5Csv() {
    if (!mt5CsvFile) {
      setMessage("Select an MT5 CSV or HTML report file first.");
      return;
    }

    setIsImportingCsv(true);
    setMessage("");

    try {
      const fileText = await mt5CsvFile.text();
      const parsedRows = parseImportedTradeFile(fileText, mt5CsvFile.name);

      if (parsedRows.length === 0) {
        setMessage("No trade rows found in this file.");
        setIsImportingCsv(false);
        return;
      }

      const importedRows = parsedRows.map((reportRow, index) =>
        mapMt5ReportRowToTradeLogRow(reportRow, index)
      );

      const mergedRows = [...rows];

      for (const importedRow of importedRows) {
        const importedTicket = importedRow.rowData.mt5_ticket;
        const importedIdentifier = importedRow.rowData.mt5_identifier;

        const existingIndex = mergedRows.findIndex((row) => {
          const existingTicket = row.rowData?.mt5_ticket;
          const existingIdentifier = row.rowData?.mt5_identifier;

          return (
            importedTicket &&
            importedIdentifier &&
            (String(existingTicket) === String(importedTicket) ||
              String(existingIdentifier) === String(importedIdentifier))
          );
        });

        if (existingIndex >= 0) {
          mergedRows[existingIndex] = {
            ...mergedRows[existingIndex],
            rowData: applyAutomaticFormulasToRow(
              {
                ...normalizeRowDataWithoutFormulas(
                  mergedRows[existingIndex].rowData
                ),
                ...normalizeRowDataWithoutFormulas(importedRow.rowData),
              },
              headers
            ),
          };
        } else {
          mergedRows.push(importedRow);
        }
      }

      const rowsWithFormulas = applyAutomaticFormulasToRows(mergedRows, headers);
      const finalRows = renumberRows(sortRows(rowsWithFormulas));

      setRows(finalRows);

      const saveResult = await persistRows(finalRows);

      if (!saveResult.ok) {
        setMessage("Report imported, but saving failed.");
        setIsImportingCsv(false);
        return;
      }

      setMessage(`MT5 report import completed. ${importedRows.length} trade(s) processed.`);
    } catch (error) {
      console.log("MT5 REPORT IMPORT ERROR:", error);
      setMessage("Could not import MT5 report file.");
    } finally {
      setIsImportingCsv(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-100">
      <nav className="flex items-center justify-between bg-white px-6 py-4 shadow-sm">
        <Link href="/" className="app-brand-title text-lg hover:opacity-80">
          Trading Journal
        </Link>

        <div className="flex items-center gap-4">
          <Link
            href="/saved-trade-logs"
            className="cursor-pointer text-sm font-medium text-gray-800 hover:text-black"
          >
            Saved Trade Logs
          </Link>

          <Link
            href="/trade-log"
            className="cursor-pointer text-sm font-medium text-gray-800 hover:text-black"
          >
            Trade Log Builder
          </Link>

          <Link
            href="/journal"
            className="cursor-pointer text-sm font-medium text-gray-800 hover:text-black"
          >
            Journal
          </Link>
        </div>
      </nav>

      <div className="px-4 py-8 md:px-8">
        <div className="mx-auto max-w-7xl">
          <section className="mb-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <h1 className="app-page-title text-3xl md:text-4xl">Trade Log</h1>

                <p className="mt-2 text-sm text-gray-700 md:text-base">
                  View your created trade log and add trade rows.
                </p>

                <p className="mt-2 text-sm font-medium text-gray-800">
                  {currentUser
                    ? `Logged in as ${currentUser.email}`
                    : "Viewing guest trade log"}
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <div className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2">
                  <label className="text-sm font-medium text-gray-700">
                    Session Timezone
                  </label>

                  <select
                    value={selectedSessionTimezone}
                    onChange={(event) =>
                      handleSessionTimezoneChange(event.target.value)
                    }
                    className="cursor-pointer bg-white text-sm font-medium text-gray-900 outline-none"
                  >
                    {availableSessionTimezones.map((timezone) => (
                      <option key={timezone} value={timezone}>
                        {timezone}
                      </option>
                    ))}
                  </select>
                </div>

                <Link
                  href="/connect-platform"
                  className="cursor-pointer rounded-lg border border-blue-300 bg-white px-4 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-50"
                >
                  Connect Trading Platform
                </Link>

                <Link
                  href={`/trade-log?edit=${tradeLogId}`}
                  className="cursor-pointer rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 transition hover:bg-gray-50"
                >
                  Update Headers
                </Link>
              </div>
            </div>
          </section>

          {isLoading ? (
            <section className="rounded-2xl bg-white p-6 shadow-sm md:p-8">
              <h2 className="app-page-title text-2xl">Loading Trade Log...</h2>
              <p className="mt-2 text-sm text-gray-700">
                Please wait while your trade log is loading.
              </p>
            </section>
          ) : !tradeLog ? (
            <section className="rounded-2xl bg-white p-6 shadow-sm md:p-8">
              <h2 className="app-page-title text-2xl">Trade Log Not Found</h2>
              <p className="mt-2 text-sm text-gray-700">
                This trade log could not be found.
              </p>
            </section>
          ) : (
            <>
              <section className="rounded-2xl bg-white p-6 shadow-sm md:p-8">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg bg-gray-50 p-4">
                    <p className="text-xs font-medium uppercase text-gray-600">
                      Trade Log Name
                    </p>
                    <p className="mt-2 text-sm font-semibold text-gray-900">
                      {tradeLog.logName || "Untitled Trade Log"}
                    </p>
                  </div>

                  <div className="rounded-lg bg-gray-50 p-4">
                    <p className="text-xs font-medium uppercase text-gray-600">
                      Number of Visible Headers
                    </p>
                    <p className="mt-2 text-sm font-semibold text-gray-900">
                      {headers.length}
                    </p>
                  </div>
                </div>
              </section>

              <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm md:p-8">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="app-page-title text-2xl">Trade Log Table</h2>
                    <p className="mt-2 text-sm text-gray-700">
                      Add, edit, save, delete, import, and sort your trade rows here.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        setSortOrder((previousOrder) =>
                          previousOrder === "newest" ? "oldest" : "newest"
                        )
                      }
                      className="cursor-pointer rounded-lg border border-purple-300 bg-white px-5 py-3 text-sm font-medium text-purple-700 transition hover:bg-purple-50"
                    >
                      Sort: {sortOrder === "newest" ? "Newest First" : "Oldest First"}
                    </button>

                    <Link
                      href="/connect-platform"
                      className="cursor-pointer rounded-lg border border-blue-300 bg-white px-5 py-3 text-sm font-medium text-blue-700 transition hover:bg-blue-50"
                    >
                      Connect Trading Platform
                    </Link>

                    <Link
                      href={`/trade-log?edit=${tradeLogId}`}
                      className="cursor-pointer rounded-lg border border-gray-300 bg-white px-5 py-3 text-sm font-medium text-gray-900 transition hover:bg-gray-50"
                    >
                      Update Headers
                    </Link>

                    <button
                      type="button"
                      onClick={handleClickImportMt5Button}
                      className="cursor-pointer rounded-lg border border-emerald-300 bg-white px-5 py-3 text-sm font-medium text-emerald-700 transition hover:bg-emerald-50"
                    >
                      {showMt5ImportPanel ? "Hide MT5 Import" : "Import MT5 Log"}
                    </button>

                    <button
                      type="button"
                      onClick={handleToggleEditMode}
                      className={`cursor-pointer rounded-lg px-5 py-3 text-sm font-medium transition ${
                        isEditMode
                          ? "border border-black bg-black text-white hover:opacity-90"
                          : "border border-gray-300 bg-white text-gray-900 hover:bg-gray-50"
                      }`}
                    >
                      {isEditMode ? "Done Editing" : "Edit Trade Log"}
                    </button>

                    <button
                      type="button"
                      onClick={handleAddRow}
                      className="cursor-pointer rounded-lg bg-black px-5 py-3 text-sm font-medium text-white transition hover:opacity-90"
                    >
                      Add Trade Row
                    </button>

                    {isEditMode && (
                      <button
                        type="button"
                        onClick={handleDeleteSelectedRows}
                        className="cursor-pointer rounded-lg border border-red-300 bg-white px-5 py-3 text-sm font-medium text-red-600 transition hover:bg-red-50"
                      >
                        Delete Selected
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={isSavingRows || isImportingMt5 || isImportingCsv}
                      className="cursor-pointer rounded-lg border border-gray-300 bg-white px-5 py-3 text-sm font-medium text-gray-900 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {isSavingRows ? "Saving..." : "Save Rows"}
                    </button>
                  </div>
                </div>

                {showMt5ImportPanel && (
                  <section className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                    <div className="flex flex-col gap-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          Import MT5 Trades
                        </h3>
                        <p className="mt-1 text-sm text-gray-700">
                          Use connector import for recent MT5 trades, or report import for old closed trades when SL/TP is missing.
                        </p>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <label className="mb-2 block text-sm font-medium text-gray-800">
                            From Date
                          </label>
                          <input
                            type="date"
                            value={mt5ImportFromDate}
                            onChange={(event) => setMt5ImportFromDate(event.target.value)}
                            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 outline-none focus:border-black"
                          />
                        </div>

                        <div>
                          <label className="mb-2 block text-sm font-medium text-gray-800">
                            To Date
                          </label>
                          <input
                            type="date"
                            value={mt5ImportToDate}
                            onChange={(event) => setMt5ImportToDate(event.target.value)}
                            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 outline-none focus:border-black"
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={handleRunMt5Import}
                          disabled={isImportingMt5 || isSavingRows || isImportingCsv}
                          className="cursor-pointer rounded-lg border border-emerald-300 bg-white px-5 py-3 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {isImportingMt5 ? "Importing MT5 Trades..." : "Import From Connector"}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setMt5ImportFromDate("");
                            setMt5ImportToDate("");
                            setMessage("");
                          }}
                          className="cursor-pointer rounded-lg border border-gray-300 bg-white px-5 py-3 text-sm font-medium text-gray-900 transition hover:bg-gray-50"
                        >
                          Clear Dates
                        </button>
                      </div>

                      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                        <h3 className="text-lg font-semibold text-gray-900">
                          Import MT5 Report
                        </h3>

                        <p className="mt-1 text-sm text-gray-700">
                          Use this for old closed trades when the MT5 connector cannot recover SL/TP from history.
                        </p>

                        <input
                          type="file"
                          accept=".csv,.html,.htm"
                          onChange={(event) => setMt5CsvFile(event.target.files?.[0] || null)}
                          className="mt-4 w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm"
                        />

                        <button
                          type="button"
                          onClick={handleImportMt5Csv}
                          disabled={isImportingCsv || isSavingRows || isImportingMt5}
                          className="mt-4 cursor-pointer rounded-lg border border-blue-300 bg-white px-5 py-3 text-sm font-medium text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {isImportingCsv ? "Importing Report..." : "Import MT5 Report"}
                        </button>
                      </div>
                    </div>
                  </section>
                )}

                {message && (
                  <p className="mt-4 text-sm font-medium text-gray-800">
                    {message}
                  </p>
                )}

                <div className="mt-6 max-h-[70vh] overflow-auto rounded-xl border border-gray-200">
                  <table className="min-w-full border-collapse">
                    <thead className="sticky top-0 z-20 bg-gray-50">
                      <tr>
                        {isEditMode && (
                          <th className="sticky top-0 z-20 border-b border-gray-200 bg-gray-50 px-4 py-3 text-left text-sm font-semibold text-gray-900">
                            Select
                          </th>
                        )}

                        {headers.map((header, index) => (
                          <th
                            key={`${header.id || header.name || "header"}-${index}`}
                            className="sticky top-0 z-20 border-b border-gray-200 bg-gray-50 px-4 py-3 text-left text-sm font-semibold text-gray-900"
                          >
                            {header.name}
                          </th>
                        ))}
                      </tr>
                    </thead>

                    <tbody>
                      {displayRows.length > 0 ? (
                        displayRows.map((row) => {
                          const normalizedRowData = normalizeRowData(row.rowData);

                          return (
                            <tr key={row.id} className="bg-white">
                              {isEditMode && (
                                <td className="border-b border-gray-200 px-4 py-3 text-sm text-gray-700">
                                  <input
                                    type="checkbox"
                                    checked={checkedRowIds.includes(row.id)}
                                    onChange={() => handleToggleRowCheckbox(row.id)}
                                    className="h-4 w-4 cursor-pointer accent-black"
                                  />
                                </td>
                              )}

                              {headers.map((header, index) => (
                                <td
                                  key={`${row.id}-${header.id || header.name || "col"}-${index}`}
                                  className="border-b border-gray-200 px-4 py-3 text-sm text-gray-700"
                                >
                                  {header.name === "S/N" ? (
                                    <span>{normalizedRowData?.[header.name] ?? ""}</span>
                                  ) : isEditMode && !getAutomaticFormulaKey(header) && !isCustomAutomaticHeader(header) ? (
                                    <input
                                      type="text"
                                      value={normalizedRowData?.[header.name] || ""}
                                      onChange={(event) =>
                                        handleChange(
                                          row.id,
                                          header.name,
                                          event.target.value
                                        )
                                      }
                                      className="w-full min-w-[140px] rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-black"
                                    />
                                  ) : (
                                    <span>{getDisplayValue(header.name, normalizedRowData)}</span>
                                  )}
                                </td>
                              ))}
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td
                            colSpan={headers.length + (isEditMode ? 1 : 0)}
                            className="px-4 py-10 text-center text-sm text-gray-600"
                          >
                            No trade rows yet. Click “Add Trade Row” or import/sync MT5 log to start.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
