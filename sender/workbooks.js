const ExcelJS = require('exceljs');
const sharp = require('sharp');

const money = n => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const clean = s => String(s || '').trim().toLowerCase().replace(/[\s\-–()*×/.,]+/g, '');
const tokens = s => new Set(String(s || '').toLowerCase().replace(/[()*×/.,]/g, ' ').split(/[\s\-–]+/).filter(x => x.length >= 2 && !/^\d+$/.test(x)));

function parseDelivery(d, ctx) {
  const f = String(d.code || '').split('|');
  if (f[0] === 'BATCH') throw new Error('BATCH orders are not eligible for individual automatic dispatch');
  if (f.length < 7 || f[0] !== 'EBR1F') throw new Error('Invalid completed order code');
  const names = {};
  (f[9] || '').split(';').filter(Boolean).forEach(v => {
    const [id, ar, en] = v.split('~');
    names[Number(id)] = { ar: ar || '', en: en || '' };
  });
  const itemsById = new Map((ctx.items || []).map(x => [Number(x.id), x]));
  const lines = (f[6] || '').split(',').filter(Boolean).map(v => {
    const [id0, req0, iss0, unit0] = v.split(':');
    const id = Number(id0), req = Number(req0), issued = Number(iss0);
    const base = itemsById.get(id) || {};
    const custom = names[id] || {};
    return {
      id, req, issued, unit: unit0 || '',
      ar: custom.ar || base.ar || ('صنف #' + id),
      en: custom.en || base.en || ''
    };
  }).filter(x => Number.isFinite(x.id) && x.issued > 0);
  const hotel = (ctx.hotels || []).find(x => x.code === d.hotel);
  return {
    key: d.key, hotel: hotel?.name || d.hotel || 'HOTEL',
    dept: f[7] || f[1], deptCode: f[1], no: f[2], ds: f[3],
    date: '20' + String(f[3]).slice(0, 2) + '-' + String(f[3]).slice(2, 4) + '-' + String(f[3]).slice(4),
    lines
  };
}

function priceFor(line, ctx) {
  const prices = (ctx.prices || []).filter(p => !p.archived && Number(p.cost) > 0);
  const link = (ctx.links || []).find(x => Number(x.item_id) === line.id);
  if (link?.method === 'none') return null;
  if (link?.price_id) {
    const selected = prices.find(p => Number(p.id) === Number(link.price_id));
    if (selected) return selected;
  }
  const n1 = clean(line.ar), n2 = clean(line.en);
  let exact = prices.find(p => clean(p.name) === n1 || (n2 && clean(p.name) === n2));
  if (exact) return exact;
  const wanted = tokens(line.ar + ' ' + line.en);
  let best = null, bestScore = 0;
  for (const p of prices) {
    const have = tokens(p.name);
    if (!wanted.size || !have.size) continue;
    const overlap = [...wanted].filter(x => have.has(x)).length;
    const score = overlap / Math.max(wanted.size, have.size);
    if (score > bestScore) { best = p; bestScore = score; }
  }
  return bestScore >= 0.55 ? best : null;
}

const CATS = ['منتجات جافة','حليب وأجبان','مشروبات','منظفات','مستلزمات','خضروات وفواكه','أخرى'];
const CATCOL = {'منتجات جافة':'0B5C7A','حليب وأجبان':'1D7A4F','مشروبات':'B4531A','منظفات':'5D6B78','مستلزمات':'A479E2','خضروات وفواكه':'7CB342','أخرى':'9AA7B2'};
const COLORS = {navy:'101827',gold:'C6A15B',pale:'E9DFC9',ink:'202938',muted:'697586',line:'D7D0C3',green:'287A61',amber:'A87524',red:'A94343',white:'FFFFFF'};
function donutSvg(byCat, size=600) {
  const cx=size/2,cy=size/2,R=size*.42,r=size*.23,total=Object.values(byCat).reduce((a,b)=>a+b,0);
  const xy=(a,rad)=>{const t=(a-90)*Math.PI/180;return [cx+rad*Math.cos(t),cy+rad*Math.sin(t)];};
  let acc=0,paths='';
  if(total) Object.entries(byCat).sort((a,b)=>b[1]-a[1]).forEach(([cat,val])=>{
    const a0=acc/total*360;acc+=val;const a1=acc/total*360,large=a1-a0>180?1:0;
    const [x0,y0]=xy(a0,R),[x1,y1]=xy(a1,R),col=CATCOL[cat]||'9AA7B2';
    paths+=`<path d="M${cx},${cy} L${x0},${y0} A${R},${R} 0 ${large} 1 ${x1},${y1} Z" fill="#${col}"/>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="100%" height="100%" fill="#fff"/>${paths}<circle cx="${cx}" cy="${cy}" r="${r}" fill="#fff"/></svg>`;
}
function barsSvg(byCat, width=1000) {
  const entries=Object.entries(byCat).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]);
  const height=Math.max(190,entries.length*48+48),max=Math.max(1,...entries.map(x=>x[1])),total=entries.reduce((a,x)=>a+x[1],0)||1;
  const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  let body='';
  entries.forEach(([cat,val],i)=>{
    const y=34+i*48,w=Math.max(2,(width-300)*val/max),pct=Math.round(val/total*100),col=CATCOL[cat]||'9AA7B2';
    body+=`<text x="${width-12}" y="${y+16}" text-anchor="end" font-family="Tahoma,Arial" font-size="19" fill="#202938">${esc(cat)}</text><rect x="18" y="${y+23}" width="${width-320}" height="13" rx="6" fill="#edf1f4"/><rect x="18" y="${y+23}" width="${w}" height="13" rx="6" fill="#${col}"/><text x="18" y="${y+13}" font-family="Tahoma,Arial" font-size="15" fill="#697586">${money(val)} د.ل · ${pct}%</text>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#fff"/><text x="${width-12}" y="22" text-anchor="end" font-family="Tahoma,Arial" font-size="17" font-weight="bold" fill="#0B5C7A">قيمة التكلفة حسب الفئة / Cost by category</text>${body}</svg>`;
}


function style(cell, opts = {}) {
  const c = COLORS;
  cell.font = { name:'Tahoma', size:opts.size || 10, bold:!!opts.bold, color:{argb:'FF' + (opts.color || c.ink)} };
  cell.alignment = { horizontal:opts.align || 'center', vertical:'middle', wrapText:true };
  if (opts.bg) cell.fill = { type:'pattern', pattern:'solid', fgColor:{argb:'FF' + opts.bg} };
  if (opts.border) cell.border = Object.fromEntries(['top','bottom','left','right'].map(k => [k,{style:'thin',color:{argb:'FF' + c.line}}]));
  if (opts.numFmt) cell.numFmt = opts.numFmt;
  return cell;
}
function merge(ws, range, value, opts={}) {
  ws.mergeCells(range);
  style(ws.getCell(range.split(':')[0]),opts).value = value;
}
function setup(ws) {
  ws.views = [{rightToLeft:true,showGridLines:false}];
  ws.properties.defaultRowHeight = 22;
  ws.pageSetup = {paperSize:9,orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0,horizontalCentered:true,margins:{left:.25,right:.25,top:.45,bottom:.45,header:.2,footer:.2}};
  ws.headerFooter = {oddFooter:'&Rتقرير داخلي / INTERNAL MANAGEMENT REPORT | Page &P of &N'};
}

async function makeIssue(order) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Store System'; wb.subject = 'Bilingual issue note'; wb.title = 'Issue ' + order.no;
  const ws = wb.addWorksheet('Issue', {views:[{rightToLeft:true,showGridLines:false}]});
  ws.columns = [{width:7},{width:32},{width:30},{width:16},{width:16},{width:25}];
  const put = (cell, value, o={}) => { style(ws.getCell(cell),o).value = value; };
  ws.mergeCells('A1:F1'); put('A1',order.hotel,{b:1,bold:true,size:18,color:'FFFFFF',bg:'0B2638',border:1});
  ws.getRow(1).height = 38;
  ws.mergeCells('A2:F2'); put('A2','إذن صرف / ISSUE NOTE',{b:1,bold:true,size:14,color:'FFFFFF',bg:'0B5C7A',border:1});
  ws.getRow(2).height = 30;
  ws.mergeCells('A3:C3'); put('A3','القسم / Department: ' + order.dept,{b:1,bg:'EAF0F4',border:1});
  ws.mergeCells('D3:F3'); put('D3','رقم الطلب / Order: ' + order.no,{b:1,bg:'EAF0F4',border:1});
  ws.mergeCells('A4:F4'); put('A4','التاريخ / Date: ' + order.date,{bg:'F4F7F9',border:1});
  ['#','الصنف بالعربية / Arabic item','ITEM NAME / English','المطلوب / Requested','المصروف / Issued','ملاحظات / Remarks'].forEach((v,i)=>put('ABCDEF'[i]+'6',v,{bold:true,color:'FFFFFF',bg:'0B5C7A',border:true}));
  ws.getRow(6).height = 34;
  order.lines.forEach((x,i)=>{
    const r=7+i, bg=i%2?'FFF4F8FA':'FFFFFFFF';
    [i+1,x.ar,x.en,x.req,x.issued,x.issued<x.req?'ناقص / Short':''].forEach((v,j)=>put('ABCDEF'[j]+r,v,{bg,border:true,bold:j===4,color:j===5&&v?'FFB4531A':undefined}));
    ws.getRow(r).height=26;
  });
  const end=7+order.lines.length;
  ws.mergeCells('A'+end+':F'+end); put('A'+end,'إجمالي الأصناف المصروفة / Total issued lines: '+order.lines.length,{bold:true,bg:'E4EEF3',border:true});
  ws.getRow(end).height=25;
  ws.mergeCells('A'+(end+2)+':C'+(end+2)); put('A'+(end+2),'مقدّم الطلب / Requested by\nالتوقيع / Signature: ____________',{border:true,align:'right'});
  ws.mergeCells('D'+(end+2)+':F'+(end+2)); put('D'+(end+2),'أمين المخزن / Storekeeper\nالتوقيع / Signature: ____________',{border:true,align:'right'});
  ws.getRow(end+2).height=58;
  ws.mergeCells('A'+(end+3)+':F'+(end+3)); put('A'+(end+3),'الأصناف غير المصروفة غير مدرجة / Unissued items are excluded',{size:9,color:'697586'});
  return wb.xlsx.writeBuffer();
}

async function makeCost(order, ctx) {
  const lines = order.lines.map(x => {
    const p = priceFor(x,ctx);
    return {...x,price:p ? Number(p.cost) : null,category:p?.category || 'غير مصنّف',priceUnit:p?.unit || x.unit || '—',estimated:!!p?.estimated};
  });
  const priced = lines.filter(x=>x.price!==null);
  const total = priced.reduce((s,x)=>s+x.issued*x.price,0);
  const missing = lines.length-priced.length;
  const byCat = {};
  priced.forEach(x=>byCat[x.category]=(byCat[x.category]||0)+x.issued*x.price);
  const cats = Object.entries(byCat).sort((a,b)=>b[1]-a[1]);
  const wb = new ExcelJS.Workbook();
  wb.creator='Store System'; wb.subject='Premium bilingual per-order cost report'; wb.title='Premium Order Cost Dashboard';
  wb.created=new Date(); wb.modified=new Date();
  const sum=wb.addWorksheet('ملخص الإدارة - EXECUTIVE'); setup(sum);
  sum.columns=[{width:5},{width:20},{width:20},{width:4},{width:20},{width:20},{width:4},{width:20},{width:20},{width:5}];
  merge(sum,'A1:J1',order.hotel,{size:20,bold:true,color:COLORS.white,bg:COLORS.navy});
  sum.getRow(1).height=42;
  merge(sum,'A2:J2','لوحة تكلفة الصرف | ORDER COST DASHBOARD',{size:13,bold:true,color:COLORS.gold,bg:COLORS.pale});
  sum.getRow(2).height=30;
  merge(sum,'A4:C4','القسم / DEPARTMENT',{size:9,bold:true,color:COLORS.muted,bg:'F3F6F8',border:true});
  merge(sum,'D4:F4','رقم الطلب / ORDER NO.',{size:9,bold:true,color:COLORS.muted,bg:'F3F6F8',border:true});
  merge(sum,'G4:J4','التاريخ / DATE',{size:9,bold:true,color:COLORS.muted,bg:'F3F6F8',border:true});
  merge(sum,'A5:C5',order.dept,{size:12,bold:true,color:COLORS.navy,bg:COLORS.white,border:true});
  merge(sum,'D5:F5',order.no,{size:12,bold:true,color:COLORS.navy,bg:COLORS.white,border:true});
  merge(sum,'G5:J5',order.date,{size:12,bold:true,color:COLORS.navy,bg:COLORS.white,border:true});
  const card=(label,value,range,bg,color)=>{sum.mergeCells(range);const c=sum.getCell(range.split(':')[0]);c.value=label+'\n'+value;style(c,{size:13,bold:true,color,bg,border:true});};
  card('إجمالي التكلفة المسعّرة | PRICED TOTAL',money(total)+' د.ل','A7:C9',COLORS.pale,COLORS.navy);
  card('أصناف تم تسعيرها | PRICED ITEMS',String(priced.length),'D7:F9','EFF7F3',COLORS.green);
  card('أصناف بانتظار السعر | PENDING PRICE',String(missing),'G7:J9','FFF5E8',COLORS.amber);
  [7,8,9].forEach(r=>sum.getRow(r).height=24);
  merge(sum,'A11:J11','تحليل توزيع التكلفة حسب الفئة | COST BREAKDOWN',{size:12,bold:true,color:COLORS.white,bg:COLORS.gold});
  sum.getRow(11).height=27;
  if(cats.length){
    const donut=await sharp(Buffer.from(donutSvg(byCat,600))).png().toBuffer();
    const bar=await sharp(Buffer.from(barsSvg(byCat,1000))).png().toBuffer();
    sum.addImage(wb.addImage({buffer:donut,extension:'png'}),{tl:{col:0,row:11},ext:{width:270,height:235}});
    sum.addImage(wb.addImage({buffer:bar,extension:'png'}),{tl:{col:4,row:11},ext:{width:520,height:235}});
  }else{
    merge(sum,'A13:J17','لا توجد تكاليف مسعّرة كافية لعرض توزيع الفئات',{size:12,color:COLORS.muted,bg:'F7F9FA'});
  }
  merge(sum,'A25:J25','ملخص الفئات | CATEGORY SUMMARY',{size:11,bold:true,color:COLORS.white,bg:COLORS.navy});
  ['الفئة / CATEGORY','التكلفة / COST','النسبة / SHARE'].forEach((v,i)=>{const cell=sum.getCell(26,i+1);cell.value=v;style(cell,{bold:true,color:COLORS.white,bg:COLORS.gold,border:true});});
  sum.mergeCells('A26:D26');sum.mergeCells('E26:G26');sum.mergeCells('H26:J26');
  [['A26','الفئة / CATEGORY'],['E26','التكلفة / COST'],['H26','النسبة / SHARE']].forEach(([a,v])=>{sum.getCell(a).value=v;style(sum.getCell(a),{bold:true,color:COLORS.white,bg:COLORS.gold,border:true})});
  let cr=27;
  cats.forEach(([cat,val],i)=>{
    sum.mergeCells('A'+cr+':D'+cr);sum.mergeCells('E'+cr+':G'+cr);sum.mergeCells('H'+cr+':J'+cr);
    style(sum.getCell('A'+cr),{align:'right',bg:i%2?'F5F8FA':COLORS.white,border:true}).value=cat;
    style(sum.getCell('E'+cr),{bg:i%2?'F5F8FA':COLORS.white,border:true,numFmt:'#,##0.00'}).value=val;
    style(sum.getCell('H'+cr),{bg:i%2?'F5F8FA':COLORS.white,border:true,numFmt:'0.0%'}).value=total?val/total:0;
    cr++;
  });
  if(!cats.length){sum.mergeCells('A27:J27');style(sum.getCell('A27'),{color:COLORS.muted}).value='لا توجد أصناف مسعّرة';cr=28;}
  sum.mergeCells('A'+cr+':D'+cr);sum.mergeCells('E'+cr+':G'+cr);sum.mergeCells('H'+cr+':J'+cr);
  style(sum.getCell('A'+cr),{bold:true,color:COLORS.white,bg:COLORS.navy,border:true}).value='الإجمالي / TOTAL';
  style(sum.getCell('E'+cr),{bold:true,color:COLORS.white,bg:COLORS.navy,border:true,numFmt:'#,##0.00'}).value=total;
  style(sum.getCell('H'+cr),{bold:true,color:COLORS.white,bg:COLORS.navy,border:true,numFmt:'0.0%'}).value=total?1:0;
  cr+=2;
  if(missing){sum.mergeCells('A'+cr+':J'+(cr+1));style(sum.getCell('A'+cr),{size:10,bold:true,color:COLORS.amber,bg:'FFF5E8',align:'right',border:true}).value='تنبيه تسعير / PRICING ALERT: يوجد '+missing+' صنف بانتظار السعر. تم الإبقاء عليها في التفاصيل، والإجمالي يشمل الأصناف المسعّرة فقط / Missing-price items remain listed; total includes priced items only.';sum.getRow(cr).height=28;sum.getRow(cr+1).height=24;cr+=2;}
  if(lines.some(x=>x.estimated)){sum.mergeCells('A'+cr+':J'+cr);style(sum.getCell('A'+cr),{size:9,color:COLORS.amber,bg:'FFF9EF',align:'right'}).value='* أسعار تقديرية / Estimated prices: القيم المعلّمة بنجمة غير مؤكدة / starred values are unconfirmed.';cr++;}
  merge(sum,'A'+(cr+1)+':J'+(cr+1),'أساس التسعير: قائمة أسعار المخزن وقت إنشاء التقرير / Price basis: current store price list',{size:8,color:COLORS.muted});
  sum.views=[{rightToLeft:true,showGridLines:false}];sum.pageSetup.printArea='A1:J'+(cr+1);
  const det=wb.addWorksheet('تفاصيل الأصناف - DETAILS');setup(det);
  det.columns=[{width:6},{width:30},{width:28},{width:22},{width:13},{width:13},{width:16},{width:18},{width:22}];
  merge(det,'A1:I1',order.hotel,{size:18,bold:true,color:COLORS.white,bg:COLORS.navy});det.getRow(1).height=38;
  merge(det,'A2:I2','تفاصيل تكلفة الطلب | ITEMIZED COST DETAILS',{size:13,bold:true,color:COLORS.gold,bg:COLORS.pale});det.getRow(2).height=28;
  merge(det,'A4:C4','القسم / DEPARTMENT: '+order.dept,{bold:true,bg:'F3F6F8',border:true,align:'right'});
  merge(det,'D4:F4','رقم الطلب / ORDER NO.: '+order.no,{bold:true,bg:'F3F6F8',border:true});
  merge(det,'G4:I4','التاريخ / DATE: '+order.date,{bold:true,bg:'F3F6F8',border:true});
  merge(det,'A6:I6','تفاصيل الأصناف والتكلفة / ITEM & COST DETAILS',{bold:true,color:COLORS.white,bg:COLORS.gold,size:12});det.getRow(6).height=26;
  ['#','الصنف بالعربية','ITEM NAME','الفئة / CATEGORY','الوحدة / UNIT','الكمية / QTY','سعر الوحدة / UNIT PRICE','الإجمالي / LINE TOTAL','حالة التسعير / STATUS'].forEach((v,i)=>style(det.getCell(7,i+1),{bold:true,color:COLORS.white,bg:COLORS.navy,border:true,size:9}).value=v);
  det.getRow(7).height=34;
  lines.forEach((x,i)=>{
    const row=8+i,bg=x.price===null?'FFF1F0':x.estimated?'FFF8E9':i%2?'F5F8FA':COLORS.white;
    const vals=[i+1,x.ar,x.en,x.category,x.priceUnit,x.issued,x.price,x.price===null?null:x.issued*x.price,x.price===null?'بانتظار السعر':x.estimated?'تقديري *':'مسعّر'];
    vals.forEach((v,j)=>style(det.getCell(row,j+1),{bg,border:true,align:j===1?'right':j===2?'left':'center',bold:j===7&&v!==null,color:x.price===null&&j===8?COLORS.red:x.estimated&&j===8?COLORS.amber:COLORS.ink,numFmt:j===6||j===7?'#,##0.00':undefined}).value=v);
    det.getRow(row).height=27;
  });
  const totalRow=8+lines.length;
  det.mergeCells('A'+totalRow+':G'+totalRow);
  style(det.getCell('A'+totalRow),{bold:true,color:COLORS.white,bg:COLORS.navy,align:'right',border:true}).value='الإجمالي المسعّر / PRICED GRAND TOTAL';
  style(det.getCell('H'+totalRow),{bold:true,color:COLORS.white,bg:COLORS.navy,border:true,numFmt:'#,##0.00'}).value=total;
  style(det.getCell('I'+totalRow),{bold:true,color:COLORS.white,bg:COLORS.navy,border:true}).value=missing?'جزئي — توجد أسعار ناقصة':'مكتمل';
  det.autoFilter={from:{row:7,column:1},to:{row:7+Math.max(1,lines.length),column:9}};
  det.views=[{rightToLeft:true,showGridLines:false,state:'frozen',ySplit:7}];
  det.pageSetup.printTitlesRow='7:7';det.pageSetup.printArea='A1:I'+totalRow;
  return wb.xlsx.writeBuffer();
}

async function generateWorkbooks(delivery, ctx) {
  const order = parseDelivery(delivery, ctx);
  if (!order.lines.length) throw new Error('No issued items found; refusing to create empty attachments');
  const [issue, cost] = await Promise.all([makeIssue(order), makeCost(order,ctx)]);
  if (!issue?.byteLength || !cost?.byteLength) throw new Error('Workbook generation returned an empty attachment');
  return {issue:Buffer.from(issue),cost:Buffer.from(cost)};
}

module.exports = { generateWorkbooks, parseDelivery, priceFor };
