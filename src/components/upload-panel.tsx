import { AlertCircle, FileText, ShieldCheck, Upload } from "lucide-react";
import type { ExtractionState } from "@/components/upload-shell";
import { getAcceptedFileTypes, isPdfFileName } from "@/lib/files";

const ACCEPTED_FILE_TYPES = getAcceptedFileTypes();

type UploadPanelProps = {
  inputId: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  isDragging: boolean;
  isProcessing: boolean;
  selectedFileName: string | null;
  extractionState: ExtractionState;
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onDragOver: (event: React.DragEvent<HTMLLabelElement>) => void;
  onDragLeave: () => void;
  onDrop: (event: React.DragEvent<HTMLLabelElement>) => void;
};

export function UploadPanel({
  inputId,
  inputRef,
  isDragging,
  isProcessing,
  selectedFileName,
  extractionState,
  onFileChange,
  onDragOver,
  onDragLeave,
  onDrop,
}: UploadPanelProps) {
  return (
    <section className="mx-auto max-w-2xl">
      <label
        htmlFor={inputId}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        aria-busy={isProcessing}
        data-testid="file-drop-zone"
        className={[
          "block rounded-2xl border-2 border-dashed bg-white p-7 text-center shadow-sm transition-colors focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/20 dark:bg-slate-900 md:p-12",
          isDragging
            ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
            : "border-slate-300 hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-600",
          isProcessing ? "cursor-default" : "cursor-pointer",
        ].join(" ")}
      >
        <input
          ref={inputRef}
          id={inputId}
          name="statement"
          type="file"
          accept={ACCEPTED_FILE_TYPES}
          aria-label="Choose a PDF statement"
          aria-describedby={`${inputId}-hint`}
          disabled={isProcessing}
          onChange={onFileChange}
          className="sr-only"
        />

        {isProcessing ? (
          <ProcessingState fileName={selectedFileName ?? "Statement.pdf"} />
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
              <Upload aria-hidden="true" className="h-7 w-7" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-950 dark:text-white">
                Upload a Macquarie card statement
              </h2>
              <p className="mt-2 text-slate-600 dark:text-slate-400">
                Drag and drop your statement here, or choose it from your device.
              </p>
            </div>
            <span className="inline-flex min-h-11 items-center justify-center rounded-lg bg-blue-600 px-6 py-2.5 font-semibold text-white transition-colors hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700">
              Choose PDF
            </span>
            <span
              id={`${inputId}-hint`}
              className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400"
            >
              <FileText aria-hidden="true" className="h-4 w-4" />
              PDF only · Up to 10 MiB
            </span>
          </div>
        )}
      </label>

      {selectedFileName && !isProcessing ? (
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
          {isPdfFileName(selectedFileName)
            ? `Selected file: ${selectedFileName}`
            : `Selected file: ${selectedFileName} (unsupported file)`}
        </p>
      ) : null}

      {extractionState.status === "error" ? (
        <div
          role="alert"
          className="mt-5 flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-950 dark:border-red-900 dark:bg-red-950 dark:text-red-100"
        >
          <AlertCircle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
          <div>
            <p className="font-semibold">{extractionState.title}</p>
            <p className="mt-1 text-red-800 dark:text-red-200">{extractionState.message}</p>
            <p className="mt-2 text-xs text-red-700 dark:text-red-300">
              Anonymous failure category reported: {extractionState.category}.
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-5 flex items-start gap-3 px-1 text-sm text-slate-600 dark:text-slate-400">
          <ShieldCheck aria-hidden="true" className="h-5 w-5 shrink-0 text-slate-500 dark:text-slate-400" />
          <p>
            Statement contents remain on this device. Only anonymous error categories may be
            reported.
          </p>
        </div>
      )}
    </section>
  );
}

function ProcessingState({ fileName }: { fileName: string }) {
  return (
    <div className="flex min-h-56 flex-col items-center justify-center gap-4" role="status">
      <div
        aria-hidden="true"
        className="h-10 w-10 rounded-full border-4 border-blue-100 border-t-blue-600 motion-safe:animate-spin dark:border-slate-700 dark:border-t-blue-400"
      />
      <div>
        <p className="max-w-full break-words font-semibold text-slate-950 dark:text-white">
          {fileName}
        </p>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Reading and extracting statement
        </p>
      </div>
    </div>
  );
}
