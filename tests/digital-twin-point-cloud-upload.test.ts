import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  uploadDigitalTwinPointCloud, validatePointCloudCapture, MAX_POINT_CLOUD_UPLOAD_SIZE,
  type PointCloudUploadCapture,
} from "../apps/geolibre-desktop/src/lib/digital-twin-point-cloud-upload";

const capture: PointCloudUploadCapture = { filename: "capture.las", size: 3, reference: "embedded" };
const file = new File(["LAS"], capture.filename);
const result = { uri: "s3://private-sources/uploads/pointclouds/golden/capture.las", version_id: "v1" };
const partSize = 32 * 1024 ** 2;

function transport(handle?: (body: Record<string, unknown>) => Response | Promise<Response>) {
  const actions: Record<string, unknown>[] = [];
  const fetchImpl = (async (url, init) => {
    assert.equal(String(url), "https://engine.example/api/v1/regions/golden/point-cloud-uploads");
    assert.equal(init?.credentials, "same-origin");
    const body = JSON.parse(String(init?.body));
    actions.push(body);
    if (handle) return handle(body);
    return Response.json(body.action === "start" ? { token: "capability", part_size: partSize }
      : body.action === "part" ? { url: "https://private-sources.s3.amazonaws.com/part" }
      : body.action === "complete" ? result : { aborted: true });
  }) as typeof fetch;
  return { actions, fetchImpl };
}

describe("private raw point-cloud intake", () => {
  it("validates filenames, size and PLY coordinate metadata before starting", () => {
    for (const patch of [
      { filename: "../cloud.las" }, { filename: "data.exe" }, { size: 0 },
      { size: MAX_POINT_CLOUD_UPLOAD_SIZE + 1 }, { filename: "cloud.ply" },
      { reference: "epsg", epsg: "bad" },
    ]) assert.throws(() => validatePointCloudCapture({ ...capture, ...patch } as PointCloudUploadCapture));
    assert.doesNotThrow(() => validatePointCloudCapture({ ...capture, filename: "scan.ply", reference: "local" }));
  });

  it("uploads only sliced bytes to S3 and verifies completion through the Engine", async () => {
    const { actions, fetchImpl } = transport();
    const progress: number[] = [];
    const uploaded = await uploadDigitalTwinPointCloud("https://engine.example", "golden", file, capture, {
      fetchImpl, signal: new AbortController().signal, onProgress: (bytes) => progress.push(bytes), onPhase: () => {},
      uploadPart: async (url, blob, report) => {
        assert.equal(url, "https://private-sources.s3.amazonaws.com/part");
        assert.equal(await blob.text(), "LAS"); report(blob.size);
      },
    });
    assert.deepEqual(uploaded, result);
    assert.deepEqual(actions.map((entry) => entry.action), ["start", "part", "complete"]);
    assert.equal(progress.at(-1), file.size);
  });

  it("slices large files into exact 32 MiB parts without loading the entire file", async () => {
    const bigFile = new File([new Uint8Array(partSize + 7)], "capture.las");
    const { actions, fetchImpl } = transport();
    const lengths: number[] = [];
    await uploadDigitalTwinPointCloud("https://engine.example", "golden", bigFile, { ...capture, size: bigFile.size }, {
      fetchImpl, signal: new AbortController().signal, onProgress: () => {}, onPhase: () => {},
      uploadPart: async (_url, blob) => { lengths.push(blob.size); },
    });
    assert.deepEqual(lengths, [partSize, 7]);
    assert.deepEqual(actions.filter((entry) => entry.action === "part").map((entry) => entry.part_number), [1, 2]);
  });

  it("cleans up when cancellation arrives while start is still returning", async () => {
    const controller = new AbortController();
    const { actions, fetchImpl } = transport((body) => {
      if (body.action === "start") { controller.abort(); return Response.json({ token: "capability", part_size: partSize }); }
      return Response.json({ aborted: true });
    });
    await assert.rejects(uploadDigitalTwinPointCloud("https://engine.example", "golden", file, capture, {
      fetchImpl, signal: controller.signal, onProgress: () => {}, onPhase: () => {},
      uploadPart: async () => assert.fail("Cancelled bytes must not reach S3"),
    }), { name: "AbortError" });
    assert.deepEqual(actions.map((entry) => entry.action), ["start", "abort"]);
  });

  it("retries failed parts with a fresh signature and aborts after repeated failure", async () => {
    const { actions, fetchImpl } = transport();
    let attempts = 0;
    await assert.rejects(uploadDigitalTwinPointCloud("https://engine.example", "golden", file, capture, {
      fetchImpl, signal: new AbortController().signal, onProgress: () => {}, onPhase: () => {},
      uploadPart: async () => { attempts++; throw new Error("S3 unavailable"); },
    }), /S3 unavailable/);
    assert.equal(attempts, 3);
    assert.deepEqual(actions.map((entry) => entry.action), ["start", "part", "part", "part", "abort"]);
  });

  it("retries uncertain completion with the same session and never aborts a completed object", async () => {
    let completions = 0;
    const { actions, fetchImpl } = transport((body) => {
      if (body.action === "start") return Response.json({ token: "capability", part_size: partSize });
      if (body.action === "part") return Response.json({ url: "https://private-sources.s3.amazonaws.com/part" });
      if (body.action === "complete" && ++completions === 1) throw new Error("Lost response");
      return Response.json(result);
    });
    assert.deepEqual(await uploadDigitalTwinPointCloud("https://engine.example", "golden", file, capture, {
      fetchImpl, signal: new AbortController().signal, onProgress: () => {}, onPhase: () => {}, uploadPart: async () => {},
    }), result);
    assert.deepEqual(actions.map((entry) => entry.action), ["start", "part", "complete", "complete"]);
  });

  it("reports cleanup failures instead of claiming cancellation succeeded", async () => {
    const controller = new AbortController();
    const { fetchImpl } = transport((body) => {
      if (body.action === "start") { controller.abort(); return Response.json({ token: "capability", part_size: partSize }); }
      return Response.json({ detail: "Session expired" }, { status: 401 });
    });
    await assert.rejects(uploadDigitalTwinPointCloud("https://engine.example", "golden", file, capture, {
      fetchImpl, signal: controller.signal, onProgress: () => {}, onPhase: () => {},
    }), /cleanup could not be confirmed/);
  });
});
