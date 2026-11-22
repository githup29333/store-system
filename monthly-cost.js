function renderMonthlyCost(){
 var all=DEL.filter(function(d){return d.status==='sent'&&!d.code.startsWith('BATCH|')});
 var months={};
 all.forEach(function(d){var m='20'+d.ds.slice(0,2)+'-'+d.ds.slice(2,4),h=d.hotel||'—';months[m]=months[m]||{};months[m][h]=(months[m][h]||0)+orderCost(ordH(d)).total});
 var hotels=[...new Set(all.map(function(d){return d.hotel||'—'}))].sort(),ms=Object.keys(months).sort(function(a,b){return b.localeCompare(a)});
 var html='<p>مقارنة شهرية بين الفنادق حسب الطلبات المرسلة. المقارنة تشمل جميع الفنادق.</p><div class="wrap"><table><tr><th>الشهر</th>';
 hotels.forEach(function(h){var hn=HOTELS.find(function(x){return x.code===h});html+='<th>'+esc(hn&&hn.name||h)+'</th>'});html+='<th>الإجمالي</th></tr>';
 ms.forEach(function(m){var total=0;html+='<tr><td><b>'+m+'</b></td>';hotels.forEach(function(h){var v=months[m][h]||0;total+=v;html+='<td>'+money(v)+' د.ل</td>'});html+='<td><b>'+money(total)+' د.ل</b></td></tr>'});
 if(!ms.length)html+='<tr><td colspan="'+(hotels.length+2)+'">لا توجد بيانات مرسلة</td></tr>';
 html+='</table></div><p style="color:var(--mut)">القيم بالأسعار الحالية؛ الأصناف غير المسعّرة مستبعدة.</p>';return html;
}