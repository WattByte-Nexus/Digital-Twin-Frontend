import { requestDigitalTwinJson, type DigitalTwinRequestOptions } from "./digital-twin-api";
import type { components } from "./digital-twin-contract.generated";

export const MAX_POINT_CLOUD_UPLOAD_SIZE = 100 * 1024 ** 3;
export type PointCloudUploadCapture = components["schemas"]["UploadCapture"];
export type PointCloudUploadResult = components["schemas"]["UploadCompleted"];
export type PointCloudUploadPhase = "starting" | "uploading" | "finishing" | "cancelling";
type UploadPart = (url: string, blob: Blob, progress: (bytes: number) => void, signal: AbortSignal) => Promise<void>;

export function validatePointCloudCapture(capture: PointCloudUploadCapture): PointCloudUploadCapture {
  if (!/^[^/\\\x00-\x1f]+\.(las|laz|ply)$/i.test(capture.filename) || capture.filename.length > 180) {
    throw new Error("Choose a LAS, LAZ or PLY file with a filename of at most 180 characters.");
  }
  if (!Number.isSafeInteger(capture.size) || capture.size <= 0 || capture.size > MAX_POINT_CLOUD_UPLOAD_SIZE) {
    throw new Error("Choose a nonempty file up to 100 GiB.");
  }
  if (capture.reference === "epsg" && !/^EPSG:[1-9]\d{2,5}$/.test(capture.epsg ?? "")) {
    throw new Error("Enter a coordinate reference such as EPSG:26913.");
  }
  if (capture.reference === "embedded" && /\.ply$/i.test(capture.filename)) {
    throw new Error("PLY files need local coordinates or an explicit EPSG code.");
  }
  return capture;
}

/** Send only a bounded slice to the signed S3 URL, without application cookies. */
const putPart: UploadPart = (url, blob, progress, signal) => new Promise((resolve, reject) => {
  const xhr = new XMLHttpRequest();
  const abort = () => xhr.abort();
  if (signal.aborted) { reject(new DOMException("Upload cancelled.", "AbortError")); return; }
  signal.addEventListener("abort", abort, { once: true });
  const cleanup = () => signal.removeEventListener("abort", abort);
  xhr.open("PUT", url);
  xhr.timeout = 20 * 60 * 1000;
  xhr.upload.onprogress = (event) => progress(event.loaded);
  xhr.onload = () => {
    cleanup();
    if (xhr.status >= 200 && xhr.status < 300) resolve();
    else reject(new Error("S3 did not accept this file part."));
  };
  xhr.onerror = () => { cleanup(); reject(new Error("Could not reach S3. Check your connection.")); };
  xhr.ontimeout = () => { cleanup(); reject(new Error("The upload timed out.")); };
  xhr.onabort = () => { cleanup(); reject(new DOMException("Upload cancelled.", "AbortError")); };
  xhr.send(blob);
});

/** Upload bounded parts directly to S3; confirm success only after server verification. */
export async function uploadDigitalTwinPointCloud(
  apiUrl: string,
  regionId: string,
  file: File,
  capture: PointCloudUploadCapture,
  options: Pick<DigitalTwinRequestOptions, "fetchImpl"> & {
    signal: AbortSignal;
    onProgress: (bytes: number) => void;
    onPhase: (phase: PointCloudUploadPhase) => void;
    uploadPart?: UploadPart;
  },
): Promise<PointCloudUploadResult> {
  validatePointCloudCapture(capture);
  if (!regionId) throw new Error("Choose a region.");
  if (capture.filename !== file.name || capture.size !== file.size) throw new Error("Selected file changed. Choose it again.");
  const path = `/api/v1/regions/${encodeURIComponent(regionId)}/point-cloud-uploads`;
  const control = <T>(json: unknown) => requestDigitalTwinJson<T>(apiUrl, path, {
    method: "POST", json, fetchImpl: options.fetchImpl,
    signal: AbortSignal.timeout(60_000),
  });
  const checkCancelled = () => options.signal.throwIfAborted();
  let token: string | undefined;
  let completing = false;
  try {
    checkCancelled();
    options.onPhase("starting");
    // Let start return its token before honouring cancellation, so cleanup can identify it.
    const started = await control<components["schemas"]["UploadStarted"]>({ action: "start", capture });
    token = started.token;
    const partSize = started.part_size;
    if (!token || !Number.isSafeInteger(partSize) || partSize < 5 * 1024 ** 2 || Math.ceil(file.size / partSize) > 10000) {
      throw new Error("The upload service returned an invalid session.");
    }
    for (let offset = 0, part = 1; offset < file.size; offset += partSize, part++) {
      checkCancelled();
      options.onPhase("uploading");
      const blob = file.slice(offset, Math.min(offset + partSize, file.size));
      for (let attempt = 0; ; attempt++) {
        checkCancelled();
        const signed = await control<components["schemas"]["UploadPartSigned"]>({ action: "part", token, part_number: part });
        checkCancelled();
        const url = new URL(signed.url);
        if (url.protocol !== "https:" || url.username || url.password) throw new Error("The upload service returned an invalid S3 URL.");
        try {
          await (options.uploadPart ?? putPart)(url.href, blob,
            (loaded) => options.onProgress(offset + Math.min(loaded, blob.size)), options.signal);
          break;
        } catch (error) {
          if (options.signal.aborted || attempt === 2) throw error;
          options.onProgress(offset);
        }
      }
      options.onProgress(offset + blob.size);
    }
    checkCancelled();
    options.onPhase("finishing");
    completing = true;
    // Completion is idempotent: retry the same capability after a lost response.
    for (let attempt = 0; ; attempt++) {
      try {
        const result = await control<PointCloudUploadResult>({ action: "complete", token });
        if (!result.uri?.startsWith("s3://")) throw new Error("Missing verified S3 location.");
        return result;
      } catch {
        if (attempt === 2) throw new Error("Completion could not be confirmed. Check the S3 upload folder before uploading this file again.");
      }
    }
  } catch (error) {
    if (token && !completing) {
      options.onPhase("cancelling");
      try { await control({ action: "abort", token }); }
      catch { throw new Error("The upload stopped, but cleanup could not be confirmed. Unfinished S3 parts may remain."); }
    }
    throw error;
  }
}
