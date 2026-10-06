#!/usr/bin/env node
/**
 * World of Dreams — Automated Store Audit (Node.js + Puppeteer)
 *
 * Percorre as páginas principais da loja em 3 viewports (Mobile / Tablet /
 * Desktop) e valida por código:
 *
 *   1. Regra anti-transbordo (sem scroll horizontal):
 *        document.documentElement.scrollWidth === window.innerWidth
 *        document.body.scrollWidth <= window.innerWidth
 *   2. Abertura/fecho do menu mobile sem transbordo.
 *   3. Abertura do Cart Drawer por AJAX ao submeter o formulário do produto.
 *   4. Capturas de ecrã em tests/screenshots/ + relatório JSON em
 *      tests/audit-report.json.
 *
 * Uso:
 *   node audit-store.js
 *
 * Variáveis de ambiente (opcionais):
 *   WOD_BASE_URL  — base URL (default: https://shop.worldofdreams.pt)
 *   WOD_HEADLESS  — "false" para modo visível (default: true)
 */
'use strict';

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

/* =========================================================
 * Configuração
 * ========================================================= */
const BASE_URL = process.env.WOD_BASE_URL || 'https://shop.worldofdreams.pt';
const HEADLESS = process.env.WOD_HEADLESS !== 'false';
const NAV_TIMEOUT = 60000;

const VIEWPORTS = [
  { name: 'mobile', width: 390, height: 844, isMobile: true, hasTouch: true },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
];

const PAGES = [
  { name: 'home', label: 'Home', url: `${BASE_URL}/` },
  { name: 'catalog', label: 'Catálogo', url: `${BASE_URL}/categoria-produto/dreams-of/` },
  { name: 'product', label: 'Ficha de Produto', url: `${BASE_URL}/produto/dreams-of-tugalandia-%c2%b7-t-shirt-preta-%c2%b7-gola-redonda/` },
  { name: 'checkout', label: 'Checkout', url: `${BASE_URL}/finalizar-compra/` },
];

const SCREENSHOT_DIR = path.join(__dirname, 'tests', 'screenshots');
const REPORT_PATH = path.join(__dirname, 'tests', 'audit-report.json');

/* =========================================================
 * Estado & registo de resultados
 * ========================================================= */
const checks = [];
let failures = 0;
let warnings = 0;
let skipped = 0;

function record(name, status, details) {
  // status: 'pass' | 'fail' | 'warn' | 'skip'
  checks.push({ name, status, details });
  if (status === 'fail') failures += 1;
  else if (status === 'warn') warnings += 1;
  else if (status === 'skip') skipped += 1;
}

function log(status, msg) {
  const tag = status === 'fail' ? '✗ FAIL' : status === 'warn' ? '⚠ WARN' : status === 'skip' ? '· SKIP' : '✓ PASS';
  console.log(`  ${tag}  ${msg}`);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* =========================================================
 * Helpers de browser
 * ========================================================= */
async function goto(page, url) {
  try {
    const resp = await page.goto(url, { waitUntil: 'networkidle2', timeout: NAV_TIMEOUT });
    return { ok: true, status: resp ? resp.status() : null };
  } catch (err) {
    return { ok: false, status: null, error: err.message };
  }
}

async function readPageState(page) {
  return page.evaluate(() => ({
    title: document.title,
    h1: (document.querySelector('h1') || {}).textContent || '',
    docScrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
    innerWidth: window.innerWidth,
    comingSoon: /is coming soon/i.test(document.body.innerText || ''),
  }));
}

function assertOverflow(state, label) {
  const { docScrollWidth, bodyScrollWidth, innerWidth } = state;
  const docOk = docScrollWidth === innerWidth;
  const bodyOk = bodyScrollWidth <= innerWidth;
  const ok = docOk && bodyOk;
  record(`${label} · sem transbordo`, ok ? 'pass' : 'fail',
    `document: ${docScrollWidth} vs ${innerWidth} (${docOk ? 'ok' : 'TRANSBORDO'}), body: ${bodyScrollWidth} (${bodyOk ? 'ok' : 'TRANSBORDO'})`);
  return ok;
}

/* =========================================================
 * Testes específicos
 * ========================================================= */
async function testMobileMenu(browser, vp) {
  console.log(`\n▶ Menu mobile (${vp.width}px)`);
  const page = await browser.newPage();
  await page.setViewport(vp);
  await goto(page, PAGES[0].url);
  const state = await readPageState(page);

  if (state.comingSoon) {
    record('Menu mobile · abre/fecha sem transbordo', 'skip', 'loja em modo "coming soon" — menu não renderizado.');
    await page.close();
    return;
  }

  const openBtnSel = '.wp-block-navigation__responsive-container-open';
  if (!(await page.$(openBtnSel))) {
    record('Menu mobile · abre/fecha sem transbordo', 'skip', 'botão de menu mobile não encontrado.');
    await page.close();
    return;
  }

  await page.click(openBtnSel);
  await page
    .waitForSelector('.wp-block-navigation__responsive-container.is-menu-open', { timeout: 5000 })
    .catch(() => {});

  const openState = await readPageState(page);
  const openOk = openState.docScrollWidth === openState.innerWidth;
  record('Menu mobile · abre sem transbordo', openOk ? 'pass' : 'fail',
    `document: ${openState.docScrollWidth} vs ${openState.innerWidth}`);

  await page
    .screenshot({ path: path.join(SCREENSHOT_DIR, 'menu-mobile-open.png') })
    .catch(() => {});

  await page
    .click('.wp-block-navigation__responsive-container-close')
    .catch(async () => page.keyboard.press('Escape'));
  await page
    .waitForFunction(() => !document.querySelector('.wp-block-navigation__responsive-container.is-menu-open'), { timeout: 5000 })
    .catch(() => {});

  const closeState = await readPageState(page);
  const closed = await page.evaluate(() => !document.querySelector('.wp-block-navigation__responsive-container.is-menu-open'));
  const closeOk = closed && closeState.docScrollWidth === closeState.innerWidth;
  record('Menu mobile · fecha sem transbordo', closeOk ? 'pass' : 'fail',
    `fechado=${closed}, document: ${closeState.docScrollWidth} vs ${closeState.innerWidth}`);

  await page.close();
}

async function testCartDrawer(browser, vp) {
  console.log(`\n▶ Cart Drawer por AJAX (${vp.width}px)`);
  const product = PAGES.find((p) => p.name === 'product');
  const page = await browser.newPage();
  await page.setViewport(vp);
  await goto(page, product.url);
  const state = await readPageState(page);

  if (state.comingSoon) {
    record('Cart Drawer · abre por AJAX ao submeter o formulário', 'skip', 'loja em modo "coming soon" — formulário de produto não renderizado.');
    await page.close();
    return;
  }

  const hasForm = await page.evaluate(() =>
    !!(document.querySelector('form.cart') || document.querySelector('form.variations_form'))
  );
  if (!hasForm) {
    record('Cart Drawer · abre por AJAX ao submeter o formulário', 'skip', 'formulário de produto (form.cart) não encontrado.');
    await page.close();
    return;
  }

  // Selecionar a primeira variação (tamanho) disponível, se existir.
  await page.evaluate(() => {
    const sel = document.querySelector('form.cart select, form.variations_form select, .variations select');
    if (sel) {
      const opt = Array.from(sel.options).find((o) => o.value && o.value !== '0');
      if (opt) {
        sel.value = opt.value;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  });

  await sleep(500);

  const clicked = await page.evaluate(() => {
    const btn = document.querySelector(
      'form.cart button[type="submit"], form.variations_form button[type="submit"], button.single_add_to_cart_button, form.cart .single_add_to_cart_button'
    );
    if (btn) { btn.click(); return true; }
    return false;
  });

  if (!clicked) {
    record('Cart Drawer · abre por AJAX ao submeter o formulário', 'skip', 'botão de adicionar ao carrinho não encontrado.');
    await page.close();
    return;
  }

  const opened = await page
    .waitForFunction(
      () => {
        const overlay = document.querySelector('.wc-block-components-drawer__screen-overlay');
        const drawer = document.querySelector('.wc-block-mini-cart__drawer');
        if (overlay && getComputedStyle(overlay).display !== 'none') return true;
        if (drawer && drawer.classList.contains('is-open')) return true;
        return document.body.classList.contains('has-drawer-open');
      },
      { timeout: 15000 }
    )
    .then(() => true)
    .catch(() => false);

  record('Cart Drawer · abre por AJAX ao submeter o formulário', opened ? 'pass' : 'fail',
    opened ? 'drawer aberto após submissão AJAX.' : 'drawer não abriu após submissão AJAX (verificar wod-add-to-cart.js / WooCommerce).');

  await page
    .screenshot({ path: path.join(SCREENSHOT_DIR, 'cart-drawer-ajax.png') })
    .catch(() => {});

  await page.close();
}

/* =========================================================
 * Fluxo principal
 * ========================================================= */
async function run() {
  console.log(`\nWorld of Dreams — Auditoria headless (Puppeteer ${require('puppeteer/package.json').version})`);
  console.log(`Base URL: ${BASE_URL}\n`);

  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const browser = await puppeteer.launch({
    headless: HEADLESS,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  let comingSoonDetected = false;

  try {
    for (const vp of VIEWPORTS) {
      console.log(`\n▶ Viewport ${vp.name.toUpperCase()} (${vp.width}×${vp.height})`);
      const page = await browser.newPage();
      await page.setViewport(vp);

      for (const pg of PAGES) {
        const res = await goto(page, pg.url);
        const state = await readPageState(page);

        if (state.comingSoon) comingSoonDetected = true;

        if (!res.ok) {
          record(`${pg.label} · HTTP`, 'fail', `navegação falhou: ${res.error}`);
        } else if (res.status && res.status >= 400) {
          record(`${pg.label} · HTTP`, 'fail', `status ${res.status} (esperado 200)`);
        } else {
          record(`${pg.label} · HTTP`, 'pass', `status ${res.status}`);
        }

        if (res.ok && (!res.status || res.status < 400)) {
          assertOverflow(state, `${vp.name} · ${pg.label}`);
        } else {
          record(`${vp.name} · ${pg.label} · sem transbordo`, 'skip', 'página não carregou (HTTP de erro)');
        }

        try {
          await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${pg.name}-${vp.name}.png`) });
        } catch (e) {
          record(`${pg.name} · screenshot`, 'warn', e.message);
        }

        console.log(`  ${pg.label.padEnd(20)} | status ${res.status} | ${state.comingSoon ? 'COMING SOON' : 'live'} | ${(state.title || '').slice(0, 40)}`);
      }

      await page.close();
    }

    await testMobileMenu(browser, VIEWPORTS[0]);
    await testCartDrawer(browser, VIEWPORTS[0]);
  } finally {
    await browser.close();
  }

  const pass = checks.filter((c) => c.status === 'pass').length;
  const total = checks.length;

  console.log(`\n${'='.repeat(64)}`);
  console.log('RELATÓRIO');
  console.log(`${'='.repeat(64)}`);
  for (const c of checks) {
    log(c.status, `${c.name} — ${c.details}`);
  }
  console.log(`${'='.repeat(64)}`);
  console.log(`Total: ${total} | PASS: ${pass} | FAIL: ${failures} | WARN: ${warnings} | SKIP: ${skipped}`);

  if (comingSoonDetected) {
    console.log(`\n⚠ A loja está em modo "Coming Soon" do WooCommerce — a loja pública não está acessível.`);
    console.log('  Defina WooCommerce → Settings → Site Visibility = "Live" para validar a loja real.');
  }

  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    viewports: VIEWPORTS.map((v) => `${v.width}x${v.height}`),
    comingSoonDetected,
    summary: { total, pass, fail: failures, warn: warnings, skip: skipped },
    checks,
  };
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

  console.log(`\nRelatório JSON: ${REPORT_PATH}`);
  console.log(`Screenshots:   ${SCREENSHOT_DIR}`);

  process.exit(failures > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error('FATAL:', err);
  process.exit(2);
});



