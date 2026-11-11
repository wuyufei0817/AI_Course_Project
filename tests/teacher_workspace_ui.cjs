/* Optional browser acceptance: NODE_PATH must expose Playwright; uses installed Chrome. */
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

async function main() {
  const root = path.resolve(__dirname, '..');
  fs.mkdirSync(path.join(root, '.tmp'), { recursive: true });
  const dbPath = path.join(root, '.tmp', `teacher-ui-${Date.now()}.db`);
  const port = process.env.AI4EN_UI_PORT || '8853';
  const base = `http://127.0.0.1:${port}`;
  const server = spawn(process.env.PYTHON || 'python', ['app/server.py', '--port', port], {
    cwd: root, env: { ...process.env, AI4EN_DB_PATH: dbPath, PYTHONUTF8: '1' }, stdio: 'ignore', windowsHide: true,
  });
  let browser, page;
  try {
    for (let i = 0; i < 100; i++) {
      try { if ((await fetch(base + '/api/health')).ok) break; } catch (_) {}
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    browser = await chromium.launch({ headless: true, channel: 'chrome' });
    page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    page.on('response', async response => {
      if (response.status() >= 400 && !response.url().endsWith('/api/me')) console.log('HTTP', response.status(), response.url(), await response.text());
    });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(base);
    await page.getByRole('button', { name: '进入工作台', exact: true }).click();
    await page.waitForSelector('.side-nav');
    assert.equal(await page.locator('.side-nav a').count(), 11, '教师应有 11 个直接入口');
    await page.getByLabel('当前课例', { exact: true }).selectOption('1');
    await page.locator('.tw-continue h2', { hasText: 'Animals' }).waitFor();
    await page.screenshot({ path: path.join(root, '.tmp', 'teacher-workspace-desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(root, '.tmp', 'teacher-workspace-mobile.png'), fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole('navigation').getByRole('link', { name: '批改与订正' }).click();
    await page.getByRole('heading', { name: '批改与订正', exact: true }).waitFor();
    assert.equal(await page.locator('.content [data-state="logForm"]').count(), 0, '批改页不应带日志表单');
    await page.getByRole('navigation').getByRole('link', { name: '教学日志' }).click();
    await page.getByLabel('本课完成情况', { exact: true }).fill('浏览器验收：完成本课');
    await page.getByRole('button', { name: '保存日志', exact: true }).click();
    await page.getByText('教学日志已保存', { exact: true }).first().waitFor();
    await page.reload();
    assert.equal(await page.getByLabel('本课完成情况', { exact: true }).inputValue(), '浏览器验收：完成本课');
    await page.getByLabel('当前课例', { exact: true }).selectOption('2');
    await page.waitForURL('**/lesson/2/logs');
    await page.locator('h1', { hasText: "My Family" }).waitFor();
    assert.equal(await page.getByLabel('本课完成情况', { exact: true }).inputValue(), '');
    await page.getByLabel('本课完成情况', { exact: true }).fill('未保存的日志');
    page.once('dialog', dialog => dialog.dismiss());
    await page.getByRole('navigation').getByRole('link', { name: '课例库', exact: true }).click();
    assert.equal(await page.getByLabel('本课完成情况', { exact: true }).inputValue(), '未保存的日志');
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('navigation').getByRole('link', { name: '课例库', exact: true }).click();
    await page.getByRole('heading', { name: '课例库', exact: true }).waitFor();
    await page.getByLabel('搜索课例').fill('Animals');
    assert.equal(await page.locator('.lesson-card:visible').count(), 1);
    await page.getByRole('navigation').getByRole('link', { name: '课堂互动', exact: true }).click();
    await page.getByLabel('观察意见').fill('未发布任务也能记录');
    await page.getByRole('button', { name: '记录观察', exact: true }).click();
    await page.getByText('未发布任务也能记录', { exact: true }).waitFor();
    await page.reload();
    await page.getByText('未发布任务也能记录', { exact: true }).waitFor();
    await page.getByRole('navigation').getByRole('link', { name: '课件与教具', exact: true }).click();
    await page.getByText('本课资源', { exact: true }).waitFor();
    assert.equal(await page.locator('a[href*="null"],a[href*="undefined"]').count(), 0);
    await page.getByLabel('当前课例', { exact: true }).selectOption('1');
    await page.locator('h1', { hasText: 'Animals' }).waitFor();
    // A second published task exposes selector wiring and cross-task isolation.
    const created = await (await page.request.post(base + '/api/lessons/1/tasks', { data: {
      class_id: 1, title: '第二次课堂练习', allow_hints: true, show_result: 'immediately',
    } })).json();
    assert.equal((await page.request.post(base + '/api/tasks/' + created.task.id + '/publish')).status(), 200);
    await page.goto(base + '/#/lesson/1/results?task=1');
    await page.getByRole('heading', { name: '学情分析', exact: true }).waitFor();
    await page.getByLabel('选择任务').selectOption(String(created.task.id));
    await page.waitForURL('**/results?task=' + created.task.id);
    await page.getByText('0 / 6', { exact: true }).waitFor();
    assert.equal(await page.locator('.content [data-state="logForm"]').count(), 0);
    const draft = await (await page.request.post(base + '/api/lessons/1/tasks', { data: {
      class_id: 1, title: '未发布草稿验收', allow_hints: true, show_result: 'immediately',
    } })).json();
    await page.goto(base + '/#/lesson/1/tasks');
    const taskTitle = page.locator('[data-state="taskForm"][data-bind="title"]');
    await taskTitle.fill('尚未保存的新任务');
    page.once('dialog', dialog => dialog.dismiss());
    await page.locator('[data-act="tw-edit-task"][data-id="' + draft.task.id + '"]').click();
    assert.equal(await taskTitle.inputValue(), '尚未保存的新任务', '取消切换应保留当前输入');
    page.once('dialog', dialog => dialog.accept());
    await page.locator('[data-act="tw-edit-task"][data-id="' + draft.task.id + '"]').click();
    await page.getByText('编辑草稿任务', { exact: true }).waitFor();
    assert.equal(await taskTitle.inputValue(), '未发布草稿验收', '放弃当前编辑后应载入选中的草稿');
    const taskCountBefore = (await (await page.request.get(base + '/api/lessons/1/tasks')).json()).tasks.length;
    await taskTitle.fill('已更新的草稿验收');
    const savedTask = page.waitForResponse(response => response.url().endsWith('/api/tasks/' + draft.task.id) && response.request().method() === 'PATCH');
    await page.getByRole('button', { name: '保存草稿', exact: true }).click();
    assert.equal((await savedTask).status(), 200);
    await page.getByText('已更新的草稿验收', { exact: true }).waitFor();
    const tasksAfter = (await (await page.request.get(base + '/api/lessons/1/tasks')).json()).tasks;
    assert.equal(tasksAfter.length, taskCountBefore, '保存选中草稿不应创建重复任务');
    assert.equal(tasksAfter.find(task => task.id === draft.task.id).title, '已更新的草稿验收');
    await page.getByLabel('当前课例', { exact: true }).selectOption('2');
    await page.locator('h1', { hasText: 'My Family' }).waitFor();
    assert.notEqual(await taskTitle.inputValue(), '已更新的草稿验收', '切换课例不应带入旧草稿');
    await page.goto(base + '/#/lesson/1/reviews?task=' + draft.task.id);
    await page.getByRole('heading', { name: '批改与订正', exact: true }).waitFor();
    assert.equal(await page.getByRole('link', { name: '查看与批改', exact: true }).count(), 0, '草稿不能显示其他任务的作答');
    assert.equal(await page.locator('.tw-task-picker').count(), 0, '草稿结果不能静默切到另一份已发布任务');
    await page.goto(base + '/#/lesson/1/reviews?task=1');
    await page.getByRole('link', { name: '查看与批改', exact: true }).first().click();
    await page.getByRole('link', { name: '返回批改列表', exact: true }).waitFor();
    await page.reload();
    await page.getByRole('link', { name: '返回批改列表', exact: true }).waitFor();
    assert.equal(await page.getByLabel('当前课例', { exact: true }).inputValue(), '1');
    await page.getByRole('link', { name: '返回批改列表', exact: true }).click();
    await page.getByRole('heading', { name: '批改与订正', exact: true }).waitFor();
    await page.getByRole('navigation').getByRole('link', { name: '练习与命题', exact: true }).click();
    await page.getByText('听写登记', { exact: true }).waitFor();
    await page.getByRole('navigation').getByRole('link', { name: '教案备课', exact: true }).click();
    const board = page.locator('[data-state="plan"][data-bind="board"]');
    await board.fill('浏览器验收板书');
    const savedPlan = page.waitForResponse(response => response.url().endsWith('/api/lessons/1/plan') && response.request().method() === 'PATCH');
    await page.getByRole('button', { name: '保存草稿', exact: true }).click();
    assert.equal((await savedPlan).status(), 200);
    await page.reload();
    assert.equal(await board.inputValue(), '浏览器验收板书');
    await page.locator('[data-act="del-obj"]').first().click();
    let structureWarning = false;
    page.once('dialog', async dialog => { structureWarning = true; await dialog.dismiss(); });
    await page.getByRole('navigation').getByRole('link', { name: '课例库', exact: true }).click();
    assert.equal(structureWarning, true, '删除目标也必须触发未保存提醒');
    assert.equal(await page.locator('[data-act="del-obj"]').count(), 2);
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('navigation').getByRole('link', { name: '教师成长与帮助', exact: true }).click();
    await page.getByRole('button', { name: '打印与下载', exact: true }).click();
    await page.getByText('本课资源', { exact: true }).waitFor();
    assert.equal(await page.locator('a[href*="null"],a[href*="undefined"],a[href*="task//"]').count(), 0);
    await page.getByRole('link', { name: '找茬侦探' }).click();
    await page.frameLocator('iframe[title="教师培训练习"]').getByRole('heading', { name: 'AI找茬侦探', exact: true }).waitFor();
    await page.goto(base + '/#/');
    await page.getByRole('heading', { name: '教师工作台', exact: true }).waitFor();
    await page.screenshot({ path: path.join(root, '.tmp', 'teacher-workspace-tested-desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(root, '.tmp', 'teacher-workspace-tested-mobile.png'), fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, '小屏不得横向溢出');
    await page.getByLabel('展开或收起页面导航').click();
    assert.equal(await page.locator('.mobile-nav a').count(), 11, '移动菜单应保留全部教师模块');
    await page.getByRole('navigation', { name: '移动端页面导航' }).getByRole('link', { name: '学情分析', exact: true }).click();
    await page.getByRole('heading', { name: '学情分析', exact: true }).waitFor();
    assert.equal(await page.locator('.mobile-menu[open]').count(), 0, '导航后应收起移动菜单');
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole('button', { name: '退出', exact: true }).click();
    await page.locator('#username').fill('p_zhang');
    await page.locator('#password').fill('par123');
    await page.getByRole('button', { name: '进入工作台', exact: true }).click();
    await page.waitForSelector('.side-nav');
    assert.equal(await page.locator('.side-nav a').count(), 7);
    await page.getByRole('button', { name: '退出', exact: true }).click();
    await page.locator('#username').fill('s_zhang');
    await page.locator('#password').fill('stu123');
    await page.getByRole('button', { name: '进入工作台', exact: true }).click();
    await page.waitForSelector('.side-nav');
    assert.equal(await page.locator('.side-nav a').count(), 7, '保留同学新增的七个学生模块');
    for (const label of ['学习概览', '我的任务', '单词卡', '错题本', '订正记录', '学习报告', '使用说明']) {
      await page.getByRole('navigation', { name: '主要导航' }).getByRole('link', { name: label, exact: true }).click();
      await page.getByRole('heading', { name: label, exact: true }).waitFor();
    }
    await page.getByRole('button', { name: '退出', exact: true }).click();
    await page.locator('#username').fill('t_li');
    await page.locator('#password').fill('teach123');
    await page.getByRole('button', { name: '进入工作台', exact: true }).click();
    await page.getByRole('heading', { name: '教师工作台', exact: true }).waitFor();
    assert.equal(await page.getByLabel('当前课例', { exact: true }).isDisabled(), true);
    await page.getByRole('navigation').getByRole('link', { name: '教师成长与帮助', exact: true }).click();
    await page.getByRole('button', { name: '打印与下载', exact: true }).click();
    await page.getByText('先在课例库创建或选择课例，再准备本课资源。', { exact: true }).waitFor();
    assert.equal(await page.locator('a[href*="null"],a[href*="undefined"],a[href*="task//"]').count(), 0);
    await page.getByRole('navigation', { name: '主要导航' }).getByRole('link', { name: '课例库', exact: true }).click();
    await page.getByRole('button', { name: '新建课例', exact: true }).click();
    await page.locator('#newLesson [name="title"]').fill('合并验收新课例');
    await page.locator('#newLesson [name="topic"]').fill('Animals');
    await page.locator('#newLesson [name="vocab"]').fill('cat, dog');
    await page.getByRole('button', { name: '创建并备课', exact: true }).click();
    await page.locator('h1', { hasText: '合并验收新课例' }).waitFor();
    await page.locator('#sec-cond').waitFor();
    assert.equal((await (await page.request.get(base + '/api/lessons')).json()).lessons.length, 1, '新弹窗只应创建一份课例');
    assert.deepEqual(errors, []);
    console.log('PASS: teacher navigation, context, logs, unsaved edits, filters, observations, resources, mobile and role regression');
  } catch (error) {
    if (page) {
      console.log('PAGE', await page.locator('body').innerText());
      await page.screenshot({ path: path.join(root, '.tmp', 'teacher-ui-failure.png'), fullPage: true });
    }
    throw error;
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
