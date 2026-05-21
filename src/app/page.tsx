import type { Metadata } from "next";
import { UploadShell } from "@/components/upload-shell";

export const metadata: Metadata = {
  title: "Pampi Card",
  description: "Browser-based credit card statement parser and CSV exporter.",
};

export default function Home() {
  return <UploadShell />;
}
