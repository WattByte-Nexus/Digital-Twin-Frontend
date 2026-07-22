#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const [, , sourceDirectory, outputDirectory] = process.argv;

if (!sourceDirectory || !outputDirectory) {
  throw new Error(
    "Usage: node scripts/build-realistic-tree-billboards.mjs <sprite-directory> <output-directory>",
  );
}

const GROUPS = "abcdefghij".split("");

function pad4(value) {
  return (value + 3) & ~3;
}

function floatBuffer(values) {
  const buffer = Buffer.alloc(values.length * Float32Array.BYTES_PER_ELEMENT);
  values.forEach((value, index) => buffer.writeFloatLE(value, index * 4));
  return buffer;
}

function indexBuffer(values) {
  const buffer = Buffer.alloc(values.length * Uint16Array.BYTES_PER_ELEMENT);
  values.forEach((value, index) => buffer.writeUInt16LE(value, index * 2));
  return buffer;
}

function buildGlb(images) {
  const chunks = [];
  const bufferViews = [];
  const accessors = [];
  let byteOffset = 0;

  function addChunk(buffer, target) {
    const alignedOffset = pad4(byteOffset);
    if (alignedOffset > byteOffset) chunks.push(Buffer.alloc(alignedOffset - byteOffset));
    const bufferView = {
      buffer: 0,
      byteOffset: alignedOffset,
      byteLength: buffer.byteLength,
      ...(target ? { target } : {}),
    };
    bufferViews.push(bufferView);
    chunks.push(buffer);
    byteOffset = alignedOffset + buffer.byteLength;
    return bufferViews.length - 1;
  }

  const primitives = [];
  const gltfImages = [];
  const materials = [];
  const textures = [];

  images.forEach((image, planeIndex) => {
    const angle = (planeIndex * Math.PI) / 3;
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    const positions = [];
    for (const [x, y] of [
      [-0.5, 0],
      [0.5, 0],
      [0.5, 1],
      [-0.5, 1],
    ]) {
      positions.push(x * cosine, y, -x * sine);
    }

    const positionView = addChunk(floatBuffer(positions), 34962);
    const texcoordView = addChunk(
      floatBuffer([0, 1, 1, 1, 1, 0, 0, 0]),
      34962,
    );
    const indicesView = addChunk(indexBuffer([0, 1, 2, 0, 2, 3]), 34963);

    const positionAccessor = accessors.push({
      bufferView: positionView,
      componentType: 5126,
      count: 4,
      type: "VEC3",
      min: [-0.5, 0, -0.5],
      max: [0.5, 1, 0.5],
    }) - 1;
    const texcoordAccessor = accessors.push({
      bufferView: texcoordView,
      componentType: 5126,
      count: 4,
      type: "VEC2",
      min: [0, 0],
      max: [1, 1],
    }) - 1;
    const indicesAccessor = accessors.push({
      bufferView: indicesView,
      componentType: 5123,
      count: 6,
      type: "SCALAR",
      min: [0],
      max: [3],
    }) - 1;

    const imageView = addChunk(image);
    gltfImages.push({ bufferView: imageView, mimeType: "image/png" });
    textures.push({ sampler: 0, source: planeIndex });
    materials.push({
      name: `Tree view ${planeIndex + 1}`,
      pbrMetallicRoughness: {
        baseColorTexture: { index: planeIndex },
        metallicFactor: 0,
        roughnessFactor: 1,
      },
      alphaMode: "MASK",
      alphaCutoff: 0.35,
      doubleSided: true,
      extensions: { KHR_materials_unlit: {} },
    });
    primitives.push({
      attributes: {
        POSITION: positionAccessor,
        TEXCOORD_0: texcoordAccessor,
      },
      indices: indicesAccessor,
      material: planeIndex,
      mode: 4,
    });
  });

  const binaryBuffer = Buffer.concat([
    ...chunks,
    Buffer.alloc(pad4(byteOffset) - byteOffset),
  ]);
  const gltf = {
    asset: { version: "2.0", generator: "GeoLibre realistic tree billboard builder" },
    extensionsUsed: ["KHR_materials_unlit"],
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: "Realistic tree billboard" }],
    meshes: [{ primitives }],
    materials,
    textures,
    samplers: [{ magFilter: 9729, minFilter: 9987, wrapS: 33071, wrapT: 33071 }],
    images: gltfImages,
    accessors,
    bufferViews,
    buffers: [{ byteLength: binaryBuffer.byteLength }],
  };

  const jsonBuffer = Buffer.from(JSON.stringify(gltf));
  const paddedJson = Buffer.concat([
    jsonBuffer,
    Buffer.alloc(pad4(jsonBuffer.byteLength) - jsonBuffer.byteLength, 0x20),
  ]);
  const header = Buffer.alloc(12);
  header.write("glTF", 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + paddedJson.byteLength + 8 + binaryBuffer.byteLength, 8);
  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(paddedJson.byteLength, 0);
  jsonHeader.writeUInt32LE(0x4e4f534a, 4);
  const binaryHeader = Buffer.alloc(8);
  binaryHeader.writeUInt32LE(binaryBuffer.byteLength, 0);
  binaryHeader.writeUInt32LE(0x004e4942, 4);

  return Buffer.concat([header, jsonHeader, paddedJson, binaryHeader, binaryBuffer]);
}

await mkdir(outputDirectory, { recursive: true });
await Promise.all(
  GROUPS.map(async (group) => {
    const images = await Promise.all(
      [1, 2, 3].map((variant) =>
        readFile(path.join(sourceDirectory, `tree_${group}000${variant}.png`)),
      ),
    );
    await writeFile(path.join(outputDirectory, `realistic_tree_${group}.glb`), buildGlb(images));
  }),
);

console.log(`Built ${GROUPS.length} realistic tree billboard GLBs in ${outputDirectory}`);
