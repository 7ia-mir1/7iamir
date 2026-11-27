/**
 * АВТОНОМНЫЙ МОДУЛЬ УПРАВЛЕНИЯ НОВОСТЯМИ В АДМИНКЕ (admin-news.js)
 * Автоматически встраивает вкладку «🐦 Новости сайта (Сорока)» в admin.html без правки его основного кода.
 */
(function () {
    function formatDate(unixSec) {
        const d = new Date((Number(unixSec) || 0) * 1000);
        return Number.isNaN(d.getTime())
            ? ''
            : d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    }

    async function loadAdminNewsList() {
        const container = document.getElementById('adminNewsListContainer');
        if (!container) return;
        container.textContent = 'Загрузка новостей...';

        try {
            const resp = await fetch('/api/news', { credentials: 'same-origin', cache: 'no-store' });
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const data = await resp.json();
            const list = Array.isArray(data.news) ? data.news : [];

            container.replaceChildren();
            if (!list.length) {
                const empty = document.createElement('div');
                empty.style.cssText = 'padding:16px; text-align:center; color:#5a3818;';
                empty.textContent = 'Новостей пока нет. Напишите первую весть выше — она сразу прилетит пользователям!';
                container.appendChild(empty);
                return;
            }

            list.forEach(item => {
                const card = document.createElement('div');
                card.className = 'item-card';
                card.style.background = '#ffffff';

                const top = document.createElement('div');
                top.style.cssText = 'display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:8px; border-bottom:1px dashed rgba(139,90,43,0.35); padding-bottom:6px;';

                const titleSpan = document.createElement('strong');
                titleSpan.style.cssText = 'color:#000000; font-size:16px;';
                titleSpan.textContent = item.title ? `📌 ${item.title}` : '📌 Новость сайта';

                const rightBox = document.createElement('div');
                rightBox.style.cssText = 'display:flex; align-items:center; gap:10px;';

                const dateSpan = document.createElement('span');
                dateSpan.style.cssText = 'font-size:13px; color:#5a3818; font-weight:bold;';
                dateSpan.textContent = `🕒 ${formatDate(item.created_at)}`;

                const delBtn = document.createElement('button');
                delBtn.type = 'button';
                delBtn.className = 'action-btn danger';
                delBtn.textContent = '🗑 Удалить';
                delBtn.onclick = async () => {
                    if (!confirm('Удалить эту новость из архива и у пользователей?')) return;
                    const delResp = await fetch(`/api/admin/news?id=${encodeURIComponent(item.id)}`, {
                        method: 'DELETE',
                        credentials: 'same-origin'
                    });
                    if (delResp.ok) loadAdminNewsList();
                    else alert('Не удалось удалить новость.');
                };

                rightBox.append(dateSpan, delBtn);
                top.append(titleSpan, rightBox);

                const body = document.createElement('div');
                body.style.cssText = 'color:#000000; font-size:15px; line-height:1.48; white-space:pre-wrap; word-break:break-word;';
                body.textContent = item.text;

                card.append(top, body);
                container.appendChild(card);
            });
        } catch (err) {
            container.textContent = `Ошибка загрузки новостей: ${err.message}`;
        }
    }

    async function publishNews() {
        const titleEl = document.getElementById('adminNewsTitleInput');
        const textEl = document.getElementById('adminNewsTextInput');
        const statusEl = document.getElementById('adminNewsStatus');
        const btn = document.getElementById('adminNewsSendBtn');

        const title = (titleEl.value || '').trim();
        const text = (textEl.value || '').trim();
        if (!text) {
            statusEl.style.color = '#8b1e0b';
            statusEl.textContent = 'Введите текст новости перед отправкой.';
            return;
        }

        btn.disabled = true;
        statusEl.style.color = '#5a3818';
        statusEl.textContent = 'Отправка вести Сороке...';

        try {
            const resp = await fetch('/api/admin/news', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({ title, text })
            });
            const result = await resp.json().catch(() => ({}));
            if (!resp.ok) throw new Error(result.error || `HTTP ${resp.status}`);

            titleEl.value = '';
            textEl.value = '';
            statusEl.style.color = '#1b5e20';
            statusEl.textContent = '✔ Новость опубликована! Она сразу появится посередине экрана у всех пользователей.';
            await loadAdminNewsList();
        } catch (err) {
            statusEl.style.color = '#8b1e0b';
            statusEl.textContent = `Ошибка публикации: ${err.message}`;
        } finally {
            btn.disabled = false;
        }
    }

    function mountAdminNewsTab() {
        const tabsRow = document.querySelector('.tabs-row');
        const anchorPanel = document.getElementById('panelImages') || document.getElementById('panelTreasury');
        if (!tabsRow || !anchorPanel || document.getElementById('admTabNews')) return;

        const tabBtn = document.createElement('button');
        tabBtn.type = 'button';
        tabBtn.className = 'tab-btn';
        tabBtn.id = 'admTabNews';
        tabBtn.textContent = '🐦 Новости сайта (Сорока)';
        tabsRow.prepend(tabBtn);

        const panel = document.createElement('div');
        panel.className = 'admin-panel';
        panel.id = 'panelNews';
        panel.innerHTML = `
            <h2 style="margin-top:0; color:#5a1807;">🐦 Новости сайта — Сорока на окне</h2>
            <p style="margin-top:0; color:#3d260f; font-size:15px;">
                Напишите о новшествах и изменениях на сайте. После отправки сообщение сразу всплывёт посередине экрана у каждого пользователя (с портретом Сороки слева, чёрным читаемым текстом и кнопкой «Прочитано»), а также сохранится в архиве при нажатии на Сороку в Избе.
            </p>
            <div class="item-card" style="background:#fffdf7;">
                <label for="adminNewsTitleInput" style="display:block; font-weight:bold; margin-bottom:6px; color:#2b1708;">Заголовок новости (необязательно):</label>
                <input type="text" id="adminNewsTitleInput" maxlength="200" placeholder="Например: Обновление в Горнице и Чате"
                    style="width:100%; padding:9px 12px; margin-bottom:12px; border:1.5px solid #8b5a2b; border-radius:8px; background:#ffffff; color:#000000; font-family:Georgia,serif; font-size:15px;">

                <label for="adminNewsTextInput" style="display:block; font-weight:bold; margin-bottom:6px; color:#2b1708;">Текст новости (будет показан чёрным шрифтом на светлом фоне):</label>
                <textarea id="adminNewsTextInput" rows="5" maxlength="5000" placeholder="Опишите изменения и новшества на сайте..."
                    style="width:100%; padding:10px 12px; border:1.5px solid #8b5a2b; border-radius:8px; background:#ffffff; color:#000000; font-family:Georgia,serif; font-size:16px; line-height:1.5; resize:vertical;"></textarea>

                <div style="display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap; margin-top:12px;">
                    <button type="button" class="action-btn" id="adminNewsSendBtn">🐦 Отправить новость на сайт</button>
                    <span id="adminNewsStatus" style="font-size:14px; font-weight:bold;"></span>
                </div>
            </div>
            <h3 style="color:#5a1807; margin:18px 0 10px 0;">📜 Архив отправленных новостей (свежие сверху):</h3>
            <div id="adminNewsListContainer"></div>
        `;
        anchorPanel.parentNode.insertBefore(panel, anchorPanel.nextSibling);

        document.getElementById('adminNewsSendBtn').addEventListener('click', publishNews);

        const origSwitch = window.switchAdminTab;
        window.switchAdminTab = function (tab) {
            tabBtn.classList.toggle('active', tab === 'news');
            panel.classList.toggle('active', tab === 'news');
            if (tab === 'news') {
                ['Media', 'Ideas', 'Pairs', 'Treasury', 'Texts', 'Labels', 'Images'].forEach(name => {
                    const b = document.getElementById(`admTab${name}`);
                    const p = document.getElementById(`panel${name}`);
                    if (b) b.classList.remove('active');
                    if (p) p.classList.remove('active');
                });
                sessionStorage.setItem('GORNITSA_ADMIN_TAB', 'news');
                loadAdminNewsList();
                return;
            }
            if (typeof origSwitch === 'function') origSwitch(tab);
        };

        tabBtn.addEventListener('click', () => window.switchAdminTab('news'));

        if (sessionStorage.getItem('GORNITSA_ADMIN_TAB') === 'news') {
            window.switchAdminTab('news');
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mountAdminNewsTab);
    } else {
        mountAdminNewsTab();
    }
})();