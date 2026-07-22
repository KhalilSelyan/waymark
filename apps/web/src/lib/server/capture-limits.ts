export const maxCaptureBytes = 15 * 1024 * 1024;

export function acceptsCaptureResponse(totalBytes: number, declaredBytes: number, bodyBytes: number) {
  if (declaredBytes > maxCaptureBytes || totalBytes + declaredBytes > maxCaptureBytes) return false;
  return totalBytes + bodyBytes <= maxCaptureBytes;
}
