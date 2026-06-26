const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  page.on('requestfailed', request =>
    console.log('REQUEST FAILED:', request.url(), request.failure().errorText)
  );

  console.log('Navigating to http://localhost:5173/users...');
  
  // Set localStorage to mock logged in user so we don't hit Login page
  await page.goto('http://localhost:5173');
  await page.evaluate(() => {
    localStorage.setItem('smart_store_user', JSON.stringify({
      username: 'admin',
      role: 'Administrator',
      token: 'mock-jwt-token-for-admin'
    }));
  });
  
  await page.goto('http://localhost:5173/users', { waitUntil: 'networkidle2' });
  
  console.log('Waiting 2 seconds...'); await page.screenshot({path: 'debug.png'}); const html = await page.content(); console.log('HTML:', html);
  await new Promise(r => setTimeout(r, 2000));
  
  await browser.close();
})();
