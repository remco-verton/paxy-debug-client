/*
 * Initial + live page context.
 *
 * Live context: setSessionContext(articleCode, categoryId).
 * The URL's article/categoryId parameters initialize the test controls only.
 */

const DEFAULT_ARTICLE_NUMBER = '756798';
const DEFAULT_CATEGORY_ID = '10001';
const ARTICLE_QUERY_PARAMETER = 'article';
const CATEGORY_QUERY_PARAMETER = 'categoryId';

const CHAT_INVITE_DELAY_MS = 4000;

let chatInviteTimer = null;
let messagingButtonCreated = false;
let chatHasBeenOpened = false;
let chatInviteConsumed = false;
let launcherSyncAttempts = 0;
let launcherSyncTimer = null;


function getCurrentArticleNumber() {
    const params = new URLSearchParams(window.location.search);
    const article = (params.get(ARTICLE_QUERY_PARAMETER) || '').trim();

    return article || DEFAULT_ARTICLE_NUMBER;
}

function getCurrentCategoryId() {
    const params = new URLSearchParams(window.location.search);
    const categoryId = (params.get(CATEGORY_QUERY_PARAMETER) || '').trim();

    return categoryId || DEFAULT_CATEGORY_ID;
}

let currentArticleNumber = getCurrentArticleNumber();
let currentCategoryId = getCurrentCategoryId();


function log(message, className = '') {
    console.log('[Krafty test]', message);

    const status = document.getElementById('status');
    if (!status) return;

    const line = document.createElement('div');
    line.className = className;
    line.textContent =
        new Date().toLocaleTimeString() + '  ' + message;

    status.appendChild(line);
    status.scrollTop = status.scrollHeight;
}


function errorText(error) {
    if (!error) return 'unknown error';
    if (typeof error === 'string') return error;
    if (error.message) return error.message;

    try {
        return JSON.stringify(error);
    } catch (_) {
        return String(error);
    }
}
