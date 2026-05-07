"use client";

import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function BugReportWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState("start");

  const [whatBroke, setWhatBroke] = useState("");
  const [whatDoing, setWhatDoing] = useState("");
  const [whatHappened, setWhatHappened] = useState("");
  const [fullStory, setFullStory] = useState("");

  const [isSending, setIsSending] = useState(false);
  const [submitMessage, setSubmitMessage] = useState("");

  function resetForm() {
    setWhatBroke("");
    setWhatDoing("");
    setWhatHappened("");
    setFullStory("");
    setSubmitMessage("");
    setIsSending(false);
  }

  function handleClose() {
    setIsOpen(false);
    setStep("start");
    setSubmitMessage("");
    setIsSending(false);
  }

  async function handleSubmit() {
    if (
      !whatBroke.trim() &&
      !whatDoing.trim() &&
      !whatHappened.trim() &&
      !fullStory.trim()
    ) {
      setSubmitMessage("Please type at least one detail before sending.");
      return;
    }

    setIsSending(true);
    setSubmitMessage("");

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const currentUser = sessionData?.session?.user ?? null;

      const payload = {
        what_broke: whatBroke.trim(),
        trying_to_do: whatDoing.trim(),
        what_happened: whatHappened.trim(),
        full_story: fullStory.trim(),
        page_url: typeof window !== "undefined" ? window.location.href : "",
        user_email: currentUser?.email || null,
      };

      const { error } = await supabase.from("bug_reports").insert([payload]);

      if (error) {
        console.log("BUG REPORT INSERT ERROR:", error);
        setSubmitMessage(`Could not send report: ${error.message}`);
        setIsSending(false);
        return;
      }

      setStep("done");
      resetForm();
    } catch (error) {
      console.log("BUG REPORT SUBMIT ERROR:", error);
      setSubmitMessage("Something went wrong while sending the report.");
      setIsSending(false);
    }
  }

  return (
    <>
      <button
        onClick={() => {
          setIsOpen(true);
          setStep("start");
          setSubmitMessage("");
        }}
        title="Something broke?"
        className="fixed bottom-5 right-5 z-[500] cursor-pointer p-2 opacity-70 transition hover:scale-110 hover:opacity-100"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="h-7 w-7 text-gray-700"
        >
          <path d="M12 2a4 4 0 0 0-4 4v1H6a1 1 0 0 0 0 2h2v1H5a1 1 0 0 0 0 2h3v1H6a1 1 0 0 0 0 2h2v1a4 4 0 1 0 8 0v-1h2a1 1 0 1 0 0-2h-2v-1h3a1 1 0 1 0 0-2h-3v-1h2a1 1 0 1 0 0-2h-2V6a4 4 0 0 0-4-4Zm-2 6V6a2 2 0 1 1 4 0v2h-4Zm4 10a2 2 0 1 1-4 0v-6h4v6Z" />
        </svg>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            {step === "start" && (
              <>
                <h2 className="text-xl font-semibold text-gray-900">
                  Something broke?
                </h2>

                <div className="mt-6 flex gap-3">
                  <button
                    onClick={() => setStep("form")}
                    className="cursor-pointer rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:opacity-90"
                  >
                    Report a Problem
                  </button>

                  <button
                    onClick={handleClose}
                    className="cursor-pointer rounded-lg border border-gray-300 px-4 py-2 text-sm"
                  >
                    Close
                  </button>
                </div>
              </>
            )}

            {step === "form" && (
              <>
                <h2 className="text-xl font-semibold text-gray-900">
                  Report a Problem
                </h2>

                <div className="mt-4 space-y-3">
                  <input
                    type="text"
                    placeholder="What broke?"
                    value={whatBroke}
                    onChange={(event) => setWhatBroke(event.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-black"
                  />

                  <input
                    type="text"
                    placeholder="What were you trying to do?"
                    value={whatDoing}
                    onChange={(event) => setWhatDoing(event.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-black"
                  />

                  <input
                    type="text"
                    placeholder="What happened instead?"
                    value={whatHappened}
                    onChange={(event) => setWhatHappened(event.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-black"
                  />

                  <textarea
                    placeholder="Tell us what went wrong so we can fix it"
                    value={fullStory}
                    onChange={(event) => setFullStory(event.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-black"
                    rows={4}
                  />
                </div>

                {submitMessage && (
                  <p className="mt-3 text-sm text-red-600">{submitMessage}</p>
                )}

                <div className="mt-6 flex gap-3">
                  <button
                    onClick={handleSubmit}
                    disabled={isSending}
                    className="cursor-pointer rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isSending ? "Sending..." : "Send Report"}
                  </button>

                  <button
                    onClick={handleClose}
                    className="cursor-pointer rounded-lg border border-gray-300 px-4 py-2 text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}

            {step === "done" && (
              <>
                <h2 className="text-xl font-semibold text-gray-900">
                  Report Sent
                </h2>

                <p className="mt-2 text-sm text-gray-700">
                  Thanks. We received it.
                </p>

                <div className="mt-6">
                  <button
                    onClick={handleClose}
                    className="cursor-pointer rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:opacity-90"
                  >
                    Close
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
