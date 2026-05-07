"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  supabase,
  saveTradeLogTemplateToSupabase,
  getSingleTradeLogTemplate,
  getUserTradeLogTemplates,
} from "../../lib/supabase";

export default function TradeLogBuilderPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-gray-100">
          <nav className="flex items-center justify-between bg-white px-6 py-4 shadow-sm">
            <Link href="/" className="app-brand-title text-lg hover:opacity-80">
              Trading Journal
            </Link>

            <div className="flex items-center gap-4">
              <Link
                href="/saved-trade-logs"
                className="text-sm font-medium text-gray-800 hover:text-black"
              >
                Saved Trade Logs
              </Link>

              <Link
                href="/new-entry"
                className="text-sm font-medium text-gray-800 hover:text-black"
              >
                Analysis Workspaces
              </Link>

              <Link
                href="/journal"
                className="text-sm font-medium text-gray-800 hover:text-black"
              >
                Journal Library
              </Link>
            </div>
          </nav>

          <div className="px-4 py-8 md:px-8">
            <div className="mx-auto max-w-7xl">
              <section className="mb-6">
                <h1 className="app-page-title text-3xl md:text-4xl">
                  Trade Log Builder
                </h1>

                <p className="mt-2 text-sm text-gray-700 md:text-base">
                  Loading builder...
                </p>
              </section>
            </div>
          </div>
        </main>
      }
    >
      <TradeLogBuilderPageInner />
    </Suspense>
  );
}

function TradeLogBuilderPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editLogId = searchParams.get("edit");

  const [currentUser, setCurrentUser] = useState(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isCreatingLog, setIsCreatingLog] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  const requiredHeaders = useMemo(
    () => [
      {
        id: "required-sn",
        name: "S/N",
        group: "required",
        type: "auto_serial",
        locked: true,
        lockedPosition: true,
      },
      {
        id: "required-symbol",
        name: "Symbol",
        group: "required",
        type: "text",
        locked: true,
        lockedPosition: false,
      },
      {
        id: "required-direction",
        name: "Direction",
        group: "required",
        type: "text",
        locked: true,
        lockedPosition: false,
      },
      {
        id: "required-volume",
        name: "Volume",
        group: "required",
        type: "number",
        locked: true,
        lockedPosition: false,
      },
      {
        id: "required-entry-time",
        name: "Entry Time",
        group: "required",
        type: "datetime",
        locked: true,
        lockedPosition: false,
      },
      {
        id: "required-entry-price",
        name: "Entry Price",
        group: "required",
        type: "number",
        locked: true,
        lockedPosition: false,
      },
      {
        id: "required-stop-loss",
        name: "Stop Loss",
        group: "required",
        type: "number",
        locked: true,
        lockedPosition: false,
      },
      {
        id: "required-take-profit",
        name: "Take Profit",
        group: "required",
        type: "number",
        locked: true,
        lockedPosition: false,
      },
      {
        id: "required-exit-time",
        name: "Exit Time",
        group: "required",
        type: "datetime",
        locked: true,
        lockedPosition: false,
      },
      {
        id: "required-exit-price",
        name: "Exit Price",
        group: "required",
        type: "number",
        locked: true,
        lockedPosition: false,
      },
      {
        id: "required-profit-loss-amount",
        name: "Profit/Loss Amount",
        group: "required",
        type: "number",
        locked: true,
        lockedPosition: false,
      },
    ],
    []
  );

  const defaultManualHeaderOptions = useMemo(
    () => [
      {
        id: "manual-notes",
        name: "Notes",
        type: "text",
        isCustom: false,
      },
      {
        id: "manual-setup-type",
        name: "Setup Type",
        type: "text",
        isCustom: false,
      },
      {
        id: "manual-trade-comment",
        name: "Trade Comment",
        type: "text",
        isCustom: false,
      },
      {
        id: "manual-before-trade-screenshot",
        name: "Before Trade Screenshot",
        type: "image",
        isCustom: false,
      },
      {
        id: "manual-after-trade-screenshot",
        name: "After Trade Screenshot",
        type: "image",
        isCustom: false,
      },
      {
        id: "manual-entry-model",
        name: "Entry Model",
        type: "text",
        isCustom: false,
      },
      {
        id: "manual-exit-reason",
        name: "Exit Reason",
        type: "text",
        isCustom: false,
      },
    ],
    []
  );

  const [manualHeaderOptions, setManualHeaderOptions] = useState(
    defaultManualHeaderOptions
  );

  const automaticHeaderOptions = useMemo(
    () => [
      {
        id: "auto-entry-market-session",
        name: "Entry Market Session",
        type: "auto",
        formulaKey: "entry_market_session",
        description: "Auto-detects regular market session from Entry Time.",
      },
      {
        id: "auto-exit-market-session",
        name: "Exit Market Session",
        type: "auto",
        formulaKey: "exit_market_session",
        description: "Auto-detects regular market session from Exit Time.",
      },
      {
        id: "auto-entry-ict-session",
        name: "Entry ICT Session",
        type: "auto",
        formulaKey: "entry_ict_session",
        description: "Auto-detects ICT session from Entry Time.",
      },
      {
        id: "auto-exit-ict-session",
        name: "Exit ICT Session",
        type: "auto",
        formulaKey: "exit_ict_session",
        description: "Auto-detects ICT session from Exit Time.",
      },
      {
        id: "auto-trade-duration",
        name: "Trade Duration",
        type: "auto",
        formulaKey: "trade_duration",
        description: "Uses Entry Time and Exit Time.",
      },
      {
        id: "auto-sl-pips",
        name: "SL Pips",
        type: "auto",
        formulaKey: "sl_pips",
        description: "Entry Price to Stop Loss distance.",
      },
      {
        id: "auto-tp-pips",
        name: "TP Pips",
        type: "auto",
        formulaKey: "tp_pips",
        description: "Entry Price to Take Profit distance.",
      },
      {
        id: "auto-result-pips",
        name: "Result Pips",
        type: "auto",
        formulaKey: "result_pips",
        description: "Entry Price to Exit Price distance.",
      },
      {
        id: "auto-planned-rr",
        name: "Planned R:R",
        type: "auto",
        formulaKey: "planned_rr",
        description: "TP Pips divided by SL Pips.",
      },
      {
        id: "auto-actual-rr",
        name: "Actual R:R",
        type: "auto",
        formulaKey: "actual_rr",
        description: "Result Pips divided by SL Pips.",
      },
    ],
    []
  );

  const [logName, setLogName] = useState("");
  const [selectedHeaders, setSelectedHeaders] = useState(requiredHeaders);
  const [customManualHeaderName, setCustomManualHeaderName] = useState("");

  const [customAutoHeaderName, setCustomAutoHeaderName] = useState("");
  const [customAutoSourceField, setCustomAutoSourceField] = useState("");
  const [customAutoDefaultValue, setCustomAutoDefaultValue] = useState("");
  const [editingCustomAutoHeaderId, setEditingCustomAutoHeaderId] = useState("");

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

  const availableRuleTimezones =
    typeof Intl !== "undefined" &&
    typeof Intl.supportedValuesOf === "function"
      ? ["UTC", ...Intl.supportedValuesOf("timeZone")]
      : fallbackTimezones;

  const [customAutoRules, setCustomAutoRules] = useState([
    {
      id: `rule-${Date.now()}`,
      ruleType: "time_range",
      ruleTimezone: "UTC",
      startTime: "",
      endTime: "",
      startDate: "",
      anchorTime: "",
      offsetDirection: "plus",
      offsetHours: "",
      offsetMinutes: "",
      offsetSeconds: "",
      outputValue: "",
    },
  ]);

  const [builderMessage, setBuilderMessage] = useState("");
  const [isBuilderError, setIsBuilderError] = useState(false);
  const [checkedManualHeaderIds, setCheckedManualHeaderIds] = useState([]);
  const [checkedAutomaticHeaderIds, setCheckedAutomaticHeaderIds] = useState([]);

  function normalizeHeaderName(headerName) {
    if (headerName === "Lot Size") {
      return "Volume";
    }

    if (headerName === "Entry Date") {
      return "Entry Time";
    }

    if (headerName === "Exit Date") {
      return "Exit Time";
    }

    return headerName;
  }

  function createSafeHeaderId(prefix, headerName, index = 0) {
    const safeName = String(headerName || "header")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    return `${prefix}-${safeName || "header"}-${index}`;
  }

  function normalizeRule(rule) {
    return {
      id:
        rule?.id ||
        `rule-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      ruleType: rule?.ruleType || "time_range",
      ruleTimezone: rule?.ruleTimezone || "UTC",
      startTime: rule?.startTime || "",
      endTime: rule?.endTime || "",
      startDate: rule?.startDate || "",
      anchorTime: rule?.anchorTime || "",
      offsetDirection: rule?.offsetDirection || "plus",
      offsetHours: rule?.offsetHours || "",
      offsetMinutes: rule?.offsetMinutes || "",
      offsetSeconds: rule?.offsetSeconds || "",
      outputValue: rule?.outputValue || "",
    };
  }

  function normalizeHeader(header, index = 0) {
    const fallbackName = normalizeHeaderName(header?.name || `Header ${index + 1}`);
    const fallbackGroup = header?.group || "manual";
    const fallbackType = header?.type || "text";

    return {
      ...header,
      id:
        header?.id ||
        createSafeHeaderId(fallbackGroup || "header", fallbackName, index),
      name: fallbackName,
      group: fallbackGroup,
      type: fallbackType,
      formulaKey: header?.formulaKey || "",
      rules: (header?.rules || []).map((rule) => normalizeRule(rule)),
      locked: Boolean(header?.locked),
      lockedPosition: Boolean(header?.lockedPosition),
    };
  }

  function normalizeHeaders(headersArray) {
    const normalized = (headersArray || []).map((header, index) =>
      normalizeHeader(header, index)
    );

    const seen = new Set();

    return normalized.filter((header) => {
      const key = `${header.group}-${header.name.toLowerCase()}`;

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
  }

  function getDayNameFromDate(dateValue) {
    if (!dateValue) return "";

    const date = new Date(`${dateValue}T00:00:00`);

    if (Number.isNaN(date.getTime())) return "";

    const dayNames = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];

    return dayNames[date.getDay()];
  }

  function formatOffsetResult(rule) {
    if (rule.ruleType !== "time_offset_range") return "";

    if (!rule.startDate || !rule.anchorTime) return "";

    const baseDate = new Date(`${rule.startDate}T${rule.anchorTime}:00`);

    if (Number.isNaN(baseDate.getTime())) return "";

    const hours = Number(rule.offsetHours || 0);
    const minutes = Number(rule.offsetMinutes || 0);
    const seconds = Number(rule.offsetSeconds || 0);

    const totalMs =
      ((hours * 60 * 60) + (minutes * 60) + seconds) * 1000;

    const resultDate =
      rule.offsetDirection === "minus"
        ? new Date(baseDate.getTime() - totalMs)
        : new Date(baseDate.getTime() + totalMs);

    const dayNames = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];

    const resultDay = dayNames[resultDate.getDay()];
    const resultDateText = resultDate.toISOString().slice(0, 10);
    const resultTimeText = resultDate.toTimeString().slice(0, 5);

    return `${resultDay}, ${resultDateText} ${resultTimeText}`;
  }

  function createBlankCustomAutoRule() {
    return {
      id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      ruleType: "time_range",
      ruleTimezone: "UTC",
      startTime: "",
      endTime: "",
      startDate: "",
      anchorTime: "",
      offsetDirection: "plus",
      offsetHours: "",
      offsetMinutes: "",
      offsetSeconds: "",
      outputValue: "",
    };
  }
 async function tradeLogNameExists(nameToCheck) {
    const cleanName = nameToCheck.trim().toLowerCase();

    if (!cleanName) {
      return false;
    }

    if (currentUser) {
      const { templates } = await getUserTradeLogTemplates(currentUser.id);
      const existingLogs = templates || [];

      return existingLogs.some((log) => {
        const sameName =
          String(log.logName || "").trim().toLowerCase() === cleanName;
        const sameLog = String(log.id) === String(editLogId);
        return sameName && !sameLog;
      });
    }

    const guestLogs = JSON.parse(localStorage.getItem("guestTradeLogs")) || [];

    return guestLogs.some((log) => {
      const sameName =
        String(log.logName || "").trim().toLowerCase() === cleanName;
      const sameLog = String(log.id) === String(editLogId);
      return sameName && !sameLog;
    });
  }

  useEffect(() => {
    let isMounted = true;

    async function loadInitialSession() {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user ?? null;

      if (isMounted) {
        setCurrentUser(user);
        setIsCheckingAuth(false);
      }
    }

    loadInitialSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isMounted) {
        setCurrentUser(session?.user ?? null);
        setIsCheckingAuth(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadEditLog() {
      if (!editLogId) return;

      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user ?? null;

      if (user) {
        const { template } = await getSingleTradeLogTemplate(user.id, editLogId);

        if (template && mounted) {
          setIsEditMode(true);
          setLogName(template.logName || "");
          setSelectedHeaders(normalizeHeaders(template.headers || requiredHeaders));
        }

        return;
      }

      const guestLogs =
        JSON.parse(localStorage.getItem("guestTradeLogs")) || [];
      const found = guestLogs.find(
        (item) => String(item.id) === String(editLogId)
      );

      if (found && mounted) {
        setIsEditMode(true);
        setLogName(found.logName || "");
        setSelectedHeaders(normalizeHeaders(found.headers || requiredHeaders));
      }
    }

    loadEditLog();

    return () => {
      mounted = false;
    };
  }, [editLogId, requiredHeaders]);

  function setStatusMessage(message, isError = false) {
    setBuilderMessage(message);
    setIsBuilderError(isError);
  }

  function headerAlreadyExists(headerName) {
    return selectedHeaders.some(
      (header) =>
        header.name.trim().toLowerCase() === headerName.trim().toLowerCase()
    );
  }

  function manualOptionAlreadyExists(headerName) {
    return manualHeaderOptions.some(
      (option) =>
        option.name.trim().toLowerCase() === headerName.trim().toLowerCase()
    );
  }

  function handleToggleManualHeader(optionId) {
    setCheckedManualHeaderIds((previousIds) =>
      previousIds.includes(optionId)
        ? previousIds.filter((id) => id !== optionId)
        : [...previousIds, optionId]
    );
  }

  function handleToggleAutomaticHeader(optionId) {
    if (!currentUser) {
      setStatusMessage("Log in to use automatic headers.", true);
      return;
    }

    setCheckedAutomaticHeaderIds((previousIds) =>
      previousIds.includes(optionId)
        ? previousIds.filter((id) => id !== optionId)
        : [...previousIds, optionId]
    );
  }

  function handleApplySelectedManualHeaders() {
    if (checkedManualHeaderIds.length === 0) {
      setStatusMessage("Select at least one manual header first.", true);
      return;
    }

    const selectedOptions = manualHeaderOptions.filter((option) =>
      checkedManualHeaderIds.includes(option.id)
    );

    const headersToAdd = selectedOptions.filter(
      (option) => !headerAlreadyExists(option.name)
    );

    if (headersToAdd.length === 0) {
      setStatusMessage("All selected manual headers already exist.", true);
      return;
    }

    const newHeaders = headersToAdd.map((option, index) => ({
      id: `manual-added-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 7)}-${index}`,
      name: option.name,
      group: "manual",
      type: option.type,
      locked: false,
      lockedPosition: false,
    }));

    setSelectedHeaders((previousHeaders) => [...previousHeaders, ...newHeaders]);
    setCheckedManualHeaderIds([]);
    setStatusMessage("Selected manual headers added.");
  }

  function handleApplySelectedAutomaticHeaders() {
    if (!currentUser) {
      setStatusMessage("Log in to use automatic headers.", true);
      return;
    }

    if (checkedAutomaticHeaderIds.length === 0) {
      setStatusMessage("Select at least one automatic header first.", true);
      return;
    }

    const selectedOptions = automaticHeaderOptions.filter((option) =>
      checkedAutomaticHeaderIds.includes(option.id)
    );

    const headersToAdd = selectedOptions.filter(
      (option) => !headerAlreadyExists(option.name)
    );

    if (headersToAdd.length === 0) {
      setStatusMessage("All selected automatic headers already exist.", true);
      return;
    }

    const newHeaders = headersToAdd.map((option, index) => ({
      id: `auto-added-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 7)}-${index}`,
      name: option.name,
      group: "automatic",
      type: option.type,
      description: option.description,
      formulaKey: option.formulaKey,
      locked: false,
      lockedPosition: false,
    }));

    setSelectedHeaders((previousHeaders) => [...previousHeaders, ...newHeaders]);
    setCheckedAutomaticHeaderIds([]);
    setStatusMessage("Selected automatic headers added.");
  }

  function handleAddCustomAutoRuleRow() {
    if (!currentUser) return;

    setCustomAutoRules((prev) => [...prev, createBlankCustomAutoRule()]);
  }

  function handleCustomRuleChange(ruleId, fieldName, fieldValue) {
    setCustomAutoRules((prev) =>
      prev.map((rule) =>
        rule.id === ruleId ? { ...rule, [fieldName]: fieldValue } : rule
      )
    );
  }

  function handleRemoveCustomRuleRow(ruleId) {
    if (customAutoRules.length === 1) return;

    setCustomAutoRules((prev) =>
      prev.filter((rule) => rule.id !== ruleId)
    );
  }

  function handleEditCustomHeader(header) {
    setEditingCustomAutoHeaderId(header.id);
    setCustomAutoHeaderName(header.name);
    setCustomAutoSourceField(header.sourceField);
    setCustomAutoDefaultValue(header.defaultValue || "");
    setCustomAutoRules(header.rules.map((r) => normalizeRule(r)));
  }

  function handleSaveEditedHeader() {
    setSelectedHeaders((prev) =>
      prev.map((h) =>
        h.id === editingCustomAutoHeaderId
          ? {
              ...h,
              name: customAutoHeaderName,
              sourceField: customAutoSourceField,
              defaultValue: customAutoDefaultValue,
              rules: customAutoRules,
            }
          : h
      )
    );

    setEditingCustomAutoHeaderId("");
    setCustomAutoHeaderName("");
    setCustomAutoSourceField("");
    setCustomAutoDefaultValue("");
    setCustomAutoRules([createBlankCustomAutoRule()]);

    setStatusMessage("Custom header updated.");
  }
 function handleDeleteSelectedManualHeaders() {
    if (checkedManualHeaderIds.length === 0) {
      setStatusMessage("Select at least one manual card to delete.", true);
      return;
    }

    setManualHeaderOptions((previousOptions) =>
      previousOptions.filter(
        (option) => !checkedManualHeaderIds.includes(option.id)
      )
    );

    setCheckedManualHeaderIds([]);
    setStatusMessage("Selected manual cards deleted from the manual list.");
  }

  function handleAddCustomManualHeader() {
    const cleanHeaderName = customManualHeaderName.trim();

    if (!cleanHeaderName) {
      setStatusMessage("Type a custom manual header name first.", true);
      return;
    }

    if (manualOptionAlreadyExists(cleanHeaderName)) {
      setStatusMessage(
        "That manual header already exists in the manual list.",
        true
      );
      return;
    }

    const newManualOption = {
      id: `manual-custom-option-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 7)}`,
      name: cleanHeaderName,
      type: "text",
      isCustom: true,
    };

    setManualHeaderOptions((previousOptions) => [
      ...previousOptions,
      newManualOption,
    ]);
    setCustomManualHeaderName("");
    setStatusMessage(
      `Custom manual header "${cleanHeaderName}" added to the manual list.`
    );
  }

  function handleAddCustomAutomaticHeader() {
    if (!currentUser) {
      setStatusMessage("Log in to use custom automatic headers.", true);
      return;
    }

    const cleanHeaderName = customAutoHeaderName.trim();
    const cleanSourceField = customAutoSourceField.trim();

    if (!cleanHeaderName) {
      setStatusMessage("Type a custom automatic header name first.", true);
      return;
    }

    if (!cleanSourceField) {
      setStatusMessage("Select a source field for the custom automatic header.", true);
      return;
    }

    if (!editingCustomAutoHeaderId && headerAlreadyExists(cleanHeaderName)) {
      setStatusMessage("That header already exists.", true);
      return;
    }

    const hasIncompleteRule = customAutoRules.some((rule) => {
      if (!rule.outputValue.trim()) return true;

      if (rule.ruleType === "time_range") {
        return !rule.startTime.trim() || !rule.endTime.trim() || !rule.ruleTimezone;
      }

      if (rule.ruleType === "time_offset_range") {
        return (
          !rule.startDate.trim() ||
          !rule.anchorTime.trim() ||
          !rule.ruleTimezone ||
          (!rule.offsetHours && !rule.offsetMinutes && !rule.offsetSeconds)
        );
      }

      return false;
    });

    if (hasIncompleteRule) {
      setStatusMessage(
        "Complete every custom automatic condition before adding the header.",
        true
      );
      return;
    }

    if (editingCustomAutoHeaderId) {
      handleSaveEditedHeader();
      return;
    }

    const newHeader = {
      id: `auto-custom-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 7)}`,
      name: cleanHeaderName,
      group: "custom_automatic",
      type: "custom_auto",
      sourceField: cleanSourceField,
      defaultValue: customAutoDefaultValue.trim(),
      rules: customAutoRules.map((rule) => normalizeRule(rule)),
      locked: false,
      lockedPosition: false,
    };

    setSelectedHeaders((previousHeaders) => [...previousHeaders, newHeader]);
    setCustomAutoHeaderName("");
    setCustomAutoSourceField("");
    setCustomAutoDefaultValue("");
    setCustomAutoRules([createBlankCustomAutoRule()]);

    setStatusMessage(`Added custom automatic header: ${cleanHeaderName}`);
  }

  function handleCancelCustomHeaderEdit() {
    setEditingCustomAutoHeaderId("");
    setCustomAutoHeaderName("");
    setCustomAutoSourceField("");
    setCustomAutoDefaultValue("");
    setCustomAutoRules([createBlankCustomAutoRule()]);
    setStatusMessage("Custom header edit cancelled.");
  }

  function handleRemoveSelectedHeader(headerId) {
    const matchedHeader = selectedHeaders.find((header) => header.id === headerId);

    if (!matchedHeader) {
      setStatusMessage("Header not found.", true);
      return;
    }

    if (matchedHeader.locked) {
      setStatusMessage("Required headers cannot be removed.", true);
      return;
    }

    if (editingCustomAutoHeaderId === headerId) {
      handleCancelCustomHeaderEdit();
    }

    setSelectedHeaders((previousHeaders) =>
      previousHeaders.filter((header) => header.id !== headerId)
    );

    setStatusMessage(`Removed header: ${matchedHeader.name || "Header"}`);
  }

  function handleMoveHeaderUp(headerId) {
    const currentIndex = selectedHeaders.findIndex(
      (header) => header.id === headerId
    );

    if (currentIndex === -1) return;

    const currentHeader = selectedHeaders[currentIndex];

    if (currentIndex === 0) return;

    if (currentHeader.lockedPosition) {
      setStatusMessage("This header cannot change position.", true);
      return;
    }

    if (currentIndex - 1 === 0) {
      const previousHeader = selectedHeaders[0];

      if (previousHeader?.lockedPosition) return;
    }

    const updatedHeaders = [...selectedHeaders];

    [updatedHeaders[currentIndex - 1], updatedHeaders[currentIndex]] = [
      updatedHeaders[currentIndex],
      updatedHeaders[currentIndex - 1],
    ];

    setSelectedHeaders(updatedHeaders);
    setStatusMessage(`Moved ${currentHeader.name} up.`);
  }

  function handleMoveHeaderDown(headerId) {
    const currentIndex = selectedHeaders.findIndex(
      (header) => header.id === headerId
    );

    if (currentIndex === -1) return;

    const currentHeader = selectedHeaders[currentIndex];

    if (currentIndex === selectedHeaders.length - 1) return;

    if (currentHeader.lockedPosition) {
      setStatusMessage("This header cannot change position.", true);
      return;
    }

    const updatedHeaders = [...selectedHeaders];

    [updatedHeaders[currentIndex], updatedHeaders[currentIndex + 1]] = [
      updatedHeaders[currentIndex + 1],
      updatedHeaders[currentIndex],
    ];

    setSelectedHeaders(updatedHeaders);
    setStatusMessage(`Moved ${currentHeader.name} down.`);
  }

  async function handleCreateOrUpdateLog() {
    if (!logName.trim()) {
      setStatusMessage(
        isEditMode
          ? "Type a trade log name before updating the log."
          : "Type a trade log name before creating the log.",
        true
      );
      return;
    }

    if (selectedHeaders.length === 0) {
      setStatusMessage("Add at least one header before saving the log.", true);
      return;
    }

    if (isCreatingLog) return;

    const nameExists = await tradeLogNameExists(logName);

    if (nameExists) {
      setStatusMessage(
        "A trade log with this name already exists. Please use a different name.",
        true
      );
      return;
    }

    setIsCreatingLog(true);

    try {
      const finalLogId = editLogId || `trade-log-${Date.now()}`;

      const templateObject = {
        id: finalLogId,
        logName: logName.trim(),
        headers: normalizeHeaders(selectedHeaders),
        createdAt: new Date().toISOString(),
      };

      if (!currentUser) {
        const existingGuestLogs =
          JSON.parse(localStorage.getItem("guestTradeLogs")) || [];

        if (!isEditMode && existingGuestLogs.length >= 1) {
          setStatusMessage(
            "Guest users can create only 1 trade log. Log in to unlock more.",
            true
          );
          setIsCreatingLog(false);
          return;
        }

        let updatedGuestLogs = [];

        if (isEditMode) {
          updatedGuestLogs = existingGuestLogs.map((log) =>
            String(log.id) === String(finalLogId)
              ? { ...log, ...templateObject }
              : log
          );
        } else {
          updatedGuestLogs = [...existingGuestLogs, templateObject];
          localStorage.setItem(`rows-${finalLogId}`, JSON.stringify([]));
        }

        localStorage.setItem("guestTradeLogs", JSON.stringify(updatedGuestLogs));
        router.push(`/trade-log/${finalLogId}`);
        return;
      }

      const result = await saveTradeLogTemplateToSupabase(
        currentUser.id,
        templateObject
      );

      if (result?.error) {
        setStatusMessage(
          isEditMode
            ? "Could not update trade log in your account."
            : "Could not save trade log to your account.",
          true
        );
        setIsCreatingLog(false);
        return;
      }

      if (!isEditMode) {
        localStorage.removeItem(`rows-${finalLogId}`);
      }

      router.push(`/trade-log/${finalLogId}`);
    } catch (error) {
      console.log("SAVE TRADE LOG ERROR:", error);
      setStatusMessage(
        isEditMode
          ? "Something went wrong while updating the trade log."
          : "Something went wrong while creating the trade log.",
        true
      );
    } finally {
      setIsCreatingLog(false);
    }
  }

  function isManualOptionChecked(optionId) {
    return checkedManualHeaderIds.includes(optionId);
  }

  function isAutomaticOptionChecked(optionId) {
    return checkedAutomaticHeaderIds.includes(optionId);
  }

  return (
    <main className="min-h-screen bg-gray-100">
      <nav className="flex items-center justify-between bg-white px-6 py-4 shadow-sm">
        <Link href="/" className="app-brand-title text-lg hover:opacity-80">
          Trading Journal
        </Link>

        <div className="flex items-center gap-4">
          <Link href="/saved-trade-logs" className="text-sm font-medium text-gray-800 hover:text-black">
            Saved Trade Logs
          </Link>
          <Link href="/new-entry" className="text-sm font-medium text-gray-800 hover:text-black">
            Analysis Workspaces
          </Link>
          <Link href="/journal" className="text-sm font-medium text-gray-800 hover:text-black">
            Journal Library
          </Link>
        </div>
      </nav>

      <div className="px-4 py-8 md:px-8">
        <div className="mx-auto max-w-7xl">
          <section className="mb-6">
            <h1 className="app-page-title text-3xl md:text-4xl">
              {isEditMode ? "Update Trade Log Headers" : "Trade Log Builder"}
            </h1>

            <p className="mt-2 text-sm text-gray-700 md:text-base">
              {isEditMode
                ? "Update your existing trade log headers without creating a new trade log."
                : "Build your trade log structure by keeping required headers, adding manual headers, adding automatic headers, and creating custom automatic rules."}
            </p>

            <p className="mt-2 text-sm font-medium text-gray-800">
              {isCheckingAuth
                ? "Checking access..."
                : currentUser
                ? `Logged in as ${currentUser.email} — full builder unlocked`
                : "Guest mode — required and manual headers only"}
            </p>
          </section>

          <section className="rounded-2xl bg-white p-6 shadow-sm md:p-8">
            <div className="grid gap-4 md:grid-cols-[1fr_auto]">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-800">
                  Trade Log Name
                </label>

                <input
                  type="text"
                  value={logName}
                  onChange={(event) => setLogName(event.target.value)}
                  placeholder="Example: Gold Scalping Log"
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
                />
              </div>

              <div className="flex items-end">
                <button
                  onClick={handleCreateOrUpdateLog}
                  disabled={isCreatingLog}
                  className="w-full rounded-lg bg-black px-5 py-3 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70 md:w-auto"
                >
                  {isCreatingLog
                    ? isEditMode
                      ? "Updating..."
                      : "Creating..."
                    : isEditMode
                    ? "Update Log"
                    : "Create Log"}
                </button>
              </div>
            </div>

            {builderMessage && (
              <p
                className={`mt-4 text-sm font-medium ${
                  isBuilderError ? "text-red-600" : "text-green-600"
                }`}
              >
                {builderMessage}
              </p>
            )}
          </section>

          <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm md:p-8">
            <h2 className="app-page-title text-2xl">Required Headers</h2>

            <p className="mt-2 text-sm text-gray-700">
              These headers are required and always stay in the trade log.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4">
              {requiredHeaders.map((header) => (
                <div
                  key={header.id}
                  className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 transition hover:border-gray-400 hover:bg-white hover:shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-red-600">*</span>

                      <p className="text-sm font-semibold text-gray-900">
                        {header.name}
                      </p>
                    </div>

                    {header.lockedPosition && (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        className="h-4 w-4 text-black"
                        title="Fixed position"
                      >
                        <path
                          fillRule="evenodd"
                          d="M12 1.5a4.5 4.5 0 0 0-4.5 4.5V9H6.75A2.25 2.25 0 0 0 4.5 11.25v8.25A2.25 2.25 0 0 0 6.75 21.75h10.5a2.25 2.25 0 0 0 2.25-2.25v-8.25A2.25 2.25 0 0 0 17.25 9H16.5V6A4.5 4.5 0 0 0 12 1.5Zm-3 7.5V6a3 3 0 1 1 6 0v3H9Z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className="mt-8 grid gap-8 xl:grid-cols-2">
            <section className="rounded-2xl bg-white p-6 shadow-sm md:p-8">
              <h2 className="app-page-title text-2xl">Add Manual Header</h2>

              <p className="mt-2 text-sm text-gray-700">
                Select one or more manual headers, then apply them to the preview.
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {manualHeaderOptions.map((option) => (
                  <div
                    key={option.id}
                    className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 transition hover:border-gray-400 hover:bg-white hover:shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          {option.name}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {option.isCustom && (
                          <button
                            onClick={() =>
                              setManualHeaderOptions((previousOptions) =>
                                previousOptions.filter(
                                  (item) => item.id !== option.id
                                )
                              )
                            }
                            className="inline-flex items-center justify-center rounded-lg border border-red-300 bg-white px-2 py-1 text-sm font-medium text-red-600 hover:bg-red-50"
                            title="Delete custom manual card"
                          >
                            ✕
                          </button>
                        )}

                        <input
                          type="checkbox"
                          checked={isManualOptionChecked(option.id)}
                          onChange={() => handleToggleManualHeader(option.id)}
                          className="mt-1 h-4 w-4 accent-black"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-xl border border-dashed border-gray-300 p-4">
                <label className="mb-2 block text-sm font-medium text-gray-800">
                  Custom Manual Header
                </label>

                <div className="flex flex-col gap-3">
                  <input
                    type="text"
                    value={customManualHeaderName}
                    onChange={(event) =>
                      setCustomManualHeaderName(event.target.value)
                    }
                    placeholder="Type custom manual header name"
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
                  />

                  <button
                    onClick={handleAddCustomManualHeader}
                    className="rounded-lg bg-black px-5 py-3 text-sm font-medium text-white hover:opacity-90"
                  >
                    Add Header
                  </button>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <button
                    onClick={handleDeleteSelectedManualHeaders}
                    className="w-full rounded-lg border border-red-300 bg-white px-5 py-3 text-sm font-medium text-red-600 hover:bg-red-50"
                  >
                    Delete Selected
                  </button>

                  <button
                    onClick={handleApplySelectedManualHeaders}
                    className="w-full rounded-lg bg-black px-5 py-3 text-sm font-medium text-white hover:opacity-90"
                  >
                    Apply Selected Headers
                  </button>
                </div>
              </div>
            </section>

            <section className="rounded-2xl bg-white p-6 shadow-sm md:p-8">
              <div className="flex items-center justify-between gap-4">
                <h2 className="app-page-title text-2xl">Add Automatic Header</h2>

                {!currentUser && (
                  <span className="rounded-full bg-gray-200 px-3 py-1 text-xs font-medium text-gray-700">
                    Login Required
                  </span>
                )}
              </div>

              <p className="mt-2 text-sm text-gray-700">
                Select one or more automatic headers, then apply them to the preview.
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {automaticHeaderOptions.map((option) => (
                  <div
                    key={option.id}
                    className={`rounded-xl border px-4 py-3 transition ${
                      currentUser
                        ? "border-gray-200 bg-gray-50 hover:border-gray-400 hover:bg-white hover:shadow-sm"
                        : "border-gray-200 bg-gray-100 opacity-70"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          {option.name}
                        </p>

                        <p className="mt-1 text-xs text-gray-600">
                          {option.description}
                        </p>
                      </div>

                      <input
                        type="checkbox"
                        checked={isAutomaticOptionChecked(option.id)}
                        onChange={() => handleToggleAutomaticHeader(option.id)}
                        disabled={!currentUser}
                        className="mt-1 h-4 w-4 accent-black disabled:cursor-not-allowed"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  onClick={handleApplySelectedAutomaticHeaders}
                  className={`rounded-lg px-5 py-3 text-sm font-medium ${
                    currentUser
                      ? "bg-black text-white hover:opacity-90"
                      : "cursor-not-allowed bg-gray-300 text-gray-600"
                  }`}
                >
                  Apply Selected Headers
                </button>
              </div>
            </section>
          </div>

          <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm md:p-8">
            <div className="flex items-center justify-between gap-4">
              <h2 className="app-page-title text-2xl">
                {editingCustomAutoHeaderId
                  ? "Edit Custom Automatic Header"
                  : "Add Custom Automatic Header"}
              </h2>

              {!currentUser && (
                <span className="rounded-full bg-gray-200 px-3 py-1 text-xs font-medium text-gray-700">
                  Login Required
                </span>
              )}
            </div>

            <p className="mt-2 text-sm text-gray-700">
              Create or edit your own automatic header by defining its name,
              source field, conditions, outputs, and optional default value.
            </p>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-800">
                  Header Name
                </label>

                <input
                  type="text"
                  value={customAutoHeaderName}
                  onChange={(event) => setCustomAutoHeaderName(event.target.value)}
                  placeholder="Example: Entry Q Zone"
                  disabled={!currentUser}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black disabled:bg-gray-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-800">
                  Source Field
                </label>

                <select
                  value={customAutoSourceField}
                  onChange={(event) => setCustomAutoSourceField(event.target.value)}
                  disabled={!currentUser}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black disabled:bg-gray-100"
                >
                  <option value="">Select source field</option>

                  {selectedHeaders.map((header) => (
                    <option key={header.id} value={header.name}>
                      {header.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-800">
                  Default Value
                </label>

                <input
                  type="text"
                  value={customAutoDefaultValue}
                  onChange={(event) =>
                    setCustomAutoDefaultValue(event.target.value)
                  }
                  placeholder="Leave blank if no condition matches"
                  disabled={!currentUser}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black disabled:bg-gray-100"
                />
              </div>
            </div>

            <div className="mt-8">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="app-page-title text-xl">Conditions</h3>

                <button
                  onClick={handleAddCustomAutoRuleRow}
                  className={`rounded-lg border px-4 py-2 text-sm font-medium ${
                    currentUser
                      ? "border-gray-300 bg-white text-gray-800 hover:bg-gray-50"
                      : "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-500"
                  }`}
                >
                  Add Condition
                </button>
              </div>

              <div className="mt-4 space-y-4">
                {customAutoRules.map((rule, index) => (
                  <div
                    key={rule.id}
                    className="rounded-xl border border-gray-200 bg-gray-50 p-4"
                  >
                    <div className="mb-4 flex items-center justify-between gap-4">
                      <p className="text-sm font-semibold text-gray-900">
                        Condition {index + 1}
                      </p>

                      <button
                        onClick={() => handleRemoveCustomRuleRow(rule.id)}
                        className={`inline-flex items-center justify-center rounded-lg border px-3 py-2 text-sm font-medium ${
                          currentUser
                            ? "border-red-300 bg-white text-red-600 hover:bg-red-50"
                            : "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-500"
                        }`}
                        title="Remove condition"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-gray-800">
                          Condition Type
                        </label>

                        <select
                          value={rule.ruleType}
                          onChange={(event) =>
                            handleCustomRuleChange(
                              rule.id,
                              "ruleType",
                              event.target.value
                            )
                          }
                          disabled={!currentUser}
                          className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black disabled:bg-gray-100"
                        >
                          <option value="time_range">Time Range</option>
                          <option value="time_offset_range">Time Offset Range</option>
                        </select>
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-gray-800">
                          Rule Timezone
                        </label>

                        <select
                          value={rule.ruleTimezone || "UTC"}
                          onChange={(event) =>
                            handleCustomRuleChange(
                              rule.id,
                              "ruleTimezone",
                              event.target.value
                            )
                          }
                          disabled={!currentUser}
                          className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black disabled:bg-gray-100"
                        >
                          {availableRuleTimezones.map((timezone) => (
                            <option key={timezone} value={timezone}>
                              {timezone}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-gray-800">
                          Output Value
                        </label>

                        <input
                          type="text"
                          value={rule.outputValue}
                          onChange={(event) =>
                            handleCustomRuleChange(
                              rule.id,
                              "outputValue",
                              event.target.value
                            )
                          }
                          placeholder="Example: Section 1"
                          disabled={!currentUser}
                          className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black disabled:bg-gray-100"
                        />
                      </div>
                    </div>

                    {rule.ruleType === "time_range" ? (
                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <div>
                          <label className="mb-2 block text-sm font-medium text-gray-800">
                            Start Time
                          </label>

                          <input
                            type="time"
                            value={rule.startTime}
                            onChange={(event) =>
                              handleCustomRuleChange(
                                rule.id,
                                "startTime",
                                event.target.value
                              )
                            }
                            disabled={!currentUser}
                            className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black disabled:bg-gray-100"
                          />
                        </div>

                        <div>
                          <label className="mb-2 block text-sm font-medium text-gray-800">
                            End Time
                          </label>

                          <input
                            type="time"
                            value={rule.endTime}
                            onChange={(event) =>
                              handleCustomRuleChange(
                                rule.id,
                                "endTime",
                                event.target.value
                              )
                            }
                            disabled={!currentUser}
                            className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black disabled:bg-gray-100"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4 space-y-4">
                        <div className="grid gap-4 md:grid-cols-3">
                          <div>
                            <label className="mb-2 block text-sm font-medium text-gray-800">
                              Start Date
                            </label>

                            <input
                              type="date"
                              value={rule.startDate}
                              onChange={(event) =>
                                handleCustomRuleChange(
                                  rule.id,
                                  "startDate",
                                  event.target.value
                                )
                              }
                              disabled={!currentUser}
                              className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black disabled:bg-gray-100"
                            />

                            {rule.startDate && (
                              <p className="mt-1 text-xs text-gray-600">
                                Day: {getDayNameFromDate(rule.startDate)}
                              </p>
                            )}
                          </div>

                          <div>
                            <label className="mb-2 block text-sm font-medium text-gray-800">
                              Start Time
                            </label>

                            <input
                              type="time"
                              value={rule.anchorTime}
                              onChange={(event) =>
                                handleCustomRuleChange(
                                  rule.id,
                                  "anchorTime",
                                  event.target.value
                                )
                              }
                              disabled={!currentUser}
                              className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black disabled:bg-gray-100"
                            />
                          </div>

                          <div>
                            <label className="mb-2 block text-sm font-medium text-gray-800">
                              Direction
                            </label>

                            <select
                              value={rule.offsetDirection}
                              onChange={(event) =>
                                handleCustomRuleChange(
                                  rule.id,
                                  "offsetDirection",
                                  event.target.value
                                )
                              }
                              disabled={!currentUser}
                              className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black disabled:bg-gray-100"
                            >
                              <option value="plus">Plus</option>
                              <option value="minus">Minus</option>
                            </select>
                          </div>
                        </div>

                        <div className="grid gap-4 md:grid-cols-3">
                          <div>
                            <label className="mb-2 block text-sm font-medium text-gray-800">
                              Offset Hours
                            </label>

                            <input
                              type="number"
                              value={rule.offsetHours}
                              onChange={(event) =>
                                handleCustomRuleChange(
                                  rule.id,
                                  "offsetHours",
                                  event.target.value
                                )
                              }
                              placeholder="Example: 120"
                              disabled={!currentUser}
                              className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black disabled:bg-gray-100"
                            />
                          </div>

                          <div>
                            <label className="mb-2 block text-sm font-medium text-gray-800">
                              Offset Minutes
                            </label>

                            <input
                              type="number"
                              value={rule.offsetMinutes}
                              onChange={(event) =>
                                handleCustomRuleChange(
                                  rule.id,
                                  "offsetMinutes",
                                  event.target.value
                                )
                              }
                              placeholder="0"
                              disabled={!currentUser}
                              className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black disabled:bg-gray-100"
                            />
                          </div>

                          <div>
                            <label className="mb-2 block text-sm font-medium text-gray-800">
                              Offset Seconds
                            </label>

                            <input
                              type="number"
                              value={rule.offsetSeconds}
                              onChange={(event) =>
                                handleCustomRuleChange(
                                  rule.id,
                                  "offsetSeconds",
                                  event.target.value
                                )
                              }
                              placeholder="0"
                              disabled={!currentUser}
                              className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black disabled:bg-gray-100"
                            />
                          </div>
                        </div>

                        {formatOffsetResult(rule) && (
                          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                            <p className="text-sm font-medium text-blue-900">
                              Result: {formatOffsetResult(rule)}
                            </p>
                            <p className="mt-1 text-xs text-blue-700">
                              The saved rule uses the start weekday/time and result weekday/time.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  onClick={handleAddCustomAutomaticHeader}
                  className={`rounded-lg px-5 py-3 text-sm font-medium ${
                    currentUser
                      ? "bg-black text-white hover:opacity-90"
                      : "cursor-not-allowed bg-gray-300 text-gray-600"
                  }`}
                >
                  {editingCustomAutoHeaderId
                    ? "Save Custom Automatic Header"
                    : "Add Custom Automatic Header"}
                </button>

                {editingCustomAutoHeaderId && (
                  <button
                    onClick={handleCancelCustomHeaderEdit}
                    className="rounded-lg border border-gray-300 bg-white px-5 py-3 text-sm font-medium text-gray-900 hover:bg-gray-50"
                  >
                    Cancel Edit
                  </button>
                )}
              </div>
            </div>
          </section>

          <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm md:p-8">
            <div className="flex items-center justify-between gap-4">
              <h2 className="app-page-title text-2xl">Selected Header Preview</h2>

              <button
                onClick={handleCreateOrUpdateLog}
                disabled={isCreatingLog}
                className="rounded-lg bg-black px-5 py-3 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isCreatingLog
                  ? isEditMode
                    ? "Updating..."
                    : "Creating..."
                  : isEditMode
                  ? "Update Log"
                  : "Create Log"}
              </button>
            </div>

            <p className="mt-2 text-sm text-gray-700">
              This preview shows the exact headers that will be used when you
              save the trade log.
            </p>

            <div className="mt-6 space-y-4">
              {selectedHeaders.map((header, index) => (
                <div
                  key={`${header.id || header.name || "selected-header"}-${index}`}
                  className="rounded-xl border border-gray-200 bg-gray-50 p-4 transition hover:border-gray-400 hover:bg-white hover:shadow-sm"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900">
                          {index + 1}. {header.name}
                        </p>

                        <span className="rounded-full bg-gray-200 px-2 py-1 text-xs font-medium text-gray-700">
                          {header.group === "required"
                            ? "Required"
                            : header.group === "manual"
                            ? "Manual"
                            : header.group === "automatic"
                            ? "Automatic"
                            : "Custom Automatic"}
                        </span>

                        {header.formulaKey && (
                          <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">
                            Formula: {header.formulaKey}
                          </span>
                        )}

                        {header.locked && (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            className="h-4 w-4 text-black"
                            title="Locked header"
                          >
                            <path
                              fillRule="evenodd"
                              d="M12 1.5a4.5 4.5 0 0 0-4.5 4.5V9H6.75A2.25 2.25 0 0 0 4.5 11.25v8.25A2.25 2.25 0 0 0 6.75 21.75h10.5a2.25 2.25 0 0 0 2.25-2.25v-8.25A2.25 2.25 0 0 0 17.25 9H16.5V6A4.5 4.5 0 0 0 12 1.5Zm-3 7.5V6a3 3 0 1 1 6 0v3H9Z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </div>

                      <p className="mt-2 text-xs text-gray-600">
                        {header.group === "custom_automatic"
                          ? `Source: ${header.sourceField || "Not set"}`
                          : header.description || ""}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {header.group === "custom_automatic" && (
                        <button
                          onClick={() => handleEditCustomHeader(header)}
                          className="rounded-lg border border-blue-300 bg-white px-3 py-2 text-xs font-medium text-blue-700 hover:bg-blue-50"
                        >
                          Edit
                        </button>
                      )}

                      <button
                        onClick={() => handleMoveHeaderUp(header.id)}
                        className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-800 hover:bg-gray-50"
                      >
                        Move Up
                      </button>

                      <button
                        onClick={() => handleMoveHeaderDown(header.id)}
                        className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-800 hover:bg-gray-50"
                      >
                        Move Down
                      </button>

                      {!header.locked && (
                        <button
                          onClick={() => handleRemoveSelectedHeader(header.id)}
                          className="inline-flex items-center justify-center rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                          title="Remove header"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>

                  {header.group === "custom_automatic" && header.rules?.length > 0 && (
                    <div className="mt-4 rounded-lg border border-dashed border-gray-300 bg-white p-4">
                      <p className="text-xs font-medium uppercase text-gray-600">
                        Custom Rules
                      </p>

                      <div className="mt-3 space-y-2">
                        {header.rules.map((rule) => (
                          <p key={rule.id} className="text-sm text-gray-700">
                            {rule.ruleType === "time_range"
                              ? `${rule.ruleTimezone || "UTC"}: ${rule.startTime} to ${rule.endTime} → ${rule.outputValue}`
                              : `${rule.ruleTimezone || "UTC"}: ${getDayNameFromDate(rule.startDate)} ${rule.anchorTime} ${rule.offsetDirection} ${rule.offsetHours || 0}h ${rule.offsetMinutes || 0}m ${rule.offsetSeconds || 0}s → ${rule.outputValue}`}
                          </p>
                        ))}
                      </div>

                      {header.defaultValue && (
                        <p className="mt-3 text-xs text-gray-600">
                          Default: {header.defaultValue}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
