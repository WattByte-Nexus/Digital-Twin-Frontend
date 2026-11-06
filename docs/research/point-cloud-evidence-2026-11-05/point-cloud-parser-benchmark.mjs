import {parse} from '../../../node_modules/@loaders.gl/core/dist/index.js';
import {Tiles3DLoader} from '../../../node_modules/@loaders.gl/3d-tiles/dist/index.js';
import os from 'node:os';
import {performance} from 'node:perf_hooks';

function tile(count, batch = false) {
  const feature = {POINTS_LENGTH:count, POSITION:{byteOffset:0}, RGB:{byteOffset:count*12}, RTC_CENTER:[-1280000,-4720000,4070000]};
  if (batch) Object.assign(feature, {BATCH_ID:{byteOffset:count*15}, BATCH_LENGTH:1});
  let header = JSON.stringify(feature);
  while ((28+header.length)%8) header+=' ';
  const binaryLength = Math.ceil(count*(batch?17:15)/8)*8;
  let batchJson = batch ? JSON.stringify({treeId:['tree-1'],risk:[0.8]}) : '';
  while (batchJson.length%8) batchJson+=' ';
  const data = new ArrayBuffer(28+header.length+binaryLength+batchJson.length);
  const bytes = new Uint8Array(data);
  const dv = new DataView(data);
  bytes.set(new TextEncoder().encode('pnts'));
  [1,data.byteLength,header.length,binaryLength,batchJson.length,0].forEach((x,i)=>dv.setUint32(4+i*4,x,true));
  bytes.set(new TextEncoder().encode(header),28);
  bytes.fill(127,28+header.length+count*12,28+header.length+count*15);
  bytes.set(new TextEncoder().encode(batchJson),28+header.length+binaryLength);
  return data;
}
const results=[];
for (const count of [10000,50000,100000,250000,1000000]) {
  const input = tile(count);
  const times=[];
  for(let i=0;i<25;i++) {
    const start=performance.now();
    const output=await parse(input,Tiles3DLoader,{'3d-tiles':{isTileset:false}});
    if(output.pointCount!==count) throw new Error('count mismatch');
    if(i>=5) times.push(performance.now()-start);
  }
  times.sort((a,b)=>a-b);
  results.push({points:count,bytes:input.byteLength,median_ms:times[10],p95_ms:times[18]});
}
let batchMetadataResult;
try {await parse(tile(100,true),Tiles3DLoader,{'3d-tiles':{isTileset:false}});batchMetadataResult='success';}
catch(error){batchMetadataResult=String(error);}
console.log(JSON.stringify({environment:{node:process.version,arch:process.arch,cpu:os.cpus()[0].model},scope:'Synthetic current-format PNTS parse only, 5 warmups + 20 measured iterations; excludes network, tile transform postprocessing and GPU upload/drawing',results,batchMetadataResult},null,2));
