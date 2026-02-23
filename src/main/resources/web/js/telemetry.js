// ===== TELEMETRY (OPT-IN) =====

(function attachTelemetry(global) {
    const queue = [];
    let flushTimer = null;

    function enabled() {
        return localStorage.getItem('telemetryEnabled') === 'true';
    }

    function scheduleFlush() {
        if (flushTimer) return;
        flushTimer = setTimeout(async () => {
            flushTimer = null;
            while (queue.length > 0) {
                const payload = queue.shift();
                try {
                    await fetch('api/telemetry', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Session-Token': localStorage.getItem('sessionToken') || ''
                        },
                        body: JSON.stringify(payload)
                    });
                } catch (error) {
                    // Drop on transport errors; telemetry must never block editor UX.
                }
            }
        }, 1500);
    }

    function track(event, metadata = {}, success = true) {
        if (!enabled()) return;
        queue.push({
            event,
            tab: (global.getEditorState && global.getEditorState('currentTab')) || '',
            mode: localStorage.getItem('autoSaveMode') || 'draft',
            success,
            metadata
        });
        scheduleFlush();
    }

    global.EditorTelemetry = {
        enabled,
        track
    };
})(window);
