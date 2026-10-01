const fs=require('fs'),zlib=require('zlib');
const zip=fs.readFileSync(process.argv[2]);
let e=-1;for(let i=zip.length-22;i>=0;i--){if(zip.readUInt32LE(i)===0x06054b50){e=i;break;}}
const n=zip.readUInt16LE(e+10),cd=zip.readUInt32LE(e+16);
const entries=new Map();let p=cd;
for(let i=0;i<n;i++){
  const nl=zip.readUInt16LE(p+28),el=zip.readUInt16LE(p+30),cl=zip.readUInt16LE(p+32);
  const lho=zip.readUInt32LE(p+42);
  const nm=zip.subarray(p+46,p+46+nl).toString();
  const cs=zip.readUInt32LE(p+20),m=zip.readUInt16LE(p+10);
  const lnl=zip.readUInt16LE(lho+26),lel=zip.readUInt16LE(lho+28);
  const c=zip.subarray(lho+30+lnl+lel,lho+30+lnl+lel+cs);
  entries.set(nm,m===8?zlib.inflateRawSync(c):c);
  p+=46+nl+el+cl;
}
const man=JSON.parse(entries.get('manifest.json').toString('utf8'));
const SHORT=new Map(JSON.parse(fs.readFileSync(require('path').join(__dirname,'..','docs/short_names.json'),'utf8')).map(x=>[x.kind,x.short]));
// build kind->short from the manifest+scripts
let leaves=0,broken=0,mismatch=0,maxName=0;
const nameSet=new Set();
for(const g of man.Options){
  if(g.Name.length>maxName)maxName=g.Name.length;
  for(const s of g.SubOptions||[]){
    leaves++;
    if(s.Name.length>maxName)maxName=s.Name.length;
    nameSet.add(s.Name);
    const patch=s.Include[0]+'/9ba626afa44a3aa3.patch_0';
    if(!entries.has(patch)){broken++;console.log('MISSING '+patch);continue;}
    const raw=entries.get(patch);
    const off=Number(raw.readBigUInt64LE(104+16));
    const body=raw.subarray(off+8,off+8+raw.readUInt32LE(off)).toString('utf8');
    const m=body.match(/\{kind=\s*(\d+), name='([^']+)', grant=\s*(\d+)\}/);
    if(!m){broken++;continue;}
    // the manifest label must equal the SHORT name of the granted kind
    const expect=SHORT.get(+m[3]);
    if(expect!==s.Name){mismatch++;if(mismatch<=5)console.log(`  ${s.Include[0]}: manifest "${s.Name}" vs expected "${expect}" (grant ${m[3]})`);}
  }
}
console.log('groups:',man.Options.length);
console.log('leaves:',leaves);
console.log('broken:',broken);
console.log('label mismatches:',mismatch);
console.log('distinct sub-option names:',nameSet.size);
console.log('longest name shown:',maxName,'chars');
console.log('');
console.log(mismatch===0&&broken===0?'ALL LABELS MATCH THE SHORT NAMES':'PROBLEMS REMAIN');
console.log('');
console.log('=== every distinct dropdown entry ===');
[...nameSet].sort().forEach(x=>console.log('  '+x));