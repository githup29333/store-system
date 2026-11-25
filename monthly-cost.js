function renderMonthlyCost(){
 var all=DEL.filter(function(d){return d.status==='sent'&&!d.code.startsWith('BATCH|')});
 var months={};
 all.forEach(function(d){var m='20'+d.ds.slice(0,2)+'-'+d.ds.slice(2,4),h=d.hotel||'—';months[m]=months[m]||{};months[m][h]=(months[m][h]||0)+orderCost(ordH(d)).total});
 var hotels=[...new Set(all.map(function(d){return d.hotel||'—'}))].sort(),ms=Object.keys(months).sort(function(a,b){return b.localeCompare(a)});
 var html='<div class="row"><p style="flex:1">مقارنة شهرية حسب الفنادق التي يملك حسابك صلاحية الوصول إليها، بناءً على الطلبات المرسلة.</p><button class="btn alt" id="mcExport">تصدير Excel</button></div><div class="wrap"><table><tr><th>الشهر</th>';
 hotels.forEach(function(h){var hn=HOTELS.find(function(x){return x.code===h});html+='<th>'+esc(hn&&hn.name||h)+'</th>'});html+='<th>الإجمالي</th></tr>';
 ms.forEach(function(m){var total=0;html+='<tr><td><b>'+m+'</b></td>';hotels.forEach(function(h){var v=months[m][h]||0;total+=v;html+='<td>'+money(v)+' د.ل</td>'});html+='<td><b>'+money(total)+' د.ل</b></td></tr>'});
 if(!ms.length)html+='<tr><td colspan="'+(hotels.length+2)+'">لا توجد بيانات مرسلة</td></tr>';
 html+='</table></div><p style="color:var(--mut)">القيم بالأسعار الحالية؛ الأصناف غير المسعّرة مستبعدة.</p>';return html;
}
async function exportMonthlyCostXlsx(){
 var X=await ensureExcelJS();
 var all=DEL.filter(function(d){return d.status==='sent'&&!d.code.startsWith('BATCH|')});
 var months={};
 all.forEach(function(d){
  var month='20'+d.ds.slice(0,2)+'-'+d.ds.slice(2,4),hotel=d.hotel||'—';
  months[month]=months[month]||{};
  months[month][hotel]=(months[month][hotel]||0)+orderCost(ordH(d)).total;
 });
 var hotels=[...new Set(all.map(function(d){return d.hotel||'—'}))].sort();
 var names=hotels.map(function(h){var row=HOTELS.find(function(x){return x.code===h});return row&&row.name||h});
 var list=Object.keys(months).sort(function(a,b){return a.localeCompare(b)});
 var wb=new X.Workbook(),ws=wb.addWorksheet('مقارنة شهرية',{views:[{rightToLeft:true,state:'frozen',ySplit:1}]});
 ws.columns=[{header:'الشهر',key:'month',width:16}].concat(names.map(function(n,i){return {header:n,key:'h'+i,width:22}})).concat([{header:'الإجمالي',key:'total',width:22}]);
 list.forEach(function(month){
  var total=0,row={month:month};
  hotels.forEach(function(h,i){var value=months[month][h]||0;row['h'+i]=value;total+=value});
  row.total=total;ws.addRow(row);
 });
 ws.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};
 ws.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF17384A'}};
 ws.autoFilter={from:'A1',to:ws.getRow(1).getCell(ws.columnCount).address};
 for(var col=2;col<=ws.columnCount;col++)ws.getColumn(col).numFmt='#,##0.00 "د.ل"';
 if(!list.length)ws.addRow({month:'لا توجد بيانات مرسلة'});
 ws.addRow([]);ws.addRow({month:'تاريخ إنشاء التقرير: '+new Date().toLocaleString('ar-LY')});
 ws.addRow({month:'ملاحظة: القيم بالأسعار الحالية، والأصناف غير المسعّرة مستبعدة.'});
 var buf=await wb.xlsx.writeBuffer(),blob=new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
 var url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='Monthly-Cost-Comparison-'+new Date().toISOString().slice(0,10)+'.xlsx';a.click();setTimeout(function(){URL.revokeObjectURL(url)},1200);
}
