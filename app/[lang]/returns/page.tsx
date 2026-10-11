import type { Metadata } from "next";
import { InfoPage, infoMetadata } from "@/components/info/InfoPage";

export function generateMetadata(): Promise<Metadata> {
  return infoMetadata("returns");
}

export default function ReturnsPage() {
  return <InfoPage page="returns" />;
}
