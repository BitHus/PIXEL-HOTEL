// 20 Nov: builds client/src/assets/logo.gif from art-src/pixellab/logo20/a_256.png (PixelLab 128 px source x2, snapped to Endesga 32)
// plus a 16-frame sparkle glint (0 generations). Run from the repo root.
import fs from 'fs'; import { PNG } from 'pngjs'; import omggif from 'omggif';
const PAL=[...new Set(fs.readFileSync('shared/src/palette.ts','utf8').match(/#[0-9a-fA-F]{6}/g).map(h=>h.toLowerCase()))].map(h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)));
const W=256,TI=PAL.length,WHITE=PAL.findIndex(p=>p.join()==='255,255,255');
const p=PNG.sync.read(fs.readFileSync('art-src/pixellab/logo20/a_256.png'));
const base=new Uint8Array(W*W);
for(let k=0;k<W*W;k++){if(p.data[k*4+3]<128){base[k]=TI;continue}let bi=0,bd=1e9;PAL.forEach((c,i)=>{const d=(c[0]-p.data[k*4])**2+(c[1]-p.data[k*4+1])**2+(c[2]-p.data[k*4+2])**2;if(d<bd){bd=d;bi=i}});base[k]=bi}
const stars=[{x:118,y:34,t0:1},{x:316>>1,y:206,t0:8}].map(s=>s); // foam glint, then sign glint
const arm=[0,1,2,3,2,1,0];
const frames=[];
for(let f=0;f<16;f++){const idx=base.slice();
 for(const s of stars){const k=f-s.t0;if(k<0||k>=arm.length)continue;const a=arm[k];if(!a)continue;
  const put=(x,y)=>{if(x>=0&&y>=0&&x<W&&y<W&&base[y*W+x]!==TI)idx[y*W+x]=WHITE;};
  for(let d=-a*2;d<a*2;d++){put(s.x+d,s.y);put(s.x+d,s.y+1);put(s.x,s.y+d);put(s.x+1,s.y+d)}}
 frames.push(idx)}
const pal=[];for(let i=0;i<64;i++){const c=PAL[i]||[0,0,0];pal.push((c[0]<<16)|(c[1]<<8)|c[2])}
const out=Buffer.alloc(W*W*frames.length+8192);const g=new omggif.GifWriter(out,W,W,{palette:pal,loop:0});
frames.forEach(i=>g.addFrame(0,0,W,W,i,{delay:10,disposal:2,transparent:TI}));
fs.writeFileSync('client/src/assets/logo.gif',out.slice(0,g.end()));
const png=(idx,f)=>{const q=new PNG({width:W,height:W});for(let k=0;k<W*W;k++){const t=idx[k]===TI;q.data.set([...(t?[0,0,0]:PAL[idx[k]]),t?0:255],k*4)}fs.writeFileSync(f,PNG.sync.write(q))};
png(frames[3],'art-src/pixellab/logo.png');
