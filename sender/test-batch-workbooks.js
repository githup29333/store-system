const assert=require('node:assert/strict');
const ExcelJS=require('exceljs');
const {generateBatchWorkbooks,generateReceiptWorkbook}=require('./batch-workbooks');
(async()=>{
 const base=(key,dept,no,code)=>({key,hotel:'EBR',rev:1,dept,code,no,ds:'261123'});
 const ctx={hotels:[{code:'EBR',name:'Hotel Test'}],items:[{id:1,ar:'أرز',en:'Rice'},{id:2,ar:'حليب',en:'Milk'}],
  prices:[{id:11,name:'Rice',unit:'كيلو',cost:4,category:'منتجات جافة',archived:false}],
  links:[{item_id:1,price_id:11,method:'manual'}]};
 const rows=[
  base('a','Restaurant','R-1','EBR1F|R|R-1|261123|1|hash|1:5:3:كيلو|Restaurant||'),
  base('b','Restaurant','R-2','EBR1F|R|R-2|261123|1|hash|1:2:2:كيلو|Restaurant||'),
  base('c','Housekeeping','H-1','EBR1F|H|H-1|261123|1|hash|2:1:1:قطعة|Housekeeping||')
 ];
 const out=await generateBatchWorkbooks(rows,ctx);
 assert.equal(out.orders,3);
 assert.deepEqual(new Set(out.departments),new Set(['Restaurant','Housekeeping']));
 const issue=new ExcelJS.Workbook();await issue.xlsx.load(out.issue);
 assert.equal(issue.worksheets.length,2);
 const restaurant=issue.worksheets.find(s=>s.name==='Restaurant');
 assert.ok(restaurant);
 assert.equal(restaurant.getCell('D5').value,'R-1');
 assert.equal(restaurant.getCell('D6').value,'R-2');
 const cost=new ExcelJS.Workbook();await cost.xlsx.load(out.cost);
 assert.equal(cost.worksheets.length,2);
 assert.equal(cost.getWorksheet('Restaurant').getCell('I7').value,20);
 const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGP4DwQACfsD/fteaysAAAAASUVORK5CYII=';
 const receipts=new Map([
  ['R-1',{recipient_name:'Chef One',confirmed_at:'2026-11-28T10:30:00Z',items:[{id:1,requested:5,issued:3,received:2,unit:'كيلو'}],signature_png:'data:image/png;base64,'+png}],
  ['R-2',{recipient_name:'Chef Two',confirmed_at:'2026-11-28T10:35:00Z',items:[{id:1,requested:2,issued:2,received:2,unit:'كيلو'}],signature_png:'data:image/png;base64,'+png}],
  ['H-1',{recipient_name:'Housekeeper',confirmed_at:'2026-11-28T10:40:00Z',items:[{id:2,requested:1,issued:1,received:1,unit:'قطعة'}],signature_png:'data:image/png;base64,'+png}]
 ]);
 const receiptBuf=await generateReceiptWorkbook(rows,ctx,receipts);
 const receiptWb=new ExcelJS.Workbook();await receiptWb.xlsx.load(receiptBuf);
 assert.equal(receiptWb.worksheets.length,2);
 assert.equal(receiptWb.getWorksheet('Restaurant').getCell('F6').value,2);
 assert.equal(receiptWb.getWorksheet('Restaurant').getImages().length,2,'one signature image per order');
 assert.equal(receiptWb.getWorksheet('Housekeeping').getCell('C6').value,'Milk');
 console.log('Batch workbook tests passed: three files, one worksheet per department, orders grouped by department.');
})().catch(e=>{console.error(e);process.exit(1);});
