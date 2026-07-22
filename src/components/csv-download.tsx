"use client";

import type { ReactNode } from "react";

type CsvDownloadProps = {
  csvData: string;
  fileName: string;
  className?: string;
  children: ReactNode;
  ariaLabel?: string;
};

export function CsvDownload({
  csvData,
  fileName,
  className,
  children,
  ariaLabel,
}: CsvDownloadProps) {
  function downloadCsv() {
    const blob = new Blob(["\uFEFF", csvData], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={downloadCsv}
      className={className}
    >
      {children}
    </button>
  );
}
