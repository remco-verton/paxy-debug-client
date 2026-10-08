// Match Krafty's creation/resume lifecycle. A page reload is not a new chat.
let paxyContextReady = false;
let paxyConversationActive = false;
let paxyCreatedOnThisPage = false;
let paxyConversationEnded = false;
let paxyContextRetry;
const PAXY_CONVERSATION_KEY = 'paxy-agentforce-conversation:00D9K00000L1UMb:Paxi_testing';
let paxyRestoringConversation = false;
try {
    paxyRestoringConversation = sessionStorage.getItem(PAXY_CONVERSATION_KEY) === 'active';
} catch (error) { /* Lifecycle events still work when storage is unavailable. */ }

function rememberPaxyConversation(active) {
    try {
        if (active) sessionStorage.setItem(PAXY_CONVERSATION_KEY, 'active');
        else sessionStorage.removeItem(PAXY_CONVERSATION_KEY);
    } catch (error) { /* Storage restrictions must not prevent chat. */ }
}

function getPaxyContextRetryDelayMs() {
    const delay = Number(window.PAXY_CONTEXT_RETRY_DELAY_MS ?? 500);
    return Number.isFinite(delay) && delay >= 0 ? delay : 500;
}

function reapplyPaxyContext() {
    // No retry timer before both readiness and conversation restoration.
    if (!paxyContextReady || !paxyConversationActive) return;
    sendPaxyPageContext(false);
    clearTimeout(paxyContextRetry);
    paxyContextRetry = setTimeout(function () {
        if (!paxyConversationEnded) sendPaxyPageContext(false);
    }, getPaxyContextRetryDelayMs());
}

function setLivePageContext() {
    return sendPaxyPageContext(!paxyRestoringConversation && !paxyConversationActive);
}

function sendPaxyPageContext(sendWithNewConversation = false) {
    if (!paxyContextReady || (!sendWithNewConversation && !paxyConversationActive)) {
        return Promise.resolve(false);
    }
    if (
        !window.embeddedservice_bootstrap ||
        !embeddedservice_bootstrap.utilAPI ||
        typeof embeddedservice_bootstrap.utilAPI.setSessionContext !== 'function'
    ) {
        log('utilAPI.setSessionContext is unavailable', 'err');
        return Promise.resolve(false);
    }

    const context = [
        {name: 'articleCode', value: {valueType: 'TextValue', textValue: currentArticleNumber}},
        {name: 'categoryId', value: {valueType: 'TextValue', textValue: currentCategoryId}}
    ];

    // Promise resolution confirms client-side queuing, not backend application.
    return Promise.resolve().then(function () {
        return embeddedservice_bootstrap.utilAPI.setSessionContext(context, {sendWithNewConversation});
    })
        .then(function () {
            log(
                'Live context set: article=' +
                (currentArticleNumber || '<none>') +
                ', categoryId=' +
                (currentCategoryId || '<none>'),
                'ok'
            );
            console.debug('[Paxy test] Direct context', context, {sendWithNewConversation});
            return true;
        })
        .catch(function (error) {
            log(
                'Live context FAILED: ' + errorText(error),
                'err'
            );
            console.error('[Krafty test] setSessionContext failed', error);
            return false;
        });
}


function updatePageContextDisplay() {
    const article = document.getElementById('current-article');
    const category = document.getElementById('current-category');

    if (article) article.textContent = currentArticleNumber || '<none>';
    if (category) category.textContent = currentCategoryId || '<none>';
}


/*
 * Test helper that simulates SPA/product-page navigation without
 * closing the existing chat. The real webshop should call
 * updateKraftyPageContext(articleNumber, categoryId) from its own
 * router/product-page change event.
 */
function updateKraftyPageContext(articleNumber, categoryId) {
    currentArticleNumber = String(articleNumber || '').trim();
    currentCategoryId = String(categoryId || '').trim();

    const browserUrl = new URL(window.location.href);

    if (currentArticleNumber) {
        browserUrl.searchParams.set(ARTICLE_QUERY_PARAMETER, currentArticleNumber);
    } else {
        browserUrl.searchParams.delete(ARTICLE_QUERY_PARAMETER);
    }

    if (currentCategoryId) {
        browserUrl.searchParams.set(CATEGORY_QUERY_PARAMETER, currentCategoryId);
    } else {
        browserUrl.searchParams.delete(CATEGORY_QUERY_PARAMETER);
    }

    /* Simulate SPA navigation: URL changes, page and chat stay open. */
    window.history.pushState({}, '', browserUrl.toString());
    updatePageContextDisplay();

    log(
        'Simulated page navigation: article=' +
        (currentArticleNumber || '<none>') +
        ', categoryId=' +
        (currentCategoryId || '<none>'),
        'info'
    );

    return setLivePageContext();
}


function updatePageContextFromInputs() {
    const articleInput = document.getElementById('article-input');
    const categoryInput = document.getElementById('category-input');

    return updateKraftyPageContext(
        articleInput ? articleInput.value : '',
        categoryInput ? categoryInput.value : ''
    );
}


// Full document navigation: let page initialization and the widget run again.
function navigateProductPageFromInputs() {
    const article = document.getElementById('article-input').value.trim();
    const category = document.getElementById('category-input').value.trim();
    const url = new URL(window.location.href);

    url.searchParams.set(ARTICLE_QUERY_PARAMETER, article);
    url.searchParams.set(CATEGORY_QUERY_PARAMETER, category);
    url.hash = '';
    window.location.assign(url.toString());
}
