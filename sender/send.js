// Sends one completed issue per email with two validated Excel attachments.
// Scheduled runs use Africa/Tripoli time; manual dispatch remains available.
const nodemailer = require('nodemailer');
const { generateWorkbooks } = require('./workbooks');
const E = process.env;
const miss = ['SUPABASE_URL','SUPABASE_SERVICE_KEY','SMTP_HOST','SMTP_USER','SMTP_PASS'].filter(k=>!E[k]);
if(miss.length){console.error('Missing env: '+miss.join(', '));process.exit(1);}

const URL_=E.SUPABASE_URL.replace(/\/$/,'');
const KEY=E.SUPABASE_SERVICE_KEY;
const H={apikey:KEY,Authorization:'Bearer '+KEY,'Content-Type':'application/json'};
const PORT=+E.SMTP_PORT||465,SECURE=E.SMTP_SECURE?E.SMTP_SECURE==='true':PORT===465;
const FROM=E.MAIL_FROM||E.SMTP_USER,MAXTRY=+E.MAX_ATTEMPTS||3,LIMIT=+E.MAX_PER_RUN||100;
const XL='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const enc=encodeURIComponent;
const transport=nodemailer.createTransport({
 host:E.SMTP_HOST,port:PORT,secure:SECURE,auth:{user:E.SMTP_USER,pass:E.SMTP_PASS},
 connectionTimeout:20000,greetingTimeout:20000,socketTimeout:60000,
 tls:{rejectUnauthorized:E.SMTP_INSECURE!=='true'}
});

async function rest(path,opt={}){
 const r=await fetch(URL_+'/rest/v1/'+path,{...opt,headers:{...H,...(opt.headers||{})}});
 if(!r.ok)throw new Error('Supabase '+r.status+' '+(await r.text()).slice(0,240));
 if(r.status===204)return null;
 const tx=await r.text();return tx?JSON.parse(tx):null;
}
const REP={Prefer:'return=representation'};
const addr=r=>({name:r.name||'',address:r.email});
const uniq=a=>{const s=new Set();return a.filter(x=>{const k=x.address.toLowerCase();if(s.has(k))return false;s.add(k);return true;});};
const localParts=(date=new Date(),tz='Africa/Tripoli')=>{
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date);
 return Object.fromEntries(parts.map(x=>[x.type,x.value]));
};
const atOrAfter=(now,hhmm)=>{const [h,m]=String(hhmm||'15:00').split(':').map(Number);return now.hour>String(h).padStart(2,'0')||(now.hour===String(h).padStart(2,'0')&&now.minute>=String(m).padStart(2,'0'));};

async function loadContext(){
 const [items,prices,links,hotels,hotelPriceOverrides]=await Promise.all([
  rest('items?select=id,ar,en&limit=5000'),
  rest('prices?select=id,name,unit,cost,category,archived,estimated&limit=5000'),
  rest('item_price_link?select=item_id,price_id,method&limit=10000'),
  rest('hotels?select=code,name&limit=1000'),
  rest('hotel_price_overrides?select=hotel_code,item_id,cost,unit,category,source_name&limit=5000')
 ]);
 return {items,prices,links,hotels,hotelPriceOverrides};
}
async function storeWorkbook(path,buffer){
 if(!buffer||buffer.length<100||buffer.subarray(0,2).toString()!=='PK')throw new Error('Generated Excel attachment is invalid: '+path);
 const r=await fetch(URL_+'/storage/v1/object/exports/'+enc(path),{
  method:'POST',headers:{...H,'Content-Type':XL,'x-upsert':'true'},body:buffer
 });
 if(!r.ok)throw new Error('Could not store '+path+' ('+r.status+'): '+(await r.text()).slice(0,180));
}
async function preparePending(rows,ctx){
 let ready=0;
 for(const d of rows){
  if(d.dept==='ALL'||String(d.code||'').startsWith('BATCH|'))continue;
  try{
   const files=await generateWorkbooks(d,ctx);
   const stem=String(d.key).replace(/[^A-Za-z0-9_-]/g,'_')+'_r'+d.rev;
   const issuePath=stem+'.xlsx',costPath=stem+'_cost.xlsx';
   await Promise.all([storeWorkbook(issuePath,files.issue),storeWorkbook(costPath,files.cost)]);
   const updated=await rest('deliveries?key=eq.'+enc(d.key)+'&rev=eq.'+d.rev+'&status=eq.pending',{
    method:'PATCH',headers:REP,body:JSON.stringify({
     status:'approved',file_path:issuePath,cost_path:costPath,
     approved_at:new Date().toISOString(),updated_at:new Date().toISOString(),error:null
    })
   });
   if(updated&&updated.length)ready++;
  }catch(e){
   const msg=String(e.message||e).slice(0,280);
   await rest('deliveries?key=eq.'+enc(d.key)+'&rev=eq.'+d.rev+'&status=eq.pending',{
    method:'PATCH',headers:REP,body:JSON.stringify({status:'failed',error:'إنشاء الملفات فشل / Workbook generation failed: '+msg,updated_at:new Date().toISOString()})
   }).catch(()=>{});
   console.error('Workbook failed '+d.key+': '+msg);
  }
 }
 return ready;
}

async function sendOne(d,to,cc,hotelName){
 const q='deliveries?key=eq.'+enc(d.key)+'&rev=eq.'+d.rev;
 const got=await rest(q+'&status=eq.approved',{method:'PATCH',headers:REP,body:JSON.stringify({
  status:'sending',attempts:(d.attempts||0)+1,updated_at:new Date().toISOString()
 })});
 if(!got||!got.length){console.log('Skip (already claimed or changed): '+d.key);return true;}
 let mailAttempted=false;
 try{
  if(!to.length)throw new Error('NOFATAL لا يوجد مستلم To لهذا الفندق / no To recipient for this hotel');
  if(!d.file_path||!d.cost_path)throw new Error('NOFATAL يجب توفر ملفّي Excel معاً / both Excel files are required');
  const [fr,cfr]=await Promise.all([
   fetch(URL_+'/storage/v1/object/exports/'+enc(d.file_path),{headers:H}),
   fetch(URL_+'/storage/v1/object/exports/'+enc(d.cost_path),{headers:H})
  ]);
  if(!fr.ok||!cfr.ok)throw new Error('تعذّر تنزيل أحد ملفّي Excel / failed to retrieve both attachments ('+fr.status+'/'+cfr.status+')');
  const [buf,costBuf]=await Promise.all([fr.arrayBuffer(),cfr.arrayBuffer()]);
  const issue=Buffer.from(buf),cost=Buffer.from(costBuf);
  if(issue.length<100||cost.length<100||issue.subarray(0,2).toString()!=='PK'||cost.subarray(0,2).toString()!=='PK')throw new Error('مرفق Excel غير صالح أو فارغ / invalid or empty Excel attachment');
  const date='20'+d.ds.slice(0,2)+'-'+d.ds.slice(2,4)+'-'+d.ds.slice(4);
  const name=d.dn||d.dept,upd=d.rev>1;
  mailAttempted=true;
  const info=await transport.sendMail({
   from:FROM,to,cc,
   subject:(hotelName?'['+hotelName+'] ':'')+'صرف / Issue — '+name+' — طلب / Order '+d.no+' — '+date+(upd?' (تحديث '+d.rev+' / Update '+d.rev+')':''),
   text:'مرفق ملف الصرف وملف التكلفة الخاصان بالطلب '+d.no+' للفندق '+(hotelName||d.hotel)+'.\nالأصناف التي لم تُصرف غير مدرجة في ملف الصرف. الأصناف التي لا يتوفر لها سعر تبقى ظاهرة في تقرير التكلفة، والإجمالي يشمل الأصناف المسعّرة فقط.\n\nAttached are the issue workbook and the cost workbook for order '+d.no+'. Unissued items are excluded from the issue note. Missing-price items remain visible in the cost report; the total includes priced items only.',
   attachments:[
    {filename:'Issue_'+d.dept+'_'+d.no+'.xlsx',content:issue,contentType:XL},
    {filename:'Cost_'+d.dept+'_'+d.no+'.xlsx',content:cost,contentType:XL}
   ]
  });
  const rej=(info.rejected||[]).map(x=>x.address||x);
  if(!(info.accepted||[]).length)throw new Error('NOFATAL لم يقبل خادم البريد أي مستلم / SMTP accepted no recipients');
  const done=await rest(q+'&status=eq.sending',{method:'PATCH',headers:REP,body:JSON.stringify({
   status:'sent',sent_at:new Date().toISOString(),
   error:rej.length?'رُفض لبعض المستلمين / rejected: '+rej.join(', '):null
  })});
  if(!done||!done.length)throw new Error('MAIL_ACCEPTED_DB_UPDATE_MISSED: mail accepted by SMTP but delivery status was not updated');
  console.log('Sent '+d.key+(rej.length?' (rejected: '+rej.join(', ')+')':''));
  return true;
 }catch(e){
  let msg=String(e.message||e).slice(0,300);
  const accepted=mailAttempted||msg.startsWith('MAIL_ACCEPTED_DB_UPDATE_MISSED');
  const fatal=msg.startsWith('NOFATAL')||accepted;
  msg=msg.replace(/^NOFATAL /,'');
  if(accepted)msg='نتيجة البريد غير مؤكدة في قاعدة البيانات؛ افحص صندوق البريد قبل إعادة المحاولة / SMTP result is ambiguous (or accepted but DB update failed); verify mailbox before retry. '+msg;
  const give=fatal||(d.attempts||0)+1>=MAXTRY;
  await rest(q+'&status=eq.sending',{method:'PATCH',headers:REP,body:JSON.stringify({
   status:give?'failed':'approved',error:msg,updated_at:new Date().toISOString()
  })}).catch(()=>{});
  console.error('Failed '+d.key+' ('+(give?'final':'will retry')+'): '+msg);
  return false;
 }
}


async function sendBatch(group, to, cc, hotelName, ctx){
 const claimed=[];
 for(const d of group){
  const got=await rest('deliveries?key=eq.'+enc(d.key)+'&rev=eq.'+d.rev+'&status=eq.approved',{
   method:'PATCH',headers:REP,body:JSON.stringify({status:'sending',attempts:(d.attempts||0)+1,updated_at:new Date().toISOString()})
  });
  if(got&&got.length)claimed.push(d);
 }
 if(!claimed.length)return true;
 let mailAttempted=false;
 try{
  if(!to.length)throw new Error('لا يوجد مستلم لهذا الفندق / no To recipient');
  const files=await require('./batch-workbooks').generateBatchWorkbooks(claimed,ctx);
  const receiptWorkbook=await require('./batch-workbooks').generateReceiptWorkbook(claimed,ctx,receiptMap);
  for(const [name,buf] of [['Issue_Departments.xlsx',files.issue],['Cost_Departments.xlsx',files.cost],['Receipt_Confirmations.xlsx',receiptWorkbook]]){
   if(!buf||buf.length<100||buf.subarray(0,2).toString()!=='PK')throw new Error('ملف Excel المجمّع غير صالح: '+name);
  }
  mailAttempted=true;
  const orderNos=claimed.map(d=>d.no).filter(Boolean);
  const info=await transport.sendMail({
   from:FROM,to,cc,
   subject:(hotelName?'['+hotelName+'] ':'')+'تقرير الصرف والتكلفة المجمّع / Consolidated Issue & Cost — '+claimed.length+' طلب',
   text:'مرفق ملف الصرف وملف التكلفة المجمّعان. يحتوي كل ملف على ورقة مستقلة لكل قسم، وجُمعت طلبات القسم الواحد في ورقته. عدد الطلبات: '+claimed.length+'. أرقام الطلبات: '+orderNos.join('، ')+'.\n\nAttached are the consolidated issue and cost workbooks. Each department has its own worksheet, with its orders grouped together.',
   attachments:[
    {filename:'Issue_Departments.xlsx',content:files.issue,contentType:XL},
    {filename:'Cost_Departments.xlsx',content:files.cost,contentType:XL},
    {filename:'Receipt_Confirmations.xlsx',content:receiptWorkbook,contentType:XL}
   ]
  });
  const rejected=(info.rejected||[]).map(x=>x.address||x);
  if(!(info.accepted||[]).length)throw new Error('SMTP accepted no recipients');
  for(const d of claimed){
   const done=await rest('deliveries?key=eq.'+enc(d.key)+'&rev=eq.'+d.rev+'&status=eq.sending',{
    method:'PATCH',headers:REP,body:JSON.stringify({status:'sent',sent_at:new Date().toISOString(),error:rejected.length?'رُفض لبعض المستلمين / rejected: '+rejected.join(', '):null})
   });
   if(!done||!done.length)throw new Error('MAIL_ACCEPTED_DB_UPDATE_MISSED: '+d.key);
  }
  console.log('Sent one consolidated email for '+claimed.length+' orders, departments: '+files.departments.join(', '));
  return true;
 }catch(e){
  let msg=String(e.message||e).slice(0,280);
  const ambiguous=mailAttempted;
  if(ambiguous)msg='نتيجة الإرسال غير مؤكدة؛ افحص البريد قبل إعادة المحاولة / SMTP outcome is ambiguous; verify mailbox before retry. '+msg;
  for(const d of claimed){
   await rest('deliveries?key=eq.'+enc(d.key)+'&rev=eq.'+d.rev+'&status=eq.sending',{
    method:'PATCH',headers:REP,body:JSON.stringify({status:ambiguous?'failed':'approved',error:msg,updated_at:new Date().toISOString()})
   }).catch(()=>{});
  }
  console.error('Consolidated email failed: '+msg);
  return false;
 }
}

async function runTest(){
 await transport.verify();
 const to=E.TEST_TO||E.SMTP_USER,hotel=E.TEST_HOTEL||'EBR';
 const rows=await rest('deliveries?select=hotel,dept,no,ds,dn,file_path,cost_path&hotel=eq.'+enc(hotel)+'&status=eq.sent&file_path=not.is.null&cost_path=not.is.null&order=updated_at.desc&limit=1');
 if(!rows.length)throw new Error('No previously sent order with both Excel files found for test hotel '+hotel);
 const d=rows[0],paths=[d.file_path,d.cost_path];
 const files=await Promise.all(paths.map(p=>fetch(URL_+'/storage/v1/object/exports/'+enc(p),{headers:H})));
 if(files.some(r=>!r.ok))throw new Error('Could not download both existing test attachments');
 const bufs=await Promise.all(files.map(r=>r.arrayBuffer()));
 if(bufs.some(b=>b.byteLength<100||Buffer.from(b).subarray(0,2).toString()!=='PK'))throw new Error('Stored test workbook is invalid');
 await transport.sendMail({from:FROM,to,subject:'[TEST] مرفقات منظومة الصرف / Issuance attachments test — '+d.no,
  text:'هذه رسالة اختبار فقط مع ملفّي Excel.\nThis is a test email with both Excel attachments.',
  attachments:[
   {filename:'Issue_'+d.dept+'_'+d.no+'.xlsx',content:Buffer.from(bufs[0]),contentType:XL},
   {filename:'Cost_'+d.dept+'_'+d.no+'.xlsx',content:Buffer.from(bufs[1]),contentType:XL}
  ]});
 const existing=await rest('app_secrets?select=value&key=eq.auto_send_config');
 let cfg={enabled:false,time:'15:00',timezone:'Africa/Tripoli'};
 try{if(existing[0]?.value)cfg={...cfg,...JSON.parse(existing[0].value)}}catch(e){}
 cfg.test_passed_at=new Date().toISOString();
 await rest('app_secrets?on_conflict=key',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({
  key:'auto_send_config',value:JSON.stringify(cfg),updated_at:cfg.test_passed_at
 })});
 console.log('Test email sent to '+to+' with two verified Excel attachments; automatic activation is now unlocked.');
}

async function main(){
 const mode=E.MODE||'auto';
 if(mode==='test')return runTest();
 // An interrupted SMTP transaction is ambiguous. Never auto-retry it and risk duplicates.
 const cutoff=new Date(Date.now()-15*60000).toISOString();
 const stuck=await rest('deliveries?status=eq.sending&updated_at=lt.'+enc(cutoff),{
  method:'PATCH',headers:REP,body:JSON.stringify({status:'failed',error:'نتيجة الإرسال غير مؤكدة؛ افحص البريد قبل إعادة المحاولة / stale sending state; verify mailbox before retry',updated_at:new Date().toISOString()})
 });
 if(stuck?.length)console.log('Marked stale sending as failed for manual verification: '+stuck.map(x=>x.key).join(', '));

 if(mode==='auto'){
  const cfgRows=await rest('app_secrets?select=value&key=eq.auto_send_config');
  let cfg={};try{cfg=JSON.parse(cfgRows[0]?.value||'{}')}catch(e){}
  if(!cfg.enabled){
   console.log('Automatic sending is disabled; all scheduled email dispatch is paused; approved manual orders will still be processed only after an explicit manual run');
   return;
  }else{
   const tz=cfg.timezone||'Africa/Tripoli',now=localParts(new Date(),tz);
   if(!atOrAfter(now,cfg.time||'15:00')){
    console.log('Waiting for configured local time '+(cfg.time||'15:00')+' '+tz);
   }else{
    const created=cfg.enabled_at||'1970-01-01T00:00:00.000Z';
    const pending=await rest('deliveries?select=*&status=eq.pending&dept=neq.ALL&created_at=gte.'+enc(created)+'&order=created_at.asc&limit='+LIMIT);
    if(pending.length){
     const ctx=await loadContext();
     const n=await preparePending(pending,ctx);
     console.log('Prepared '+n+' completed order(s) for automatic dispatch');
    }else console.log('No new completed orders eligible for automatic sending');
   }
  }
 }else if(mode==='manual'){
  const pending=await rest('deliveries?select=*&status=eq.pending&dept=neq.ALL&order=created_at.asc&limit='+LIMIT);
  if(pending.length){
   const ctx=await loadContext();
   const n=await preparePending(pending,ctx);
   console.log('Prepared '+n+' order(s) from manual send-now request');
  }
 }else if(mode!=='send'){
  throw new Error('Unknown MODE: '+mode);
 }

 const rows=await rest('deliveries?select=*&status=eq.approved&dept=neq.ALL&order=approved_at.asc&limit='+LIMIT);
 if(!rows.length){console.log('Nothing approved to send');return;}
 const rec=await rest('recipients?select=kind,email,name,hotel&active=eq.true&order=id.asc');
 const hs=await rest('hotels?select=code,name').catch(()=>[]);
 const hname=Object.fromEntries(hs.map(h=>[h.code,h.name]));
 const by=h=>({
  to:uniq(rec.filter(r=>r.hotel===h&&r.kind==='to').map(addr)),
  cc:uniq(rec.filter(r=>r.hotel===h&&r.kind==='cc').map(addr))
 });
 const ctx=await loadContext();
 const grouped=new Map();
 for(const d of rows){if(!grouped.has(d.hotel))grouped.set(d.hotel,[]);grouped.get(d.hotel).push(d);}
 let ok=true;
 for(const [hotel,orders] of grouped){const g=by(hotel);ok=(await sendBatch(orders,g.to,g.cc,hname[hotel]||'',ctx))&&ok;}
 if(!ok)process.exitCode=1;
}
main().catch(e=>{console.error('Fatal: '+(e.message||e));process.exit(1);});
