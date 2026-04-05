"use client";

import { useId, useState } from "react";
import styles from "./upload-shell.module.css";
import { getAcceptedFileTypes, isPdfFileName } from "@/lib/files";

const ACCEPTED_FILE_TYPES = getAcceptedFileTypes();

export function UploadShell() {
  const inputId = useId();
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      setSelectedFileName(null);
      return;
    }

    setSelectedFileName(isPdfFileName(file.name) ? file.name : `${file.name} (unsupported file)`);
  }

  return (
    <section className={styles.shell}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <p className={styles.panelLabel}>Upload</p>
          <h2>Load a Macquarie Bank credit card statement PDF</h2>
          <p className={styles.panelCopy}>
            Later milestones will parse the file in-browser and export card-specific CSVs. For
            now, this shell captures file input and preserves the empty state expected by the test
            harness.
          </p>
        </div>

        <label className={styles.dropzone} htmlFor={inputId}>
          <span className={styles.dropzoneTitle}>Choose a PDF statement</span>
          <span className={styles.dropzoneCopy}>Accepted type: PDF</span>
          <input
            id={inputId}
            name="statement"
            type="file"
            accept={ACCEPTED_FILE_TYPES}
            className={styles.input}
            aria-describedby={`${inputId}-hint`}
            onChange={handleFileChange}
          />
        </label>

        <p className={styles.fileHint} id={`${inputId}-hint`}>
          {selectedFileName
            ? `Selected file: ${selectedFileName}`
            : "No statement loaded yet. Uploading a file will trigger browser-side extraction in a later milestone."}
        </p>
      </div>

      <div className={styles.resultsHeader}>
        <div>
          <p className={styles.panelLabel}>Results</p>
          <h2>Waiting for parsed statement data</h2>
        </div>
        <p className={styles.resultsCopy}>
          Summary, reconciliation, and CSV download panels remain hidden until parsing is
          implemented.
        </p>
      </div>
    </section>
  );
}
