// End-to-end test runner. Launches the Vite dev server, drives the rendered
// page with puppeteer-core + system Chrome, and asserts UI behavior that
// unit tests can't cover (event handlers, watchers, full Vue reactivity).
//
// Usage: node e2e/run.js
// Exits non-zero on any test failure.
//
// Tauri APIs are mocked via setup-tauri-mock.js so the app can run in a
// plain browser (no Tauri runtime available outside the desktop binary).

const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')
const puppeteer = require('puppeteer-core')

const ROOT = path.resolve(__dirname, '..')
const VITE_PORT = 1420

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

async function waitFor(predicate, { timeout = 10000, interval = 100 } = {}) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    try {
      if (await predicate()) return true
    } catch {}
    await sleep(interval)
  }
  throw new Error(`waitFor timed out after ${timeout}ms`)
}

async function startVite() {
  // Reuse an already-running vite server if present.
  try {
    const r = await fetch(`http://localhost:${VITE_PORT}/`)
    if (r.ok) {
      console.log('[e2e] reusing existing vite at :' + VITE_PORT)
      return null
    }
  } catch {}
  console.log('[e2e] starting vite…')
  const child = spawn('npm', ['run', 'dev'], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  await waitFor(
    async () => {
      try {
        const r = await fetch(`http://localhost:${VITE_PORT}/`)
        return r.ok
      } catch {
        return false
      }
    },
    { timeout: 30000 }
  )
  console.log('[e2e] vite ready')
  return child
}

const tests = []
function test(name, fn) {
  tests.push({ name, fn })
}

test('switch-side toolbar button flips the visible side label', async page => {
  // Wait for the toolbar to render.
  await page.waitForSelector('.top-toolbar', { timeout: 15000 })
  // Wait for the analysis sidebar's switch-side button (we look for the
  // label text — it includes 切换先手 in zh_cn or "Switch Side" in en).
  const button = await page.evaluateHandle(() => {
    const btns = Array.from(document.querySelectorAll('button'))
    return btns.find(
      b => /切换先手|Switch\s*Side/i.test(b.textContent || '')
    )
  })
  if (!button || !(await button.evaluate(b => !!b))) {
    throw new Error('switch-side button not found in DOM')
  }
  const labelBefore = await button.evaluate(b => b.textContent.trim())
  await button.evaluate(b => b.click())
  await sleep(200)
  const labelAfter = await button.evaluate(b => b.textContent.trim())
  if (labelBefore === labelAfter) {
    throw new Error(
      `switch-side click did NOT change label.\n  before: ${JSON.stringify(labelBefore)}\n  after:  ${JSON.stringify(labelAfter)}`
    )
  }
  console.log('  before:', labelBefore)
  console.log('  after :', labelAfter)
})

test('switch-side: red↔black toggles back and forth', async page => {
  const sideOf = label => {
    if (/红方|red.to.move|red side/i.test(label)) return 'red'
    if (/黑方|black.to.move|black side/i.test(label)) return 'black'
    return 'unknown'
  }
  const click = async () => {
    const btn = await page.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll('button'))
      return btns.find(
        b => /切换先手|Switch\s*Side/i.test(b.textContent || '')
      )
    })
    await btn.evaluate(b => b.click())
    await sleep(150)
    return btn.evaluate(b => b.textContent.trim())
  }
  const a = sideOf(await click())
  const b = sideOf(await click())
  const c = sideOf(await click())
  if (a === b) throw new Error(`first toggle didn't change side: ${a} → ${b}`)
  if (b === c) throw new Error(`second toggle didn't change side: ${b} → ${c}`)
  if (a !== c) throw new Error(`A then back to A failed: ${a}, ${b}, ${c}`)
  console.log('  side sequence:', a, '→', b, '→', c)
})

test('opening Position Editor alone does not crash the page', async page => {
  const errors = []
  const onErr = err => errors.push(err.message)
  page.on('pageerror', onErr)
  // Find the edit-position button (mdi-pencil-box icon) and click it.
  const btn = await page.evaluateHandle(() => {
    const btns = Array.from(document.querySelectorAll('button'))
    return btns.find(b => {
      const icon = b.querySelector('i')?.className || ''
      return /mdi-pencil-box|编辑局面|Edit\s*Position/i.test(
        (b.textContent || '') + (b.getAttribute('title') || '') + icon
      )
    })
  })
  if (!btn || !(await btn.evaluate(b => !!b))) {
    throw new Error('edit-position button not found')
  }
  await btn.evaluate(b => b.click())
  await sleep(1000)
  page.off('pageerror', onErr)
  console.log('  pageerrors:', errors.length)
  for (const e of errors) console.log('    -', e.slice(0, 200))
  if (errors.some(e => /maximum call stack size/i.test(e))) {
    throw new Error('Stack overflow on dialog open alone')
  }
  // Close the dialog so subsequent tests start clean.
  await page.evaluate(() => {
    const closer = document.querySelector(
      'button[aria-label*="cancel" i], button[aria-label*="close" i]'
    )
    if (closer) closer.click()
  })
  await sleep(300)
})

test('📱 capture flow does not crash the page (regression: stack overflow)', async page => {
  await page.evaluate(() => {
    // 1×1 transparent PNG as fake adb screencap output. YOLO will detect zero
    // pieces — we don't care about the recognition outcome here, only that
    // the workflow does not blow the JS stack like the recent regression did.
    const png = new Uint8Array([
      137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1,
      0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 13, 73, 68, 65, 84,
      120, 156, 99, 0, 1, 0, 0, 5, 0, 1, 13, 10, 45, 180, 0, 0, 0, 0, 73, 69,
      78, 68, 174, 66, 96, 130,
    ])
    window.__E2E_INVOKE_MOCKS__.capture_phone_screen = async () => png.buffer
  })
  const errors = []
  const onErr = err => errors.push(err.message)
  page.on('pageerror', onErr)
  const btn = await page.evaluateHandle(() => {
    const btns = Array.from(document.querySelectorAll('button'))
    return btns.find(b => {
      const icon = b.querySelector('i')?.className || ''
      return /cellphone-arrow|一键识别|Capture from Phone/i.test(
        (b.textContent || '') + (b.getAttribute('title') || '') + icon
      )
    })
  })
  if (!btn || !(await btn.evaluate(b => !!b))) {
    throw new Error('📱 capture button not found in DOM')
  }
  await btn.evaluate(b => b.click())
  await sleep(8000)
  const status = await page.evaluate(() => {
    const alerts = Array.from(
      document.querySelectorAll('.v-alert, [role="alert"]')
    )
    return alerts.map(a => (a.textContent || '').trim()).join(' | ')
  })
  page.off('pageerror', onErr)
  console.log('  status:', JSON.stringify(status.slice(0, 240)))
  console.log('  pageerrors:', errors.length)
  for (const e of errors) console.log('    -', e.slice(0, 200))
  if (/maximum call stack size/i.test(status)) {
    throw new Error('Stack overflow regression detected in status banner')
  }
  if (errors.some(e => /maximum call stack size/i.test(e))) {
    throw new Error('Stack overflow regression detected in pageerror events')
  }
})

;(async () => {
  const viteChild = await startVite()
  let exitCode = 0
  let browser
  try {
    browser = await puppeteer.launch({
      executablePath: '/usr/bin/google-chrome',
      headless: 'new',
      args: ['--no-sandbox', '--disable-gpu'],
    })
    const page = await browser.newPage()
    await page.evaluateOnNewDocument(
      fs.readFileSync(path.join(__dirname, 'setup-tauri-mock.js'), 'utf8')
    )
    page.on('pageerror', err => console.log('[page error]', err.message))
    page.on('console', msg => {
      const t = msg.type()
      if (t === 'error' || t === 'warn') {
        console.log(`[page ${t}]`, msg.text().slice(0, 300))
      }
    })
    await page.goto(`http://localhost:${VITE_PORT}/`, {
      waitUntil: 'networkidle0',
      timeout: 30000,
    })
    for (const t of tests) {
      console.log(`\n▶ ${t.name}`)
      try {
        await t.fn(page)
        console.log(`✓ ${t.name}`)
      } catch (e) {
        console.error(`✗ ${t.name}\n  ${e.message}`)
        exitCode = 1
      }
    }
  } catch (e) {
    console.error('[e2e fatal]', e)
    exitCode = 2
  } finally {
    if (browser) await browser.close()
    if (viteChild) viteChild.kill()
  }
  process.exit(exitCode)
})()
