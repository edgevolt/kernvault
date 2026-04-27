const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('LOG:', msg.text()));

  await page.goto('http://localhost:5173/spaces/new', { waitUntil: 'networkidle0' });
  
  // Fill the new space form
  await page.waitForSelector('input[name="name"]');
  await page.type('input[name="name"]', 'Puppeteer Testing');
  await page.click('button[type="submit"]');

  await page.waitForNavigation({ waitUntil: 'networkidle0' });
  
  // Wait for tour to start
  await page.waitForSelector('.__floater__open', { timeout: 5000 }).catch(() => console.log('Tour did not start'));
  console.log('Tour started');

  // Click Skip
  await page.click('button[aria-label="Skip"]').catch(() => console.log('No skip button'));
  console.log('Clicked Skip');

  await page.waitForTimeout(1000);
  const floater = await page.$('.__floater__open');
  if (floater) {
    console.log('Tour is still visible!');
  } else {
    console.log('Tour disappeared.');
  }

  await browser.close();
})();
