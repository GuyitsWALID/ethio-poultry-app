// Real React component and Chromium; transport fixtures, not an authenticated staging check.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';
const repo = path.resolve(import.meta.dirname, '..');
const require = createRequire(path.join(repo, 'package.json'));
const {build} = require('esbuild'), {chromium, expect} = require('@playwright/test');
const id = n => `31000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const row = n => ({id: id(n), report_name: `Saved report ${n}`, period_from: '2026-10-01', period_to: '2026-10-18',
  status: 'completed', failure_message: null, generated_at: '2026-10-19T07:00:00Z', created_at: '2026-10-19T07:00:00Z'});
const entry = `import React from 'react';import {createRoot} from 'react-dom/client';
import {SavedReportHistory} from './src/components/reports/saved-report-history';
const page=${JSON.stringify({runs: [row(1), row(2)], nextCursor: 'page-two'})};
createRoot(document.getElementById('root')).render(<SavedReportHistory page={page}/>);`;
const bundle = await build({stdin: {contents: entry, resolveDir: repo, loader: 'tsx'}, bundle: true, write: false,
  jsx: 'automatic', platform: 'browser', define: {'process.env.NODE_ENV': '"development"'}, plugins: [{name: 'next-navigation', setup(b) {
    b.onResolve({filter: /^next\/navigation$/}, () => ({path: 'navigation', namespace: 'mock'}));
    b.onLoad({filter: /.*/, namespace: 'mock'}, () => ({resolveDir: repo, contents: `
      import {useSyncExternalStore} from 'react';
      const subscribe=cb=>{addEventListener('popstate',cb);addEventListener('routechange',cb);return()=>{removeEventListener('popstate',cb);removeEventListener('routechange',cb)}};
      export const usePathname=()=>location.pathname;
      export const useSearchParams=()=>new URLSearchParams(useSyncExternalStore(subscribe,()=>location.search,()=>''));
      const router={push:url=>{history.pushState(null,'',url);dispatchEvent(new Event('routechange'))}};
      export const useRouter=()=>router;` }));
  }}]});
const browser = await chromium.launch({headless: true});
try {
  for (const width of [768, 1440]) {
    const page = await browser.newPage({viewport: {width, height: 1024}});
    let failMore = true, deniedDetail = false, writes = 0;
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (route.request().method() !== 'GET') writes++;
      if (url.pathname === '/api/reports/management') return route.fulfill(failMore
        ? {status: 503, json: {error: 'Temporary list failure'}}
        : {json: {runs: [row(2), row(3)], nextCursor: null}});
      if (url.pathname.startsWith('/api/reports/management/')) {
        const target = url.pathname.split('/').at(-1), n = Number(target.split('-').at(-1));
        if (deniedDetail || n === 999) return route.fulfill({status: 404, json: {error: 'Report unavailable'}});
        return route.fulfill({json: {...row(n), report_version: 'management-report-v1-scoped', html: '<html><body>Frozen evidence<script>parent.hacked=true</script></body></html>'}});
      }
      return route.fulfill({contentType: 'text/html', body: '<html><body><div id="root"></div></body></html>'});
    });
    const mount = async query => {
      await page.goto(`http://reports.test/app/reports?${query}`);
      await page.addStyleTag({content: 'button,a{min-height:48px} iframe{width:100%;height:400px}'});
      await page.addScriptTag({content: bundle.outputFiles[0].text});
    };
    await mount('view=saved&saved_report=' + id(80));
    await expect(page.getByRole('region', {name: 'Saved report details'}).getByRole('heading', {name: 'Saved report 80', exact: true})).toBeVisible();
    await expect(page.locator('iframe')).toHaveAttribute('sandbox', '');
    assert.equal(await page.evaluate(() => window.hacked), undefined);
    await page.getByRole('button', {name: 'Close report'}).click();
    await page.getByRole('button', {name: 'View report', exact: true}).first().click();
    await expect(page).toHaveURL(new RegExp(id(1)));
    await expect(page.getByRole('region', {name: 'Saved report details'})).toHaveCount(1);
    await page.getByRole('button', {name: 'View report', exact: true}).click();
    await expect(page).toHaveURL(new RegExp(id(2)));
    await expect(page.getByRole('region', {name: 'Saved report details'})).toHaveCount(1);
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(id(1)));
    await expect(page.getByRole('region').getByRole('heading', {name: 'Saved report 1', exact: true})).toBeVisible();
    await page.goForward();
    await expect(page.getByRole('region').getByRole('heading', {name: 'Saved report 2', exact: true})).toBeVisible();
    await page.getByRole('button', {name: 'Load more reports'}).click();
    await expect(page.getByRole('alert')).toContainText('Temporary list failure');
    await expect(page.locator('article')).toHaveCount(2);
    failMore = false;
    await page.getByRole('button', {name: 'Retry loading reports'}).click();
    await expect(page.locator('article')).toHaveCount(3);
    await expect(page.getByRole('status').filter({hasText: '3 reports loaded'})).toBeVisible();
    await expect(page.getByRole('button', {name: 'Load more reports'})).toHaveCount(0);
    deniedDetail = true;
    await page.getByRole('button', {name: 'View report', exact: true}).last().click();
    await expect(page.getByRole('alert')).toContainText('Report unavailable');
    await expect(page.locator('iframe')).toHaveCount(0);
    await mount('saved_report=' + id(999));
    await expect(page.getByRole('alert')).toContainText('Report unavailable');
    await expect(page.locator('iframe')).toHaveCount(0);
    assert.equal(writes, 0);
    await page.close();
    console.log(`Saved reports ${width}px: pagination failure/retry, exact older selection, Back/Forward, sandbox and denied state passed.`);
  }
} finally {await browser.close();}
