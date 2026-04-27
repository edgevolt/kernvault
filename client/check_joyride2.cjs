const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('LOG:', msg.text()));

  await page.goto('http://localhost:5173/spaces/new', { waitUntil: 'networkidle0' });
  
  // Fill the new space form
  await page.waitForSelector('input');
  await page.type('input', 'Puppeteer Testing');
  
  // Type in the textarea (intent)
  await page.type('textarea', 'Testing intent');
  
  await page.click('button[type="submit"]');

  await page.waitForNavigation({ waitUntil: 'networkidle0' });
  
  console.log('Navigated to space view');

  // Wait for tour to start
  await page.waitForSelector('.__floater__open', { timeout: 5000 }).catch(() => console.log('Tour did not start'));
  console.log('Tour started');

  // Click Next until Last
  let nextBtn = await page.$('button[aria-label="Next"]');
  while (nextBtn) {
    await nextBtn.click();
    await page.waitForTimeout(500);
    nextBtn = await page.$('button[aria-label="Next"]');
  }
  
  const lastBtn = await page.$('button[aria-label="Last"]');
  if (lastBtn) {
    console.log('Clicking Last');
    await lastBtn.click();
    await page.waitForTimeout(1000);
  }

  const floater1 = await page.$('.__floater__open');
  console.log('Tour visible after Last?', !!floater1);

  // Click Knowledge Map
  await page.click('#tab-map');
  await page.waitForTimeout(500);
  console.log('Clicked Map tab');

  // Click List
  await page.click('#tab-list');
  await page.waitForTimeout(500);
  console.log('Clicked List tab');

  const floater2 = await page.$('.__floater__open');
  console.log('Tour visible after tab switch?', !!floater2);

  const localStorageData = await page.evaluate(() => localStorage.getItem('kernvault_settings'));
  console.log('LocalStorage settings:', localStorageData);

  await browser.close();
})();
