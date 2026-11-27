/**
 * АВТОНОМНЫЙ МОДУЛЬ «ПРАВИЛА МИРА СКАЗКИ — ДОМОВИЧОК ПОД ГРАММОФОНОМ» (rules.js)
 * - Перехватывает нажатие на лесовичка/домовичка под граммофоном в Избе (izba_domovoi)
 * - Слева: портрет старичка-домовичка из Избы, справа: правила сайта чёрным шрифтом + кнопка «✔ Ознакомлен»
 */
(function (window) {
    if (window.GornitsaRules) return;

    let cachedRules = null;
    let isReadFlag = false;
    let domovoiDataUrlCache = null;

    function formatDateTime(unixSec) {
        const d = new Date((Number(unixSec) || 0) * 1000);
        if (Number.isNaN(d.getTime())) return '';
        return d.toLocaleString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    // Вырезаем портрет старичка-домовичка под граммофоном прямо из сцены Избы
    function getDomovoiPortraitUrl() {
        if (domovoiDataUrlCache) return Promise.resolve(domovoiDataUrlCache);

        const fallbackSvg = 'data:image/svg+xml;utf8,' + encodeURIComponent(`
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 260">
                <defs>
                    <radialGradient id="dbg" cx="50%" cy="45%" r="60%">
                        <stop offset="0%" stop-color="#5c3818"/>
                        <stop offset="100%" stop-color="#241306"/>
                    </radialGradient>
                </defs>
                <rect width="220" height="260" rx="14" fill="url(#dbg)"/>
                <rect x="8" y="8" width="204" height="244" rx="10" fill="none" stroke="#d4af37" stroke-width="3"/>
                <ellipse cx="110" cy="185" rx="48" ry="42" fill="#2e5a27"/>
                <circle cx="110" cy="112" r="28" fill="#f2c9a0"/>
                <path d="M78 118 Q110 175 142 118 Q132 148 110 152 Q88 148 78 118 Z" fill="#f5f2eb"/>
                <ellipse cx="110" cy="88" rx="46" ry="14" fill="#8b4513"/>
                <path d="M82 88 Q110 42 138 88 Z" fill="#a0522d"/>
                <circle cx="100" cy="108" r="3" fill="#2b1708"/>
                <circle cx="120" cy="108" r="3" fill="#2b1708"/>
            </svg>
        `);

        return new Promise((resolve) => {
            const candidates = [
                'images/izba_man.jpeg',
                'images/izba_woman.jpeg',
                'izba_man.jpeg',
                'izba_woman.jpeg'
            ];
            let idx = 0;
            const img = new Image();
            img.crossOrigin = 'anonymous';

            function tryNext() {
                if (idx >= candidates.length) {
                    domovoiDataUrlCache = fallbackSvg;
                    resolve(fallbackSvg);
                    return;
                }
                img.src = candidates[idx++];
            }

            img.onload = function () {
                try {
                    const iw = img.naturalWidth;
                    const ih = img.naturalHeight;
                    const canvas = document.createElement('canvas');
                    canvas.width = 220;
                    canvas.height = 260;
                    const ctx = canvas.getContext('2d');
                    // Координаты старичка-домовичка под граммофоном (левый нижний угол сундука)
                    const sx = iw * 0.125;
                    const sy = ih * 0.615;
                    const sw = iw * 0.095;
                    const sh = ih * 0.215;
                    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
                    domovoiDataUrlCache = canvas.toDataURL('image/jpeg', 0.92);
                    resolve(domovoiDataUrlCache);
                } catch (e) {
                    domovoiDataUrlCache = fallbackSvg;
                    resolve(fallbackSvg);
                }
            };

            img.onerror = tryNext;
            tryNext();
        });
    }

    function injectStyles() {
        if (document.getElementById('gornitsaRulesStyles')) return;
        const style = document.createElement('style');
        style.id = 'gornitsaRulesStyles';
        style.textContent = `
            .gornitsa-rules-overlay {
                position: fixed;
                inset: 0;
                z-index: 2147483100;
                background: rgba(12, 6, 2, 0.8);
                backdrop-filter: blur(3px);
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 14px;
                box-sizing: border-box;
                font-family: 'Georgia', 'Times New Roman', serif;
            }
            .gornitsa-rules-card {
                width: min(780px, 96vw);
                max-height: 90vh;
                overflow-y: auto;
                background: radial-gradient(circle at 25% 20%, #fffdf6 0%, #f3e2c1 65%, #e2c693 100%);
                border: 4px solid #5a3210;
                outline: 2px solid #d4af37;
                border-radius: 16px;
                box-shadow: 0 22px 60px rgba(0, 0, 0, 0.92), inset 0 0 32px rgba(110, 65, 25, 0.28);
                padding: 20px 24px;
                color: #000000;
                box-sizing: border-box;
            }
            .gornitsa-rules-body {
                display: flex;
                gap: 20px;
                align-items: stretch;
            }
            .gornitsa-domovoi-box {
                flex: 0 0 175px;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: flex-start;
            }
            .gornitsa-domovoi-box img {
                width: 175px;
                height: 210px;
                object-fit: cover;
                border-radius: 12px;
                border: 3px solid #6e4119;
                outline: 2px solid #d4af37;
                box-shadow: 0 6px 18px rgba(0, 0, 0, 0.45);
                background: #23150b;
            }
            .gornitsa-domovoi-caption {
                margin-top: 8px;
                font-size: 13.5px;
                font-weight: bold;
                color: #4a280b;
                text-align: center;
            }
            .gornitsa-rules-content {
                flex: 1;
                min-width: 0;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
            }
            .gornitsa-rules-header {
                display: flex;
                justify-content: space-between;
                align-items: baseline;
                flex-wrap: wrap;
                gap: 8px;
                border-bottom: 2px dashed rgba(90, 50, 16, 0.45);
                padding-bottom: 8px;
                margin-bottom: 12px;
            }
            .gornitsa-rules-badge {
                font-size: 19px;
                font-weight: bold;
                color: #5a1807;
            }
            .gornitsa-rules-date {
                font-size: 12.5px;
                color: #4a2e12;
                font-weight: bold;
            }
            .gornitsa-rules-title {
                font-size: 18px;
                font-weight: bold;
                color: #000000;
                margin: 0 0 8px 0;
            }
            .gornitsa-rules-text {
                background: #ffffff;
                border: 1.5px solid #8b5a2b;
                border-radius: 10px;
                padding: 14px 16px;
                color: #000000 !important;
                font-size: 16px;
                font-weight: 600;
                line-height: 1.55;
                white-space: pre-wrap;
                word-break: break-word;
                max-height: 52vh;
                overflow-y: auto;
            }
            .gornitsa-rules-actions {
                margin-top: 16px;
                display: flex;
                justify-content: flex-end;
                gap: 10px;
                flex-wrap: wrap;
            }
            .gornitsa-rules-ack-btn {
                background: linear-gradient(180deg, #2e7d32 0%, #1b5e20 100%);
                color: #ffffff;
                border: 2px solid #d4af37;
                border-radius: 10px;
                padding: 10px 28px;
                font-family: 'Georgia', serif;
                font-size: 16px;
                font-weight: bold;
                cursor: pointer;
                box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
            }
            .gornitsa-rules-ack-btn:hover {
                filter: brightness(1.1);
                transform: translateY(-1px);
            }
            @media (max-width: 620px) {
                .gornitsa-rules-card { padding: 14px 16px; }
                .gornitsa-rules-body { flex-direction: column; align-items: center; }
                .gornitsa-domovoi-box { flex: none; }
                .gornitsa-domovoi-box img { width: 120px; height: 145px; }
                .gornitsa-rules-content { width: 100%; }
                .gornitsa-rules-ack-btn { width: 100%; }
            }
        `;
        document.head.appendChild(style);
    }

    async function fetchRules() {
        try {
            const resp = await fetch('/api/rules', {
                credentials: 'same-origin',
                cache: 'no-store'
            });
            if (!resp.ok) return null;
            const data = await resp.json();
            cachedRules = data.rules || null;
            isReadFlag = Boolean(data.is_read);
            return cachedRules;
        } catch (e) {
            return null;
        }
    }

    async function markRulesAcknowledged() {
        isReadFlag = true;
        try {
            await fetch('/api/rules', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                credentials: 'same-origin',
                body: '{}'
            });
        } catch (e) {
            console.error('Не удалось сохранить отметку об ознакомлении с правилами:', e);
        }
    }

    async function openRulesModal() {
        if (document.getElementById('gornitsaRulesOverlay')) return;
        injectStyles();

        await fetchRules();
        const domovoiUrl = await getDomovoiPortraitUrl();

        const overlay = document.createElement('div');
        overlay.id = 'gornitsaRulesOverlay';
        overlay.className = 'gornitsa-rules-overlay';

        const card = document.createElement('div');
        card.className = 'gornitsa-rules-card';

        const body = document.createElement('div');
        body.className = 'gornitsa-rules-body';

        const leftCol = document.createElement('div');
        leftCol.className = 'gornitsa-domovoi-box';
        const img = document.createElement('img');
        img.src = domovoiUrl;
        img.alt = 'Старичок Домовичок';
        const cap = document.createElement('div');
        cap.className = 'gornitsa-domovoi-caption';
        cap.textContent = '🧙‍♂️ Хранитель Горницы';
        leftCol.append(img, cap);

        const rightCol = document.createElement('div');
        rightCol.className = 'gornitsa-rules-content';

        const topBlock = document.createElement('div');
        const header = document.createElement('div');
        header.className = 'gornitsa-rules-header';
        const badge = document.createElement('span');
        badge.className = 'gornitsa-rules-badge';
        badge.textContent = '📜 Мир сказки — Правила сайта';
        const dateSpan = document.createElement('span');
        dateSpan.className = 'gornitsa-rules-date';
        dateSpan.textContent = cachedRules && cachedRules.updated_at
            ? `Обновлено: ${formatDateTime(cachedRules.updated_at)}`
            : '';
        header.append(badge, dateSpan);
        topBlock.appendChild(header);

        if (cachedRules && cachedRules.title) {
            const titleEl = document.createElement('div');
            titleEl.className = 'gornitsa-rules-title';
            titleEl.textContent = cachedRules.title;
            topBlock.appendChild(titleEl);
        }

        const textEl = document.createElement('div');
        textEl.className = 'gornitsa-rules-text';
        textEl.textContent = (cachedRules && cachedRules.text)
            ? cachedRules.text
            : 'Добро пожаловать в Мир сказки! Правила нашего сказочного края скоро будут записаны хранителем в Приказной Палате.';
        topBlock.appendChild(textEl);

        const actions = document.createElement('div');
        actions.className = 'gornitsa-rules-actions';
        const ackBtn = document.createElement('button');
        ackBtn.type = 'button';
        ackBtn.className = 'gornitsa-rules-ack-btn';
        ackBtn.textContent = '✔ Ознакомлен';
        ackBtn.onclick = async function () {
            ackBtn.disabled = true;
            await markRulesAcknowledged();
            overlay.remove();
        };
        actions.appendChild(ackBtn);

        rightCol.append(topBlock, actions);
        body.append(leftCol, rightCol);
        card.appendChild(body);
        overlay.appendChild(card);
        document.body.appendChild(overlay);
    }

    // Перехватываем нажатие на маленького лесовичка / домовичка под граммофоном в Избе
    function hookIzbaDomovoiTrigger() {
        const infoModal = document.getElementById('infoModal');
        if (!infoModal) return;

        const observer = new MutationObserver(() => {
            if (!infoModal.classList.contains('active')) return;
            const titleEl = document.getElementById('modalTitle');
            const titleText = (titleEl && titleEl.innerText || '').toLowerCase();
            if (titleText.includes('домово') || titleText.includes('лесович') || titleText.includes('хранитель горницы')) {
                if (typeof window.closeModal === 'function') window.closeModal();
                else infoModal.classList.remove('active');
                openRulesModal();
            }
        });
        observer.observe(infoModal, { attributes: true, attributeFilter: ['class'] });
    }

    window.GornitsaRules = {
        open: openRulesModal
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', hookIzbaDomovoiTrigger);
    } else {
        hookIzbaDomovoiTrigger();
    }
})(window);
