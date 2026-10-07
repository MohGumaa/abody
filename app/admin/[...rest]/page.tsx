import { notFound } from "next/navigation";

// Keeps an unknown /admin/... URL in the admin root layout. Without it the URL
// would match app/[lang]/[...rest] with "admin" as the language.
export default function UnmatchedAdminPage() {
  notFound();
}
