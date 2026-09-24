const BASE='https://mineru.net/api/v1/agent';
function out(res,status,obj){res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(obj))}
function safeUrl(raw,hosts){try{const u=new URL(raw);return u.protocol==='https:'&&hosts.has(u.hostname)?u:null}catch{return null}}
async function readRaw(req,limit=4200000){const chunks=[];let n=0;for await(const c of req){n+=c.length;if(n>limit)throw new Error('UPLOAD_TOO_LARGE');chunks.push(c)}return Buffer.concat(chunks)}
export default async function handler(req,res){
 try{
  const u=new URL(req.url,'https://local.invalid'),action=u.searchParams.get('action')||'';
  if(action==='create'){
   if(req.method!=='POST')return out(res,405,{ok:false,error:'Method not allowed'});
   const b=typeof req.body==='object'&&req.body?req.body:JSON.parse(typeof req.body==='string'?req.body:'{}');
   const fileName=String(b.fileName||'').slice(0,180);if(!/\.pdf$/i.test(fileName))return out(res,400,{ok:false,error:'Chỉ hỗ trợ PDF'});
   const body={file_name:fileName,language:'latin',enable_table:false,is_ocr:true,enable_formula:false};if(b.pageRange)body.page_range=String(b.pageRange);
   const r=await fetch(BASE+'/parse/file',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),j=await r.json().catch(()=>({}));
   if(!r.ok||j.code!==0)return out(res,502,{ok:false,error:j.msg||('MinerU '+r.status)});
   return out(res,200,{ok:true,taskId:j.data?.task_id,fileUrl:j.data?.file_url});
  }
  if(action==='status'){
   const id=String(u.searchParams.get('taskId')||'');if(!/^[a-zA-Z0-9_-]{8,80}$/.test(id))return out(res,400,{ok:false,error:'taskId không hợp lệ'});
   const r=await fetch(BASE+'/parse/'+encodeURIComponent(id),{headers:{Accept:'application/json'}}),j=await r.json().catch(()=>({}));
   if(!r.ok||j.code!==0)return out(res,502,{ok:false,error:j.msg||('MinerU '+r.status)});
   return out(res,200,{ok:true,state:j.data?.state||'',markdownUrl:j.data?.markdown_url||'',error:j.data?.err_msg||''});
  }
  if(action==='markdown'){
   const x=safeUrl(u.searchParams.get('url')||'',new Set(['cdn-mineru.openxlab.org.cn']));if(!x)return out(res,400,{ok:false,error:'URL kết quả không hợp lệ'});
   const r=await fetch(x.toString());if(!r.ok)return out(res,502,{ok:false,error:'Không tải được kết quả OCR'});
   const t=await r.text();res.statusCode=200;res.setHeader('Content-Type','text/plain; charset=utf-8');res.setHeader('Cache-Control','no-store');return res.end(t.slice(0,2000000));
  }
  if(action==='upload'){
   if(req.method!=='POST')return out(res,405,{ok:false,error:'Method not allowed'});
   const x=safeUrl(u.searchParams.get('url')||'',new Set(['oss-mineru.openxlab.org.cn']));if(!x)return out(res,400,{ok:false,error:'URL upload không hợp lệ'});
   const buf=await readRaw(req);const r=await fetch(x.toString(),{method:'PUT',body:buf});if(!r.ok)return out(res,502,{ok:false,error:'Upload OCR thất bại '+r.status});return out(res,200,{ok:true});
  }
  return out(res,400,{ok:false,error:'Action không hợp lệ'});
 }catch(e){return out(res,500,{ok:false,error:String(e?.message||e).slice(0,260)})}
}
export const config={api:{bodyParser:false}};