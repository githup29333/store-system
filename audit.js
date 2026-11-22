/* Read-only, hotel-scoped inventory and system activity history. */
var AUDIT_LOG=[], AUDIT_ERR='';
async function loadAuditData(){
  try{
    AUDIT_LOG=await api('admin_audit_log?select=*&order=created_at.desc&limit=150');
    AUDIT_ERR='';
  }catch(e){AUDIT_LOG=[];AUDIT_ERR=e.message||String(e)}
}
function drawAudit(){
  var root=document.querySelector('#g');if(!root)return;
  if(AUDIT_ERR){root.innerHTML='<h2>سجل العمليات</h2><p class="tag t-bad">تعذّر تحميل السجل: '+esc(AUDIT_ERR)+'</p>';return}
  var rows=AUDIT_LOG.filter(function(x){return !HSEL||!x.hotel_code||x.hotel_code===HSEL}).slice(0,100);
  var op={INSERT:'إضافة',UPDATE:'تعديل',DELETE:'حذف'};
  root.innerHTML='<h2 style="margin-top:0">سجل العمليات والتغييرات</h2><p style="color:var(--mut)">سجل تلقائي للقراءة فقط لتغييرات الأصناف والأسعار والمخزون وروابط الأصناف. تظهر السجلات ضمن نطاق الفندق المحدد.</p><div class="wrap"><table><tr><th>التاريخ</th><th>الفندق</th><th>العملية</th><th>الجدول</th><th>المعرّف</th><th>المستخدم</th><th>التفاصيل</th></tr>'+
    (rows.map(function(x){var snap=x.new_data||x.old_data||{};var summary=Object.keys(snap).filter(function(k){return ['name','ar','en','quantity','reorder_level','cost','status','movement_type','unit'].includes(k)}).map(function(k){return k+': '+snap[k]}).join(' · ');return '<tr><td>'+new Date(x.created_at).toLocaleString('ar-LY')+'</td><td>'+esc((HOTELS.find(function(h){return h.code===x.hotel_code})||{}).name||x.hotel_code||'—')+'</td><td>'+esc(op[x.operation]||x.operation)+'</td><td>'+esc(x.table_name)+'</td><td dir="ltr">'+esc(x.entity_id||'—')+'</td><td>'+esc(x.actor_email||'—')+'</td><td>'+esc(summary||'—')+'</td></tr>'}).join('')||'<tr><td colspan="7">لا توجد عمليات مسجلة بعد</td></tr>')+'</table></div>';
}
