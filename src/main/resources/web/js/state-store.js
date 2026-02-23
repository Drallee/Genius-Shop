// ===== CENTRAL EDITOR STATE STORE =====

(function attachEditorStateStore(global) {
    function createStore(initialState) {
        const state = { ...initialState };
        const listeners = new Set();

        function emit(changedKey) {
            listeners.forEach(listener => {
                try {
                    listener({ state, changedKey });
                } catch (error) {
                    console.error('[STATE] listener failed:', error);
                }
            });
        }

        return {
            get(key) {
                return key ? state[key] : state;
            },
            set(key, value) {
                state[key] = value;
                emit(key);
                return value;
            },
            patch(partial) {
                Object.keys(partial || {}).forEach(key => {
                    state[key] = partial[key];
                });
                emit('*');
            },
            subscribe(listener) {
                listeners.add(listener);
                return () => listeners.delete(listener);
            }
        };
    }

    global.EditorStateStore = {
        createStore
    };
})(window);
