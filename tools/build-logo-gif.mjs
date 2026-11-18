// Builds client/src/assets/logo.gif from the PixelLab frames in art-src/pixellab/logo_pl (a0..a8): snap to Endesga 32, ping-pong loop.
import fs from 'fs'; import { PNG } from 'pngjs'; import omggif from 'omggif';
const PAL=[...new Set(fs.readFileSync('shared/src/palette.ts','utf8').match(/#[0-9a-fA-F]{6}/g).map(h=>h.toLowerCase()))].map(h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)));
const W=256,TI=PAL.length;
const snap=(r,g,b)=>{let bi=0,bd=1e9;PAL.forEach((p,i)=>{const d=(p[0]-r)**2+(p[1]-g)**2+(p[2]-b)**2;if(d<bd){bd=d;bi=i}});return bi};
const fr=[];for(let i=0;i<=8;i++){const p=PNG.sync.read(fs.readFileSync(`art-src/pixellab/logo_pl/a${i}.png`));const idx=new Uint8Array(W*W);for(let k=0;k<W*W;k++)idx[k]=p.data[k*4+3]<128?TI:snap(p.data[k*4],p.data[k*4+1],p.data[k*4+2]);fr.push(idx)}
const order=[0,1,2,3,4,5,6,7,8,7,6,5,4,3,2,1];
const pal=[];for(let i=0;i<64;i++){const p=PAL[i]||[0,0,0];pal.push((p[0]<<16)|(p[1]<<8)|p[2])}
const out=Buffer.alloc(W*W*order.length+8192);const g=new omggif.GifWriter(out,W,W,{palette:pal,loop:0});
order.forEach(i=>g.addFrame(0,0,W,W,fr[i],{delay:10,disposal:2,transparent:TI}));
fs.writeFileSync('client/src/assets/logo.gif',out.slice(0,g.end()));
const png=(idx,f)=>{const p=new PNG({width:W,height:W});for(let k=0;k<W*W;k++){const t=idx[k]===TI,c=t?[0,0,0]:PAL[idx[k]];p.data.set([...c,t?0:255],k*4)}fs.writeFileSync(f,PNG.sync.write(p))};
png(fr[4],'art-src/pixellab/logo.png');png(fr[0],'tools/out/logo_snap0.png');
