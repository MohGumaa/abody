import type { Metadata } from "next";
import { InfoPage, infoMetadata } from "@/components/info/InfoPage";

export function generateMetadata(): Promise<Metadata> {
  return infoMetadata("privacy");
}

export default function PrivacyPage() {
  return <InfoPage page="privacy" />;
}
