// يسحب النتائج الموافق عليها من Supabase ويرسلها بالإيميل، ويسجّل تم/فشل.
// Node 18+ . المتغيرات (Secrets) فقط، لا تكتب أي كلمة مرور داخل الملف.
const nodemailer = require('nodemailer');
const E = process.env;

const miss = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'].filter(k => !E[k]);
if (miss.length) { console.error('Missing env: ' + miss.join(', ')); process.exit(1); }

const URL_ = E.SUPABASE_URL.replace(/\/$/, ''), KEY = E.SUPABASE_SERVICE_KEY;
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };
const PORT = +E.SMTP_PORT || 465, SECURE = E.SMTP_SECURE ? E.SMTP_SECURE === 'true' : PORT === 465;
const FROM = E.MAIL_FROM || E.SMTP_USER;
const MAXTRY = +E.MAX_ATTEMPTS || 3, STALE_MIN = +E.STALE_MINUTES || 15, LIMIT = +E.MAX_PER_RUN || 20;
const XL = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const enc = encodeURIComponent;

const transport = nodemailer.createTransport({
  host: E.SMTP_HOST, port: PORT, secure: SECURE,
  auth: { user: E.SMTP_USER, pass: E.SMTP_PASS },
  connectionTimeout: 20000, greetingTimeout: 20000, socketTimeout: 60000,
  tls: { rejectUnauthorized: E.SMTP_INSECURE !== 'true' }
});

async function rest(path, opt = {}) {
  const r = await fetch(URL_ + '/rest/v1/' + path, { ...opt, headers: { ...H, ...(opt.headers || {}) } });
  if (!r.ok) throw new Error('Supabase ' + r.status + ' ' + (await r.text()).slice(0, 200));
  return r.status === 204 ? null : r.json();
}
const REP = { Prefer: 'return=representation' };
const addr = r => ({ name: r.name || '', address: r.email });
const uniq = a => { const s = new Set(); return a.filter(x => { const k = x.address.toLowerCase(); if (s.has(k)) return false; s.add(k); return true; }); };

async function sendOne(d, to, cc) {
  const q = 'deliveries?key=eq.' + enc(d.key) + '&rev=eq.' + d.rev;
  // حجز ذري: لو جهاز ثاني حجزه قبلنا ما نرسله مرة ثانية
  const got = await rest(q + '&status=eq.approved', { method: 'PATCH', headers: REP, body: JSON.stringify({ status: 'sending', attempts: (d.attempts || 0) + 1, updated_at: new Date().toISOString() }) });
  if (!got || !got.length) { console.log('Skip (already claimed or changed): ' + d.key); return true; }
  const toPending = () => rest('deliveries?key=eq.' + enc(d.key) + '&status=eq.sending', { method: 'PATCH', body: JSON.stringify({ status: 'pending' }) }).catch(() => {});
  try {
    if (!to.length) throw new Error('NOFATAL لا يوجد مستلم من نوع To / no To recipient');
    if (!d.file_path) throw new Error('NOFATAL لا يوجد ملف مرفق / no file');
    const fr = await fetch(URL_ + '/storage/v1/object/exports/' + enc(d.file_path), { headers: H });
    if (!fr.ok) throw new Error('تعذّر تنزيل الملف / download failed ' + fr.status);
    const buf = Buffer.from(await fr.arrayBuffer());
    const date = '20' + d.ds.slice(0, 2) + '-' + d.ds.slice(2, 4) + '-' + d.ds.slice(4);
    const name = d.dn || d.dept, upd = d.rev > 1;
    const info = await transport.sendMail({
      from: FROM, to, cc,
      subject: `صرف / Issue — ${name} — طلب / Order ${d.no} — ${date}` + (upd ? ` (تحديث ${d.rev} / Update ${d.rev})` : ''),
      text: `مرفق ملف الصرف الخاص بـ${name} (طلب ${d.no} بتاريخ ${date}).` + (upd ? '\nهذه نسخة محدّثة من الطلب.' : '') +
        `\nالأصناف التي لم تُصرف تم حذفها من الملف.\n\n--\nAttached is the issue note for ${name} (order ${d.no}, ${date}).` +
        (upd ? '\nThis is an updated version of the order.' : '') + '\nUnissued items have been removed from the file.',
      attachments: [{ filename: `Issue_${d.dept}_${d.no}.xlsx`, content: buf, contentType: XL }]
    });
    const rej = (info.rejected || []).map(x => x.address || x);
    const done = await rest(q + '&status=eq.sending', { method: 'PATCH', headers: REP, body: JSON.stringify({ status: 'sent', sent_at: new Date().toISOString(), error: rej.length ? 'رُفض لبعض المستلمين / rejected: ' + rej.join(', ') : null }) });
    if (!done.length) await toPending(); // تغيّر الطلب أثناء الإرسال: يرجع بانتظار موافقتك بالنسخة الجديدة
    console.log('Sent ' + d.key + (rej.length ? ' (rejected: ' + rej.join(', ') + ')' : ''));
    return true;
  } catch (e) {
    let msg = String(e.message || e).slice(0, 300);
    const fatal = msg.startsWith('NOFATAL');
    msg = msg.replace(/^NOFATAL /, '');
    const give = fatal || (d.attempts || 0) + 1 >= MAXTRY;
    const res = await rest(q + '&status=eq.sending', { method: 'PATCH', headers: REP, body: JSON.stringify({ status: give ? 'failed' : 'approved', error: msg, updated_at: new Date().toISOString() }) }).catch(() => []);
    if (!res || !res.length) await toPending();
    console.error('Failed ' + d.key + ' (' + (give ? 'final' : 'will retry') + '): ' + msg);
    return false;
  }
}

async function main() {
  if (E.MODE === 'test') {
    await transport.verify();
    const to = E.TEST_TO || E.SMTP_USER;
    await transport.sendMail({ from: FROM, to, subject: 'اختبار منظومة الصرف / Issuance system test', text: 'إذا وصلتك هذه الرسالة فالإرسال يعمل.\nIf you received this, sending works.' });
    console.log('Test email sent to ' + to);
    return;
  }
  // إنقاذ العالق: طلب بقي "قيد الإرسال" أكثر من STALE_MIN دقيقة يرجع للإرسال
  const cutoff = new Date(Date.now() - STALE_MIN * 60000).toISOString();
  const stuck = await rest('deliveries?status=eq.sending&updated_at=lt.' + cutoff, { method: 'PATCH', headers: REP, body: JSON.stringify({ status: 'approved' }) });
  if (stuck && stuck.length) console.log('Recovered stuck: ' + stuck.map(x => x.key).join(', '));

  const rows = await rest('deliveries?select=*&status=eq.approved&order=approved_at.asc&limit=' + LIMIT);
  if (!rows.length) { console.log('Nothing to send'); return; }
  const rec = await rest('recipients?select=kind,email,name&active=eq.true&order=id.asc');
  const to = uniq(rec.filter(r => r.kind === 'to').map(addr)), cc = uniq(rec.filter(r => r.kind === 'cc').map(addr));
  let ok = true;
  for (const d of rows) ok = (await sendOne(d, to, cc)) && ok;
  if (!ok) process.exitCode = 1; // يظهر الفشل في GitHub ويصلك إشعار
}
main().catch(e => { console.error('Fatal: ' + (e.message || e)); process.exit(1); });
