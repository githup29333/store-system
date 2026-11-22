var VLOW = false, VSCAN_STREAM=null, VSCAN_FRAME=0;
function invHotel(){var sel=document.querySelector('#vh');return (sel&&sel.value)||(HSEL&&HOTELS.some(function(x){return x.code===HSEL})?HSEL:(HOTELS[0]&&HOTELS[0].code)||'');}
function drawV(){
 var root=document.querySelector('#v');if(!root)return;
 if(INVERR){root.innerHTML='<p style="color:#b4231a">تعذّر تحميل المخزون: '+esc(INVERR)+'</p><p>تأكد من صلاحيات جداول المخزون ثم حدّث الصفحة.</p>';return;}
 var h=invHotel(),records=INVENTORY.filter(function(x){return x.hotel_code===h}),byId=new Map(records.map(function(x){return [x.item_id,x]}));
 var q=(document.querySelector('#vq')&&document.querySelector('#vq').value||'').trim().toLowerCase();
 var items=ITEMS.filter(function(it){return !it.hotels||!it.hotels.length||it.hotels.includes(h)});
 var rows=items.map(function(it){var r=byId.get(it.id),link=LINKS.find(function(l){return l.item_id===it.id&&l.price_id}),p=link&&PRICES.find(function(z){return z.id===link.price_id&&!z.archived});return {it:it,r:r,qty:+(r&&r.quantity||0),min:+(r&&r.reorder_level||0),unit:(r&&r.unit)||(p&&p.unit)||'قطعة'}}).filter(function(x){return !q||(x.it.ar+' '+x.it.en+' '+x.it.sku+' '+x.it.code).toLowerCase().includes(q)});
 var low=rows.filter(function(x){return x.r&&x.min>0&&x.qty<=x.min}).length,zero=rows.filter(function(x){return x.r&&x.qty<=0}).length;
 var recent=MOVEMENTS.filter(function(x){return x.hotel_code===h}).slice(0,12);
 var html='<div class="row"><b style="font-size:18px;flex:1">إدارة المخزون</b><button class="btn alt" id="vscan">مسح QR بالكاميرا</button><button class="btn alt" id="vtemplate">تحميل نموذج CSV</button><button class="btn alt" id="vimport">استيراد أرصدة CSV</button><select id="vh">'+HOTELS.map(function(x){return '<option value="'+esc(x.code)+'" '+(x.code===h?'selected':'')+'>'+esc(x.name)+' ('+esc(x.code)+')</option>'}).join('')+'</select><button class="btn alt" id="vrefresh">تحديث</button></div>';
 html+='<input type="file" id="vfile" accept=".csv,text/csv" hidden>';
 html+='<div class="grid"><div class="kpi"><b>'+rows.length+'</b>أصناف الفندق</div><div class="kpi"><b>'+records.length+'</b>أصناف لها رصيد مسجل</div><div class="kpi"><b style="color:var(--warn)">'+low+'</b>تحت حد إعادة الطلب</div><div class="kpi"><b style="color:var(--bad)">'+zero+'</b>رصيد صفر</div></div>';
 html+='<p style="color:var(--mut)">الرصيد مستقل لكل فندق. نزّل نموذج CSV لتعبئة أرصدة الأصناف وحدود إعادة الطلب دفعة واحدة. الاستيراد يستبدل الرصيد الحالي للصنف ويسجل حركة تسوية؛ الطلبات القديمة لا تخصم تلقائيًا.</p>';
 html+='<div class="row"><input type="search" id="vq" placeholder="ابحث بالاسم أو SKU أو كود المورد" value="'+esc(q)+'" style="flex:1"><button class="btn alt" id="vlow">'+(VLOW?'عرض كل الأصناف':'عرض النواقص فقط')+'</button></div>';
 html+='<div class="wrap"><table><tr><th>الصنف</th><th>SKU / كود داخلي</th><th>الرصيد</th><th>الوحدة</th><th>حد الطلب</th><th>الحالة</th><th>QR</th><th>الحركة</th></tr><tbody id="vrows">'+rows.map(function(x){var state=!x.r?'<span class="tag">لم يُسجل</span>':x.min>0&&x.qty<=x.min?'<span class="tag t-w">اطلب الآن</span>':x.qty<=0?'<span class="tag t-bad">نفد</span>':'<span class="tag t-ok">متوفر</span>';return '<tr data-search="'+esc((x.it.ar+' '+x.it.en+' '+x.it.sku+' '+x.it.code).toLowerCase())+'" data-low="'+(x.min>0&&x.qty<=x.min?'1':'0')+'" '+(VLOW&&!(x.min>0&&x.qty<=x.min)?'hidden':'')+'><td>'+esc(x.it.ar)+'<br><small dir="ltr">'+esc(x.it.en)+'</small></td><td dir="ltr">'+esc(x.it.sku||'—')+'</td><td><b>'+x.qty+'</b></td><td>'+esc(x.unit)+'</td><td>'+x.min+'</td><td>'+state+'</td><td><button class="btn alt" data-vqr="'+x.it.id+'">طباعة QR</button></td><td><button class="btn" data-vin="'+x.it.id+'">وارد</button> <button class="btn alt" data-vout="'+x.it.id+'">صرف</button> <button class="btn alt" data-vadj="'+x.it.id+'">تسوية</button> <button class="btn alt" data-vmin="'+x.it.id+'">حد الطلب</button></td></tr>'}).join('')+' </tbody></table></div>';
 html+='<h3>آخر حركات المخزون</h3><div class="wrap"><table><tr><th>التاريخ</th><th>الصنف</th><th>الحركة</th><th>الكمية</th><th>ملاحظة</th></tr>'+recent.map(function(m){var it=ITEMS.find(function(x){return x.id===m.item_id});return '<tr><td>'+new Date(m.created_at).toLocaleString('ar')+'</td><td>'+esc(it&&it.ar||m.item_id)+'</td><td>'+(m.movement_type==='in'?'وارد':m.movement_type==='out'?'صرف':'تسوية')+'</td><td>'+m.quantity+' '+esc(m.unit)+'</td><td>'+esc(m.note||'—')+'</td></tr>'}).join('')+'<tr '+(recent.length?'hidden':'')+'><td colspan="5">لا توجد حركات بعد</td></tr></table></div>';
 root.innerHTML=html;
}

function csvCell(v){var s=String(v==null?'':v);return '"'+s.replace(/"/g,'""')+'"'}
function downloadInventoryTemplate(){
 var h=invHotel(),items=ITEMS.filter(function(it){return !it.hotels||!it.hotels.length||it.hotels.includes(h)}),rows=[['sku','item_name','quantity','unit','reorder_level']];
 items.forEach(function(it){
  var r=INVENTORY.find(function(x){return x.hotel_code===h&&x.item_id===it.id}),link=LINKS.find(function(x){return x.item_id===it.id&&x.price_id}),p=link&&PRICES.find(function(x){return x.id===link.price_id&&!x.archived});
  rows.push([it.sku||'',it.ar||'',r? r.quantity:'',r&&r.unit||p&&p.unit||'قطعة',r?r.reorder_level:'']);
 });
 var csv='\\uFEFF'+rows.map(function(row){return row.map(csvCell).join(',')}).join('\\r\\n'),blob=new Blob([csv],{type:'text/csv;charset=utf-8;'}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download='inventory-opening-'+h+'.csv';a.click();setTimeout(function(){URL.revokeObjectURL(url)},1200);
}
function parseInventoryCsv(text){
 text=String(text||'').replace(/^\\uFEFF/,'');
 var first=(text.split(/\\r?\\n/)[0]||''),delimiter=first.includes(';')&&!first.includes(',')?';':',',rows=[],row=[],cell='',quoted=false;
 for(var i=0;i<text.length;i++){
  var ch=text[i];
  if(ch==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++}else quoted=!quoted}
  else if(ch===delimiter&&!quoted){row.push(cell);cell=''}
  else if((ch==='\\n'||ch==='\\r')&&!quoted){if(ch==='\\r'&&text[i+1]==='\\n')i++;row.push(cell);if(row.some(function(x){return String(x).trim()!==''}))rows.push(row);row=[];cell=''}
  else cell+=ch;
 }
 row.push(cell);if(row.some(function(x){return String(x).trim()!==''}))rows.push(row);
 if(rows.length<2)throw new Error('ملف CSV لا يحتوي على بيانات');
 var headers=rows.shift().map(function(x){return String(x).trim().toLowerCase()}),find=function(keys){return headers.findIndex(function(x){return keys.includes(x)})};
 var si=find(['sku','item_sku','كود','الكود','الكود الداخلي']),qi=find(['quantity','qty','الرصيد','الكمية']),ui=find(['unit','الوحدة']),mi=find(['reorder_level','min_stock','حد الطلب','الحد الأدنى']);
 if(si<0||qi<0||mi<0)throw new Error('الأعمدة المطلوبة: sku, quantity, reorder_level');
 return rows.map(function(r){
  var sku=String(r[si]||'').trim(),qty=String(r[qi]||'').trim().replace(',','.'),min=String(r[mi]||'').trim().replace(',','.'),unit=ui>=0?String(r[ui]||'').trim():'';
  if(!sku)return null;
  if(qty===''||min==='')throw new Error('أكمل الكمية وحد الطلب لكل SKU: '+sku);
  var q=Number(qty),m=Number(min);if(!Number.isFinite(q)||q<0||!Number.isFinite(m)||m<0)throw new Error('قيمة غير صحيحة في SKU: '+sku);
  if(!unit){var it=ITEMS.find(function(x){return x.sku===sku}),r0=it&&INVENTORY.find(function(x){return x.hotel_code===invHotel()&&x.item_id===it.id}),l=it&&LINKS.find(function(x){return x.item_id===it.id&&x.price_id}),p=l&&PRICES.find(function(x){return x.id===l.price_id&&!x.archived});unit=r0&&r0.unit||p&&p.unit||'قطعة'}
  return {sku:sku,quantity:q,unit:unit,reorder_level:m};
 }).filter(Boolean);
}
async function importInventoryCsv(file){
 if(!file)return;
 try{
  var rows=parseInventoryCsv(await file.text());
  if(!rows.length)return alert('لم يتم العثور على صفوف صالحة');
  if(!confirm('سيتم استيراد '+rows.length+' صنف إلى الفندق '+invHotel()+'. سيتم استبدال الرصيد الحالي لكل صنف وتسجيل حركة تسوية. متابعة؟'))return;
  var count=await api('rpc/import_hotel_inventory',{method:'POST',body:JSON.stringify({p_hotel_code:invHotel(),p_rows:rows})});
  await refreshInventory();alert('تم استيراد '+count+' صنف بنجاح.');
 }catch(e){alert('تعذّر استيراد الملف: '+e.message)}
 finally{var input=document.querySelector('#vfile');if(input)input.value=''}
}
function stopVScan(){if(VSCAN_FRAME)cancelAnimationFrame(VSCAN_FRAME);VSCAN_FRAME=0;if(VSCAN_STREAM){VSCAN_STREAM.getTracks().forEach(function(t){t.stop()});VSCAN_STREAM=null}var m=document.querySelector('#vscanModal');if(m)m.remove()}
async function startVScan(){
 if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia||typeof jsQR!=='function')return alert('الكاميرا غير مدعومة في هذا المتصفح. استخدم خانة البحث بالكود الداخلي.');
 stopVScan();var m=document.createElement('div');m.id='vscanModal';m.style='position:fixed;inset:0;z-index:9999;background:#000c;display:flex;align-items:center;justify-content:center;padding:16px';m.innerHTML='<div style="background:#fff;border-radius:12px;padding:14px;max-width:520px;width:100%;text-align:center"><button class="btn alt" id="vscanClose">إغلاق الكاميرا</button><p>وجّه الكاميرا إلى ملصق QR للصنف</p><video id="vscanVideo" playsinline muted style="width:100%;max-height:60vh;background:#000;border-radius:8px"></video><p id="vscanStatus">جاري تشغيل الكاميرا…</p></div>';document.body.appendChild(m);m.querySelector('#vscanClose').onclick=stopVScan;
 try{VSCAN_STREAM=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});var video=m.querySelector('#vscanVideo'),canvas=document.createElement('canvas'),ctx=canvas.getContext('2d',{willReadFrequently:true});video.srcObject=VSCAN_STREAM;await video.play();
  function tick(){if(!VSCAN_STREAM)return;if(video.readyState===video.HAVE_ENOUGH_DATA){canvas.width=video.videoWidth;canvas.height=video.videoHeight;ctx.drawImage(video,0,0,canvas.width,canvas.height);var img=ctx.getImageData(0,0,canvas.width,canvas.height),code=jsQR(img.data,img.width,img.height,{inversionAttempts:'dontInvert'});if(code&&code.data){var value=code.data.trim(),item=ITEMS.find(function(x){return x.sku===value||x.barcode===value||x.code===value});stopVScan();VLOW=false;var search=document.querySelector('#vq');if(search)search.value=item?(item.sku||item.ar):value;drawV();if(!item)alert('تم قراءة الكود '+value+' لكنه غير مرتبط بصنف مسجل.');return}}VSCAN_FRAME=requestAnimationFrame(tick)}tick();
 }catch(e){stopVScan();alert('تعذّر فتح الكاميرا: '+e.message+' — تأكد من السماح للمتصفح باستخدام الكاميرا وفتح اللوحة عبر HTTPS.')}
}
function printItemQR(id){var it=ITEMS.find(function(x){return x.id===id});if(!it||!it.sku)return alert('لا يوجد كود داخلي لهذا الصنف');if(typeof qrcode!=='function')return alert('مولّد QR غير متاح');var qr=qrcode(0,'M');qr.addData(it.sku);qr.make();var w=window.open('','_blank','width=420,height=520');if(!w)return alert('اسمح بالنوافذ المنبثقة لطباعة الملصق');w.document.write('<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><title>ملصق صنف</title><body style="font-family:Tahoma,Arial;text-align:center;padding:18px"><h3>'+esc(it.ar)+'</h3><p dir="ltr">'+esc(it.en)+'</p>'+qr.createSvgTag(5,0)+'<h3 dir="ltr">'+esc(it.sku)+'</h3><script>window.onload=function(){window.print()}</script></body></html>');w.document.close()}
async function refreshInventory(){var data=await Promise.all([api('hotel_inventory?select=*&limit=5000'),api('hotel_stock_movements?select=*&order=created_at.desc&limit=200')]);INVENTORY=data[0];MOVEMENTS=data[1];INVERR='';drawV();}
document.querySelector('#v').addEventListener('change',function(e){if(e.target.id==='vh'){VLOW=false;drawV()}if(e.target.id==='vfile'&&e.target.files&&e.target.files[0])importInventoryCsv(e.target.files[0])});
document.querySelector('#v').addEventListener('input',function(e){if(e.target.id==='vq'){var q=e.target.value.trim().toLowerCase();document.querySelectorAll('#vrows tr[data-search]').forEach(function(r){r.hidden=(VLOW&&r.dataset.low!=='1')||!r.dataset.search.includes(q)})}});
document.querySelector('#v').addEventListener('click',async function(e){
 var b=e.target.closest('button');if(!b)return;
 try{
  if(b.id==='vrefresh'){await refreshInventory();return}
  if(b.id==='vtemplate'){downloadInventoryTemplate();return}
  if(b.id==='vimport'){document.querySelector('#vfile').click();return}
  if(b.id==='vscan'){await startVScan();return}
  if(b.dataset.vqr){printItemQR(+b.dataset.vqr);return}
  if(b.id==='vlow'){VLOW=!VLOW;document.querySelectorAll('#vrows tr[data-search]').forEach(function(r){r.hidden=VLOW&&r.dataset.low!=='1'});b.textContent=VLOW?'عرض كل الأصناف':'عرض النواقص فقط';return}
  var id=+(b.dataset.vin||b.dataset.vout||b.dataset.vadj||b.dataset.vmin||0);if(!id)return;
  var h=invHotel(),it=ITEMS.find(function(x){return x.id===id}),r=INVENTORY.find(function(x){return x.hotel_code===h&&x.item_id===id}),link=LINKS.find(function(l){return l.item_id===id&&l.price_id}),p=link&&PRICES.find(function(z){return z.id===link.price_id&&!z.archived}),unit=(r&&r.unit)||(p&&p.unit)||'قطعة';
  if(b.dataset.vmin){
   var v=prompt('حد إعادة الطلب لصنف '+it.ar+' ('+unit+'):',String(r&&r.reorder_level||0));if(v===null)return;var n=Number(v);if(!Number.isFinite(n)||n<0)return alert('أدخل رقمًا صحيحًا');
   if(r)await api('hotel_inventory?hotel_code=eq.'+enc(h)+'&item_id=eq.'+id,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({reorder_level:n,updated_at:new Date().toISOString()})});
   else await api('hotel_inventory',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({hotel_code:h,item_id:id,quantity:0,reorder_level:n,unit:unit})});
  }else{
   var type=b.dataset.vin?'in':b.dataset.vout?'out':'adjust',label=type==='in'?'كمية الوارد':type==='out'?'كمية الصرف':'الرصيد الفعلي الجديد';
   var v=prompt(label+' — '+it.ar+' ('+unit+'):',type==='adjust'?String(r&&r.quantity||0):'1');if(v===null)return;var n=Number(v);if(!Number.isFinite(n)||n<0||(type!=='adjust'&&n===0))return alert('أدخل كمية صحيحة');
   var note=prompt('ملاحظة (اختياري):','')||'';await api('hotel_stock_movements',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({hotel_code:h,item_id:id,movement_type:type,quantity:n,unit:unit,note:note})});
  }
  await refreshInventory();
 }catch(err){alert('تعذّر تحديث المخزون: '+err.message)}
});