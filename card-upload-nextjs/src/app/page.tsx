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
        <p className={styles.eyebrow}>Milestone 1</p>
        <h1>Credit card statements, without the Streamlit runtime.</h1>
        <p className={styles.lead}>
          This Next.js app is the standalone successor shell for the current Macquarie statement
          converter. PDF parsing is not wired yet; the upload flow, test harness, and page
          structure are in place.
        </p>
      </section>

      <UploadShell />
    </main>
  );
}
