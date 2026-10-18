/* Read-only ledger reporting. A newer filter request always supersedes an older one. */
(() => {
    let controller;
    let sequence = 0;
    let chart;
    let initialized = false;
    const byId = id => document.getElementById(`sales-${id}`);
    const number = value => new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
    const priceNumber = value => new Intl.NumberFormat(undefined, { maximumSignificantDigits: 15 }).format(value);
    const integer = value => new Intl.NumberFormat().format(value);
    const label = value => value === '' ? '(Unattributed)' : value;
    const optionValue = value => `id:${value}`;
    const selected = id => byId(id).value === '' ? null : byId(id).value.slice(3);

    function table(id, rows, empty, columns) {
        const body = byId(id);
        body.replaceChildren();
        if (!rows.length) {
            const cell = document.createElement('td');
            cell.colSpan = columns;
            cell.textContent = empty;
            const row = document.createElement('tr');
            row.append(cell);
            body.append(row);
        }
        for (const values of rows) {
            const row = document.createElement('tr');
            for (const value of values) {
                const cell = document.createElement('td');
                cell.textContent = value;
                row.append(cell);
            }
            body.append(row);
        }
    }

    function options(id, values, active, allLabel) {
        const select = byId(id);
        select.replaceChildren(new Option(allLabel, ''));
        const choices = [...values];
        if (active !== null && !choices.includes(active)) choices.push(active);
        for (const value of choices) select.add(new Option(label(value), optionValue(value)));
        select.value = active === null ? '' : optionValue(active);
        select.dispatchEvent(new Event('refresh'));
    }

    function render(report) {
        const filter = report.filter;
        options('shop', report.shops, filter.shop ?? null, 'All shops');
        options('item', report.items, filter.item ?? null, 'All items');
        byId('generated').textContent = `${filter.from} to ${filter.through} / Updated ${new Date(report.generatedAt).toISOString().slice(11, 19)} UTC`;
        byId('money').replaceChildren();
        for (const [name, value, className] of [
            ['To players (sales)', report.playerInflow, 'inflow'],
            ['From players (purchases)', report.playerOutflow, 'outflow'],
            ['Net to players', report.netPlayerInflow, 'net']
        ]) {
            const metric = document.createElement('dl');
            metric.className = className;
            const title = document.createElement('dt');
            title.textContent = name;
            const amount = document.createElement('dd');
            amount.textContent = number(value);
            metric.append(title, amount);
            byId('money').append(metric);
        }
        table('totals', [['PURCHASE', 'Purchases'], ['SALE', 'Sales'], ['WAND_SALE', 'Wand sales']].map(([type, name]) => {
            const total = report.totals[type];
            return [name, integer(total.operations), integer(total.lines), integer(total.quantity), number(total.money)];
        }), '', 5);
        table('popular', report.popular.map(item => [label(item.shop), label(item.item), integer(item.purchases), integer(item.sales), number(item.turnover)]), 'No completed transactions in this range.', 5);
        byId('ranking-count').textContent = `${report.popular.length} of ${integer(report.matchingItems)} items / Top ${report.popularLimit} by units`;
        const hasSelection = filter.shop != null && filter.item != null;
        const hasPrices = hasSelection && report.prices.length > 0;
        byId('price-empty').hidden = hasPrices;
        byId('price-empty').textContent = hasSelection ? 'No completed trades for this item in this range.' : 'Select a shop and item.';
        byId('price-content').hidden = !hasPrices;
        table('prices', report.prices.map(price => [price.day, price.direction === 'BUY' ? 'Buy' : 'Sell (including wands)', integer(price.quantity), priceNumber(price.average), priceNumber(price.minimum), priceNumber(price.maximum)]), '', 6);
        if (chart) { chart.destroy(); chart = null; }
        byId('results').hidden = false;
        if (hasPrices && window.Chart) {
            const days = [];
            const end = new Date(`${filter.through}T00:00:00Z`);
            for (const day = new Date(`${filter.from}T00:00:00Z`); day <= end; day.setUTCDate(day.getUTCDate() + 1)) days.push(day.toISOString().slice(0, 10));
            chart = new Chart(byId('chart'), {
                type: 'line',
                data: { labels: days, datasets: [ ['BUY', 'Buy', '#f0ba73'], ['SELL', 'Sell (including wands)', '#73d6ba'] ].map(([direction, name, color]) => ({
                    label: name, borderColor: color, backgroundColor: color, borderWidth: 2, pointRadius: 3, spanGaps: false,
                    data: days.map(day => report.prices.find(price => price.day === day && price.direction === direction)?.average ?? null)
                })) },
                options: { responsive: true, maintainAspectRatio: false, animation: false,
                    plugins: { legend: { labels: { color: '#c7d1d8', boxWidth: 12 } } },
                    scales: { x: { ticks: { color: '#aab9c3', maxTicksLimit: 8 }, grid: { color: '#323d45' } }, y: { beginAtZero: true, ticks: { color: '#aab9c3' }, grid: { color: '#323d45' } } }
                }
            });
        }
    }

    async function load() {
        init();
        if (!byId('filters').reportValidity()) return;
        if (controller) controller.abort();
        controller = new AbortController();
        const current = ++sequence;
        const query = new URLSearchParams({ from: byId('from').value, through: byId('through').value });
        for (const id of ['shop', 'item']) { const value = selected(id); if (value !== null) query.set(id, value); }
        byId('results').hidden = true;
        byId('generated').textContent = '';
        byId('status').textContent = 'Loading sales report...';
        byId('status').dataset.error = 'false';
        byId('filters').setAttribute('aria-busy', 'true');
        try {
            const response = await fetch(`api/sales-analytics?${query}`, { headers: { 'X-Session-Token': sessionToken }, signal: controller.signal, cache: 'no-store' });
            if (!response.ok) {
                if (response.status === 401 || response.status === 403) throw new Error('Session expired or access denied. Sign in again.');
                const error = await response.json().catch(() => ({}));
                throw new Error(error.message || error.detail || `Sales report unavailable (${response.status}).`);
            }
            const report = await response.json();
            if (current !== sequence) return;
            render(report);
            byId('status').textContent = report.popular.length ? '' : 'No completed transactions in this range.';
        } catch (error) {
            if (current !== sequence) return;
            byId('results').hidden = true;
            byId('status').dataset.error = 'true';
            byId('status').textContent = error.message || 'Unable to load sales report.';
        } finally {
            if (current === sequence) byId('filters').setAttribute('aria-busy', 'false');
        }
    }

    function invalidate() {
        ++sequence;
        if (controller) controller.abort();
        byId('results').hidden = true;
        byId('generated').textContent = '';
        byId('status').textContent = 'Filters changed.';
        byId('filters').setAttribute('aria-busy', 'false');
    }

    function init() {
        if (initialized) return;
        initialized = true;
        if (typeof initCustomSelects === 'function') initCustomSelects();
        const today = new Date();
        byId('through').value = today.toISOString().slice(0, 10);
        today.setUTCDate(today.getUTCDate() - 29);
        byId('from').value = today.toISOString().slice(0, 10);
        byId('filters').addEventListener('submit', event => { event.preventDefault(); load(); });
        byId('filters').addEventListener('change', event => {
            invalidate();
            if (event.target === byId('shop')) options('item', [], null, 'All items');
            load();
        });
    }

    window.SalesAnalytics = { load };
})();
