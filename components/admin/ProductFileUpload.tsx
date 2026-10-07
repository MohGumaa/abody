"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { PRODUCT_FILE_MAX_BYTES, productFileExtension } from "@/lib/admin-product-rules";

type UploadState =
  | { kind: "idle" }
  | { kind: "uploading" }
  | { kind: "done"; fileName: string }
  | { kind: "error"; message: string };

const BUTTON =
  "h-11 justify-self-start rounded-control bg-primary-strong px-5 text-sm font-semibold text-white outline-offset-2 hover:shadow-raised focus-visible:outline-2 focus-visible:outline-primary-strong disabled:cursor-wait disabled:opacity-70";

const SERVER_ERRORS: Record<string, string> = {
  invalid_file_type: "The file is not a valid PDF or ZIP.",
  empty_file: "The file is empty.",
  file_too_large: "The file is larger than 25 MB.",
  not_found: "This product no longer exists.",
};

// The file goes to the upload route as the raw request body. The checks here
// only save a wasted upload; the server checks everything again.
export function ProductFileUpload({
  productId,
  fileName,
}: {
  productId: string;
  fileName: string | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<UploadState>({ kind: "idle" });

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = inputRef.current?.files?.[0];
    if (!file) {
      setState({ kind: "error", message: "Choose a PDF or ZIP file first." });
      return;
    }
    if (!productFileExtension(file.name)) {
      setState({ kind: "error", message: "Upload a PDF or ZIP file." });
      return;
    }
    if (file.size > PRODUCT_FILE_MAX_BYTES) {
      setState({ kind: "error", message: SERVER_ERRORS.file_too_large });
      return;
    }

    setState({ kind: "uploading" });
    try {
      const response = await fetch(`/api/admin/products/${productId}/file`, {
        method: "PUT",
        headers: { "x-file-name": encodeURIComponent(file.name) },
        body: file,
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        const code: unknown = body?.error?.code;
        setState({
          kind: "error",
          message:
            (typeof code === "string" && SERVER_ERRORS[code]) ||
            "The upload failed. Try again.",
        });
        return;
      }
      setState({ kind: "done", fileName: body.fileName });
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    } catch {
      setState({ kind: "error", message: "The upload failed. Check your connection and try again." });
    }
  }

  const uploading = state.kind === "uploading";

  return (
    <form onSubmit={upload} className="grid gap-4">
      <p className="text-sm">
        <span className="text-muted">Current file: </span>
        {fileName ? (
          <strong className="font-semibold break-all">{fileName}</strong>
        ) : (
          <span className="font-semibold text-warning">No file yet</span>
        )}
      </p>
      <div className="grid gap-1.5">
        <label htmlFor="product-file" className="text-sm font-medium">
          {fileName ? "Replace the file" : "Upload a file"}
        </label>
        <input
          ref={inputRef}
          id="product-file"
          type="file"
          accept=".pdf,.zip,application/pdf,application/zip"
          aria-describedby="product-file-hint"
          disabled={uploading}
          className="text-sm file:me-3 file:h-10 file:rounded-control file:border file:border-border file:bg-surface file:px-4 file:font-semibold file:text-foreground"
        />
        <p id="product-file-hint" className="text-xs text-muted">
          PDF or ZIP, up to 25 MB. Customers who bought the product download the
          newest file.
        </p>
      </div>
      <button type="submit" disabled={uploading} className={BUTTON}>
        {uploading ? "Uploading…" : "Upload"}
      </button>
      <p
        role="status"
        className={
          state.kind === "error"
            ? "rounded-control bg-danger-soft px-4 py-3 text-sm text-danger"
            : state.kind === "done"
              ? "text-sm font-medium text-success"
              : "sr-only"
        }
      >
        {state.kind === "error"
          ? state.message
          : state.kind === "done"
            ? `Uploaded ${state.fileName}.`
            : state.kind === "uploading"
              ? "Uploading the file…"
              : ""}
      </p>
    </form>
  );
}
