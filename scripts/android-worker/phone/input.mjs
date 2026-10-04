export function textKeys(text) {
 const chars=Array.from(text);
 if(chars.length>4096) throw new Error('Maximum 4096 characters');
 return chars.map(c=>c==='\n'?0xff0d:c==='\t'?0xff09:c.codePointAt(0)<=255?c.codePointAt(0):0x1000000+c.codePointAt(0));
}
export function viewportBox(v) {return {width:Math.max(1,v.width),height:Math.max(1,v.height),top:v.offsetTop||0,left:v.offsetLeft||0};}
