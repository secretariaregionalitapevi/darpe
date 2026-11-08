(() => {
    'use strict';
    if (!requireAuth()) return;

    const $ = id => document.getElementById(id);
    const norm = value => String(value || '').normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
    const unique = values => [...new Set(values)];
    let context = null;
    let records = [];
    let version = 0;

    function el(tag, text, className) {
        const node = document.createElement(tag);
        if (text !== undefined) node.textContent = text;
        if (className) node.className = className;
        return node;
    }

    async function api(action) {
        const response = await authFetch('/api/darpe/' + action, { cache: 'no-store' });
        const body = await response.json();
        if (!response.ok) throw Error(body.error || 'Não foi possível consultar os atendimentos.');
        return body;
    }

    function options(id, values, label, desired) {
        const select = $(id);
        const value = desired ?? select.value;
        select.replaceChildren(new Option(label, ''));
        for (const item of unique(values.filter(Boolean))
            .sort((a, b) => a.localeCompare(b, 'pt-BR'))) {
            select.add(new Option(item, item));
        }
        select.value = [...select.options].find(option => norm(option.value) === norm(value))?.value || '';
    }

    function scope(reset = false) {
        const selectedScope = context.escopo;
        const catalog = context.localidades || [];
        options('mobile-city', catalog.map(row => row.municipio), 'Todos os municípios',
            $('mobile-city').value || selectedScope.municipio);
        $('mobile-city').disabled = ['municipal', 'local'].includes(selectedScope.level);
        const city = $('mobile-city').value;
        options('mobile-common', catalog.filter(row => !city || norm(row.municipio) === norm(city))
            .map(row => row.comum), 'Todas as comuns',
            reset ? '' : $('mobile-common').value || selectedScope.comum);
        $('mobile-common').disabled = selectedScope.level === 'local';
        $('header-comum').textContent = $('mobile-common').value || city || 'Regional Itapevi';
    }

    function visible() {
        return records.filter(record =>
            (!$('mobile-date').value || record.data === $('mobile-date').value) &&
            (!$('mobile-city').value || norm(record.municipio) === norm($('mobile-city').value)) &&
            (!$('mobile-common').value || norm(record.comum) === norm($('mobile-common').value)) &&
            (!$('mobile-sector').value || String(record.setor) === $('mobile-sector').value));
    }

    function phoneDigits(value) {
        return String(value || '').replace(/\D/g, '');
    }

    function whatsappDigits(value) {
        const digits = phoneDigits(value);
        return digits.length === 10 || digits.length === 11 ? '55' + digits : digits;
    }

    function whatsappIcon() {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('aria-hidden', 'true');
        const bubble = document.createElementNS(svg.namespaceURI, 'path');
        bubble.setAttribute('d', 'M12 2.5a9.5 9.5 0 0 0-8.2 14.3L2.5 21.5l4.9-1.3A9.5 9.5 0 1 0 12 2.5Z');
        const phone = document.createElementNS(svg.namespaceURI, 'path');
        phone.setAttribute('d', 'M8.1 7.2c-.4 0-.8.5-.9 1-.2 1 .6 2.5 2.1 4s3.2 2.4 4.2 2.1c.5-.1 1-.6 1-1l-1.8-1-1 1c-.8-.3-2.2-1.7-2.6-2.5l1-1-1-1.8-1-.8Z');
        svg.append(bubble, phone);
        return svg;
    }

    function contactLink(label, href, icon, className) {
        const link = el('a', undefined, 'mobile-contact-link ' + className);
        link.href = href;
        link.setAttribute('aria-label', label);
        link.title = label;
        if (href.startsWith('http')) {
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
        }
        if (icon === 'whatsapp') link.append(whatsappIcon());
        else link.append(el('i', undefined, 'fa fa-phone'));
        link.append(el('span', label));
        return link;
    }

    function contactActions(record) {
        const actions = el('div', undefined, 'mobile-card-contacts');
        const whatsapp = whatsappDigits(record.whatsapp);
        const phone = phoneDigits(record.telefone);
        if (whatsapp.length >= 8 && whatsapp.length <= 15) {
            actions.append(contactLink('WhatsApp', 'https://wa.me/' + whatsapp, 'whatsapp', 'is-whatsapp'));
        }
        if (phone.length >= 8 && phone.length <= 15) {
            actions.append(contactLink('Ligar', 'tel:' + phone, 'phone', 'is-phone'));
        }
        return actions;
    }

    function sectorBadge(record) {
        const sector = context.setores.find(item => Number(item.id) === Number(record.setor));
        const badge = el('span', undefined, 'mobile-sector-badge sector-' + record.setor);
        const icons = { 1: 'fa-building', 2: 'fa-house', 3: 'fa-shield-halved', 4: 'fa-school' };
        badge.append(el('i', undefined, 'fa ' + (icons[record.setor] || 'fa-building')));
        badge.append(document.createTextNode(' Setor ' + record.setor + (sector ? ' · ' + sector.nome : '')));
        if (sector) badge.title = sector.nome;
        return badge;
    }

    function draw() {
        const data = visible();
        const people = unique(data.flatMap(record => record.equipe.map(person => person.cadastro_id)));
        $('mobile-count').textContent = data.length;
        $('mobile-people').textContent = people.length;
        $('mobile-locations').textContent = unique(
            data.map(record => norm(record.municipio) + '|' + norm(record.local))).length;

        const params = new URLSearchParams();
        for (const [id, key] of [['mobile-city', 'municipio'], ['mobile-common', 'comum'],
            ['mobile-date', 'data']]) {
            if ($(id).value) params.set(key, $(id).value);
        }
        $('mobile-new').href = '/atendimento?' + params;

        const target = $('mobile-records');
        target.replaceChildren();
        $('mobile-state').hidden = data.length > 0;
        $('mobile-state').replaceChildren();
        if (!data.length) {
            $('mobile-state').append(
                el('strong', 'Nenhum atendimento neste recorte'),
                el('p', 'Use Lançar atendimento para preencher a papeleta do culto de evangelização.'));
            const action = el('a', 'Lançar atendimento', 'mobile-empty-action');
            action.href = $('mobile-new').href;
            $('mobile-state').append(action);
        }

        for (const [title, start, end, icon] of [
            ['Manhã', 0, 12, 'fa-sun'], ['Tarde', 12, 18, 'fa-cloud-sun'],
            ['Noite', 18, 24, 'fa-moon'],
        ]) {
            const items = data.filter(record =>
                Number(record.hora_inicio.slice(0, 2)) >= start &&
                Number(record.hora_inicio.slice(0, 2)) < end);
            if (!items.length) continue;

            const heading = el('div', undefined, 'mobile-period-heading');
            const label = el('h3');
            label.append(el('i', undefined, 'fa ' + icon), document.createTextNode(' ' + title));
            heading.append(label, el('span', String(items.length), 'mobile-count-badge'));
            target.append(heading);

            for (const [index, record] of items
                .sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio)).entries()) {
                const card = el('article', undefined, 'mobile-attendance-card');
                const main = el('a', undefined, 'mobile-card-main');
                main.href = '/atendimento?' + new URLSearchParams({ registro: record.id });
                const number = el('span', String(index + 1).padStart(2, '0'), 'mobile-card-number');
                const info = el('div', undefined, 'mobile-card-info');
                const responsible = record.equipe.find(person => person.funcao === 'atendente');
                const place = el('strong');
                place.append(el('i', undefined, 'fa fa-building'), document.createTextNode(' ' + record.local));
                info.append(
                    place,
                    el('small', record.municipio + ' · ' + record.comum),
                    el('b', record.hora_inicio.slice(0, 5) + ' às ' + record.hora_fim.slice(0, 5)),
                    el('small', responsible?.nome || 'Atendente não informado'));
                const tags = el('div', undefined, 'mobile-card-tags');
                tags.append(sectorBadge(record));
                info.append(tags);
                main.append(number, info, el('i', undefined, 'fa fa-chevron-right'));
                card.append(main);

                const contacts = contactActions(record);
                if (contacts.childElementCount) card.append(contacts);
                target.append(card);
            }
        }
    }

    async function load() {
        const run = ++version;
        $('mobile-refresh').disabled = true;
        $('mobile-state').hidden = false;
        $('mobile-state').textContent = 'Carregando seus atendimentos…';
        try {
            context = await api('contexto/');
            if (run !== version) return;
            scope();
            const name = context.usuario?.nome || mobileSession.get()?.user?.user_metadata?.full_name || '';
            $('mobile-welcome').textContent = name ? 'Olá, ' + name.split(' ')[0] + '!' : 'Olá!';
            $('mobile-sector').replaceChildren(new Option('Todos os setores', ''));
            for (const sector of context.setores) {
                $('mobile-sector').add(new Option('Setor ' + sector.id + ' · ' + sector.nome, sector.id));
            }
            records = (await api('atendimentos/')).items;
            if (run === version) draw();
        } catch (error) {
            if (run === version) {
                $('mobile-state').hidden = false;
                $('mobile-state').textContent = error.message;
            }
        } finally {
            if (run === version) $('mobile-refresh').disabled = false;
        }
    }

    $('mobile-date').value = new URLSearchParams(location.search).get('data') ||
        new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
    $('mobile-city').onchange = () => { scope(true); draw(); };
    $('mobile-common').onchange = () => {
        $('header-comum').textContent = $('mobile-common').value ||
            $('mobile-city').value || 'Regional Itapevi';
        draw();
    };
    $('mobile-date').onchange = draw;
    $('mobile-sector').onchange = draw;
    $('mobile-refresh').onclick = load;
    $('mobile-logout').onclick = () => logoutMobile();
    load();
})();
