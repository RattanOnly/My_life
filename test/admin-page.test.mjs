import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { createContext, runInContext } from 'node:vm';

const adminScriptUrl = new URL('../source/js/admin-dashboard.js', import.meta.url);

class FakeElement {
  constructor(name) {
    this.name = name;
    this.children = [];
    this.className = '';
    this.colSpan = 0;
    this.dataset = {};
    this.disabled = false;
    this.formValues = {};
    this.hidden = false;
    this.listeners = new Map();
    this.selectorMap = new Map();
    this.type = '';
    this.value = '';
    this._textContent = '';
  }

  get textContent() {
    return this._textContent;
  }

  set textContent(value) {
    this._textContent = String(value);
    this.children = [];
  }

  addEventListener(type, handler) {
    this.listeners.set(type, handler);
  }

  append(...children) {
    this.children.push(...children);
  }

  dispatch(type) {
    const handler = this.listeners.get(type);
    if (!handler) return undefined;

    return handler({
      defaultPrevented: false,
      preventDefault() {
        this.defaultPrevented = true;
      }
    });
  }

  querySelector(selector) {
    return this.selectorMap.get(selector) || null;
  }

  reset() {
    this.formValues = {};
  }
}

const createDeferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, reject, resolve };
};

const createResponse = payload => {
  const isResponseShape = Object.hasOwn(payload, 'ok') || Object.hasOwn(payload, 'status') || Object.hasOwn(payload, 'body');
  const status = isResponseShape ? payload.status || 200 : 200;
  const ok = isResponseShape ? payload.ok ?? status < 400 : true;
  const body = isResponseShape ? payload.body ?? {} : payload;

  return {
    ok,
    status,
    async json() {
      return body;
    }
  };
};

const settleAsyncWork = async () => {
  for (let index = 0; index < 50; index += 1) {
    await Promise.resolve();
  }
};

const collectText = element => [
  element.textContent,
  ...element.children.map(child => collectText(child))
].join(' ');

const defaultAdminData = {
  onlineCount: 3,
  visitorLogs: [{
    ipAddress: '203.0.113.10',
    isOwnerVisitor: false,
    visitedAt: '2026-07-04T01:02:03Z',
    visitedPage: '/echo/',
    visitorDeviceSummary: 'Desktop',
    visitorLocation: '上海'
  }],
  visitorLogsPagination: {
    page: 1,
    pageSize: 20,
    total: 1,
    totalPages: 1
  }
};

const defaultCommentsData = {
  comments: [{
    id: 1,
    articlePath: '/echo/',
    body: '可见评论',
    createdAt: '2026-07-04T01:03:04Z',
    email: 'reader@example.com',
    name: '读者'
  }],
  commentsPagination: {
    page: 1,
    pageSize: 20,
    total: 1,
    totalPages: 1
  }
};

const createAdminRuntime = ({
  adminDataResponses = [defaultAdminData],
  commentsResponses = [defaultCommentsData],
  echoStatusResponses = [{ enabled: true }],
  echoUsageResponses = [{
    summary: {
      totalCount: 1,
      successCount: 1,
      failureCount: 0,
      promptTokens: 10,
      completionTokens: 20
    },
    recentEvents: []
  }],
  echoPostResponses = [{ ok: true, body: { enabled: false } }]
} = {}) => {
  const root = new FakeElement('root');
  const loginForm = new FakeElement('loginForm');
  const status = new FakeElement('status');
  const content = new FakeElement('content');
  const onlineCount = new FakeElement('onlineCount');
  const visitorLogs = new FakeElement('visitorLogs');
  const visitorFilters = new FakeElement('visitorFilters');
  const visitorFilterResetButton = new FakeElement('visitorFilterResetButton');
  const visitorPagePrevButton = new FakeElement('visitorPagePrevButton');
  const visitorPageNextButton = new FakeElement('visitorPageNextButton');
  const visitorPageSummary = new FakeElement('visitorPageSummary');
  const commentFilters = new FakeElement('commentFilters');
  const commentFilterResetButton = new FakeElement('commentFilterResetButton');
  const commentPagePrevButton = new FakeElement('commentPagePrevButton');
  const commentPageNextButton = new FakeElement('commentPageNextButton');
  const commentPageSummary = new FakeElement('commentPageSummary');
  const comments = new FakeElement('comments');
  const refreshButton = new FakeElement('refreshButton');
  const logoutButton = new FakeElement('logoutButton');
  const clearVisitsButton = new FakeElement('clearVisitsButton');
  const echoEnabled = new FakeElement('echoEnabled');
  const echoToggleButton = new FakeElement('echoToggleButton');
  const echoUsage = new FakeElement('echoUsage');
  const calls = [];
  const localStorageStore = new Map();

  content.hidden = true;
  echoEnabled.textContent = '--';
  echoToggleButton.textContent = '暂停 Echo';
  loginForm.formValues.password = 'secret';
  root.dataset.adminDataEndpoint = '/unit-admin-data';
  root.dataset.adminCommentsEndpoint = '/unit-admin-comments';
  root.dataset.adminOwnerIpMarksEndpoint = '/unit-owner-ip-marks';
  root.dataset.adminClearVisitsEndpoint = '/unit-admin-visits';
  root.dataset.adminEchoStatusEndpoint = '/unit-admin-echo';
  root.dataset.adminEchoUsageEndpoint = '/unit-admin-echo-usage';

  [
    ['[data-admin-login]', loginForm],
    ['[data-admin-status]', status],
    ['[data-admin-content]', content],
    ['[data-admin-online-count]', onlineCount],
    ['[data-admin-visitor-logs]', visitorLogs],
    ['[data-admin-visitor-filters]', visitorFilters],
    ['[data-admin-visitor-filter-reset]', visitorFilterResetButton],
    ['[data-admin-visitor-page-prev]', visitorPagePrevButton],
    ['[data-admin-visitor-page-next]', visitorPageNextButton],
    ['[data-admin-visitor-page-summary]', visitorPageSummary],
    ['[data-admin-comment-filters]', commentFilters],
    ['[data-admin-comment-filter-reset]', commentFilterResetButton],
    ['[data-admin-comment-page-prev]', commentPagePrevButton],
    ['[data-admin-comment-page-next]', commentPageNextButton],
    ['[data-admin-comment-page-summary]', commentPageSummary],
    ['[data-admin-comments]', comments],
    ['[data-admin-refresh]', refreshButton],
    ['[data-admin-logout]', logoutButton],
    ['[data-admin-clear-visits]', clearVisitsButton],
    ['[data-admin-echo-enabled]', echoEnabled],
    ['[data-admin-echo-toggle]', echoToggleButton],
    ['[data-admin-echo-usage]', echoUsage]
  ].forEach(([selector, element]) => {
    root.selectorMap.set(selector, element);
  });

  const makeQueuedResponse = async (queue, fallback) => createResponse(await (queue.shift() ?? fallback));
  const adminDataQueue = [...adminDataResponses];
  const commentsQueue = [...commentsResponses];
  const echoStatusQueue = [...echoStatusResponses];
  const echoUsageQueue = [...echoUsageResponses];
  const echoPostQueue = [...echoPostResponses];

  const fetch = async (url, options = {}) => {
    calls.push({ url, options });

    if (url.startsWith('/unit-admin-data')) return makeQueuedResponse(adminDataQueue, defaultAdminData);
    if (url.startsWith('/unit-admin-comments')) return makeQueuedResponse(commentsQueue, defaultCommentsData);
    if (url === '/unit-admin-echo' && options.method === 'POST') {
      return makeQueuedResponse(echoPostQueue, { ok: true, body: { enabled: false } });
    }
    if (url === '/unit-admin-echo') return makeQueuedResponse(echoStatusQueue, { enabled: true });
    if (url === '/unit-admin-echo-usage') return makeQueuedResponse(echoUsageQueue, { summary: {}, recentEvents: [] });

    return createResponse({ ok: false, status: 404, body: {} });
  };

  const localStorage = {
    getItem(key) {
      return localStorageStore.has(key) ? localStorageStore.get(key) : null;
    },
    removeItem(key) {
      localStorageStore.delete(key);
    },
    setItem(key, value) {
      localStorageStore.set(key, String(value));
    }
  };

  const context = createContext({
    Date,
    FormData: class FakeFormData {
      constructor(form) {
        this.form = form;
      }

      get(name) {
        return this.form.formValues[name] ?? '';
      }
    },
    JSON,
    URLSearchParams,
    document: {
      createElement: tagName => new FakeElement(tagName),
      getElementById: id => (id === 'admin-dashboard' ? root : null)
    },
    fetch,
    localStorage,
    window: {
      confirm: () => true
    }
  });

  return {
    calls,
    comments,
    content,
    context,
    echoEnabled,
    echoToggleButton,
    echoUsage,
    localStorage,
    loginForm,
    onlineCount,
    root,
    status,
    visitorLogs
  };
};

const runAdminScript = async runtime => {
  const script = await readFile(adminScriptUrl, 'utf8');
  runInContext(script, runtime.context, { filename: 'admin-dashboard.js' });
  await settleAsyncWork();
};

test('admin page renders a private Visitor Admin Page shell', async () => {
  const page = await readFile(new URL('../source/admin/index.md', import.meta.url), 'utf8');

  assert.match(page, /title:\s*后台管理/);
  assert.match(page, /comments:\s*false/);
  assert.match(page, /id="admin-dashboard"/);
  assert.match(page, /data-admin-data-endpoint="\/admin-data"/);
  assert.match(page, /data-admin-comments-endpoint="\/admin-comments"/);
  assert.match(page, /data-admin-owner-ip-marks-endpoint="\/admin-owner-ip-marks"/);
  assert.match(page, /data-admin-clear-visits-endpoint="\/admin-visits"/);
  assert.match(page, /data-admin-echo-status-endpoint="\/admin-echo"/);
  assert.match(page, /data-admin-echo-usage-endpoint="\/admin-echo-usage"/);
  assert.match(page, /data-admin-refresh/);
  assert.match(page, /data-admin-logout/);
  assert.match(page, /data-admin-clear-visits/);
  assert.match(page, /data-admin-echo-enabled/);
  assert.match(page, /data-admin-echo-toggle/);
  assert.match(page, /data-admin-echo-usage/);
  assert.match(page, /data-admin-visitor-filters/);
  assert.match(page, /name="visitorFrom"/);
  assert.match(page, /name="visitorTo"/);
  assert.match(page, /name="visitorOwner"/);
  assert.match(page, /name="visitorPageKeyword"/);
  assert.match(page, /data-admin-visitor-filter-reset/);
  assert.match(page, /data-admin-visitor-pagination/);
  assert.match(page, /data-admin-visitor-page-prev/);
  assert.match(page, /data-admin-visitor-page-next/);
  assert.match(page, /data-admin-visitor-page-summary/);
  assert.match(page, /data-admin-comment-filters/);
  assert.match(page, /name="commentFrom"/);
  assert.match(page, /name="commentTo"/);
  assert.match(page, /name="commentArticlePathKeyword"/);
  assert.match(page, /name="commentKeyword"/);
  assert.match(page, /data-admin-comment-filter-reset/);
  assert.match(page, /data-admin-comment-pagination/);
  assert.match(page, /data-admin-comment-page-prev/);
  assert.match(page, /data-admin-comment-page-next/);
  assert.match(page, /data-admin-comment-page-summary/);
  assert.match(page, /<th>访客<\/th>/);
  assert.match(page, /<th>位置<\/th>/);
  assert.match(page, /<th>操作<\/th>/);
  assert.doesNotMatch(page, /<th>IP<\/th>/);
  assert.match(page, /<tbody data-admin-visitor-logs><\/tbody>/);
  assert.match(page, /<div data-admin-comments><\/div>/);
  assert.match(page, /\/js\/admin-dashboard\.js/);
  assert.doesNotMatch(page, /\n\s{4}<section class="admin-section">/);
});

test('admin dashboard script authenticates, loads owner data, and deletes comments', async () => {
  const script = await readFile(new URL('../source/js/admin-dashboard.js', import.meta.url), 'utf8');

  assert.match(script, /Authorization/);
  assert.match(script, /Bearer/);
  assert.match(script, /admin-data/);
  assert.match(script, /admin-comments/);
  assert.match(script, /method:\s*'DELETE'/);
  assert.match(script, /localStorage/);
  assert.match(script, /admin_dashboard_password/);
  assert.match(script, /data-admin-refresh/);
  assert.match(script, /data-admin-logout/);
  assert.match(script, /data-admin-clear-visits/);
  assert.match(script, /adminOwnerIpMarksEndpoint/);
  assert.match(script, /adminClearVisitsEndpoint/);
  assert.match(script, /adminEchoStatusEndpoint/);
  assert.match(script, /adminEchoUsageEndpoint/);
  assert.match(script, /visitorFilterState/);
  assert.match(script, /commentFilterState/);
  assert.match(script, /URLSearchParams/);
  assert.match(script, /visitorPageSize:\s*20/);
  assert.match(script, /commentPageSize:\s*20/);
  assert.match(script, /data-admin-visitor-filters/);
  assert.match(script, /data-admin-visitor-filter-reset/);
  assert.match(script, /data-admin-visitor-page-prev/);
  assert.match(script, /data-admin-visitor-page-next/);
  assert.match(script, /data-admin-comment-filters/);
  assert.match(script, /data-admin-comment-filter-reset/);
  assert.match(script, /data-admin-comment-page-prev/);
  assert.match(script, /data-admin-comment-page-next/);
  assert.match(script, /visitorLogsPagination/);
  assert.match(script, /commentsPagination/);
  assert.match(script, /markOwnerIp/);
  assert.match(script, /unmarkOwnerIp/);
  assert.match(script, /log\.isOwnerVisitor/);
  assert.match(script, /log\.visitorLocation/);
  assert.match(script, /formatVisitorLocation/);
  assert.match(script, /formatVisitedPage/);
  assert.match(script, /loadEchoAdmin/);
  assert.match(script, /toggleEchoEnabled/);
  assert.match(script, /renderEchoUsage/);
  assert.match(script, /decodeURI/);
  assert.match(script, /本机/);
  assert.doesNotMatch(script, /appendCell\(row,\s*log\.visitorLocation\s*\|\|\s*'未知地区'\)/);
  assert.doesNotMatch(script, /appendCell\(row,\s*log\.visitedPage\)/);
  assert.doesNotMatch(script, /promptText|replyText|conversationText/);
  assert.doesNotMatch(script, /innerHTML\s*=/);
});

test('admin dashboard styles keep Visitor Log filters and pagination compact', async () => {
  const styles = await readFile(new URL('../source/_data/styles.styl', import.meta.url), 'utf8');

  assert.match(styles, /\.admin-filter-form/);
  assert.match(styles, /\.admin-pagination/);
  assert.match(styles, /min-height:\s*44px/);
  assert.match(styles, /overflow-x:\s*auto/);
  assert.match(styles, /@media\s+\(max-width:\s*700px\)/);
  assert.match(styles, /\.admin-echo-status/);
  assert.match(styles, /\.admin-echo-usage/);
});

test('admin dashboard shows core data and saves password while Echo usage is still loading', async () => {
  const slowUsage = createDeferred();
  const runtime = createAdminRuntime({
    echoUsageResponses: [slowUsage.promise]
  });

  await runAdminScript(runtime);
  runtime.loginForm.dispatch('submit');
  await settleAsyncWork();

  const coreState = {
    contentHidden: runtime.content.hidden,
    savedPassword: runtime.localStorage.getItem('admin_dashboard_password'),
    onlineCount: runtime.onlineCount.textContent,
    renderedComments: runtime.comments.children.length,
    renderedVisitorLogs: runtime.visitorLogs.children.length
  };

  slowUsage.resolve({ summary: {}, recentEvents: [] });
  await settleAsyncWork();

  assert.equal(coreState.contentHidden, false);
  assert.equal(coreState.savedPassword, 'secret');
  assert.equal(coreState.onlineCount, '3');
  assert.equal(coreState.renderedComments, 1);
  assert.equal(coreState.renderedVisitorLogs, 1);
});

test('admin dashboard keeps Echo enabled state when usage loading fails', async () => {
  const runtime = createAdminRuntime({
    echoStatusResponses: [{ enabled: false }],
    echoUsageResponses: [{ ok: false, status: 500, body: {} }]
  });

  await runAdminScript(runtime);
  runtime.loginForm.dispatch('submit');
  await settleAsyncWork();

  assert.equal(runtime.content.hidden, false);
  assert.equal(runtime.echoEnabled.textContent, '暂停');
  assert.equal(runtime.echoToggleButton.textContent, '开启 Echo');
  assert.equal(runtime.echoToggleButton.disabled, false);
  assert.equal(runtime.echoUsage.textContent, 'Echo 状态暂时无法加载。');
});

test('admin dashboard disables Echo toggle when status loading fails', async () => {
  const runtime = createAdminRuntime({
    echoStatusResponses: [{ ok: false, status: 500, body: {} }],
    echoUsageResponses: [{
      summary: {
        totalCount: 1,
        successCount: 1,
        failureCount: 0,
        promptTokens: 4,
        completionTokens: 8
      },
      recentEvents: []
    }]
  });

  await runAdminScript(runtime);
  runtime.loginForm.dispatch('submit');
  await settleAsyncWork();

  assert.equal(runtime.content.hidden, false);
  assert.equal(runtime.onlineCount.textContent, '3');
  assert.equal(runtime.comments.children.length, 1);
  assert.equal(runtime.visitorLogs.children.length, 1);
  assert.equal(runtime.echoEnabled.textContent, '无法加载');
  assert.equal(runtime.echoToggleButton.disabled, true);
  assert.notEqual(runtime.echoToggleButton.textContent, '暂停 Echo');
  assert.match(runtime.echoToggleButton.textContent, /无法加载|不可用/);
});

test('admin dashboard disables Echo toggle in flight and keeps POST result when refresh usage fails', async () => {
  const postToggle = createDeferred();
  const runtime = createAdminRuntime({
    echoStatusResponses: [{ enabled: true }, { enabled: false }],
    echoUsageResponses: [
      { summary: {}, recentEvents: [] },
      { ok: false, status: 500, body: {} }
    ],
    echoPostResponses: [postToggle.promise]
  });

  await runAdminScript(runtime);
  runtime.loginForm.dispatch('submit');
  await settleAsyncWork();
  assert.equal(runtime.echoEnabled.textContent, '开启');
  assert.equal(runtime.echoToggleButton.textContent, '暂停 Echo');

  runtime.echoToggleButton.dispatch('click');
  runtime.echoToggleButton.dispatch('click');
  await settleAsyncWork();

  const postCallsWhilePending = runtime.calls.filter(call => call.url === '/unit-admin-echo' && call.options.method === 'POST');
  assert.equal(runtime.echoToggleButton.disabled, true);
  assert.equal(postCallsWhilePending.length, 1);
  assert.deepEqual(JSON.parse(postCallsWhilePending[0].options.body), { enabled: false });

  postToggle.resolve({ ok: true, body: { enabled: false } });
  await settleAsyncWork();

  assert.equal(runtime.echoEnabled.textContent, '暂停');
  assert.equal(runtime.echoToggleButton.textContent, '开启 Echo');
  assert.equal(runtime.echoToggleButton.disabled, false);
  assert.equal(runtime.status.textContent, 'Echo 已暂停。');
  assert.equal(runtime.echoUsage.textContent, 'Echo 状态暂时无法加载。');
});

test('admin dashboard restores previous Echo enabled state when toggle POST fails', async () => {
  const postToggle = createDeferred();
  const runtime = createAdminRuntime({
    echoStatusResponses: [{ enabled: true }],
    echoUsageResponses: [{ summary: {}, recentEvents: [] }],
    echoPostResponses: [postToggle.promise]
  });

  await runAdminScript(runtime);
  runtime.loginForm.dispatch('submit');
  await settleAsyncWork();
  assert.equal(runtime.echoEnabled.textContent, '开启');
  assert.equal(runtime.echoToggleButton.textContent, '暂停 Echo');
  assert.equal(runtime.echoToggleButton.disabled, false);

  runtime.echoToggleButton.dispatch('click');
  await settleAsyncWork();

  const postCallsWhilePending = runtime.calls.filter(call => call.url === '/unit-admin-echo' && call.options.method === 'POST');
  assert.equal(runtime.echoToggleButton.disabled, true);
  assert.equal(postCallsWhilePending.length, 1);
  assert.deepEqual(JSON.parse(postCallsWhilePending[0].options.body), { enabled: false });

  postToggle.resolve({ ok: false, status: 500, body: {} });
  await settleAsyncWork();

  assert.equal(runtime.echoEnabled.textContent, '开启');
  assert.equal(runtime.echoToggleButton.textContent, '暂停 Echo');
  assert.equal(runtime.echoToggleButton.disabled, false);
  assert.equal(runtime.status.textContent, 'Echo 状态更新失败。');
});

test('admin dashboard renders Echo usage safely without empty lists or conversation text', async () => {
  const runtime = createAdminRuntime({
    echoUsageResponses: [{
      summary: {
        totalCount: 7,
        successCount: 6,
        failureCount: 1,
        promptTokens: 70,
        completionTokens: 140
      },
      recentEvents: [
        {
          completionTokens: 2,
          conversationText: 'conversation secret',
          createdAt: 'not-a-date',
          promptText: 'prompt secret',
          promptTokens: 1,
          replyText: 'reply secret',
          status: 'success'
        },
        { completionTokens: 4, createdAt: '2026-07-04T00:00:00Z', promptTokens: 3, status: 'failure' },
        { completionTokens: 6, createdAt: '2026-07-04T00:01:00Z', promptTokens: 5, status: 'success' },
        { completionTokens: 8, createdAt: '2026-07-04T00:02:00Z', promptTokens: 7, status: 'success' },
        { completionTokens: 10, createdAt: '2026-07-04T00:03:00Z', promptTokens: 9, status: 'success' },
        { completionTokens: 12, createdAt: '2026-07-04T00:04:00Z', promptTokens: 11, status: 'success' },
        { completionTokens: 14, createdAt: '2026-07-04T00:05:00Z', promptTokens: 13, status: 'success' }
      ]
    }]
  });

  await runAdminScript(runtime);
  runtime.loginForm.dispatch('submit');
  await settleAsyncWork();

  const renderedText = collectText(runtime.echoUsage);
  const list = runtime.echoUsage.children.find(child => child.name === 'ul');
  assert.ok(list);
  assert.equal(list.children.length, 5);
  assert.match(renderedText, /调用 7 次，成功 6 次，失败 1 次。/);
  assert.match(renderedText, /未知时间 · success · 输入 1 · 输出 2/);
  assert.doesNotMatch(renderedText, /Invalid Date/);
  assert.doesNotMatch(renderedText, /prompt secret|reply secret|conversation secret/);
});

test('admin dashboard renders an empty Echo usage event state', async () => {
  const runtime = createAdminRuntime({
    echoUsageResponses: [{
      summary: {
        totalCount: 0,
        successCount: 0,
        failureCount: 0,
        promptTokens: 0,
        completionTokens: 0
      },
      recentEvents: []
    }]
  });

  await runAdminScript(runtime);
  runtime.loginForm.dispatch('submit');
  await settleAsyncWork();

  assert.equal(runtime.echoUsage.children.some(child => child.name === 'ul'), false);
  assert.match(collectText(runtime.echoUsage), /暂无最近调用。/);
});
