// UI checks for TC-057 (theme, number formatting, chart labelling) and TC-051 (script text not executed).
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:3457';
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext()).newPage();
  let dialog = false;
  p.on('dialog', async (d) => { dialog = true; await d.dismiss(); });
  await p.goto(BASE + '/login');
  await p.fill('input[type=email]', 'priya@wealthwise.dev');
  await p.fill('input[type=password]', 'password123');
  await p.keyboard.press('Enter');
  await p.waitForURL('**/dashboard');
  await p.waitForSelector('text=Asset allocation');
  await p.click('text=☾ Dark');
  await p.reload({ waitUntil: 'domcontentloaded' });
  const noFlash = await p.evaluate(() => document.documentElement.classList.contains('dark'));
  await p.waitForSelector('text=Asset allocation');
  const persisted = await p.evaluate(() => document.documentElement.classList.contains('dark'));
  const dash = await p.innerText('main');
  const m = dash.match(/₹\d{1,2},\d{2},\d{2},\d{3}\.\d{2}|₹\d{1,2},\d{2},\d{3}\.\d{2}/);
  const legendsDash = /Income/.test(dash) && /Expense/.test(dash) && /Property/.test(dash) && /%/.test(dash);
  await p.goto(BASE + '/projection'); await p.waitForSelector('text=Current plan');
  const proj = await p.innerText('main');
  await p.goto(BASE + '/reports'); await p.waitForSelector('text=Spending by category');
  const rep = await p.innerText('main');
  await p.click('text=☀ Light');
  // rahul's ledger contains a description '<script>alert(1)</script>' from TC-051
  await p.click('text=Log out'); await p.waitForURL('**/login');
  await p.fill('input[type=email]', 'rahul@wealthwise.dev');
  await p.fill('input[type=password]', 'password123');
  await p.keyboard.press('Enter'); await p.waitForURL('**/dashboard');
  await p.goto(BASE + '/transactions'); await p.waitForTimeout(1500);
  const ledger = await p.innerText('main');
  const xssSafe = ledger.includes('<script>alert(1)</script>') && !dialog;
  await b.close();
  console.log(JSON.stringify({
    persisted, noFlash, inr: !!m, sample: m ? m[0] : null,
    legends: legendsDash && /Current plan/.test(proj) && /Month/.test(proj) && /%/.test(rep),
    xssSafe,
  }));
})().catch((e) => { console.log(JSON.stringify({ error: e.message })); process.exit(0); });
