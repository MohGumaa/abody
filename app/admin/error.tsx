"use client";

interface ErrorScreenProps {
  error: Error & { digest?: string };
  retry: () => void;
}

// Never renders the error itself: server details must not reach the page.
export default function AdminErrorScreen({ retry }: ErrorScreenProps) {
  return (
    <section className="grid justify-items-center gap-2 rounded-panel bg-panel px-5 py-16 text-center font-sans shadow-soft">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="text-muted">This page could not be loaded. Please try again.</p>
      <button
        type="button"
        onClick={() => retry()}
        className="mt-4 rounded-full bg-primary-strong px-6 py-3 font-semibold text-white outline-offset-2 hover:shadow-raised focus-visible:outline-2 focus-visible:outline-primary-strong"
      >
        Try again
      </button>
    </section>
  );
}
