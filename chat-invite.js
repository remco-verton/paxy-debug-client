function collectElementsIncludingShadowRoots(root, output) {
    const scope = root || document;
    const result = output || [];

    if (scope.querySelectorAll) {
        scope.querySelectorAll('button, [role="button"]').forEach(function (element) {
            result.push(element);
        });

        scope.querySelectorAll('*').forEach(function (element) {
            if (element.shadowRoot) {
                collectElementsIncludingShadowRoots(element.shadowRoot, result);
            }
        });
    }

    return result;
}


function findSalesforceLauncher() {
    const elements = collectElementsIncludingShadowRoots(document, []);
    let best = null;
    let bestScore = -Infinity;

    elements.forEach(function (element) {
        if (element.id === 'paxy-chat-invite') return;

        const rect = element.getBoundingClientRect();
        if (rect.width < 40 || rect.height < 35) return;
        if (rect.bottom < window.innerHeight * .55) return;
        if (rect.right < window.innerWidth * .65) return;

        const text = (element.textContent || '').trim().toLowerCase();
        const aria = (element.getAttribute('aria-label') || '').toLowerCase();
        const id = (element.id || '').toLowerCase();
        const className = String(element.className || '').toLowerCase();

        let score = 0;
        if (text.includes('ask me anything')) score += 100;
        if (aria.includes('chat') || aria.includes('messag')) score += 45;
        if (id.includes('embedded') || id.includes('messag')) score += 30;
        if (className.includes('embedded') || className.includes('messag')) score += 25;
        if (getComputedStyle(element).position === 'fixed') score += 10;
        score += Math.max(0, 20 - Math.abs(window.innerWidth - rect.right) / 10);

        if (score > bestScore) {
            bestScore = score;
            best = element;
        }
    });

    return bestScore >= 30 ? best : null;
}


function cloneNativeLauncherIcon(launcher) {
    if (!launcher) return;

    const target = document.querySelector('.paxy-invite-icon');
    if (!target) return;

    const nativeIcon = launcher.querySelector('svg, img');
    if (!nativeIcon) return;

    const clone = nativeIcon.cloneNode(true);
    clone.removeAttribute('id');
    clone.classList.add('sf-native-icon');
    clone.setAttribute('aria-hidden', 'true');

    target.replaceChildren(clone);
}


function syncInviteToSalesforceLauncher() {
    const invite = getChatInviteElement();
    const launcher = findSalesforceLauncher();

    if (!invite || !launcher) return false;

    const rect = launcher.getBoundingClientRect();
    const style = getComputedStyle(launcher);
    const right = Math.max(0, window.innerWidth - rect.right);
    const bottom = Math.max(0, window.innerHeight - rect.bottom);

    invite.style.right = right + 'px';
    invite.style.bottom = bottom + 'px';
    invite.style.setProperty('--sf-launcher-width', rect.width + 'px');
    invite.style.setProperty('--sf-launcher-height', rect.height + 'px');
    invite.style.setProperty('--sf-launcher-radius', style.borderRadius || (rect.height / 2) + 'px');
    invite.style.setProperty('--sf-launcher-background', style.backgroundColor || '#2d2d2d');
    invite.style.setProperty('--sf-launcher-color', style.color || '#fff');
    invite.style.setProperty('--sf-launcher-border-style', style.borderStyle || 'solid');
    invite.style.setProperty('--sf-launcher-border-width', style.borderWidth || '1px');
    invite.style.setProperty('--sf-launcher-border-color', style.borderColor || 'rgba(255,255,255,.14)');
    invite.style.setProperty('--sf-launcher-shadow', style.boxShadow === 'none' ? 'none' : style.boxShadow);

    cloneNativeLauncherIcon(launcher);
    return true;
}


function scheduleLauncherSync() {
    if (launcherSyncTimer) {
        window.clearTimeout(launcherSyncTimer);
    }

    launcherSyncAttempts = 0;

    function attempt() {
        launcherSyncAttempts += 1;

        if (syncInviteToSalesforceLauncher()) {
            launcherSyncTimer = null;
            return;
        }

        if (launcherSyncAttempts < 30) {
            launcherSyncTimer = window.setTimeout(attempt, 100);
        } else {
            launcherSyncTimer = null;
            log('Could not inspect native launcher; using fallback invite styling', 'wait');
        }
    }

    attempt();
}


function getChatInviteElement() {
    return document.getElementById('paxy-chat-invite');
}


function hideChatInvite(reason) {
    if (chatInviteTimer) {
        window.clearTimeout(chatInviteTimer);
        chatInviteTimer = null;
    }

    const invite = getChatInviteElement();
    if (invite) {
        invite.classList.remove('invite-visible', 'invite-expanded');
        invite.setAttribute('aria-hidden', 'true');
    }

    if (reason) {
        log('Chat invitation hidden: ' + reason, 'info');
    }
}


function showChatInvite() {
    chatInviteTimer = null;

    if (
        !messagingButtonCreated ||
        chatHasBeenOpened ||
        chatInviteConsumed
    ) {
        return;
    }

    const invite = getChatInviteElement();
    if (!invite) return;

    syncInviteToSalesforceLauncher();
    invite.setAttribute('aria-hidden', 'false');
    invite.classList.add('invite-visible');

    /*
     * First reveal the compact chat circle, then expand it into
     * the invitation pill. This makes the expansion visible.
     */
    window.requestAnimationFrame(function () {
        window.requestAnimationFrame(function () {
            if (!chatHasBeenOpened && !chatInviteConsumed) {
                invite.classList.add('invite-expanded');
            }
        });
    });

    log(CHAT_INVITE_DELAY_MS + 'ms elapsed — chat invitation shown', 'info');
}


function scheduleChatInvite() {
    if (
        chatInviteTimer ||
        chatHasBeenOpened ||
        chatInviteConsumed
    ) {
        return;
    }

    chatInviteTimer = window.setTimeout(
        showChatInvite,
        CHAT_INVITE_DELAY_MS
    );

    log('Chat invitation scheduled for ' + CHAT_INVITE_DELAY_MS + 'ms', 'wait');
}


function openChatFromInvite() {
    if (chatHasBeenOpened) {
        hideChatInvite('chat is already open');
        return;
    }

    if (
        !messagingButtonCreated ||
        !window.embeddedservice_bootstrap ||
        !embeddedservice_bootstrap.utilAPI ||
        typeof embeddedservice_bootstrap.utilAPI.launchChat !== 'function'
    ) {
        log('utilAPI.launchChat is unavailable', 'err');
        return;
    }

    chatInviteConsumed = true;
    hideChatInvite('invitation clicked');
    log('Opening chat from custom invitation', 'info');

    embeddedservice_bootstrap.utilAPI.launchChat()
        .then(function () {
            chatHasBeenOpened = true;
            log('Chat opened from custom invitation', 'ok');
        })
        .catch(function (error) {
            /*
             * Allow another click if Salesforce failed to launch.
             */
            chatInviteConsumed = false;
            log(
                'launchChat failed: ' + errorText(error),
                'err'
            );

            const invite = getChatInviteElement();
            if (invite && !chatHasBeenOpened) {
                invite.setAttribute('aria-hidden', 'false');
                invite.classList.add(
                    'invite-visible',
                    'invite-expanded'
                );
            }
        });
}
