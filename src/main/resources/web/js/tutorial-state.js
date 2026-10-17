(function(global) {
    'use strict';

    function createProgress(storage, username) {
        const key = `geniusshop:tutorial:v1:${encodeURIComponent(username.trim().toLowerCase())}`;
        let state = { firstRunHandled: false, autoNewFeatures: true, sections: {} };
        try {
            const saved = JSON.parse(storage.getItem(key));
            if (saved && typeof saved === 'object') {
                state.firstRunHandled = saved.firstRunHandled === true;
                state.autoNewFeatures = saved.autoNewFeatures !== false;
                if (saved.sections && typeof saved.sections === 'object') {
                    for (const [id, entry] of Object.entries(saved.sections)) {
                        if (entry && Number.isInteger(entry.revision) && entry.revision > 0 &&
                            ['completed', 'dismissed'].includes(entry.status)) {
                            state.sections[id] = { revision: entry.revision, status: entry.status };
                        }
                    }
                }
            }
        } catch (_) { /* Storage can be unavailable in private or restricted browsers. */ }

        function persist() {
            try { storage.setItem(key, JSON.stringify(state)); return true; } catch (_) { return false; }
        }

        return {
            snapshot: () => JSON.parse(JSON.stringify(state)),
            pending: sections => sections.filter(section => !state.firstRunHandled ||
                (state.autoNewFeatures && (!state.sections[section.id] || state.sections[section.id].revision < section.revision))),
            firstRun: () => !state.firstRunHandled,
            handleFirstRun() { state.firstRunHandled = true; return persist(); },
            setAutomatic(enabled) { state.autoNewFeatures = !!enabled; return persist(); },
            mark(section, status) {
                const previous = state.sections[section.id];
                if (!previous || previous.revision < section.revision ||
                    (previous.revision === section.revision && previous.status !== 'completed')) {
                    state.sections[section.id] = { revision: section.revision, status };
                }
                return persist();
            }
        };
    }

    global.EditorTutorialState = { createProgress };
})(window);
