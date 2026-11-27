/**
 * АВТОНОМНЫЙ МОДУЛЬ РЕДАКТИРОВАНИЯ ПРАВИЛ САЙТА В АДМИНКЕ (admin-rules.js)
 * Автоматически встраивает вкладку «📜 Правила сайта (Домовичок)» в admin.html.
 */
(function () {
    async function loadAdminRules() {
        const titleEl = document.getElementById('adminRulesTitleInput');
        const textEl = document.getElementById('adminRulesTextInput');
        const statusEl = document.getElementById('adminRulesStatus');
        if (!titleEl || !textEl) return;

        statusEl.style.color = '#5a3818';
        statusEl.textContent = 'Загрузка текущих правил...';
        try {
            const resp = await fetch('/api/rules', { credentials: 'same-origin', cache: 'no-store' });
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const data = await resp.json();
            if (data.rules) {
                titleEl.value = data.rules.title || '';
                textEl.value = data.rules.text || '';
                statusEl.textContent = 'Правила загружены из базы D1.';
            } else {
                statusEl.textContent = 'Правила ещё не заданы. Напишите текст и сохраните.';
            }
        } catch (err) {
            statusEl.style.color = '#8b1e0b';
            statusEl.textContent = `Ошибка загрузки: ${err.message}`;
        }
    }

    async function saveAdminRules() {
        const titleEl = document.getElementById('adminRulesTitleInput');
        const textEl = document.getElementById('adminRulesTextInput');
        const statusEl = document.getElementById('adminRulesStatus');
        const btn = document.getElementById('adminRulesSaveBtn');

        const title = (titleEl.value || '').trim();
        const text = (textEl.value || '').trim();
        

        btn.disabled = true;
        statusEl.style.color = '#5a3818';
        statusEl.textContent = 'Сохранение правил...';
        try {
            const resp = await fetch('/api/admin/rules', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({ title, text })
            });
            const result = await resp.json().catch(() => ({}));
            if (!resp.ok) throw new Error(result.error || `HTTP ${resp.status}`);

            statusEl.style.color = '#1b5e20';
            statusEl.textContent = '✔ Правила сайта обновлены (если поля пустые — текст полностью очищен).';
        } catch (err) {
            statusEl.style.color = '#8b1e0b';
            statusEl.textContent = `Ошибка сохранения: ${err.message}`;
        } finally {
            btn.disabled = false;
        }
    }

    function mountAdminRulesTab() {
        const tabsRow = document.querySelector('.tabs-row');
        const anchorPanel = document.getElementById('panelNews') || document.getElementById('panelImages') || document.getElementById('panelTreasury');
        if (!tabsRow || !anchorPanel || document.getElementById('admTabRules')) return;

        const tabBtn = document.createElement('button');
        tabBtn.type = 'button';
        tabBtn.className = 'tab-btn';
        tabBtn.id = 'admTabRules';
        tabBtn.textContent = '📜 Правила сайта (Домовичок)';
        tabsRow.prepend(tabBtn);

        const panel = document.createElement('div');
        panel.className = 'admin-panel';
        panel.id = 'panelRules';
        panel.innerHTML = `
            <h2 style="margin-top:0; color:#5a1807;">📜 Мир сказки — Правила сайта (Домовичок под граммофоном)</h2>
            <p style="margin-top:0; color:#3d260f; font-size:15px;">
                Этот текст открывается в красивом окне с портретом старичка-домовичка слева и кнопкой «✔ Ознакомлен» внизу, когда гость нажимает на маленького лесовичка под граммофоном в Горнице.
            </p>
            <div class="item-card" style="background:#fffdf7;">
                <label for="adminRulesTitleInput" style="display:block; font-weight:bold; margin-bottom:6px; color:#2b1708;">Заголовок окна правил (необязательно):</label>
                <input type="text" id="adminRulesTitleInput" maxlength="200" placeholder="Например: Правила поведения и устройства Мира сказки"
                    style="width:100%; padding:9px 12px; margin-bottom:12px; border:1.5px solid #8b5a2b; border-radius:8px; background:#ffffff; color:#000000; font-family:Georgia,serif; font-size:15px;">

                <label for="adminRulesTextInput" style="display:block; font-weight:bold; margin-bottom:6px; color:#2b1708;">Текст правил сайта (отображается чёрным шрифтом на светлом фоне):</label>
                <textarea id="adminRulesTextInput" rows="10" maxlength="15000" placeholder="Напишите правила сайта для гостей..."
                    style="width:100%; padding:10px 12px; border:1.5px solid #8b5a2b; border-radius:8px; background:#ffffff; color:#000000; font-family:Georgia,serif; font-size:16px; line-height:1.5; resize:vertical;"></textarea>

                <div style="display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap; margin-top:12px;">
                    <button type="button" class="action-btn" id="adminRulesSaveBtn">💾 Сохранить правила сайта</button>
                    <span id="adminRulesStatus" style="font-size:14px; font-weight:bold;"></span>
                </div>
            </div>
        `;
        anchorPanel.parentNode.insertBefore(panel, anchorPanel.nextSibling);

        document.getElementById('adminRulesSaveBtn').addEventListener('click', saveAdminRules);

        const origSwitch = window.switchAdminTab;
        window.switchAdminTab = function (tab) {
            tabBtn.classList.toggle('active', tab === 'rules');
            panel.classList.toggle('active', tab === 'rules');
            if (tab === 'rules') {
                ['Media', 'Ideas', 'Pairs', 'Treasury', 'Texts', 'Labels', 'Images', 'News'].forEach(name => {
                    const b = document.getElementById(`admTab${name}`);
                    const p = document.getElementById(`panel${name}`);
                    if (b) b.classList.remove('active');
                    if (p) p.classList.remove('active');
                });
                sessionStorage.setItem('GORNITSA_ADMIN_TAB', 'rules');
                loadAdminRules();
                return;
            }
            if (typeof origSwitch === 'function') origSwitch(tab);
        };

        tabBtn.addEventListener('click', () => window.switchAdminTab('rules'));

        if (sessionStorage.getItem('GORNITSA_ADMIN_TAB') === 'rules') {
            window.switchAdminTab('rules');
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mountAdminRulesTab);
    } else {
        mountAdminRulesTab();
    }
})();
