/*
 * Enhanced Messaging is ready.
 *
 * Queue direct context once the SDK reports readiness.
 */
window.addEventListener(
    'onEmbeddedMessagingReady',
    function () {
        log(
            'onEmbeddedMessagingReady — API ready',
            'ok'
        );

        paxyContextReady = true;
        paxyConversationEnded = false;
        if (paxyConversationActive && !paxyCreatedOnThisPage) reapplyPaxyContext();
        else setLivePageContext();
    }
);


window.addEventListener(
    'onEmbeddedMessagingButtonCreated',
    function () {
        messagingButtonCreated = true;

        log(
            'onEmbeddedMessagingButtonCreated — launcher ready',
            'ok'
        );

        scheduleLauncherSync();
        scheduleChatInvite();
    }
);


window.addEventListener('resize', function () {
    syncInviteToSalesforceLauncher();
});


window.addEventListener(
    'onEmbeddedMessagingButtonClicked',
    function () {
        /*
         * User opened the native Salesforce launcher before the
         * delayed invitation fired. Do not show our invitation.
         */
        chatHasBeenOpened = true;
        chatInviteConsumed = true;
        hideChatInvite('Salesforce launcher clicked');
    }
);


window.addEventListener(
    'onEmbeddedMessagingConversationStarted',
    function () {
        const restarting = paxyConversationEnded;
        paxyConversationEnded = false;
        paxyCreatedOnThisPage = true;
        paxyConversationActive = true;
        rememberPaxyConversation(true);
        if (paxyRestoringConversation || restarting) {
            paxyRestoringConversation = false;
            sendPaxyPageContext(false);
        }
        chatHasBeenOpened = true;
        chatInviteConsumed = true;
        hideChatInvite('conversation already started');

        log(
            'onEmbeddedMessagingConversationStarted',
            'info'
        );
    }
);


window.addEventListener(
    'onEmbeddedMessagingConversationOpened',
    function () {
        /*
         * Also catches an existing conversation restored into this
         * browser tab after navigation / reload.
         */
        paxyConversationActive = true;
        paxyConversationEnded = false;
        rememberPaxyConversation(true);
        if (!paxyCreatedOnThisPage) reapplyPaxyContext();
        chatHasBeenOpened = true;
        chatInviteConsumed = true;
        hideChatInvite('existing conversation opened');

        log(
            'onEmbeddedMessagingConversationOpened',
            'info'
        );
    }
);


window.addEventListener(
    'onEmbeddedMessagingWindowMaximized',
    function () {
        chatHasBeenOpened = true;
        chatInviteConsumed = true;
        hideChatInvite('chat window maximized');

        log(
            'onEmbeddedMessagingWindowMaximized',
            'info'
        );
    }
);


window.addEventListener(
    'onEmbeddedMessagingWindowMinimized',
    function () {
        /*
         * The user already has an active chat; don't nag them with
         * a second invitation after they deliberately minimize it.
         */
        chatHasBeenOpened = true;
        chatInviteConsumed = true;
        hideChatInvite('chat window minimized');

        log(
            'onEmbeddedMessagingWindowMinimized',
            'info'
        );
    }
);


window.addEventListener(
    'onEmbeddedMessagingWindowClosed',
    function () {
        chatHasBeenOpened = false;
        chatInviteConsumed = true;
        hideChatInvite('chat window closed');

        log(
            'onEmbeddedMessagingWindowClosed',
            'info'
        );
    }
);

// Closing/minimizing the window is not the same as ending the conversation.
window.addEventListener('onEmbeddedMessagingConversationClosed', function () {
    clearTimeout(paxyContextRetry);
    paxyConversationEnded = true;
    paxyConversationActive = false;
    paxyRestoringConversation = false;
    paxyCreatedOnThisPage = false;
    rememberPaxyConversation(false);
    // Seed a genuinely new chat, even if the SDK does not emit Ready again.
    sendPaxyPageContext(true);
    log('onEmbeddedMessagingConversationClosed — context reset', 'info');
});
