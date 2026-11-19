// usage: magick in.png RGBA:in.rgba (128x128), then node tools/logo-snap.mjs in.rgba out.png -> snapped to Endesga 32, 2x nearest, 256x256
import fs from 'fs'; import { PNG } from 'pngjs';
const src = fs.readFileSync('shared/src/palette.ts','utf8');
const pal=[...src.matchAll(/#([0-9a-fA-F]{6})/g)].map(m=>[0,2,4].map(i=>parseInt(m[1].slice(i,i+2),16)));
const [,,inp,out]=process.argv; const p={data:fs.readFileSync(inp)};
const o=new PNG({width:256,height:256});
for(let y=0;y<256;y++)for(let x=0;x<256;x++){const s=((y>>1)*128+(x>>1))*4,d=(y*256+x)*4;
 if(p.data[s+3]<128){continue}
 let best=0,bd=1e9;pal.forEach((c,i)=>{const e=(c[0]-p.data[s])**2+(c[1]-p.data[s+1])**2+(c[2]-p.data[s+2])**2;if(e<bd){bd=e;best=i}});
 o.data[d]=pal[best][0];o.data[d+1]=pal[best][1];o.data[d+2]=pal[best][2];o.data[d+3]=255;}
fs.writeFileSync(out,PNG.sync.write(o));
