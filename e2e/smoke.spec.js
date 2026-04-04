// Smoke Test: Grundlegende Navigation und Seitenladung
// Prueft ob die App startet und kritische Seiten erreichbar sind

import { test, expect } from '@playwright/test'

// Login-Helper (wiederverwendbar)
async function login(page) {
  await page.goto('/login')
  await page.fill('input[type="email"]', process.env.E2E_USER || 'andreas.stolarczyk@js-fenster.de')
  await page.fill('input[type="password"]', process.env.E2E_PASS || '')
  await page.click('button[type="submit"]')
  // Wait for redirect to dashboard
  await page.waitForURL('**/cockpit', { timeout: 10000 })
}

test.describe('Smoke Tests', () => {

  test('Login-Seite rendert', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })

  test('App hat keine Console-Errors auf Login', async ({ page }) => {
    const errors = []
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text())
    })
    await page.goto('/login')
    await page.waitForTimeout(2000)
    // Filter known acceptable errors (e.g. favicon 404)
    const realErrors = errors.filter(e =>
      !e.includes('favicon') &&
      !e.includes('manifest')
    )
    expect(realErrors).toEqual([])
  })
})

test.describe('Navigation (nach Login)', () => {

  test.beforeEach(async ({ page }) => {
    // Skip wenn kein Passwort konfiguriert
    test.skip(!process.env.E2E_PASS, 'E2E_PASS nicht gesetzt — Login-Tests uebersprungen')
    await login(page)
  })

  const pages = [
    { name: 'Cockpit', url: '/cockpit', selector: 'main' },
    { name: 'Kalender', url: '/kalender', selector: 'main' },
    { name: 'Projekte', url: '/projekte', selector: 'main' },
    { name: 'Mitarbeiter', url: '/mitarbeiter', selector: 'main' },
    { name: 'Finanzen', url: '/finanzen', selector: 'main' },
    { name: 'Belege', url: '/belege', selector: 'main' },
  ]

  for (const p of pages) {
    test(`${p.name} Seite laedt ohne Fehler`, async ({ page }) => {
      const errors = []
      page.on('console', msg => {
        if (msg.type() === 'error') errors.push(msg.text())
      })

      await page.goto(p.url)
      await expect(page.locator(p.selector)).toBeVisible({ timeout: 10000 })

      // Keine JS-Errors
      const realErrors = errors.filter(e =>
        !e.includes('favicon') &&
        !e.includes('manifest')
      )
      expect(realErrors).toEqual([])
    })
  }
})
