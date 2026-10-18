(function(global) {
    'use strict';

    function plainText(value) {
        return String(value ?? '').replace(/<\/?gradient(?::[^>]*)?>/gi, '')
            .replace(/(?:&|\u00a7)x(?:(?:&|\u00a7)[0-9a-f]){6}/gi, '')
            .replace(/(?:&|\u00a7)#[0-9a-f]{6}/gi, '').replace(/(?:&|\u00a7)[0-9a-fk-or]/gi, '');
    }

    function element(tag, text, className) {
        const node = document.createElement(tag);
        if (text != null) node.textContent = text;
        if (className) node.className = className;
        return node;
    }

    function context(entry) {
        const file = entry.details?.shopFile || entry.details?.fileName || entry.afterData?.fileName || entry.beforeData?.fileName || '';
        return file ? (file.startsWith('shops/') || entry.details?.shopFile ? 'Shop: ' + file.replace(/^shops\//, '').replace(/\.yml$/, '') : file) : '';
    }

    function names(before, after) {
        const labels = [];
        for (const snapshot of [after, before]) {
            const value = snapshot?.content ?? snapshot;
            const items = Array.isArray(value) ? value : Array.isArray(value?.items) ? value.items : value?.material ? [value] : [];
            for (const item of items) {
                const label = plainText(item?.name || item?.material || item?.key);
                if (label && !labels.includes(label)) labels.push(label);
            }
        }
        return labels;
    }

    function comparison(before, after, beforeLabel = 'Before', afterLabel = 'After') {
        const container = element('div', null, 'change-comparison activity-comparison draft-diff');
        for (const [label, value, other, kind] of [[beforeLabel, before, after, 'before'], [afterLabel, after, before, 'after']]) {
            const column = element('section', null, `change-column draft-${kind}`);
            column.append(element('h3', label));
            const pre = element('pre');
            const source = value == null ? '# Not present\n' : formatActivityYaml(value);
            const previous = other == null ? '# Not present\n' : formatActivityYaml(other);
            const lines = source.match(/[^\n]*\n|[^\n]+$/g) || [];
            const otherLines = previous.match(/[^\n]*\n|[^\n]+$/g) || [];
            let start = 0, end = 0;
            const same = (left, right) => left.replace(/\r?\n$/, '') === right.replace(/\r?\n$/, '');
            while (start < Math.min(lines.length, otherLines.length) && same(lines[start], otherLines[start])) start++;
            while (end < Math.min(lines.length, otherLines.length) - start && same(lines.at(-1 - end), otherLines.at(-1 - end))) end++;
            lines.forEach((line, index) => pre.append(element('span', line,
                index >= start && index < lines.length - end ? `draft-line-${kind === 'before' ? 'removed' : 'added'}` : null)));
            column.append(pre);
            container.append(column);
        }
        return container;
    }

    function metadata(text, before, after) {
        const row = element('div', null, 'change-metadata');
        if (text) row.append(element('span', text));
        const labels = names(before, after);
        for (const label of labels.slice(0, 8)) row.append(element('span', label, 'change-item-label'));
        if (labels.length > 8) row.append(element('span', `+${labels.length - 8} more items`, 'change-item-label'));
        return row;
    }

    function historyRow(entry) {
        const row = element('button', null, 'change-history-row');
        row.type = 'button';
        row.append(element('span', entry.action || 'updated', `draft-kind ${entry.action || 'updated'}`));
        const body = element('span', null, 'change-history-body');
        body.append(element('strong', getActivitySummary(entry)),
            element('span', [context(entry), entry.username || 'Unknown', getTimeAgo(entry.timestamp)].filter(Boolean).join(' · '), 'change-history-meta'));
        row.append(body, element('span', 'View details', 'change-history-link'));
        row.addEventListener('click', () => openActivityDetailModal(entry.id));
        return row;
    }

    function conflictSources(sources, economy = false) {
        const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
            ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
        const equal = values => values.every(value => JSON.stringify(canonical(value)) === JSON.stringify(canonical(values[0])));
        const mapping = value => value !== null && typeof value === 'object' && !Array.isArray(value);
        const identity = ['material', 'name', 'slot', 'key', 'spawner-type', 'spawner-item', 'potion-type'];
        const project = (values, item = false) => {
            if (equal(values)) return values.map(() => undefined);
            if (values.every(value => value === undefined || mapping(value))) {
                const result = values.map(value => value === undefined ? undefined : Object.create(null));
                const keys = new Set(values.flatMap(value => Object.keys(value || {})));
                for (const key of keys) {
                    const selected = item && identity.includes(key) ? values.map(value => value?.[key]) : project(values.map(value => value?.[key]));
                    selected.forEach((value, index) => { if (value !== undefined && result[index]) result[index][key] = value; });
                }
                return result;
            }
            if (values.every(value => value === undefined || Array.isArray(value))) {
                const result = values.map(value => value === undefined ? undefined : []);
                const length = Math.max(...values.map(value => value?.length || 0));
                for (let index = 0; index < length; index++) {
                    const selected = project(values.map(value => value?.[index]), true);
                    selected.forEach((value, column) => { if (value !== undefined && result[column]) result[column].push(value); });
                }
                return result;
            }
            return values;
        };
        try {
            const values = sources.map(source => source == null ? undefined : economy ? JSON.parse(source) : EditorYaml.parse(source));
            if (equal(values)) return sources;
            const selected = project(values);
            return sources.map((source, index) => source == null ? null : selected[index] === undefined
                ? '# No changed values in this version\n' : economy ? JSON.stringify(selected[index], null, 2) : EditorYaml.stringify(selected[index]));
        } catch {
            return sources;
        }
    }

    function changedLines(sources) {
        const lines = sources.map(source => String(source ?? '').split(/\r?\n/));
        const changed = lines.map(() => new Set());
        for (let left = 0; left < lines.length; left++) for (let right = left + 1; right < lines.length; right++) {
            const previous = lines[left], next = lines[right];
            const matchedLeft = new Set(), matchedRight = new Set();
            if (previous.length * next.length <= 1000000) {
                const lengths = Array.from({ length: previous.length + 1 }, () => new Uint32Array(next.length + 1));
                for (let row = previous.length - 1; row >= 0; row--) for (let column = next.length - 1; column >= 0; column--) {
                    lengths[row][column] = previous[row] === next[column] ? lengths[row + 1][column + 1] + 1
                        : Math.max(lengths[row + 1][column], lengths[row][column + 1]);
                }
                let row = 0, column = 0;
                while (row < previous.length && column < next.length) {
                    if (previous[row] === next[column]) { matchedLeft.add(row++); matchedRight.add(column++); }
                    else if (lengths[row + 1][column] >= lengths[row][column + 1]) row++;
                    else column++;
                }
            } else previous.forEach((line, index) => { if (line === next[index]) { matchedLeft.add(index); matchedRight.add(index); } });
            previous.forEach((line, index) => { if (line && !matchedLeft.has(index)) changed[left].add(index); });
            next.forEach((line, index) => { if (line && !matchedRight.has(index)) changed[right].add(index); });
        }
        return changed;
    }

    global.EditorChangeView = { plainText, context, names, comparison, metadata, historyRow, conflictSources, changedLines };
})(window);
