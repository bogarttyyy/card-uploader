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
        <p className={styles.eyebrow}>Browser Workflow</p>
        <h1>Credit card statements, parsed directly in the browser.</h1>
        <p className={styles.lead}>
          Upload a supported Macquarie Bank statement to extract transactions, review
          reconciliation, and export per-card or combined CSV files without sending the PDF to a
          backend service.
        </p>
      </section>

      <UploadShell />
    </main>
  );
}
