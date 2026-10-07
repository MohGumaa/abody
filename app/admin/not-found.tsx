import Link from "next/link";
import { getCurrentUser } from "@/lib/session";

// Also what a signed-in non-admin sees, so it never mentions the admin area.
// For an admin it sits inside the layout's <main>, so it renders a section.
export default async function AdminNotFound() {
  const user = await getCurrentUser();
  const Wrapper = user?.role === "ADMIN" ? "section" : "main";

  return (
    <Wrapper className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-16 text-center font-sans">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="mt-2 text-muted">The page you are looking for does not exist.</p>
      <Link
        href="/en"
        className="mt-6 rounded-full bg-primary-strong px-6 py-3 font-semibold text-white outline-offset-2 focus-visible:outline-2 focus-visible:outline-primary-strong"
      >
        Go to the store
      </Link>
    </Wrapper>
  );
}
