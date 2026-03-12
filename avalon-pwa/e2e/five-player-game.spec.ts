import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

const BASE = 'http://localhost:5173'
const NAMES = ['P1', 'P2', 'P3', 'P4', 'P5'] as const
const PLAYER_COUNT = 5
const TEAM_SIZES_BY_ROUND: Record<number, number> = { 1: 2, 2: 3, 3: 2, 4: 3, 5: 3 }

test.describe('5人局完整流程', () => {
  test('5人局单轮：建房到第一轮回合结果', async ({ browser }) => {
    test.setTimeout(120000)
    const pages = await Promise.all(
      Array.from({ length: PLAYER_COUNT }, () => browser.newContext().then((ctx) => ctx.newPage()))
    )
    await pages[0].goto(BASE)
    await pages[0].getByPlaceholder('Your name').first().fill(NAMES[0])
    await pages[0].getByRole('button', { name: 'Create Room' }).click()
    await expect(pages[0].getByTestId('room-code')).toBeVisible({ timeout: 10000 })
    const roomCode = (await pages[0].getByTestId('room-code').textContent())!.replace(/Room Code:\s*/i, '').trim()
    for (let i = 1; i < PLAYER_COUNT; i++) {
      await pages[i].goto(BASE)
      await pages[i].getByPlaceholder('Room code').fill(roomCode)
      await pages[i].getByPlaceholder('Your name').last().fill(NAMES[i])
      await pages[i].getByRole('button', { name: 'Join Room' }).click()
    }
    await expect(pages[0].getByRole('button', { name: /Ready|Not ready/ })).toBeVisible({ timeout: 10000 })
    for (let i = 0; i < PLAYER_COUNT; i++) {
      const btn = pages[i].getByRole('button', { name: 'Ready' })
      await btn.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {})
      if (await btn.isVisible()) await btn.click()
    }
    await pages[0].getByRole('button', { name: 'Start Game' }).click()
    for (let i = 0; i < PLAYER_COUNT; i++) {
      await expect(pages[i].getByRole('button', { name: 'Continue' })).toBeVisible({ timeout: 15000 })
      await pages[i].getByRole('button', { name: 'Continue' }).click()
    }
    await expect(pages[0].getByText('Round: 1')).toBeVisible({ timeout: 25000 })
    await new Promise((r) => setTimeout(r, 2000))
    let leaderPage = await findLeaderPage(pages, 2)
    if (!leaderPage) {
      await new Promise((r) => setTimeout(r, 3000))
      leaderPage = await findLeaderPage(pages, 2)
    }
    expect(leaderPage).not.toBeNull()
    const checkboxes = leaderPage!.getByRole('checkbox')
    await checkboxes.first().click()
    await checkboxes.nth(1).click()
    await leaderPage!.getByRole('button', { name: 'Confirm Team' }).click()
    await pages[0].getByRole('button', { name: 'Approve' }).waitFor({ state: 'visible', timeout: 15000 })
    for (const page of pages) {
      if (await page.getByRole('button', { name: 'Approve' }).isVisible()) await page.getByRole('button', { name: 'Approve' }).click()
    }
    await new Promise((r) => setTimeout(r, 2000))
    for (const page of pages) {
      const successBtn = page.getByRole('button', { name: 'Success' })
      await successBtn.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {})
      if (await successBtn.isVisible()) await successBtn.click()
    }
    await Promise.any(
      pages.map((p) =>
        p.getByText('Mission Result').or(p.getByRole('button', { name: /^Continue$/ })).waitFor({ state: 'visible', timeout: 30000 })
      )
    )
  })

  test('5人局：建房 -> 加入 -> 准备 -> 开始 -> 角色 -> 多轮任务 -> 结束', async ({ browser }) => {
    test.setTimeout(300000)
    const pages = await Promise.all(
      Array.from({ length: PLAYER_COUNT }, () => browser.newContext().then((ctx) => ctx.newPage()))
    )

    // 1) P1 创建房间
    await pages[0].goto(BASE)
    await pages[0].getByPlaceholder('Your name').first().fill(NAMES[0])
    await pages[0].getByRole('button', { name: 'Create Room' }).click()
    await expect(pages[0].getByTestId('room-code')).toBeVisible({ timeout: 10000 })
    const roomCodeText = await pages[0].getByTestId('room-code').textContent()
    const roomCode = roomCodeText!.replace(/Room Code:\s*/i, '').trim()

    // 2) P2–P5 加入
    for (let i = 1; i < PLAYER_COUNT; i++) {
      await pages[i].goto(BASE)
      await pages[i].getByPlaceholder('Room code').fill(roomCode)
      await pages[i].getByPlaceholder('Your name').last().fill(NAMES[i])
      await pages[i].getByRole('button', { name: 'Join Room' }).click()
    }

    // 3) 等待所有人进入 Lobby，全部 Ready
    await expect(pages[0].getByRole('button', { name: /Ready|Not ready/ })).toBeVisible({ timeout: 10000 })
    for (let i = 0; i < PLAYER_COUNT; i++) {
      const btn = pages[i].getByRole('button', { name: 'Ready' })
      await btn.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {})
      if (await btn.isVisible()) await btn.click()
    }

    // 4) P1 开始游戏
    await pages[0].getByRole('button', { name: 'Start Game' }).click()

    // 5) 所有人进入 Role Reveal 并点击 Continue
    for (let i = 0; i < PLAYER_COUNT; i++) {
      await expect(pages[i].getByRole('button', { name: 'Continue' })).toBeVisible({ timeout: 15000 })
      await pages[i].getByRole('button', { name: 'Continue' }).click()
    }

    // 6) 等待进入游戏主界面（选队）
    await expect(pages[0].getByText('Round: 1')).toBeVisible({ timeout: 25000 })

    // 7) 游戏主循环：选队 -> 投票 -> 任务投票 -> 回合结果，直到出现刺杀或游戏结束
    let round = 1
    const maxRounds = 20
    let didAssassinPhase = false
    while (round <= maxRounds) {
      await new Promise((r) => setTimeout(r, 1000))
      const teamSize = TEAM_SIZES_BY_ROUND[round] ?? 2

      // 6a) TEAM_SELECTION：找到队长页（有可点 checkbox），勾选 teamSize 个并确认
      let leaderPage = await findLeaderPage(pages, teamSize)
      if (leaderPage === null) {
        await new Promise((r) => setTimeout(r, 3000))
        leaderPage = await findLeaderPage(pages, teamSize)
      }
      if (leaderPage === null) break
      const checkboxes = leaderPage.getByRole('checkbox')
      await checkboxes.first().click()
      for (let k = 1; k < teamSize; k++) {
        await checkboxes.nth(k).click()
      }
      await leaderPage.getByRole('button', { name: 'Confirm Team' }).click()

      // 6b) TEAM_VOTING：所有人 Approve
      await pages[0].getByRole('button', { name: 'Approve' }).waitFor({ state: 'visible', timeout: 15000 })
      for (const page of pages) {
        if (await page.getByRole('button', { name: 'Approve' }).isVisible()) {
          await page.getByRole('button', { name: 'Approve' }).click()
        }
      }

      // 6c) MISSION_VOTING：能点 Success 的页面（任务成员）点 Success
      await new Promise((r) => setTimeout(r, 1500))
      for (const page of pages) {
        const successBtn = page.getByRole('button', { name: 'Success' })
        await successBtn.waitFor({ state: 'visible', timeout: 8000 }).catch(() => {})
        if (await successBtn.isVisible()) await successBtn.click()
      }
      // 等待任一页出现：回合结果 / 刺杀 / 游戏结束
      await Promise.any([
        ...pages.flatMap((p) => [
          p.getByText('Mission Result').waitFor({ state: 'visible', timeout: 20000 }),
          p.getByRole('button', { name: 'Confirm Kill' }).waitFor({ state: 'visible', timeout: 20000 }),
          p.getByText('GAME OVER').waitFor({ state: 'visible', timeout: 20000 }),
        ]),
      ]).catch(() => {})

      // 6d) 判定阶段并处理
      const phase = await waitForNextPhase(pages)
      if (phase === 'assassin') {
        didAssassinPhase = true
        const assassinPage = await findAssassinPage(pages)
        if (assassinPage) {
          await assassinPage.getByRole('radio').first().check()
          await assassinPage.getByRole('button', { name: 'Confirm Kill' }).click()
        }
        break
      }
      if (phase === 'gameover') break

      if (phase === 'roundResult') {
        await new Promise((r) => setTimeout(r, 1000))
        const continuePage = await findPageWithButton(pages, 'Continue', /^Continue$/)
        if (continuePage) {
          await continuePage.getByRole('button', { name: /^Continue$/ }).click()
        }
        round++
      } else {
        break
      }
    }

    // 8) 刺杀后等待状态同步，至少一页出现结束画面（GAME OVER 或 TEAM WINS）
    await new Promise((r) => setTimeout(r, 3000))
    const anyGameOver = await Promise.any(
      pages.flatMap((p) => [
        p.getByText('GAME OVER').waitFor({ state: 'visible', timeout: 25000 }),
        p.getByText(/TEAM WINS/).waitFor({ state: 'visible', timeout: 25000 }),
      ])
    ).then(() => true).catch(() => false)
    if (!anyGameOver) {
      await pages[0].screenshot({ path: 'test-results/failure-page0.png' })
    }
    expect(
      anyGameOver,
      didAssassinPhase
        ? 'Reached assassination and clicked Confirm Kill but no GAME OVER; check app/Firebase.'
        : 'Never reached assassination (loop broke early); check leader/phase timeouts.'
    ).toBe(true)
  })
})

/** 轮询直到任一页出现刺杀 / GAME OVER / 回合结果(Continue)，最多等 25s */
async function waitForNextPhase(
  pages: Page[]
): Promise<'assassin' | 'gameover' | 'roundResult' | 'timeout'> {
  const deadline = Date.now() + 25000
  while (Date.now() < deadline) {
    for (const p of pages) {
      if (await p.getByRole('button', { name: 'Confirm Kill' }).isVisible().catch(() => false))
        return 'assassin'
      if (await p.getByText('GAME OVER').isVisible().catch(() => false)) return 'gameover'
      if (await p.getByRole('button', { name: /^Continue$/ }).isVisible().catch(() => false))
        return 'roundResult'
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  return 'timeout'
}

/** 队长页 = 有 data-testid=team-selector-leader 的页面，否则退化为「有可点 checkbox」的页 */
async function findLeaderPage(pages: Page[], _teamSize: number): Promise<Page | null> {
  for (const page of pages) {
    try {
      await page.getByTestId('team-selector-leader').waitFor({ state: 'visible', timeout: 5000 })
      return page
    } catch {
      // not this page
    }
  }
  const candidates = await Promise.all(
    pages.map(async (page) => {
      try {
        await page.getByRole('button', { name: 'Confirm Team' }).waitFor({ state: 'visible', timeout: 5000 })
        const firstCheckbox = page.getByRole('checkbox').first()
        await firstCheckbox.waitFor({ state: 'visible', timeout: 2000 })
        return (await firstCheckbox.isDisabled()) ? null : page
      } catch {
        return null
      }
    })
  )
  return candidates.find((p) => p !== null) ?? null
}

async function findPageWithButton(pages: Page[], _label: string, name: RegExp | string): Promise<Page | null> {
  for (const page of pages) {
    const btn = page.getByRole('button', { name })
    try {
      await btn.waitFor({ state: 'visible', timeout: 3000 })
      return page
    } catch {
      // not this page
    }
  }
  return null
}

async function findAssassinPage(pages: Page[]): Promise<Page | null> {
  for (const page of pages) {
    if (await page.getByRole('button', { name: 'Confirm Kill' }).isVisible()) return page
  }
  return null
}
