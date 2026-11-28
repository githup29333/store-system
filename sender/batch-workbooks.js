const ExcelJS = require('exceljs');
const { parseDelivery, priceFor } = require('./workbooks');

const money = n => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const safeSheet = (s, used) => {
  let base = String(s || 'أخرى').replace(/[\\/*?:\[\]]/g, ' ').trim().slice(0, 25) || 'أخرى';
  let name = base, i = 2;
  while (used.has(name.toLowerCase())) name = (base.slice(0, 27) + ' ' + i++).slice(0, 31);
  used.add(name.toLowerCase());
  return name;
};
const border = {top:{style:'thin',color:{argb:'FFD7D0C3'}},bottom:{style:'thin',color:{argb:'FFD7D0C3'}},left:{style:'thin',color:{argb:'FFD7D0C3'}},right:{style:'thin',color:{argb:'FFD7D0C3'}}};
function put(cell, value, opts={}) {
  cell.value=value;
  cell.font={name:'Tahoma',size:opts.size||10,bold:!!opts.bold,color:{argb:'FF'+(opts.color||'202938')}};
  cell.alignment={horizontal:opts.align||'center',vertical:'middle',wrapText:true};
  if(opts.bg)cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF'+opts.bg}};
  if(opts.border!==false)cell.border=border;
  if(opts.numFmt)cell.numFmt=opts.numFmt;
}
function title(ws, hotel, heading, lastCol) {
  ws.views=[{rightToLeft:true,showGridLines:false}];
  ws.properties.defaultRowHeight=23;
  ws.mergeCells(1,1,1,lastCol);put(ws.getCell(1,1),hotel,{size:17,bold:true,color:'FFFFFF',bg:'101827'});ws.getRow(1).height=36;
  ws.mergeCells(2,1,2,lastCol);put(ws.getCell(2,1),heading,{size:13,bold:true,color:'FFFFFF',bg:'0B5C7A'});ws.getRow(2).height=29;
  ws.autoFilter={from:{row:4,column:1},to:{row:4,column:lastCol}};
  ws.views=[{rightToLeft:true,showGridLines:false,state:'frozen',ySplit:4}];
}
async function generateBatchWorkbooks(deliveries, ctx) {
  if(!deliveries.length)throw new Error('No deliveries to combine');
  const orders=deliveries.map(d=>({raw:d, ...parseDelivery(d,ctx)}));
  const groups=new Map();
  for(const o of orders){const k=o.dept||'أخرى';if(!groups.has(k))groups.set(k,[]);groups.get(k).push(o);}
  const hotel=orders[0].hotel;
  const issueWb=new ExcelJS.Workbook(), costWb=new ExcelJS.Workbook();
  issueWb.creator=costWb.creator='Store System';
  issueWb.subject='Consolidated departmental issue and cost reports';
  const usedIssue=new Set(),usedCost=new Set();
  for(const [dept,list] of groups){
    const ws=issueWb.addWorksheet(safeSheet(dept,usedIssue));
    ws.columns=[{width:7},{width:28},{width:26},{width:18},{width:15},{width:15},{width:14},{width:14}];
    title(ws,hotel,'إذن صرف مجمّع / CONSOLIDATED ISSUE — '+dept,8);
    ['#','الصنف بالعربية','ITEM NAME','رقم الطلب / ORDER','المطلوب','المصروف','الوحدة','التاريخ'].forEach((v,i)=>put(ws.getCell(4,i+1),v,{bold:true,color:'FFFFFF',bg:'C6A15B'}));
    let row=5,n=1;
    for(const o of list)for(const line of o.lines){
      [n++,line.ar,line.en,o.no,line.req,line.issued,line.unit||'—',o.date].forEach((v,i)=>put(ws.getCell(row,i+1),v,{bg:row%2?'F5F8FA':'FFFFFF',bold:i===5}));
      row++;
    }
    ws.autoFilter={from:{row:4,column:1},to:{row:Math.max(4,row-1),column:8}};
    ws.pageSetup={paperSize:9,orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0};
    const cw=costWb.addWorksheet(safeSheet(dept,usedCost));
    cw.columns=[{width:7},{width:28},{width:25},{width:18},{width:14},{width:14},{width:16},{width:17},{width:18},{width:18}];
    title(cw,hotel,'تقرير تكلفة مجمّع / CONSOLIDATED COST — '+dept,10);
    ['#','الصنف بالعربية','ITEM NAME','رقم الطلب','الفئة','الوحدة','المصروف','سعر الوحدة','الإجمالي','حالة التسعير'].forEach((v,i)=>put(cw.getCell(4,i+1),v,{bold:true,color:'FFFFFF',bg:'C6A15B'}));
    let cr=5,idx=1,total=0,missing=0;
    for(const o of list)for(const line of o.lines){
      const p=priceFor(line,ctx,o.hotelCode),unitPrice=p?Number(p.cost):null,amount=unitPrice===null?null:line.issued*unitPrice;
      if(amount===null)missing++;else total+=amount;
      [idx++,line.ar,line.en,o.no,p?.category||'غير مصنّف',p?.unit||line.unit||'—',line.issued,unitPrice,amount,unitPrice===null?'بانتظار السعر':p.estimated?'تقديري':'مسعّر'].forEach((v,i)=>put(cw.getCell(cr,i+1),v,{bg:unitPrice===null?'FFF1F0':cr%2?'F5F8FA':'FFFFFF',numFmt:i===7||i===8?'#,##0.00':undefined}));
      cr++;
    }
    cw.mergeCells(cr,1,cr,8);put(cw.getCell(cr,1),'إجمالي التكلفة المسعّرة / PRICED TOTAL',{bold:true,color:'FFFFFF',bg:'101827',align:'right'});
    put(cw.getCell(cr,9),total,{bold:true,color:'FFFFFF',bg:'101827',numFmt:'#,##0.00'});
    put(cw.getCell(cr,10),missing?'يوجد '+missing+' صنف بانتظار السعر':'مكتمل',{bold:true,color:missing?'A87524':'287A61',bg:'F3F6F8'});
    cw.autoFilter={from:{row:4,column:1},to:{row:Math.max(4,cr-1),column:10}};
    cw.pageSetup={paperSize:9,orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0};
  }
  const [issue,cost]=await Promise.all([issueWb.xlsx.writeBuffer(),costWb.xlsx.writeBuffer()]);
  return {issue:Buffer.from(issue),cost:Buffer.from(cost),departments:[...groups.keys()],orders:orders.length};
}
async function generateReceiptWorkbook(deliveries, ctx, receipts) {
  if(!deliveries.length) throw new Error('No signed receipts to combine');
  const orders=deliveries.map(d=>({raw:d,...parseDelivery(d,ctx)}));
  const wb=new ExcelJS.Workbook();
  wb.creator='Store System';
  wb.subject='Signed departmental receipt confirmations';
  wb.title='Receipt Confirmations';
  const groups=new Map();
  for(const o of orders) {
    const receipt=receipts.get(String(o.no));
    if(!receipt || !receipt.signature_png || !Array.isArray(receipt.items)) throw new Error('Missing signed receipt for order '+o.no);
    const k=o.dept||receipt.department||'أخرى';
    if(!groups.has(k)) groups.set(k,[]);
    groups.get(k).push({...o,receipt});
  }
  const used=new Set();
  for(const [dept,list] of groups) {
    const ws=wb.addWorksheet(safeSheet(dept,used));
    ws.columns=[{width:7},{width:29},{width:27},{width:17},{width:15},{width:15},{width:16},{width:20}];
    title(ws,list[0].hotel,'تأكيدات الاستلام الموقعة / SIGNED RECEIPT CONFIRMATIONS — '+dept,8);
    let row=4;
    for(const o of list) {
      const receipt=o.receipt;
      const byId=new Map(receipt.items.map(x=>[Number(x.id),x]));
      ws.mergeCells(row,1,row,8);
      put(ws.getCell(row,1),'الطلب / ORDER: '+o.no+'    |    المستلم / RECEIVED BY: '+receipt.recipient_name+'    |    الوقت / CONFIRMED: '+new Date(receipt.confirmed_at).toLocaleString('en-GB',{timeZone:'Africa/Tripoli'}),{bold:true,color:'FFFFFF',bg:'0B5C7A',align:'right'});
      ws.getRow(row).height=31; row++;
      ['#','الصنف بالعربية','ITEM NAME','المطلوب / REQUESTED','المصروف / ISSUED','المستلم / RECEIVED','الوحدة / UNIT','القسم / DEPARTMENT'].forEach((v,i)=>put(ws.getCell(row,i+1),v,{bold:true,color:'FFFFFF',bg:'C6A15B'}));
      row++;
      let n=1;
      for(const line of o.lines) {
        const actual=byId.get(Number(line.id));
        if(!actual) throw new Error('Receipt item missing from signed snapshot: '+o.no+'/'+line.id);
        [n++,line.ar,line.en,actual.requested,actual.issued,actual.received,actual.unit||line.unit||'—',o.dept].forEach((v,i)=>put(ws.getCell(row,i+1),v,{bg:row%2?'F5F8FA':'FFFFFF',bold:i===5}));
        row++;
      }
      ws.mergeCells(row,1,row,2);put(ws.getCell(row,1),'اسم المستلم / RECIPIENT',{bold:true,bg:'E9DFC9',align:'right'});
      ws.mergeCells(row,3,row,5);put(ws.getCell(row,3),receipt.recipient_name,{bold:true});
      ws.mergeCells(row,6,row,8);put(ws.getCell(row,6),'تاريخ ووقت الاستلام / RECEIVED AT: '+new Date(receipt.confirmed_at).toLocaleString('en-GB',{timeZone:'Africa/Tripoli'}),{size:9});
      row++;
      ws.mergeCells(row,1,row,2);put(ws.getCell(row,1),'التوقيع / SIGNATURE',{bold:true,bg:'E9DFC9',align:'right'});
      ws.mergeCells(row,3,row+3,5);
      const signatureData=String(receipt.signature_png);
      if(!signatureData.startsWith('data:image/png;base64,') || !/^[A-Za-z0-9+/]+={0,2}$/.test(signatureData.slice('data:image/png;base64,'.length))) throw new Error('Invalid PNG signature for order '+o.no);
      const imageId=wb.addImage({base64:signatureData,extension:'png'});
      ws.addImage(imageId,{tl:{col:2,row:row-1},br:{col:5,row:row+3},editAs:'oneCell'});
      ws.getRow(row).height=23;ws.getRow(row+1).height=23;ws.getRow(row+2).height=23;ws.getRow(row+3).height=23;
      row+=5;
      ws.mergeCells(row,1,row,8);put(ws.getCell(row,1),'— نهاية تأكيد الطلب / END OF RECEIPT '+o.no+' —',{size:9,color:'697586'});
      row+=2;
    }
    ws.pageSetup={paperSize:9,orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0};
  }
  const buffer=await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
module.exports={generateBatchWorkbooks,generateReceiptWorkbook};
