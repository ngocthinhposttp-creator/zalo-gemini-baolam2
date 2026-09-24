(() => {
  const V='3.4 Reliable OCR';
  const oldExtractFile=window.extractFile;
  const oldVisual=window.visualOcrPage;
  const oldMeta=window.verifiedPdfMeta;
  function delay(ms){return new Promise(r=>setTimeout(r,ms))}
  function timeout(p,ms,label){return Promise.race([p,new Promise((_,rej)=>setTimeout(()=>rej(new Error((label||'Tác vụ')+' quá thời gian')),ms))])}
  function safeMsg(e){return String(e?.message||e||'Lỗi không xác định').slice(0,260)}
  function firstLines(s,n=50){return String(s||'').split(/\r?\n/).slice(0,n).join('\n').trim()}
  if(oldVisual){
    window.visualOcrPage=async function(canvas,page,opt={}){
      try{return await timeout(oldVisual(canvas,page,opt),32000,'OCR cục bộ')}
      catch(e){console.warn('Local OCR skipped:',e);try{v4Status('OCR cục bộ chưa sẵn sàng; chuyển sang bộ đọc dự phòng…',true)}catch{}return {best:{text:'',confidence:0,engine:'LOCAL_OCR_UNAVAILABLE'},paddle:null,tess:null,error:safeMsg(e)}}
    }
  }
  async function pdfPageCount(file){
    try{const pdfjs=await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.mjs');pdfjs.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.mjs';const pdf=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),useSystemFonts:true}).promise;return pdf.numPages||0}catch{return 0}
  }
  async function minerCreate(fileName,pageRange=''){
    const r=await fetch('/api/mineru?action=create',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({fileName,pageRange})});const j=await r.json().catch(()=>({}));if(!r.ok||!j.ok)throw new Error(j.error||('MinerU create '+r.status));return j
  }
  async function minerUpload(file,url){
    try{const r=await fetch(url,{method:'PUT',body:file});if(r.ok)return;throw new Error('HTTP '+r.status)}
    catch(e){if(file.size>4000000)throw new Error('Không thể tải PDF trực tiếp tới OCR cloud: '+safeMsg(e));const r=await fetch('/api/mineru?action=upload&url='+encodeURIComponent(url),{method:'POST',headers:{'Content-Type':'application/pdf'},body:file});const j=await r.json().catch(()=>({}));if(!r.ok||!j.ok)throw new Error(j.error||('MinerU upload '+r.status))}
  }
  async function minerStatus(taskId){const r=await fetch('/api/mineru?action=status&taskId='+encodeURIComponent(taskId),{cache:'no-store'});const j=await r.json().catch(()=>({}));if(!r.ok||!j.ok)throw new Error(j.error||('MinerU status '+r.status));return j}
  async function minerMarkdown(url){const r=await fetch('/api/mineru?action=markdown&url='+encodeURIComponent(url),{cache:'no-store'});if(!r.ok)throw new Error('MinerU markdown '+r.status);return await r.text()}
  async function minerExtract(file,pageRange=''){
    v4Status('OCR cloud dự phòng: đang tạo tác vụ đọc scan…');const c=await minerCreate(file.name,pageRange);await minerUpload(file,c.fileUrl);
    for(let i=0;i<70;i++){await delay(i<4?1200:2000);const s=await minerStatus(c.taskId);if(s.state==='done'){if(!s.markdownUrl)throw new Error('OCR cloud hoàn tất nhưng thiếu kết quả');const md=await minerMarkdown(s.markdownUrl);if(md.replace(/\s/g,'').length<20)throw new Error('OCR cloud trả nội dung rỗng');return md}if(s.state==='failed')throw new Error(s.error||'OCR cloud thất bại');v4Status('OCR cloud dự phòng: '+(s.state||'đang xử lý')+'…')}throw new Error('OCR cloud quá thời gian')
  }
  function needsCloud(text,name){if(!text||String(text).replace(/\s/g,'').length<80)return true;try{const m=oldMeta(text,name);return !m||m.no==='KHONG-XAC-DINH'||!m.date||m.subject==='KHONG-XAC-DINH'||!m.subject}catch{return true}}
  function mergeMiner(local,md,pages){const header=firstLines(md,55),audit='--- CLOUD OCR AUDIT ---\nENGINE: MinerU Agent Lightweight OCR\nLANGUAGE: latin (Vietnamese)\nPAGES_REQUESTED: '+(pages||'AUTO')+'\n';return cleanText('--- PADDLE HEADER TRANG 1 [CONF 91] ---\n'+header+'\n--- MINERU OCR TOÀN VĂN ---\n'+md+'\n'+audit+'\n'+(local||''))}
  window.extractFile=async function(file){
    if(ext(file.name)!=='pdf')throw new Error('Bản này chỉ nhận PDF.');let local='',localError='';try{local=await timeout(oldExtractFile(file),45000,'Bộ đọc PDF cục bộ')}catch(e){localError=safeMsg(e);console.warn('Local extract failed:',e)}
    if(!needsCloud(local,file.name))return local;
    if(file.size>10*1024*1024){if(local)return local;throw new Error('PDF scan vượt 10 MB và OCR cục bộ không đọc được. Hãy giảm dung lượng hoặc chia PDF. '+localError)}
    const pages=await pdfPageCount(file),pageRange=pages>20?'1':'',requested=pageRange||String(pages||'AUTO');
    try{const md=await minerExtract(file,pageRange),merged=mergeMiner(local,md,requested);if(merged.replace(/\s/g,'').length<60)throw new Error('Nội dung sau OCR quá ngắn');v4Status('Đã đọc PDF bằng cơ chế dự phòng kép · Local + MinerU OCR.');return merged}
    catch(e){if(local){v4Status('OCR cloud không khả dụng; giữ kết quả đọc cục bộ và yêu cầu kiểm tra.',true);return local}throw new Error('Không đọc được PDF scan. Local: '+localError+' · Cloud OCR: '+safeMsg(e))}
  };
  try{const el=document.querySelector('#aiStatus');if(el)el.textContent='Reader Engine 3.4 · Reliable OCR · Local + MinerU fallback';let badge=document.querySelector('#readerVersionBadge');if(!badge){badge=document.createElement('div');badge.id='readerVersionBadge';badge.style.cssText='position:fixed;right:12px;bottom:12px;z-index:9999;background:#0d2f4a;color:#fff;padding:7px 10px;border-radius:999px;font:600 11px/1.2 system-ui;box-shadow:0 5px 18px #0002;opacity:.86';document.body.appendChild(badge)}badge.textContent='BL2 Reader 3.4'}catch{}
})();