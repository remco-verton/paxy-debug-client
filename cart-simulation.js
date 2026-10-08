/* Paxy simulation: no cart API call and no automatically sent chat message. */
const KRAFTY_AGENT_HOST_EVENT = 'onKraftyAgentData';
// INT ESW origin from the supplied Paxi_testing bootstrap.
// Verify the actual renderer origin in the console if the handshake is rejected.
const PAXY_SIM_RENDERER_ORIGINS = new Set([
    'https://takkt-eu--integ.sandbox.my.site.com'
]);
const paxySimulationRoutes = new Map();
const PAXY_SIM_DELAY_MS = 5000;

window.addEventListener('message', function (event) {
    const data = event.data;
    if (data?.type !== 'PAXY_SIM_CONNECT') return;
    if (!PAXY_SIM_RENDERER_ORIGINS.has(event.origin) || !event.source || event.source === window) {
        log('Simulation: rejected renderer origin ' + event.origin, 'err');
        return;
    }
    if (typeof data.requestId !== 'string' || !/^[A-Za-z0-9_-]{8,128}$/.test(data.requestId)) return;
    for (const [id, route] of paxySimulationRoutes) {
        if (route.expiresAt < Date.now()) paxySimulationRoutes.delete(id);
    }
    const previous = paxySimulationRoutes.get(data.requestId);
    if (previous && (previous.source !== event.source || previous.origin !== event.origin)) return;
    if (!previous) paxySimulationRoutes.set(data.requestId, {
        source: event.source, origin: event.origin, expiresAt: Date.now() + 30000
    });
    event.source.postMessage({ type: 'PAXY_SIM_READY', requestId: data.requestId }, event.origin);
    log('Simulation return channel ready: ' + data.requestId, 'ok');
});

window.addEventListener(KRAFTY_AGENT_HOST_EVENT, async function (event) {
    const payload = event.detail;
    const route = paxySimulationRoutes.get(payload?.requestId);
    if (!route || route.expiresAt < Date.now()) {
        log('Simulation: received an event without a matching return channel. Check the renderer version.', 'err');
        return;
    }
    // Ignore repeat delivery of the same event. No duplicate simulation or reply.
    if (route.started) return;
    route.started = true;
    const mode = document.getElementById('paxy-sim-mode')?.value || 'success';
    log('Simulation started (' + mode + '): ' + JSON.stringify(payload), 'wait');

    await new Promise(resolve => window.setTimeout(resolve, PAXY_SIM_DELAY_MS));
    if (mode === 'timeout') {
        paxySimulationRoutes.delete(payload.requestId);
        log('Simulation: deliberately withholding the reply to test the LWC timeout.', 'wait');
        return;
    }
    const result = {
        success: mode === 'success',
        itemCount: mode === 'success' ? 1 : 0,
        simulated: true
    };
    try {
        route.source.postMessage({
            type: 'PAXY_SIM_RESULT', requestId: payload.requestId, result
        }, route.origin);
        log('Simulation replied: ' + JSON.stringify(result), result.success ? 'ok' : 'err');
    } catch (error) {
        log('Simulation reply failed: ' + errorText(error), 'err');
    } finally {
        paxySimulationRoutes.delete(payload.requestId);
    }
});
