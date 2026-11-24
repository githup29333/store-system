(() => {
  const root = document.getElementById('b');
  if (!root) return;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const EXPECTED = [
    'companies','warehouses','suppliers','products','purchase_requests','purchase_request_items',
    'stock_movements','orders','deliveries','items','prices','item_price_link','recipients','hotels',
    'hotel_inventory','hotel_stock_movements','hotel_suppliers','hotel_purchase_orders','hotel_purchase_order_items'
  ];
  root.innerHTML = '<h2 style="margin-top:0">النسخ الاحتياطي</h2>' +
    '<p class="st">إنشاء نسخة JSON من بيانات التشغيل المسموح بها، أو فحص نسخة موجودة دون تعديل قاعدة البيانات.</p>' +
    '<div class="row"><button class="btn" id="backupDownload">إنشاء وتنزيل نسخة الآن</button>' +
    '<label class="btn alt" for="backupFile" style="cursor:pointer">فحص ملف نسخة احتياطية</label><input id="backupFile" type="file" accept=".json,application/json" hidden></div>' +
    '<p id="backupStatus" role="status" style="margin-top:14px;color:var(--mut)">لا توجد عملية جارية.</p>' +
    '<div id="backupDetails"></div>' +
    '<p style="color:var(--mut);font-size:13px">مهم: هذه نسخة بيانات تشغيل وليست نسخة PostgreSQL كاملة. لا تتضمن كلمات المرور أو مفاتيح الفنادق أو أسرار الربط أو حسابات المستخدمين. الفحص لا يستعيد البيانات ولا يغيّرها. احتفظ بالملف في مكان خاص وآمن.</p>';
  const status = text => { const el=root.querySelector('#backupStatus'); if(el)el.textContent=text; };
  const details = rows => { root.querySelector('#backupDetails').innerHTML = rows; };
  root.querySelector('#backupDownload').addEventListener('click', async e => {
    const button=e.currentTarget; button.disabled=true; status('جارٍ تجهيز النسخة والتحقق من اكتمالها…'); details('');
    try {
      const result=await ownerAction('backup_export');
      if(!result || result.format!=='store-system-backup' || !result.sha256) throw new Error('استجابة النسخة غير مكتملة.');
      const blob=new Blob([JSON.stringify(result,null,2)],{type:'application/json'});
      const url=URL.createObjectURL(blob),a=document.createElement('a');
      const stamp=new Date(result.createdAt).toISOString().replace(/[:.]/g,'-');
      a.href=url;a.download='store-system-backup-'+stamp+'.json';document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
      const total=Object.values(result.rowCounts||{}).reduce((sum,n)=>sum+Number(n||0),0);
      status('تم تجهيز النسخة وتنزيلها. راجع مكان التنزيل في جهازك.');
      details('<h3>ملخص النسخة</h3><p>عدد السجلات: <b>'+total.toLocaleString('ar-LY')+'</b></p><p>الجداول: '+Object.keys(result.tables||{}).length+'</p><p>التاريخ: '+esc(new Date(result.createdAt).toLocaleString('ar-LY'))+'</p><p dir="ltr">SHA-256: <code>'+esc(result.sha256)+'</code></p>');
    } catch(err) { status('فشل إنشاء النسخة: '+err.message); }
    finally { button.disabled=false; }
  });
  root.querySelector('#backupFile').addEventListener('change', async e => {
    const file=e.target.files?.[0]; if(!file)return;
    status('جارٍ فحص الملف…');details('');
    try {
      if(file.size>5_000_000) throw new Error('حجم الملف أكبر من الحد المسموح (5MB).');
      const data=JSON.parse(await file.text());
      if(data.format!=='store-system-backup'||data.schemaVersion!==1||!data.tables||!data.rowCounts||!Array.isArray(data.includes)||typeof data.sha256!=='string') throw new Error('صيغة النسخة غير معروفة.');
      for(const name of EXPECTED) if(!Object.prototype.hasOwnProperty.call(data.tables,name)||!Array.isArray(data.tables[name])) throw new Error('جدول مفقود أو غير صالح: '+name);
      for(const name of Object.keys(data.tables)) if(!EXPECTED.includes(name)) throw new Error('النسخة تحتوي جدولاً غير معتمد: '+name);
      const counts={};for(const name of EXPECTED){counts[name]=data.tables[name].length;if(Number(data.rowCounts[name])!==counts[name])throw new Error('عدد السجلات لا يطابق جدول '+name);}
      const unsigned={...data};delete unsigned.sha256;
      const bytes=new TextEncoder().encode(JSON.stringify(unsigned));
      const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(b=>b.toString(16).padStart(2,'0')).join('');
      if(hash!==data.sha256)throw new Error('فشل التحقق من البصمة؛ الملف قد يكون تالفاً أو معدّلاً.');
      const total=Object.values(counts).reduce((sum,n)=>sum+n,0);
      status('النسخة سليمة من ناحية البنية والبصمة. لم يتم استيراد أي بيانات.');
      details('<h3>نتيجة الفحص</h3><p>عدد السجلات: <b>'+total.toLocaleString('ar-LY')+'</b></p><p>الجداول: '+EXPECTED.length+'</p><p>تاريخ الإنشاء: '+esc(new Date(data.createdAt).toLocaleString('ar-LY'))+'</p><p dir="ltr">SHA-256: <code>'+esc(hash)+'</code></p>');
    } catch(err) { status('النسخة غير صالحة: '+err.message); }
    finally { e.target.value=''; }
  });
})();