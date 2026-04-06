import type { Metadata } from "next";
import styles from "./page.module.css";
import { UploadShell } from "@/components/upload-shell";

export const metadata: Metadata = {
  title: "Card Upload",
  description: "Browser-based Macquarie credit card statement parser and CSV exporter.",
};

export default function Home() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <p className={styles.eyebrow}>Milestone 6</p>
        <h1>Credit card statements, without the Streamlit runtime.</h1>
        <p className={styles.lead}>
          This Next.js app now runs the statement workflow fully in the browser: PDF extraction,
          parser-based reconciliation, per-card review, and CSV exports for supported Macquarie
          credit card statements.
        </p>
      </section>

      <UploadShell />
    </main>
  );
}
