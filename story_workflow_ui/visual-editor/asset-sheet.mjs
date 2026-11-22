// Contact sheet: many catalog PNGs in one numbered grid so an agent (or person) compares
// poses/faces/props in a single vision call instead of opening each image.
import sharp from 'sharp';

export const SHEET_LIMIT=36;
const escapeXml=text=>String(text).replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]));

/** cells: [{n, name, bytes}] → PNG Buffer. Transparent sprites sit on a light checker so edges stay visible. */
export async function buildSheet(cells,{columns=6,cell=220,label=28}={}){
  if(!cells.length||cells.length>SHEET_LIMIT)throw Error('Sheet needs 1–'+SHEET_LIMIT+' images');
  const cols=Math.min(columns,cells.length),rows=Math.ceil(cells.length/cols),gap=6;
  const width=cols*(cell+gap)+gap,height=rows*(cell+label+gap)+gap;
  const tiles=await Promise.all(cells.map(async(c,i)=>{
    const x=gap+(i%cols)*(cell+gap),y=gap+Math.floor(i/cols)*(cell+label+gap);
    const thumb=await sharp(c.bytes).trim({threshold:1}).resize(cell-8,cell-8,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).png().toBuffer().catch(()=>
      sharp(c.bytes).resize(cell-8,cell-8,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).png().toBuffer());
    const caption=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${cell}" height="${label}"><rect width="100%" height="100%" fill="#1d2430"/>`+
      `<text x="6" y="${label-8}" font-family="Microsoft YaHei, SimHei, Arial" font-size="17" fill="#ffd24a" font-weight="bold">${c.n}</text>`+
      `<text x="${12+String(c.n).length*11}" y="${label-8}" font-family="Microsoft YaHei, SimHei, Arial" font-size="15" fill="#e8ecf2">${escapeXml(String(c.name).slice(0,c.tag?11:14))}</text>`+
      (c.tag?`<rect x="${cell-34}" y="4" width="30" height="${label-8}" rx="4" fill="${c.tag==='D'?'#2f6fd6':'#d68a2f'}"/><text x="${cell-19}" y="${label-9}" text-anchor="middle" font-family="Arial" font-size="15" font-weight="bold" fill="#fff">${escapeXml(c.tag)}</text>`:'')+`</svg>`);
    return [{input:thumb,left:x+4,top:y+4},{input:caption,left:x,top:y+cell}];
  }));
  const checker=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs><pattern id="c" width="20" height="20" patternUnits="userSpaceOnUse">`+
    `<rect width="20" height="20" fill="#f2f2f2"/><rect width="10" height="10" fill="#dcdcdc"/><rect x="10" y="10" width="10" height="10" fill="#dcdcdc"/></pattern></defs><rect width="100%" height="100%" fill="url(#c)"/></svg>`);
  return sharp(checker).composite(tiles.flat()).png({compressionLevel:9}).toBuffer();
}

/** Layer cropped PSD parts back onto their canvas positions, same rule as catalog-selection.mjs:
 *  a part whose size equals the canvas sits at 0,0; otherwise at its bbox origin. Output is cropped to the union box. */
export async function composeParts(parts,canvas=[0,0]){
  if(!parts.length)throw Error('Nothing to compose');
  const full=p=>p.width===canvas[0]&&p.height===canvas[1];
  const origin=p=>full(p)?[0,0]:[p.bbox[0],p.bbox[1]];
  const boxes=parts.map(p=>{const [x,y]=origin(p);return [x,y,x+p.width,y+p.height];});
  const left=Math.min(...boxes.map(b=>b[0])),top=Math.min(...boxes.map(b=>b[1]));
  const width=Math.max(...boxes.map(b=>b[2]))-left,height=Math.max(...boxes.map(b=>b[3]))-top;
  if(!(width>0&&height>0)||width>8000||height>8000)throw Error('Invalid composed size');
  return sharp({create:{width,height,channels:4,background:{r:0,g:0,b:0,alpha:0}}})
    .composite(parts.map((p,i)=>({input:p.bytes,left:Math.round(boxes[i][0]-left),top:Math.round(boxes[i][1]-top)}))).png().toBuffer();
}

/** Resolve "cell number or image id" references against one group (numbers are 1-based, as on the sheet). */
export function pickFromGroup(list,refs,label){
  return refs.map(ref=>{const item=typeof ref==='number'||/^\d+$/.test(String(ref))?list[Number(ref)-1]:list.find(i=>i.id===ref);
    if(!item)throw Error(label+' not found: '+ref+' (group has '+list.length+')');return item;});
}
