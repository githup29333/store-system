/* Hotel-scoped purchasing, supplier management and immutable activity history. */
var SUPPLIERS=[], PURCHASES=[], PURCHASE_LINES=[], AUDIT_LOG=[], PROCERR='', PO_OPEN='', PO_HOTEL='';
async function loadProcurementData(){
  try{
    var r=await Promise.all([
      api('hotel_suppliers?select=*&order=name.asc&limit=3000'),
      api('hotel_purchase_orders?select=*&order=created_at.desc&limit=3000'),
      api('hotel_purchase_order_items?select=*&order=created_at.asc&limit=10000'),
      api('admin_audit_log?select=*&order=created_at.desc&limit=150')
    ]);
    SUPPLIERS=r[0]||[];PURCHASES=r[1]||[];PURCHASE_LINES=r[2]||[];AUDIT_LOG=r[3]||[];PROCERR='';
  }catch(e){PROCERR=e.message||String(e);SUPPLIERS=[];PURCHASES=[];PURCHASE_LINES=[];AUDIT_LOG=[];}
}
function poHotelDefault(){if(HSEL&&HOTELS.some(function(h){return h.code===HSEL}))return HSEL;if(PO_HOTEL&&HOTELS.some(function(h){return h.code===PO_HOTEL}))return PO_HOTEL;return (HOTELS[0]&&HOTELS[0].code)||''}
function drawProcurement(){
  var root=document.querySelector('#p');if(!root)return;
  if(PROCERR){root.innerHTML='<h2>المشتريات والموردون</h2><p class="tag t-bad">تعذّر تحميل بيانات المشتريات: '+esc(PROCERR)+'</p><p>تأكد من تطبيق ترحيل المشتريات وسجل العمليات ثم حدّث اللوحة.</p>';return}
  var selected=poHotelDefault(),hotels=HOTELS.map(function(h){return '<option value="'+esc(h.code)+'" '+(h.code===selected?'selected':'')+'>'+esc(h.name)+' ('+esc(h.code)+')</option>'}).join('');
  var supplierOptions=SUPPLIERS.filter(function(s){return s.hotel_code===selected&&s.active}).map(function(s){return '<option value="'+s.id+'">'+esc(s.name)+'</option>'}).join('');
  var suppliers=SUPPLIERS.filter(function(s){return !HSEL||s.hotel_code===HSEL});
  var orders=PURCHASES.filter(function(o){return !HSEL||o.hotel_code===HSEL});
  var status={draft:'مسودة',ordered:'تم إرسال الطلب',received:'تم الاستلام',cancelled:'ملغي'};
  var html='<h2 style="margin-top:0">المشتريات والموردون</h2><div class="row"><label>الفندق <select id="poHotel">'+hotels+'</select></label><span style="color:var(--mut)">كل مورد وطلب شراء مرتبط بفندق واحد فقط.</span></div>'+
    '<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(280px,1fr))"><div><h3>إضافة مورد</h3><div class="row"><input id="spName" placeholder="اسم المورد" style="flex:1;min-width:150px"></div><div class="row"><input id="spContact" placeholder="الشخص المسؤول"><input id="spPhone" placeholder="الهاتف" dir="ltr"></div><div class="row"><input id="spEmail" placeholder="البريد الإلكتروني" dir="ltr" style="flex:1"></div><textarea id="spNotes" rows="2" placeholder="ملاحظات المورد" style="width:100%"></textarea><button class="btn" id="spAdd">حفظ المورد</button></div>'+
    '<div><h3>إنشاء طلب شراء</h3><div class="row"><select id="poSupplier" style="flex:1"><option value="">اختر المورد</option>'+supplierOptions+'</select></div><textarea id="poNotes" rows="2" placeholder="ملاحظات الطلب" style="width:100%"></textarea><button class="btn" id="poCreate" '+(supplierOptions?'':'disabled')+'>إنشاء مسودة شراء</button> <button class="btn alt" id="poCreateFromLow" '+(supplierOptions?'':'disabled')+'>مسودة من نواقص المخزون</button><p style="color:var(--mut)">اقتراح النواقص يرفع الرصيد المستهدف إلى ضعف حد إعادة الطلب، ويستخدم السعر الحالي إن توفر. راجع المسودة قبل اعتمادها.</p></div></div>'+
    '<h3>الموردون ('+suppliers.length+')</h3><div class="wrap"><table><tr><th>الفندق</th><th>المورد</th><th>جهة الاتصال</th><th>الهاتف</th><th>الحالة</th><th>إجراء</th></tr>'+
    (suppliers.map(function(s){return '<tr><td>'+esc((HOTELS.find(function(h){return h.code===s.hotel_code})||{}).name||s.hotel_code)+'</td><td>'+esc(s.name)+'</td><td>'+esc(s.contact||'—')+'</td><td dir="ltr">'+esc(s.phone||'—')+'</td><td><span class="tag '+(s.active?'t-ok':'t-w')+'">'+(s.active?'نشط':'موقوف')+'</span></td></tr>'}).join('')||'<tr><td colspan="6">لا يوجد موردون لهذا النطاق بعد</td></tr>')+'</table></div>'+
    '<h3>طلبات الشراء ('+orders.length+')</h3><div class="wrap"><table><tr><th>رقم الطلب</th><th>الفندق</th><th>المورد</th><th>التاريخ</th><th>عدد الأصناف</th><th>التكلفة التقديرية</th><th>الحالة</th><th>الإجراءات</th></tr>'+
    (orders.map(function(o){
      var sup=SUPPLIERS.find(function(s){return s.id===o.supplier_id}),ls=PURCHASE_LINES.filter(function(x){return x.purchase_order_id===o.id}),total=ls.reduce(function(a,x){return a+(+x.quantity)*(+x.unit_cost)},0);
      var actions='<button class="btn alt" data-po-view="'+o.id+'">التفاصيل</button>';
      if(o.status==='draft')actions+=' <button class="btn" data-po-line="'+o.id+'">إضافة صنف</button> <button class="btn" data-po-order="'+o.id+'">اعتماد الطلب</button> <button class="btn bad" data-po-cancel="'+o.id+'">إلغاء</button>';
      if(o.status==='ordered')actions+=' <button class="btn ok" data-po-receive="'+o.id+'">تأكيد الاستلام</button> <button class="btn bad" data-po-cancel="'+o.id+'">إلغاء</button>';
      var expanded=PO_OPEN===o.id?'<tr><td colspan="8"><table><tr><th>الصنف</th><th>الكمية</th><th>الوحدة</th><th>سعر الوحدة</th><th>الإجمالي</th><th>المستلم</th><th>إجراء</th></tr>'+
        (ls.map(function(x){var it=ITEMS.find(function(i){return i.id===x.item_id});return '<tr><td>'+esc(it&&it.ar||'صنف #'+x.item_id)+'</td><td>'+x.quantity+'</td><td>'+esc(x.unit)+'</td><td>'+money(x.unit_cost)+'</td><td>'+money(x.line_total||x.quantity*x.unit_cost)+'</td><td>'+x.received_quantity+'</td><td>'+(o.status==='draft'?'<button class="btn alt" data-po-line-edit="'+x.id+'">تعديل</button> <button class="btn bad" data-po-line-del="'+x.id+'">حذف</button>':'—')+'</td></tr>'}).join('')||'<tr><td colspan="6">لم تتم إضافة أصناف بعد</td></tr>')+'</table>'+(o.notes?'<p>'+esc(o.notes)+'</p>':'')+'</td></tr>':'';
      return '<tr><td><b>'+esc(o.order_no)+'</b></td><td>'+esc((HOTELS.find(function(h){return h.code===o.hotel_code})||{}).name||o.hotel_code)+'</td><td>'+esc(sup&&sup.name||'—')+'</td><td>'+new Date(o.created_at).toLocaleDateString('ar-LY')+'</td><td>'+ls.length+'</td><td>'+money(total)+' د.ل</td><td><span class="tag '+(o.status==='received'?'t-ok':o.status==='cancelled'?'t-bad':'t-w')+'">'+(status[o.status]||o.status)+'</span></td><td>'+actions+'</td></tr>'+expanded;
    }).join('')||'<tr><td colspan="8">لا توجد طلبات شراء لهذا الفندق بعد</td></tr>')+'</table></div>';
  root.innerHTML=html;
}
function drawAudit(){
  var root=document.querySelector('#g');if(!root)return;
  var rows=AUDIT_LOG.filter(function(x){return !HSEL||!x.hotel_code||x.hotel_code===HSEL}).slice(0,100);
  var op={INSERT:'إضافة',UPDATE:'تعديل',DELETE:'حذف'};
  root.innerHTML='<h2 style="margin-top:0">سجل العمليات والتغييرات</h2><p style="color:var(--mut)">سجل تلقائي لتغييرات الأصناف والأسعار والمخزون والموردين وطلبات الشراء. السجل للقراءة فقط.</p><div class="wrap"><table><tr><th>التاريخ</th><th>الفندق</th><th>العملية</th><th>الجدول</th><th>المعرّف</th><th>المستخدم</th><th>التفاصيل</th></tr>'+
    (rows.map(function(x){var snap=x.new_data||x.old_data||{};var summary=Object.keys(snap).filter(function(k){return ['name','ar','en','quantity','reorder_level','cost','status','order_no','movement_type'].includes(k)}).map(function(k){return k+': '+snap[k]}).join(' · ');return '<tr><td>'+new Date(x.created_at).toLocaleString('ar-LY')+'</td><td>'+esc((HOTELS.find(function(h){return h.code===x.hotel_code})||{}).name||x.hotel_code||'—')+'</td><td>'+esc(op[x.operation]||x.operation)+'</td><td>'+esc(x.table_name)+'</td><td dir="ltr">'+esc(x.entity_id||'—')+'</td><td>'+esc(x.actor_email||'—')+'</td><td>'+esc(summary||'—')+'</td></tr>'}).join('')||'<tr><td colspan="7">لا توجد عمليات مسجلة بعد</td></tr>')+'</table></div>';
}
function openPurchaseLine(orderId,lineId){
  var o=PURCHASES.find(function(x){return x.id===orderId}),existing=lineId&&PURCHASE_LINES.find(function(x){return x.id===lineId});if(!o||o.status!=='draft')return;
  var options=ITEMS.filter(function(it){return !it.hotels||!it.hotels.length||it.hotels.includes(o.hotel_code)}).map(function(it){return '<option value="'+it.id+'" '+(existing&&existing.item_id===it.id?'selected':'')+'>'+esc(it.ar)+' — '+esc(it.en||'')+'</option>'}).join('');
  $('#mb').innerHTML='<h3>'+(existing?'تعديل صنف في ':'إضافة صنف إلى ')+esc(o.order_no)+'</h3><label>الصنف <select id="poItemSelect" style="width:100%">'+options+'</select></label><div class="row" style="margin-top:10px"><label>الكمية <input id="poQty" type="number" min="0.001" step="0.001" value="'+(existing?existing.quantity:1)+'"></label><label>الوحدة <input id="poUnit" value="'+esc(existing&&existing.unit||'قطعة')+'" style="width:100px"></label><label>سعر الوحدة <input id="poCost" type="number" min="0" step="0.0001" value="'+(existing?existing.unit_cost:0)+'"></label></div><div class="row"><button class="btn" id="poLineSave">حفظ الصنف</button><button class="btn alt" id="poLineClose">إغلاق</button></div>';
  $('#modal').hidden=false;
  var fill=function(){var id=+$('#poItemSelect').value,link=LINKS.find(function(x){return x.item_id===id&&x.price_id}),p=link&&PRICES.find(function(x){return x.id===link.price_id&&!x.archived});if(p){$('#poUnit').value=p.unit||'قطعة';$('#poCost').value=p.cost||0}};
  $('#poItemSelect').onchange=fill;if(!existing)fill();
  $('#poLineClose').onclick=function(){$('#modal').hidden=true};
  $('#poLineSave').onclick=async function(){
    var id=+$('#poItemSelect').value,qty=Number($('#poQty').value),unit=$('#poUnit').value.trim(),cost=Number($('#poCost').value);
    if(!id||!Number.isFinite(qty)||qty<=0||!unit||!Number.isFinite(cost)||cost<0)return alert('تحقق من الصنف والكمية والوحدة والسعر');
    try{if(existing)await api('hotel_purchase_order_items?id=eq.'+encodeURIComponent(existing.id),{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({item_id:id,quantity:qty,unit:unit,unit_cost:cost})});else await api('hotel_purchase_order_items',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({purchase_order_id:orderId,item_id:id,quantity:qty,unit:unit,unit_cost:cost})});$('#modal').hidden=true;await loadProcurementData();drawProcurement()}
    catch(e){alert('تعذّر إضافة الصنف: '+e.message)}
  };
}
document.querySelector('#p').addEventListener('click',async function(e){
  var b=e.target.closest('button');if(!b)return;
  try{
    if(b.dataset.spToggle){var sp=SUPPLIERS.find(function(x){return x.id===b.dataset.spToggle});if(!sp)return;await api('hotel_suppliers?id=eq.'+encodeURIComponent(sp.id),{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({active:!sp.active,updated_at:new Date().toISOString()})});await loadProcurementData();drawProcurement();return;}
    if(b.id==='spAdd'){
      var hotel=$('#poHotel').value,name=$('#spName').value.trim();if(!hotel||name.length<2)return alert('اختر الفندق واكتب اسم المورد');
      await api('hotel_suppliers',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({hotel_code:hotel,name:name,contact:$('#spContact').value.trim(),phone:$('#spPhone').value.trim(),email:$('#spEmail').value.trim(),notes:$('#spNotes').value.trim()})});
      await loadProcurementData();drawProcurement();return;
    }
    if(b.id==='poCreate'){
      var hotel=$('#poHotel').value,sid=$('#poSupplier').value;if(!hotel||!sid)return alert('اختر الفندق والمورد');
      var sup=SUPPLIERS.find(function(x){return x.id===sid&&x.hotel_code===hotel});if(!sup)return alert('المورد لا يتبع الفندق المختار');
      await api('hotel_purchase_orders',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({hotel_code:hotel,supplier_id:sid,notes:$('#poNotes').value.trim()})});
      await loadProcurementData();drawProcurement();return;
    }
    if(b.id==='poCreateFromLow'){
      var hotel=$('#poHotel').value,sid=$('#poSupplier').value;
      if(!hotel||!sid)return alert('اختر الفندق والمورد أولاً');
      var sup=SUPPLIERS.find(function(x){return x.id===sid&&x.hotel_code===hotel});if(!sup)return alert('المورد لا يتبع الفندق المختار');
      var low=INVENTORY.filter(function(x){return x.hotel_code===hotel&&+x.reorder_level>0&&+x.quantity<=+x.reorder_level});
      if(!low.length)return alert('لا توجد أصناف تحت حد إعادة الطلب لهذا الفندق');
      var created=await api('hotel_purchase_orders',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({hotel_code:hotel,supplier_id:sid,notes:'مسودة مقترحة تلقائياً من تنبيهات المخزون — راجع الكميات والأسعار قبل الاعتماد'})});
      var order=created&&created[0];if(!order)throw new Error('تعذّر إنشاء مسودة الشراء');
      var lines=low.map(function(x){
        var link=LINKS.find(function(l){return l.item_id===x.item_id&&l.price_id}),price=link&&PRICES.find(function(p){return p.id===link.price_id&&!p.archived});
        var target=+x.reorder_level*2,qty=Math.max(0,target-(+x.quantity||0));
        return {purchase_order_id:order.id,item_id:x.item_id,quantity:qty,unit:x.unit||(price&&price.unit)||'قطعة',unit_cost:price?+price.cost:0,note:price?'سعر من قائمة الأسعار الحالية':'بانتظار إدخال السعر'};
      }).filter(function(x){return x.quantity>0});
      if(lines.length)await api('hotel_purchase_order_items',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify(lines)});
      await loadProcurementData();PO_OPEN=order.id;drawProcurement();return;
    }
    if(b.dataset.poView){PO_OPEN=PO_OPEN===b.dataset.poView?'':b.dataset.poView;drawProcurement();return}
    if(b.dataset.poLine){openPurchaseLine(b.dataset.poLine);return}
    if(b.dataset.poLineEdit){var line=PURCHASE_LINES.find(function(x){return x.id===b.dataset.poLineEdit});if(line)openPurchaseLine(line.purchase_order_id,line.id);return}
    if(b.dataset.poLineDel){if(!confirm('حذف هذا الصنف من مسودة الشراء؟'))return;await api('hotel_purchase_order_items?id=eq.'+encodeURIComponent(b.dataset.poLineDel),{method:'DELETE',headers:{Prefer:'return=minimal'}});await loadProcurementData();drawProcurement();return}
    if(b.dataset.poOrder){
      var id=b.dataset.poOrder,lines=PURCHASE_LINES.filter(function(x){return x.purchase_order_id===id});if(!lines.length)return alert('أضف صنفاً واحداً على الأقل');
      await api('hotel_purchase_orders?id=eq.'+encodeURIComponent(id),{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status:'ordered',ordered_at:new Date().toISOString(),updated_at:new Date().toISOString()})});
      await loadProcurementData();drawProcurement();return;
    }
    if(b.dataset.poReceive){
      if(!confirm('تأكيد استلام الطلب بالكامل وإضافة الكميات تلقائياً إلى مخزون هذا الفندق؟'))return;
      await api('rpc/receive_hotel_purchase_order',{method:'POST',body:JSON.stringify({p_order_id:b.dataset.poReceive})});
      await loadProcurementData();await refreshInventory();drawProcurement();drawAudit();return;
    }
    if(b.dataset.poCancel){
      if(!confirm('إلغاء طلب الشراء؟ لن يتم إضافة أي كمية للمخزون.'))return;
      await api('hotel_purchase_orders?id=eq.'+encodeURIComponent(b.dataset.poCancel),{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status:'cancelled',updated_at:new Date().toISOString()})});
      await loadProcurementData();drawProcurement();return;
    }
  }catch(err){alert('تعذّر تنفيذ العملية: '+err.message)}
});
document.querySelector('#p').addEventListener('change',function(e){
  if(e.target.id==='poHotel'){PO_HOTEL=e.target.value;drawProcurement()}
});
