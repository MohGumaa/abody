"use client";

import { type FormEvent, startTransition, useActionState, useState } from "react";
import { saveServiceWork, type ServiceWorkResult } from "@/actions/admin-service-work";
import { INPUT_BASE } from "@/components/auth/AuthForm";
import type { ServiceStatus } from "@/lib/generated/prisma/enums";
import { ADMIN_NOTES_MAX_LENGTH } from "@/lib/service-work-rules";

const TEXTAREA = `${INPUT_BASE} h-auto px-4 py-3 leading-relaxed`;
const SUBMIT =
  "h-11 justify-self-start rounded-control bg-primary-strong px-5 text-sm font-semibold text-white outline-offset-2 hover:shadow-raised focus-visible:outline-2 focus-visible:outline-primary-strong disabled:cursor-wait disabled:opacity-70";

// Labels only; the server whitelists the value.
const OPTIONS: { value: ServiceStatus; label: string; hint: string }[] = [
  { value: "NEW", label: "New", hint: "Details received, work not started." },
  {
    value: "WAITING_FOR_INFORMATION",
    label: "Waiting for information",
    hint: "Asks the customer for more; they can edit their details again.",
  },
  { value: "IN_PROGRESS", label: "In progress", hint: "Work has started. Records the start date." },
  { value: "COMPLETED", label: "Completed", hint: "Work delivered. Records the completion date." },
  { value: "CANCELLED", label: "Cancelled", hint: "The service will not be delivered." },
];

const MESSAGES: Record<Exclude<ServiceWorkResult, null | { success: true }>["error"], string> = {
  changed: "Someone changed this service's status. Reload to see it.",
  not_found: "This service order no longer exists or its order is no longer paid.",
  notes_too_long: `Notes can be up to ${ADMIN_NOTES_MAX_LENGTH.toLocaleString("en")} characters.`,
  invalid_status: "Something went wrong. Try again.",
  unexpected: "Something went wrong. Try again.",
};

export function ServiceWorkForm({
  serviceId,
  status,
  notes,
}: {
  serviceId: string;
  status: ServiceStatus;
  notes: string;
}) {
  const [state, action, pending] = useActionState<ServiceWorkResult, FormData>(
    saveServiceWork,
    null,
  );
  // Submitted by hand, not through the form's action prop: React resets an
  // action form after every submit, which put the radios back to the status
  // the page first loaded with, so the next save would undo this one.
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => action(data));
  }
  const [picked, setPicked] = useState<ServiceStatus>(status);
  const [text, setText] = useState(notes);
  const [saved, setSaved] = useState({ status, notes });
  if (saved.status !== status || saved.notes !== notes) {
    // A refresh brought new saved values.
    setSaved({ status, notes });
    setPicked(status);
    setText(notes);
  }
  const error = !pending && state?.success === false ? state.error : null;
  const notesError = error === "notes_too_long";
  const message = error ? MESSAGES[error] : !pending && state?.success ? "Saved." : "";

  return (
    <form onSubmit={submit} className="grid gap-5">
      <input type="hidden" name="id" value={serviceId} />
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">Status</legend>
        {OPTIONS.map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer items-start gap-3 rounded-control border border-border bg-surface px-4 py-3 text-sm has-checked:border-primary has-checked:bg-primary-soft"
          >
            <input
              type="radio"
              name="status"
              value={option.value}
              checked={picked === option.value}
              onChange={() => setPicked(option.value)}
              className="mt-0.5 accent-primary-strong"
            />
            <span className="grid gap-0.5">
              <span className="font-semibold">{option.label}</span>
              <span className="text-xs text-muted">{option.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <div className="grid gap-2">
        <label htmlFor="service-notes" className="text-sm font-medium">
          Internal notes
        </label>
        <textarea
          id="service-notes"
          name="notes"
          rows={6}
          value={text}
          onChange={(event) => setText(event.target.value)}
          aria-describedby="service-notes-hint"
          aria-invalid={notesError || undefined}
          dir="auto"
          className={TEXTAREA}
        />
        <p id="service-notes-hint" className={`text-xs ${notesError ? "text-danger" : "text-faint"}`}>
          Only the Abody team sees these. Up to{" "}
          {ADMIN_NOTES_MAX_LENGTH.toLocaleString("en")} characters.
        </p>
      </div>
      <button type="submit" disabled={pending} className={SUBMIT}>
        {pending ? "Saving…" : "Save"}
      </button>
      <p
        role="status"
        className={
          error
            ? "rounded-control bg-danger-soft px-4 py-3 text-sm text-danger"
            : message
              ? "text-sm font-medium text-success"
              : "sr-only"
        }
      >
        {message}
      </p>
    </form>
  );
}
