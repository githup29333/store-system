const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');
const { generateWorkbooks } = require('./workbooks');

(async () => {
  const delivery = {
    key:'EBR|R|TEST-001|261121', hotel:'EBR', rev:1,
    code:'EBR1F|R|TEST-001|261121|1|hash|1:5:3:كيلو,2:2:2:قطعة|Restaurant||2~حليب~Milk'
  };
  const ctx = {
    hotels:[{code:'EBR',name:'Test Hotel'}],
    items:[{id:1,ar:'أرز',en:'Rice'},{id:2,ar:'حليب',en:'Milk'}],
    prices:[{id:11,name:'Rice',unit:'صندوق',cost:50,category:'منتجات جافة',archived:false,estimated:false},{id:12,name:'Rice',unit:'كيلو',cost:4.5,category:'منتجات جافة',archived:false,estimated:false}],
    links:[{item_id:1,price_id:11,method:'manual'},{item_id:2,price_id:null,method:'none'}]
  };
  const files = await generateWorkbooks(delivery,ctx);
  assert.equal(files.issue.subarray(0,2).toString(),'PK');
  assert.equal(files.cost.subarray(0,2).toString(),'PK');
  const issue = new ExcelJS.Workbook();
  await issue.xlsx.load(files.issue);
  assert.ok(issue.getWorksheet('Issue'));
  assert.equal(issue.getWorksheet('Issue').getCell('B7').value,'أرز');
  const cost = new ExcelJS.Workbook();
  await cost.xlsx.load(files.cost);
  const summary = cost.getWorksheet('ملخص الإدارة - EXECUTIVE');
  assert.ok(summary);
  assert.equal(summary.getImages().length,2,'executive workbook should contain donut and category bar charts');
  const details = cost.getWorksheet('تفاصيل الأصناف - DETAILS');
  assert.ok(details);
  assert.equal(details.getCell('G8').value,4.5,'linked price must respect the issued unit and select the matching kilo price');
  assert.equal(details.getCell('I9').value,'بانتظار السعر');
  assert.equal(details.getCell('H10').value,13.5);
  console.log('Workbook tests passed: two valid XLSX files, priced total excludes missing-price line.');
})().catch(e => { console.error(e); process.exit(1); });
