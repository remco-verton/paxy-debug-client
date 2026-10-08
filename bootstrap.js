/*
 * Salesforce bootstrap.
 */
function initEmbeddedMessaging() {
    try {
        log('init() called', 'wait');

        embeddedservice_bootstrap.settings.language = 'en_US';
        embeddedservice_bootstrap.settings.targetElement =
            document.body;

        embeddedservice_bootstrap.init(
            '00D9K00000L1UMb',
            'Paxi_testing',
            'https://takkt-eu--integ.sandbox.my.site.com/ESWPaxitesting1787580431573',
            {
                scrt2URL:
                    'https://takkt-eu--integ.sandbox.my.salesforce-scrt.com'
            }
        );

        log(
            'init() returned without error',
            'ok'
        );
    } catch (error) {
        console.error(
            'Error loading Embedded Messaging:',
            error
        );

        log(
            'init() failed: ' +
            errorText(error),
            'err'
        );
    }
}


function onEmbeddedMessagingLoaded() {
    console.log(
        '[Krafty test] bootstrap.min.js loaded'
    );

    if (document.readyState === 'loading') {
        document.addEventListener(
            'DOMContentLoaded',
            initEmbeddedMessaging
        );
    } else {
        initEmbeddedMessaging();
    }
}


function onEmbeddedMessagingError() {
    log(
        'bootstrap.min.js failed to load',
        'err'
    );
}
