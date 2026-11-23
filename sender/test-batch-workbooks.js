const assert=require('node:assert/strict');
const ExcelJS=require('exceljs');
const {generateBatchWorkbooks}=require('./batch-workbooks');
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
 console.log('Batch workbook tests passed: two files, one worksheet per department, orders grouped by department.');
})().catch(e=>{console.error(e);process.exit(1);});
