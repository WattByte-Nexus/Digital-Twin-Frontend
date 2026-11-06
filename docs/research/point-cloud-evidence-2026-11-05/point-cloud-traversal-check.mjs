import {Tileset3DTraverser} from '../../../node_modules/@loaders.gl/tiles/dist/tileset/format-3d-tiles/tileset-3d-traverser.js';
const tileset={memoryAdjustedScreenSpaceError:8,_cache:{touch:()=>{}}};
function tile(id,loaded=false){
 return {id,tileset,children:[],hasChildren:false,hasRenderContent:true,refine:2,contentAvailable:loaded,hasUnloadedContent:!loaded,contentExpired:false,isVisibleAndInRequestVolume:true,_inRequestVolume:true,_distanceToCamera:0,_screenSpaceError:0,updateVisibility:()=>{},_getPriority:()=>1};
}
// TILE_REFINEMENT.REPLACE is numeric 2 in loaders.gl.
const root=tile('root',true);
root.hasChildren=true; root._screenSpaceError=100;
root.children=Array.from({length:8},(_,i)=>Object.assign(tile(`child-${i}`),{parent:root}));
const traverser=new Tileset3DTraverser();
const waves=[];
for(let frame=1;frame<=9;frame++){
 traverser.traverse(root,{frameNumber:frame,viewport:{id:'audit'}},{});
 const requested=Object.keys(traverser.requestedTiles);
 waves.push({frame,requested,selected:Object.keys(traverser.selectedTiles)});
 for(const child of root.children){if(requested.includes(child.id)){child.contentAvailable=true;child.hasUnloadedContent=false;}}
}
console.log(JSON.stringify({scope:'Installed loaders.gl default REPLACE traversal; root already resident, 8 visible unloaded leaves, each prior request completes before next traversal. No network simulation.',waves},null,2));
