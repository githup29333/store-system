/* Analytics center: hotel/date scoped reporting from completed, sent orders. */
var AN_RANGE = {from:'', to:'', dept:''};
function anISO(ds){return /^\d{6}$/.test(String(ds||''))?'20'+ds.slice(0,2)+'-'+ds.slice(2,4)+'-'+ds.slice(4):''}
function anDefaultRange(){
  if(!AN_RANGE.from||!AN_RANGE.to){
    var end=new Date(),start=new Date();start.setDate(start.getDate()-29);
    AN_RANGE.from=fmtD(start);AN_RANGE.to=fmtD(end);
  }
}
function analyticsData(){
  anDefaultRange();
  var rows=DV().filter(function(d){
    if(d.status!=='sent'||d.dept==='ALL'||String(d.code||'').startsWith('BATCH|'))return false;
    var day=anISO(d.ds);
    return day&&day>=AN_RANGE.from&&day<=AN_RANGE.to&&(!AN_RANGE.dept||d.dn===AN_RANGE.dept);
  });
  var total=0,missing=0,quantity=0,byDept={},byItem={},byDay={},byDeptDay={},byDeptItems={},missingItems={},details=[];
  rows.forEach(function(d){
    var ord=ordH(d),cost=orderCostDetail(ord),day=anISO(d.ds);
    total+=cost.total;missing+=cost.missing;
    byDept[d.dn]=(byDept[d.dn]||0)+cost.total;
    byDay[day]=(byDay[day]||0)+cost.total;
    byDeptDay[d.dn]=byDeptDay[d.dn]||{};byDeptDay[d.dn][day]=(byDeptDay[d.dn][day]||0)+cost.total;
    byDeptItems[d.dn]=byDeptItems[d.dn]||{};
    linesOf(ord).forEach(function(x){
      quantity+=x.iss;
      var n=itemOfD(ord,x.id),p=resolvePrice(x.id,n.n,x.unit,ord.hotelCode)||resolvePrice(x.id,n.u,x.unit,ord.hotelCode);
      var k=String(x.id),it=byItem[k]||(byItem[k]={name:n.n,unit:x.unit||n.u||'—',qty:0,cost:0,missing:0});
      var di=byDeptItems[d.dn][k]||(byDeptItems[d.dn][k]={name:n.n,unit:x.unit||n.u||'—',requested:0,issued:0,cost:0,missing:0,orders:0});di.requested+=(+x.req||+x.iss||0);di.issued+=(+x.iss||0);di.orders++;
      it.qty+=x.iss;
      if(p){var lineCost=x.iss*(+p.cost||0);it.cost+=lineCost;di.cost+=lineCost}else{it.missing++;di.missing++;missingItems[k]=missingItems[k]||{name:n.n,qty:0,count:0};missingItems[k].qty+=x.iss;missingItems[k].count++;}
    });
    details.push({hotel:d.hotel||'',date:day,order:d.no,department:d.dn,total:cost.total,missing:cost.missing,quantity:linesOf(ord).reduce(function(a,x){return a+x.iss},0)});
  });
  return {rows:rows,total:total,missing:missing,quantity:quantity,byDept:byDept,byItem:byItem,byDay:byDay,byDeptDay:byDeptDay,byDeptItems:byDeptItems,missingItems:missingItems,details:details};
}
function drawAnalytics(){
  var root=document.querySelector('#a');if(!root)return;
  anDefaultRange();
  var d=analyticsData(),depts=[...new Set(DV().filter(function(x){return x.status==='sent'&&x.dept!=='ALL'}).map(function(x){return x.dn}))].sort();
  var opts='<option value="">كل الأقسام</option>'+depts.map(function(x){return '<option value="'+esc(x)+'" '+(AN_RANGE.dept===x?'selected':'')+'>'+esc(x)+'</option>'}).join('');

  var itemRows=Object.values(d.byItem).sort(function(a,b){return b.cost-a.cost}).slice(0,15);
  var deptRows=Object.entries(d.byDept).sort(function(a,b){return b[1]-a[1]});
  var startDate=new Date(AN_RANGE.from+'T12:00:00'),endDate=new Date(AN_RANGE.to+'T12:00:00');
  var periodDays=Math.max(1,Math.round((endDate-startDate)/86400000)+1);
  var prevEnd=new Date(startDate);prevEnd.setDate(prevEnd.getDate()-1);
  var prevStart=new Date(prevEnd);prevStart.setDate(prevStart.getDate()-periodDays+1);
  var prevFrom=fmtD(prevStart),prevTo=fmtD(prevEnd),prevRows=DV().filter(function(x){
    if(x.status!=='sent'||x.dept==='ALL'||String(x.code||'').startsWith('BATCH|'))return false;
    var day=anISO(x.ds);return day&&day>=prevFrom&&day<=prevTo&&(!AN_RANGE.dept||x.dn===AN_RANGE.dept);
  });
  var prevTotal=0,prevMissing=0;
  prevRows.forEach(function(x){var c=orderCostDetail(ordH(x));prevTotal+=c.total;prevMissing+=c.missing});
  var changeText=prevRows.length?(prevTotal>0?((d.total-prevTotal)>=0?'زيادة ':'انخفاض ')+Math.abs((d.total-prevTotal)/prevTotal*100).toFixed(1)+'% عن الفترة السابقة':'لا يمكن حساب نسبة التغير لأن تكلفة الفترة السابقة صفر'):'لا توجد بيانات في الفترة السابقة للمقارنة';
  var dailyValues=Object.values(d.byDay),dailyAvg=dailyValues.length?dailyValues.reduce(function(a,b){return a+b},0)/dailyValues.length:0;
  var highestDay=Object.entries(d.byDay).sort(function(a,b){return b[1]-a[1]})[0];
  var highDays=dailyValues.filter(function(v){return dailyAvg>0&&v>=dailyAvg*1.5}).length;
  var estimatedLines=0,totalLines=0;
  d.rows.forEach(function(x){var c=orderCostDetail(ordH(x));c.lines.forEach(function(line){totalLines++;if(line.estimated)estimatedLines++})});
  var missingRate=totalLines?d.missing/totalLines*100:0;
  var topDept=deptRows[0],topItem=itemRows[0];
  var insightHtml='<div style="border:1px solid var(--ln);border-radius:14px;padding:14px;margin:14px 0"><h3 style="margin-top:0">مؤشرات ذكية للفترة المحددة</h3>'+
    '<div class="grid"><div class="kpi"><b>'+esc(changeText)+'</b>مقارنة التكلفة بالفترة السابقة ('+prevFrom+' إلى '+prevTo+')</div>'+
    '<div class="kpi"><b>'+money(dailyAvg)+' د.ل</b>متوسط تكلفة يوم الصرف المسجل</div>'+
    '<div class="kpi"><b>'+(highestDay?money(highestDay[1])+' د.ل':'—')+'</b>أعلى يوم تكلفة '+(highestDay?esc(highestDay[0]):'')+'</div>'+
    '<div class="kpi"><b>'+highDays+'</b>أيام تجاوزت 150% من المتوسط</div></div>'+
    '<p><b>أعلى قسم تكلفة:</b> '+(topDept?esc(topDept[0])+' — '+money(topDept[1])+' د.ل':'لا توجد بيانات')+'</p>'+
    '<p><b>أعلى صنف تكلفة:</b> '+(topItem?esc(topItem.name)+' — '+money(topItem.cost)+' د.ل':'لا توجد بيانات')+'</p>'+
    '<p><b>تغطية التسعير:</b> '+d.missing+' سطر بلا سعر من '+totalLines+' ('+missingRate.toFixed(1)+'%).'+
    (estimatedLines?' يوجد '+estimatedLines+' سطرًا احتُسب بسعر تقديري ويحتاج مراجعة.':'')+'</p>'+
    '<p style="color:var(--mut);font-size:12px;margin-bottom:0">المقارنة تستخدم عدد أيام مساوياً للفترة المختارة، مع نفس الفندق والقسم. المؤشرات وصفية وليست تنبؤاً، والتكلفة محسوبة بالأسعار الحالية.</p></div>';

  var dayRows=Object.entries(d.byDay).sort(function(a,b){return a[0].localeCompare(b[0])}).slice(-14).map(function(x){return [x[0],x[1]]});
  var deptItemHtml=Object.keys(d.byDeptItems).sort().map(function(dep){
    var entries=Object.values(d.byDeptItems[dep]).sort(function(x,y){return y.cost-x.cost});
    return '<h4>'+esc(dep)+'</h4><div class="wrap"><table><tr><th>الصنف</th><th>الكمية المطلوبة</th><th>الكمية المصروفة</th><th>الوحدة</th><th>التكلفة د.ل</th><th>أسطر بلا سعر</th></tr>'+
      (entries.map(function(x){return '<tr><td>'+esc(x.name)+'</td><td>'+x.requested.toLocaleString('en-US')+'</td><td>'+x.issued.toLocaleString('en-US')+'</td><td>'+esc(x.unit)+'</td><td>'+money(x.cost)+'</td><td>'+x.missing+'</td></tr>'}).join('')||'<tr><td colspan="6">لا توجد بيانات</td></tr>')+'</table></div>';
  }).join('')||'<p>لا توجد بيانات</p>';
  var dailyDeptRows=[];
  Object.keys(d.byDeptDay).forEach(function(dep){Object.keys(d.byDeptDay[dep]).forEach(function(day){dailyDeptRows.push({dep:dep,day:day,cost:d.byDeptDay[dep][day]})})});
  var dailyDeptHtml='<div class="wrap"><table><tr><th>التاريخ</th><th>القسم</th><th>التكلفة اليومية د.ل</th></tr>'+
    (dailyDeptRows.sort(function(x,y){return y.day.localeCompare(x.day)||x.dep.localeCompare(y.dep)}).map(function(x){return '<tr><td>'+x.day+'</td><td>'+esc(x.dep)+'</td><td>'+money(x.cost)+'</td></tr>'}).join('')||'<tr><td colspan="3">لا توجد بيانات</td></tr>')+'</table></div>';
  var shortageRows=Object.values(d.missingItems).sort(function(x,y){return y.count-x.count});
  var shortageHtml='<div class="wrap"><table><tr><th>الصنف</th><th>الكمية المصروفة بلا سعر</th><th>عدد الأسطر</th></tr>'+
    (shortageRows.map(function(x){return '<tr><td>'+esc(x.name)+'</td><td>'+x.qty+'</td><td>'+x.count+'</td></tr>'}).join('')||'<tr><td colspan="3">لا توجد أصناف بلا سعر</td></tr>')+'</table></div>';

  root.innerHTML='<div class="row"><div style="flex:1"><h2 style="margin:0">مركز التحليلات والتقارير</h2><small style="color:var(--mut)">تحليل الطلبات المكتملة والمرسلة فقط — الأسعار الحالية</small></div><button class="btn" id="anExport">تصدير Excel</button></div>'+
    '<div class="row"><label>من <input type="date" id="anFrom" value="'+AN_RANGE.from+'"></label><label>إلى <input type="date" id="anTo" value="'+AN_RANGE.to+'"></label><select id="anDept">'+opts+'</select><button class="btn alt" id="anApply">تطبيق</button><button class="btn alt" id="anReset">آخر 30 يوماً</button></div>'+
    insightHtml+'<div class="grid"><div class="kpi"><b>'+d.rows.length+'</b>طلبات مرسلة</div><div class="kpi"><b>'+money(d.total)+' د.ل</b>إجمالي التكلفة</div><div class="kpi"><b>'+d.quantity.toLocaleString('en-US')+'</b>كمية الأصناف المصروفة</div><div class="kpi"><b>'+d.missing+'</b>أسطر بلا سعر</div></div>'+
    '<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(280px,1fr))"><div><h3>التكلفة حسب القسم</h3>'+bars(deptRows)+'</div><div><h3>التكلفة اليومية — آخر 14 يوماً</h3>'+bars(dayRows)+'</div></div>'+
    '<h3>أعلى 15 صنفاً حسب التكلفة</h3><div class="wrap"><table><tr><th>الصنف</th><th>الكمية</th><th>الوحدة</th><th>التكلفة</th><th>أسطر بلا سعر</th></tr>'+
    (itemRows.map(function(x){return '<tr><td>'+esc(x.name)+'</td><td>'+x.qty.toLocaleString('en-US')+'</td><td>'+esc(x.unit)+'</td><td>'+money(x.cost)+' د.ل</td><td>'+(x.missing||0)+'</td></tr>'}).join('')||'<tr><td colspan="5">لا توجد بيانات ضمن الفترة المحددة</td></tr>')+
    '</table></div><h3>تفصيل الأصناف حسب القسم</h3>'+deptItemHtml+'<h3>التكلفة اليومية حسب القسم</h3>'+dailyDeptHtml+'<h3>الأصناف التي لم تُسعّر</h3>'+shortageHtml+'<h3>تفاصيل الطلبات الداخلة في التقرير</h3><div class="wrap"><table><tr><th>الفندق</th><th>التاريخ</th><th>رقم الطلب</th><th>القسم</th><th>التكلفة</th><th>أسطر بلا سعر</th><th>الكمية</th></tr>'+
    (d.details.slice().sort(function(a,b){return b.date.localeCompare(a.date)}).map(function(x){return '<tr><td>'+esc((HOTELS.find(function(h){return h.code===x.hotel})||{}).name||x.hotel)+'</td><td>'+x.date+'</td><td>'+esc(x.order)+'</td><td>'+esc(x.department)+'</td><td>'+money(x.total)+'</td><td>'+x.missing+'</td><td>'+x.quantity+'</td></tr>'}).join('')||'<tr><td colspan="7">لا توجد طلبات</td></tr>')+'</table></div>'+
    '<p style="color:var(--mut)">ملاحظة: يتم احتساب التكلفة بأسعار قائمة الأسعار الحالية، وليست لقطة تاريخية لسعر يوم الصرف. الأصناف بلا سعر تظهر في التقرير ولا تدخل في الإجمالي.</p>';
}
async function exportAnalyticsXlsx(){
  if(typeof ExcelJS!=='function'&&typeof ExcelJS==='undefined')return alert('مكتبة Excel غير متاحة');
  var d=analyticsData(),wb=new ExcelJS.Workbook(),ws=wb.addWorksheet('ملخص التحليل');
  ws.views=[{rightToLeft:true,showGridLines:false}];
  ws.columns=[{width:18},{width:16},{width:20},{width:22},{width:16},{width:16},{width:14}];
  ws.addRow(['الفندق','التاريخ','رقم الطلب','القسم','التكلفة د.ل','أسطر بلا سعر','الكمية']);
  d.details.forEach(function(x){ws.addRow([(HOTELS.find(function(h){return h.code===x.hotel})||{}).name||x.hotel,x.date,x.order,x.department,x.total,x.missing,x.quantity])});
  ws.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};ws.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF173047'}};
  ws.autoFilter='A1:G1';ws.eachRow(function(r){r.eachCell(function(c){c.alignment={vertical:'middle',horizontal:'right'}})});
  var sum=wb.addWorksheet('الأصناف');sum.views=[{rightToLeft:true}];sum.columns=[{width:38},{width:16},{width:14},{width:18},{width:16}];
  sum.addRow(['الصنف','الكمية','الوحدة','التكلفة د.ل','أسطر بلا سعر']);
  Object.values(d.byItem).sort(function(a,b){return b.cost-a.cost}).forEach(function(x){sum.addRow([x.name,x.qty,x.unit,x.cost,x.missing])});
  sum.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};sum.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF173047'}};
  var buf=await wb.xlsx.writeBuffer(),blob=new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download='Store-System-Analytics-'+AN_RANGE.from+'-'+AN_RANGE.to+'.xlsx';a.click();setTimeout(function(){URL.revokeObjectURL(url)},1500);
}
document.querySelector('#a').addEventListener('click',function(e){
  var b=e.target.closest('button');if(!b)return;
  if(b.id==='anApply'){AN_RANGE.from=document.querySelector('#anFrom').value;AN_RANGE.to=document.querySelector('#anTo').value;AN_RANGE.dept=document.querySelector('#anDept').value;if(!AN_RANGE.from||!AN_RANGE.to||AN_RANGE.from>AN_RANGE.to)return alert('تحقق من فترة التاريخ');drawAnalytics()}
  if(b.id==='anReset'){AN_RANGE={from:'',to:'',dept:''};drawAnalytics()}
  if(b.id==='anExport')exportAnalyticsXlsx().catch(function(err){alert('تعذّر التصدير: '+err.message)});
});
