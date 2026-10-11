import type { Metadata } from "next";
import { InfoPage, infoMetadata } from "@/components/info/InfoPage";

export function generateMetadata(): Promise<Metadata> {
  return infoMetadata("terms");
}

export default function TermsPage() {
  return <InfoPage page="terms" />;
}
