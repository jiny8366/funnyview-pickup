/**
 * HTML → PDF 변환 (헤드리스 chromium, 배경색 유지).
 * 사용: node scripts/html-to-pdf.cjs <입력.html> <출력.pdf>
 */
const path = require('path');
const { chromium } = require('@playwright/test');

(async () => {
  const inAbs = path.resolve(process.argv[2]);
  const outAbs = path.resolve(process.argv[3]);
  const fileUrl = 'file:///' + inAbs.replace(/\\/g, '/');

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(fileUrl, { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForTimeout(1500); // Tailwind CDN JIT 정착 대기
    await page.pdf({
      path: outAbs,
      format: 'A4',
      printBackground: true,
      margin: { top: '12mm', bottom: '12mm', left: '10mm', right: '10mm' },
    });
    console.log('PDF saved:', outAbs);
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error('변환 실패:', e.message);
  process.exit(1);
});
