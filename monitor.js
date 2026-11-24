/* Owner-only operations and security monitoring view. */
let MONITOR_DATA = null;
async function loadMonitor(){
 const root=document.querySelector('#m');
 root.innerHTML='<h2 style="margin-top:0">مركز المراقبة</h2><p>جارٍ جلب مؤشرات التشغيل وسجل النشاط من الخادم…</p>';
 const data=await ownerAction('monitor');
 MONITOR_DATA=data;
 drawMonitor();
}
function drawMonitor(){
 const root=document.querySelector('#m');if(!root||!MONITOR_DATA)return;
 const d=MONITOR_DATA,t=d.totals||{},statuses=d.deliveryStatuses||{};
 const activity=(d.recentActivity||[]).map(x=>'<tr><td>'+new Date(x.created_at).toLocaleString('ar-LY')+'</td><td>'+esc(x.actor_username||'—')+'</td><td>'+esc(x.action||'—')+'</td><td>'+esc(x.target_username||'—')+'</td><td><code>'+esc(JSON.stringify(x.details||{}))+'</code></td></tr>').join('');
 const audit=(d.recentAudit||[]).map(x=>'<tr><td>'+new Date(x.created_at).toLocaleString('ar-LY')+'</td><td>'+esc(x.hotel_code||'—')+'</td><td>'+esc(x.actor_email||'—')+'</td><td>'+esc(x.operation||'—')+'</td><td>'+esc(x.table_name||'—')+'</td><td dir="ltr">'+esc(x.entity_id||'—')+'</td></tr>').join('');
 const statusRows=Object.entries(statuses).map(([k,v])=>'<tr><td>'+esc(k)+'</td><td>'+v+'</td></tr>').join('');
 root.innerHTML='<div class="row" style="justify-content:space-between"><div><h2 style="margin:0">مركز المراقبة والأمان</h2><p style="color:var(--mut);margin:4px 0">مؤشرات مباشرة من قاعدة البيانات — عرض للمالك فقط</p></div><button class="btn alt" id="monitorRefresh">تحديث المؤشرات ↻</button></div>'+
 '<div class="grid"><div class="kpi"><b>'+Number(t.ordersLoaded||0)+'</b>طلبات ضمن آخر 500 سجل</div><div class="kpi"><b>'+Number(t.deliveriesLoaded||0)+'</b>عمليات إرسال ضمن آخر 500 سجل</div><div class="kpi"><b>'+Number(t.users||0)+'</b>حسابات المستخدمين</div><div class="kpi"><b>'+Number(t.activeUsers||0)+'</b>حسابات فعّالة</div><div class="kpi"><b style="color:'+(t.failedDeliveries?'var(--bad)':'var(--ok)')+'">'+Number(t.failedDeliveries||0)+'</b>إرسالات فاشلة ضمن العينة</div><div class="kpi"><b>'+Number(t.pendingDeliveries||0)+'</b>إرسالات تنتظر المعالجة</div></div>'+
 '<p class="st">آخر تحديث: '+new Date(d.generatedAt).toLocaleString('ar-LY')+'. الأعداد المعروضة محدودة بآخر 500 سجل للطلبات والإرسال، وليست إجماليًا تاريخيًا.</p>'+
 '<h3>حالة الإرسال</h3><div class="wrap"><table><tr><th>الحالة</th><th>العدد ضمن العينة</th></tr>'+ (statusRows||'<tr><td colspan="2">لا توجد بيانات</td></tr>')+'</table></div>'+
 '<h3>آخر نشاط للمستخدمين</h3><div class="wrap"><table><tr><th>التاريخ</th><th>المنفذ</th><th>العملية</th><th>المستهدف</th><th>التفاصيل</th></tr>'+(activity||'<tr><td colspan="5">لا توجد أنشطة</td></tr>')+'</table></div>'+
 '<h3>آخر تغييرات البيانات</h3><div class="wrap"><table><tr><th>التاريخ</th><th>الفندق</th><th>البريد</th><th>العملية</th><th>الجدول</th><th>المعرّف</th></tr>'+(audit||'<tr><td colspan="6">لا توجد تغييرات مسجلة</td></tr>')+'</table></div>';
 const b=document.querySelector('#monitorRefresh');if(b)b.onclick=()=>loadMonitor().catch(e=>{root.innerHTML+='<p class="tag t-bad">'+esc(e.message)+'</p>'});
}
