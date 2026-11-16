// Usage: node tools/check-palette.mjs <png files>  (Endesga 32 and alpha check for sprites; run from the repo root)
import fs from 'fs'; import { PNG } from 'pngjs';
const src = fs.readFileSync('shared/src/palette.ts','utf8');
const hex = new Set([...src.matchAll(/#([0-9a-fA-F]{6})/g)].map(m=>m[1].toLowerCase()));
const files = process.argv.slice(2); let bad=0;
for (const f of files){ const p=PNG.sync.read(fs.readFileSync(f)); const off=new Map(); let semi=0;
 for(let i=0;i<p.data.length;i+=4){const a=p.data[i+3]; if(a===0)continue; if(a<255)semi++; const h=[p.data[i],p.data[i+1],p.data[i+2]].map(v=>v.toString(16).padStart(2,'0')).join(''); if(!hex.has(h))off.set(h,(off.get(h)||0)+1);}
 if(off.size||semi){bad++;console.log(f.split('/').pop(),'off-palette',off.size,'semi-alpha',semi);} }
console.log('checked',files.length,'bad',bad,'palette',hex.size);
