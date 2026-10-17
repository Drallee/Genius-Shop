(function(global) {
    'use strict';

    let state = null;
    let queue = Promise.resolve();
    let dialog;
    let content;
    let publishButton;
    let reviewToken = null;
    let reviewing = false;
    let busy = false;

    function setState(value) {
        if (!value) return;
        state = value;
        const status = document.getElementById('draft-status');
        if (status) status.textContent = value.changedFiles ? `Draft: ${value.changedFiles} changed file${value.changedFiles === 1 ? '' : 's'}` : 'Draft matches live';
    }

    function request(url, options = {}) {
        const send = async () => {
            const headers = { 'X-Session-Token': sessionToken, ...options.headers };
            if (state) headers['X-Draft-Revision'] = state.revision;
            const response = await fetch(url, { ...options, headers });
            const data = await response.clone().json().catch(() => ({}));
            if (response.status === 403 && global.EditorPermissions) await EditorPermissions.recheck();
            if (!response.ok) throw new Error(data.message || data.error || `Request failed (${response.status})`);
            if (data.draft) setState(data.draft);
            return response;
        };
        const pending = queue.then(send);
        queue = pending.catch(() => {});
        return pending;
    }

    function element(tag, text, className) {
        const node = document.createElement(tag);
        if (text != null) node.textContent = text;
        if (className) node.className = className;
        return node;
    }

    function button(label, icon, action, className = '') {
        const node = element('button', null, `btn-base ${className}`);
        node.type = 'button';
        const glyph = element('i', null, `fa-solid fa-${icon}`);
        glyph.setAttribute('aria-hidden', 'true');
        node.append(glyph, document.createTextNode(label));
        node.addEventListener('click', action);
        return node;
    }

    function close() {
        if (busy) return;
        reviewing = false;
        reviewToken = null;
        dialog.close();
        if (typeof scheduleEditorAutoSave === 'function' && unsavedChanges.length) scheduleEditorAutoSave();
    }

    function createDialog() {
        dialog = element('dialog', null, 'draft-review');
        dialog.id = 'draft-review';
        dialog.setAttribute('aria-labelledby', 'draft-review-title');
        const header = element('header');
        const title = element('h2', 'Review and publish');
        title.id = 'draft-review-title';
        const dismiss = button('', 'xmark', close, 'draft-close btn-secondary');
        dismiss.title = 'Close review';
        dismiss.setAttribute('aria-label', 'Close review');
        header.append(title, dismiss);
        content = element('div', null, 'draft-review-content');
        content.setAttribute('aria-live', 'polite');
        const footer = element('footer');
        publishButton = button('Publish', 'upload', publish, 'btn-success');
        publishButton.id = 'draft-publish';
        publishButton.hidden = !!global.EditorPermissions && !EditorPermissions.can('publish');
        footer.append(button('Discard draft', 'trash', discard, 'btn-secondary'),
            button('Validate again', 'check', () => review(false), 'btn-secondary'), publishButton);
        dialog.append(header, content, footer);
        dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
        dialog.addEventListener('keydown', event => {
            event.stopPropagation();
            if ((event.ctrlKey || event.metaKey) && ['s', 'enter'].includes(event.key.toLowerCase())) event.preventDefault();
        });
        document.body.append(dialog);
    }

    function setBusy(value) {
        busy = value;
        dialog.querySelectorAll('button').forEach(control => { control.disabled = value; });
        publishButton.disabled = value || !reviewToken || (!!global.EditorPermissions && !EditorPermissions.can('publish'));
        publishButton.hidden = !!global.EditorPermissions && !EditorPermissions.can('publish');
    }

    function showError(error) {
        content.replaceChildren(element('p', error.message || String(error), 'draft-error'));
        reviewToken = null;
        setBusy(false);
    }

    function renderReview(data) {
        content.replaceChildren();
        content.append(element('p', data.errors.length ? 'Validation failed' : data.changes.length ? 'Validation passed' : 'No draft changes', data.errors.length ? 'draft-error' : 'draft-valid'));
        if (data.errors.length) {
            const list = element('ul', null, 'draft-errors');
            data.errors.forEach(error => list.append(element('li', error)));
            content.append(list);
        }
        for (const change of data.changes) {
            const row = element('details', null, 'draft-file');
            const summary = element('summary');
            summary.append(element('span', change.kind, `draft-kind ${change.kind}`), element('code', change.file));
            const diff = element('div', null, 'draft-diff');
            // Complete before/after text keeps long, comment-preserving YAML changes inspectable without truncation.
            for (const [title, source] of [['Live', change.before], ['Draft', change.after]]) {
                const column = element('section');
                column.className = title === 'Live' ? 'draft-before' : 'draft-after';
                column.append(element('h3', title), diffSource(source, title === 'Live' ? change.after : change.before, title === 'Live' ? 'removed' : 'added'));
                diff.append(column);
            }
            row.append(summary, diff);
            content.append(row);
        }
        reviewToken = !data.errors.length && data.changes.length ? data.token : null;
        setBusy(false);
    }

    function diffSource(source, other, kind) {
        const pre = element('pre');
        if (source == null) { pre.textContent = '(file absent)'; return pre; }
        const lines = source.match(/[^\n]*\n|[^\n]+$/g) || [];
        const previous = other == null ? [] : other.match(/[^\n]*\n|[^\n]+$/g) || [];
        let start = 0, end = 0;
        const same = (a, b) => a.replace(/\r?\n$/, '') === b.replace(/\r?\n$/, '');
        while (start < Math.min(lines.length, previous.length) && same(lines[start], previous[start])) start++;
        while (end < Math.min(lines.length, previous.length) - start && same(lines[lines.length - 1 - end], previous[previous.length - 1 - end])) end++;
        // Keep complete source text, highlighting the changed span between matching context.
        lines.forEach((line, index) => pre.append(element('span', line,
            index >= start && index < lines.length - end ? `draft-line-${kind}` : null)));
        return pre;
    }

    async function review(saveLocal = true) {
        if (busy) return;
        if (!dialog) createDialog();
        reviewing = true;
        reviewToken = null;
        const pending = getEditorState('autoSaveTimeout');
        if (pending) clearTimeout(pending);
        setEditorState('autoSaveTimeout', null);
        if (!dialog.open) dialog.showModal();
        setBusy(true);
        content.replaceChildren(element('p', 'Validating draft...'));
        try {
            if (saveLocal) await saveAllDrafts();
            const response = await request('api/draft/review');
            renderReview(await response.json());
        } catch (error) { showError(error); }
    }

    async function publish() {
        if (global.EditorPermissions && !EditorPermissions.can('publish')) return;
        if (!reviewToken || busy) return;
        const token = reviewToken;
        setBusy(true);
        try {
            await request('api/draft/publish', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
            await loadAllFiles();
            setBusy(false);
            close();
            showToast('Configuration published', 'success');
        } catch (error) { showError(error); }
    }

    async function discard() {
        if (busy) return;
        // Use a native confirmation above this modal, without opening another editor overlay behind it.
        if (!global.confirm('Discard your saved draft and local edits, and reload the live configuration?')) return;
        setBusy(true);
        try {
            await request('api/draft/discard', { method: 'POST' });
            await loadAllFiles();
            setBusy(false);
            close();
            showToast('Draft discarded', 'success');
        } catch (error) { showError(error); }
    }

    global.EditorDrafts = { request, setState, review, isReviewing: () => reviewing };
})(window);
