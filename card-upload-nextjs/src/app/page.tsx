import type { Metadata } from "next";
import styles from "./page.module.css";
import { UploadShell } from "@/components/upload-shell";

export const metadata: Metadata = {
  title: "Card Upload",
  description: "Browser-based PDF upload shell for the credit card statement converter.",
};

export default function Home() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <p className={styles.eyebrow}>Milestone 4</p>
        <h1>Credit card statements, without the Streamlit runtime.</h1>
        <p className={styles.lead}>
          This Next.js app now performs browser-side PDF extraction and parses supported statement
          fixtures into metadata, card numbers, and reconciliation-ready totals. Full UI parity and
          export flows are still being ported on top of that parser core.
        </p>
      </section>

      <UploadShell />
    </main>
  );
}
