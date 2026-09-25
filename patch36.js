(function(){
  var oldExtractFile=window.extractFile, oldMeta=window.verifiedPdfMeta, oldClassify=window.classifyItem, oldScore=window.scoreFolder;
  var V='3.6 Signed-PDF Header Vision';

  function wait(ms){return new Promise(function(r){setTimeout(r,ms)})}
  function plain(s){return String(s||'').replace(/\r/g,'').trim()}
  function one(s){return String(s||'').replace(/\s+/g,' ').trim()}
  function ascii(s){
    try{return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toUpperCase()}
    catch(e){return String(s||'').toUpperCase()}
  }
  function slug(s){
    if(typeof safe==='function')return safe(String(s||''));
    return ascii(s).replace(/[^A-Z0-9]+/g,'-').replace(/^-+|-+$/g,'');
  }
  function validDate(d,m,y){try{return validDateParts(+d,+m,+y)}catch(e){return +d>=1&&+d<=31&&+m>=1&&+m<=12&&+y>=2000&&+y<=2100}}
  function isoDate(s){
    var m=String(s||'').match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](20\d{2})$/);
    if(m&&validDate(m[1],m[2],m[3]))return m[3]+'-'+String(+m[2]).padStart(2,'0')+'-'+String(+m[1]).padStart(2,'0');
    m=String(s||'').match(/^(20\d{2})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);
    if(m&&validDate(m[3],m[2],m[1]))return m[1]+'-'+String(+m[2]).padStart(2,'0')+'-'+String(+m[3]).padStart(2,'0');
    return '';
  }
  function marker(text,label){
    var start='--- '+label+' ---',p=String(text||'').indexOf(start);
    if(p<0)return'';
    var s=String(text).slice(p+start.length),q=s.indexOf('\n--- ');
    return plain(q>=0?s.slice(0,q):s);
  }
  function metaMarker(obj){
    var a=['--- STRICT META V36 ---'];
    a.push('SoKyHieu: '+(obj.no||''));
    a.push('NgayBanHanh: '+(obj.date||''));
    a.push('CoQuan: '+(obj.issuer||''));
    a.push('Loai: '+(obj.type||''));
    a.push('TrichYeu: '+(obj.subject||''));
    a.push('KySo: '+(obj.signed?'YES':'NO'));
    a.push('NguonNgay: '+(obj.dateSource||''));
    a.push('NguonSo: '+(obj.numberSource||''));
    a.push('--- END STRICT META V36 ---');
    return a.join('\n');
  }
  function parseMetaMarker(text){
    var s=marker(text,'STRICT META V36'); if(!s)return null;
    function g(k){var m=s.match(new RegExp('(?:^|\\n)'+k+':\\s*([^\\n]*)','i'));return m?m[1].trim():''}
    return {no:g('SoKyHieu'),date:g('NgayBanHanh'),issuer:g('CoQuan'),type:g('Loai'),subject:g('TrichYeu'),signed:/^YES$/i.test(g('KySo')),dateSource:g('NguonNgay'),numberSource:g('NguonSo')};
  }

  async function loadPdf(file){
    var pdfjs=await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.mjs';
    return await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),useSystemFonts:true}).promise;
  }
  function groupLines(items){
    var a=(items||[]).filter(function(x){return x&&String(x.str||'').trim()}).map(function(x){return {t:String(x.str),y:x.transform&&x.transform[5]||0,x:x.transform&&x.transform[4]||0}}).sort(function(a,b){return Math.abs(b.y-a.y)>2?b.y-a.y:a.x-b.x});
    var rows=[];
    a.forEach(function(it){
      var r=rows.find(function(z){return Math.abs(z.y-it.y)<2.2});
      if(!r){r={y:it.y,items:[]};rows.push(r)}
      r.items.push(it);
    });
    rows.sort(function(a,b){return b.y-a.y});
    return rows.map(function(r){return r.items.sort(function(a,b){return a.x-b.x}).map(function(x){return x.t}).join(' ').replace(/\s+/g,' ').trim()}).filter(Boolean);
  }
  async function nativeText(pdf){
    var pages=[],page1Lines=[],signatureText='';
    for(var i=1;i<=Math.min(pdf.numPages,120);i++){
      var p=await pdf.getPage(i),tc=await p.getTextContent(),ls=groupLines(tc.items),txt=ls.join('\n');
      if(i===1){page1Lines=ls;signatureText=txt}
      pages.push('--- TEXT LAYER TRANG '+i+' ---\n'+txt);
    }
    return {text:pages.join('\n'),page1Lines:page1Lines,signatureText:signatureText,pages:pdf.numPages};
  }
  async function rawSignature(file){
    var buf=await file.arrayBuffer(),s='';
    try{s=new TextDecoder('latin1').decode(buf)}catch(e){s=new TextDecoder().decode(buf)}
    var signed=/\/FT\s*\/Sig|\/SubFilter\s*\/ETSI\.CAdES\.detached|\/ByteRange\s*\[/i.test(s),m=s.match(/\/M\s*\(D:(20\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/);
    return {signed:signed,date:m?(+m[3])+'/'+(+m[2])+'/'+m[1]:'',rawDate:m?m[0]:''};
  }
  function issuerFromNative(txt){
    var a=String(txt||'').split(/\n+/),i,line;
    for(i=0;i<a.length;i++){
      line=one(a[i]);
      if(/^(Cơ quan|Co quan)\s*:/i.test(line))return normalizeIssuer(line.replace(/^[^:]+:\s*/,''));
      if(/^(Ký bởi|Ky boi)\s*:/i.test(line))return normalizeIssuer(line.replace(/^[^:]+:\s*/,''));
    }
    return '';
  }
  function normalizeIssuer(s){
    var z=ascii(s);
    if(/UY BAN NHAN DAN/.test(z)){
      var m=z.match(/TINH\s+([A-Z ]{2,40})/);
      if(m)return 'UBND tỉnh '+titleVN(m[1]);
      m=z.match(/XA\s+([A-Z0-9 ]{2,40})/); if(m)return 'UBND xã '+titleVN(m[1]);
      m=z.match(/PHUONG\s+([A-Z0-9 ]{2,40})/); if(m)return 'UBND phường '+titleVN(m[1]);
      return 'UBND';
    }
    return one(s);
  }
  function titleVN(s){
    var z=one(s).toLowerCase().replace(/\blam dong\b/g,'Lâm Đồng').replace(/\bbao lam\b/g,'Bảo Lâm');
    return z.split(' ').map(function(w){return /[à-ỹ]/i.test(w)?w.charAt(0).toUpperCase()+w.slice(1):w.charAt(0).toUpperCase()+w.slice(1)}).join(' ');
  }
  function dateFromNative(txt){
    var m=String(txt||'').match(/(?:Thời gian ký|Thoi gian ky)\s*:\s*(\d{1,2})[\/\-.](\d{1,2})[\/\-.](20\d{2})/i);
    return m&&validDate(m[1],m[2],m[3])?(+m[1])+'/'+(+m[2])+'/'+m[3]:'';
  }

  async function renderFirst(pdf){
    var p=await pdf.getPage(1),vp=p.getViewport({scale:4}),c=document.createElement('canvas');
    c.width=Math.ceil(vp.width);c.height=Math.ceil(vp.height);
    await p.render({canvasContext:c.getContext('2d',{willReadFrequently:true}),viewport:vp}).promise;
    return c;
  }
  function crop(src,x,y,w,h){
    if(typeof cropRectCanvas==='function')return cropRectCanvas(src,x,y,w,h);
    var c=document.createElement('canvas');c.width=Math.max(1,Math.round(src.width*w));c.height=Math.max(1,Math.round(src.height*h));
    c.getContext('2d').drawImage(src,Math.round(src.width*x),Math.round(src.height*y),c.width,c.height,0,0,c.width,c.height);return c;
  }
  function blueMask(src){
    var c=document.createElement('canvas');c.width=src.width;c.height=src.height;var ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(src,0,0);
    var im=ctx.getImageData(0,0,c.width,c.height),d=im.data;
    for(var i=0;i<d.length;i+=4){var r=d[i],g=d[i+1],b=d[i+2],ink=(b-r>20&&b-g>10&&b<250);d[i]=d[i+1]=d[i+2]=ink?0:255;d[i+3]=255}
    ctx.putImageData(im,0,0);return c;
  }
  async function tess(c,label,opt){
    opt=opt||{};
    if(typeof ocrCanvas==='function'){
      try{return await ocrCanvas(c,label,{tessedit_pageseg_mode:String(opt.psm||6),tessedit_char_whitelist:opt.whitelist||''})}catch(e){console.warn(label,e)}
    }
    if(!window.Tesseract){
      await new Promise(function(resolve,reject){var s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';s.onload=resolve;s.onerror=reject;document.head.appendChild(s)});
    }
    var r=await Tesseract.recognize(c,'eng',{});
    return {text:r&&r.data?r.data.text:'',confidence:r&&r.data?r.data.confidence:0};
  }
  function numFromText(s){
    var z=ascii(s).replace(/[§$]/g,'S').replace(/\s+/g,' ');
    var m=z.match(/(?:SO|S0|S6)\s*[:.]?\s*(\d{1,7})\s*\/\s*([A-Z0-9]{1,12}(?:-[A-Z0-9]{1,12}){1,5})/);
    if(m)return m[1]+'/'+m[2];
    m=z.match(/(\d{3,7})\s*\/\s*([A-Z0-9]{1,12}(?:-[A-Z0-9]{1,12}){1,5})/);
    return m?m[1]+'/'+m[2]:'';
  }
  function suffixFrom(s){
    var z=ascii(s),m=z.match(/\/\s*([A-Z0-9]{1,12}(?:-[A-Z0-9]{1,12}){1,5})/);return m?m[1]:'';
  }
  function digitsOnly(s){
    var m=String(s||'').match(/\d{2,7}/g);if(!m)return'';m.sort(function(a,b){return b.length-a.length});return m[0];
  }
  function dateFromHeader(s){
    var z=ascii(s),m=z.match(/NGAY\s*([0-3]?\d)\s*THANG\s*([01]?\d)\s*NAM\s*(20\d{2})/);
    if(m&&validDate(m[1],m[2],m[3]))return(+m[1])+'/'+(+m[2])+'/'+m[3];
    return'';
  }
  function monthYearFromHeader(s){
    var z=ascii(s),m=z.match(/THANG\s*([01]?\d)\s*NAM\s*(20\d{2})/);return m?{m:+m[1],y:+m[2]}:null;
  }
  function typeFromHeader(s){
    var z=ascii(s);
    if(/\bKE\s*HOACH\b/.test(z))return'Kế hoạch';
    if(/\bQUYET\s*DINH\b/.test(z))return'Quyết định';
    if(/\bTO\s*TRINH\b/.test(z))return'Tờ trình';
    if(/\bTHONG\s*BAO\b/.test(z))return'Thông báo';
    if(/\bBAO\s*CAO\b/.test(z))return'Báo cáo';
    if(/\bGIAY\s*MOI\b/.test(z))return'Giấy mời';
    if(/\bNGHI\s*QUYET\b/.test(z))return'Nghị quyết';
    if(/\bCONG\s*VAN\b/.test(z)||/\bV\/V\b/.test(z))return'Công văn';
    return'';
  }
  function subjectFromHeader(s,type){
    var a=plain(s).split(/\n+/).map(one).filter(Boolean),az=a.map(ascii),target=ascii(type||''),idx=-1;
    for(var i=0;i<a.length;i++){if(target&&az[i].indexOf(target)>=0){idx=i;break}}
    if(idx<0)for(i=0;i<a.length;i++){if(/KE HOACH|QUYET DINH|TO TRINH|THONG BAO|BAO CAO|NGHI QUYET/.test(az[i])){idx=i;break}}
    if(idx<0)return'';
    var out=[];
    for(i=idx+1;i<a.length&&out.length<5;i++){
      if(/^(CAN CU|KINH GUI|I\.|1\.|MUC )/.test(az[i]))break;
      if(a[i].length>8)out.push(a[i]);
      if(out.join(' ').length>230)break;
    }
    return one(out.join(' '));
  }
  function issuerFromHeader(s){
    var z=ascii(s),m;
    if(/UY BAN NHAN DAN/.test(z)){
      m=z.match(/UY BAN NHAN DAN[\s\S]{0,80}?TINH\s+([A-Z ]{2,30})/);
      if(m)return'UBND tỉnh '+titleVN(m[1].replace(/CONG HOA[\s\S]*/,''));
      m=z.match(/UY BAN NHAN DAN[\s\S]{0,80}?XA\s+([A-Z0-9 ]{2,30})/);
      if(m)return'UBND xã '+titleVN(m[1].replace(/CONG HOA[\s\S]*/,''));
    }
    return'';
  }
  async function headerVision(pdf){
    var page=await renderFirst(pdf),top=crop(page,0.035,0.035,0.93,0.31),leftRow=crop(page,0.055,0.092,0.43,0.082),blue=blueMask(leftRow);
    var full=await tess(top,'BL2 header 300dpi',{psm:6}),row=await tess(leftRow,'BL2 số ký hiệu',{psm:6}),digits=await tess(blue,'BL2 mực viết tay',{psm:7,whitelist:'0123456789'});
    var ht=plain(full&&full.text||''),rt=one(row&&row.text||''),bt=one(digits&&digits.text||''),no=numFromText(rt)||numFromText(ht);
    if(!no){var suf=suffixFrom(rt)||suffixFrom(ht),ds=digitsOnly(bt);if(suf&&ds)no=ds+'/'+suf}
    var type=typeFromHeader(ht),subject=subjectFromHeader(ht,type),issuer=issuerFromHeader(ht),date=dateFromHeader(ht),my=monthYearFromHeader(ht);
    page.width=page.height=top.width=top.height=leftRow.width=leftRow.height=blue.width=blue.height=1;
    return {headerText:ht,rowText:rt,blueText:bt,no:no,date:date,monthYear:my,type:type,subject:subject,issuer:issuer};
  }

  window.extractFile=async function(file){
    if(typeof ext==='function'&&ext(file.name)!=='pdf')throw new Error('Bản này chỉ nhận PDF đã ký.');
    var pdf=await loadPdf(file),nat=await nativeText(pdf),sig=await rawSignature(file),vis={};
    try{if(typeof v4Status==='function')v4Status('Đang đọc vùng đầu trang 300 dpi và nét viết tay…');vis=await headerVision(pdf)}catch(e){console.warn('headerVision',e)}
    var signDate=dateFromNative(nat.signatureText)||sig.date,issuer=issuerFromNative(nat.signatureText)||vis.issuer||'';
    var date=vis.date||'';
    if(!date&&signDate){
      var p=signDate.split('/'),my=vis.monthYear;
      if(!my||(my.m===+p[1]&&my.y===+p[2]))date=signDate;
    }
    var strict={no:vis.no||'',date:date,issuer:issuer,type:vis.type||'',subject:vis.subject||'',signed:!!sig.signed,dateSource:vis.date?'HEADER_OCR':(date?'DIGITAL_SIGNATURE_CROSSCHECK':''),numberSource:vis.no?'HEADER_IMAGE_300DPI':''};
    var body=nat.text;
    if((!strict.no||!strict.subject||body.replace(/\s/g,'').length<300)&&oldExtractFile){
      try{var extra=await oldExtractFile(file);if(extra)body+='\n--- LEGACY/FALLBACK OCR ---\n'+extra}catch(e){console.warn('fallback OCR',e)}
    }
    if(typeof v4Status==='function')v4Status('Đã đọc PDF: chữ in + vùng Số/Ngày + chữ ký số; không lấy số/ngày trong phần Căn cứ.');
    return metaMarker(strict)+'\n--- HEADER VISION V36 ---\n'+(vis.headerText||'')+'\n'+body;
  };

  window.verifiedPdfMeta=function(text,name){
    var strict=parseMetaMarker(text),base=oldMeta?oldMeta(text,name):{};
    if(!strict)return base;
    var no=strict.no||(base.no&&base.no!=='KHONG-XAC-DINH'?base.no:''),date=strict.date||base.date||'',issuer=strict.issuer||(base.issuer&&base.issuer!=='KHONG-XAC-DINH'?base.issuer:''),type=strict.type||base.type||'',subject=strict.subject||(base.subject&&base.subject!=='KHONG-XAC-DINH'?base.subject:'');
    var miss=[];
    if(!/^\d{1,7}\/[A-Z0-9Đ]{1,12}(?:-[A-Z0-9Đ]{1,12}){1,5}$/i.test(no))miss.push('số/ký hiệu');
    if(!isoDate(date))miss.push('ngày ban hành');
    if(!issuer)miss.push('cơ quan ban hành');
    if(!type||type==='Tài liệu PDF')miss.push('loại văn bản');
    if(!subject||subject.length<10)miss.push('trích yếu');
    if(!strict.signed)miss.push('chữ ký số');
    return Object.assign({},base,{no:no||'KHONG-XAC-DINH',date:date,year:(String(date).match(/20\d{2}/)||[])[0]||'KHONG-XAC-DINH',issuer:issuer||'KHONG-XAC-DINH',type:type||'Tài liệu PDF',subject:subject||'KHONG-XAC-DINH',digitalSignature:strict.signed,releaseReady:miss.length===0,missing:miss,source:'Reader '+V+' · metadata chỉ từ vùng đầu trang + chữ ký số'});
  };

  if(typeof folders!=='undefined'&&!folders.some(function(f){return f.code==='CCHC.01'})){
    var folder={code:'CCHC.01',field:'Cải cách hành chính - ISO',work:'Áp dụng, duy trì, cải tiến HTQLCL',name:'HTQLCL theo TCVN ISO 9001:2015',strong:['hệ thống quản lý chất lượng','htqlcl','tcvn iso 9001:2015','iso 9001:2015','duy trì và cải tiến htqlcl'],weak:['cải cách hành chính','thủ tục hành chính','quy trình iso'],exclude:[],semantic:'áp dụng duy trì cải tiến hệ thống quản lý chất lượng HTQLCL theo TCVN ISO 9001:2015 trong cơ quan hành chính nhà nước'};
    var k=Math.max(0,folders.findIndex(function(f){return f.code==='TTHC.01'})+1);folders.splice(k,0,folder);
  }
  if(typeof oldScore==='function')window.scoreFolder=function(folder,profile,name){
    var r=oldScore(folder,profile,'')||{score:0,hits:[]},p=ascii(((profile&&profile.subject)||'')+' '+((profile&&profile.purpose)||''));
    if(folder.code==='CCHC.01'&&/(HTQLCL|HE THONG QUAN LY CHAT LUONG|TCVN\s*ISO\s*9001|ISO\s*9001)/.test(p))r.score=(r.score||0)+28;
    if(folder.code==='XD.01'&&/(HTQLCL|ISO\s*9001)/.test(p))r.score=(r.score||0)-24;
    return r;
  };

  function compactSubject(s){
    var z=ascii(s);
    if(/HTQLCL|HE THONG QUAN LY CHAT LUONG|ISO\s*9001/.test(z))return'AP-DUNG-HTQLCL-TCVN-ISO9001-2015';
    var stop=new Set('VE VIEC CONG TAC CUA THEO VA TRONG NAM TREN DIA BAN CAC DOI VOI TAI THUC HIEN TRIEN KHAI MOT SO NHAM PHUC VU HOAT DONG CO QUAN TO CHUC THUOC HE THONG'.split(' ')),a=slug(s).split('-').filter(Boolean),o=[];
    for(var i=0;i<a.length;i++){if(stop.has(a[i]))continue;if(o.indexOf(a[i])<0)o.push(a[i]);if(o.length>=9)break}
    return (o.join('-')||'TRICH-YEU').slice(0,48).replace(/-+[^-]*$/,'').replace(/-+$/,'');
  }
  function issuerSlug(s){
    var z=slug(s).replace(/^UY-BAN-NHAN-DAN-/,'UBND-').replace(/^UBND-TINH-LAM-DONG.*$/,'UBND-TINH-LAM-DONG').replace(/^UBND-XA-BAO-LAM-2.*$/,'UBND-XA-BAO-LAM-2');
    return z.slice(0,32)||'CO-QUAN';
  }
  function fileName(vm,extn){
    if(!vm||!vm.releaseReady)return'—';
    var d=isoDate(vm.date),e=String(extn||'pdf').replace(/[^a-z0-9]/gi,'').toLowerCase()||'pdf',fixed=d+'_'+slug(vm.type).slice(0,18)+'_'+slug(String(vm.no).replace(/[\/\\]+/g,'-')).slice(0,30)+'_'+issuerSlug(vm.issuer)+'_',title=compactSubject(vm.subject),budget=Math.max(20,112-fixed.length-e.length-1);
    if(title.length>budget)title=title.slice(0,budget).replace(/-+[^-]*$/,'').replace(/-+$/,'');
    return fixed+title+'.'+e;
  }
  window.buildOfficialFilename=fileName;

  window.classifyItem=async function(item){
    var r=await oldClassify(item),vm=window.verifiedPdfMeta(item.text||'',item.name||''),all=ascii((item.text||'')+' '+(vm.subject||''));
    if(r){
      r.meta=Object.assign({},r.meta||{},vm);r.type=vm.type||r.type;r.suggested=fileName(vm,typeof ext==='function'?ext(item.name):'pdf');
      if(/HTQLCL|HE THONG QUAN LY CHAT LUONG|TCVN\s*ISO\s*9001|ISO\s*9001/.test(all)&&typeof folders!=='undefined'){
        var f=folders.find(function(x){return x.code==='CCHC.01'});
        if(f){r.chosen=f;r.confidence=vm.releaseReady?'Cao':'Trung bình';if(Array.isArray(r.top)){r.top=r.top.filter(function(x){return !(x.folder&&x.folder.code==='CCHC.01')});r.top.unshift({folder:f,score:99,hits:['HTQLCL','TCVN ISO 9001:2015'],semantic:1})}}
      }
      r.status=vm.releaseReady?'AI ĐỌC SÂU - CHỜ CÁN BỘ XÁC NHẬN':'CHƯA ĐỦ CĂN CỨ ĐẶT TÊN: '+vm.missing.join(', ');
    }
    return r;
  };

  try{
    var el=document.querySelector('#aiStatus');if(el)el.textContent='Reader Engine '+V+' · khóa metadata đầu trang + chữ ký số';
    var b=document.querySelector('#readerVersionBadge');if(!b){b=document.createElement('div');b.id='readerVersionBadge';b.style.cssText='position:fixed;right:12px;bottom:12px;z-index:9999;background:#0d2f4a;color:#fff;padding:7px 10px;border-radius:999px;font:600 11px system-ui;opacity:.9';document.body.appendChild(b)}b.textContent='BL2 Reader 3.6';
  }catch(e){}
})();