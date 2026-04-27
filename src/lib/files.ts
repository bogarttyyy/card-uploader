const ACCEPTED_FILE_TYPES = [".pdf"] as const;

export function getAcceptedFileTypes() {
  return ACCEPTED_FILE_TYPES.join(",");
}

export function isPdfFileName(fileName: string) {
  return fileName.trim().toLowerCase().endsWith(".pdf");
}
