/**
 * АВТОНОМНЫЙ МОДУЛЬ НОВОСТЕЙ «СОРОКА НА ОКНЕ» (news.js)
 * - Показывает непрочитанные новости посередине активного окна пользователя
 * - Слева: портрет сороки из Избы, справа: новость чёрным шрифтом в стиле сайта + кнопка «Прочитано»
 * - Автоматически перехватывает нажатие на Сороку в Избе и открывает Архив новостей (свежие сверху)
 */
(function (window) {
    if (window.GornitsaNews) return;

    const POLL_INTERVAL_MS = 12000;
    let cachedNews = [];
    let currentPopupNewsId = null;
    let sorokaDataUrlCache = null;

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

    function getSorokaPortraitUrl() {
        if (sorokaDataUrlCache) return Promise.resolve(sorokaDataUrlCache);

        const fallbackSvg = 'data:image/svg+xml;utf8,' + encodeURIComponent(`
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 260">
                <defs>
                    <radialGradient id="bg" cx="50%" cy="45%" r="60%">
                        <stop offset="0%" stop-color="#4e7a52"/>
                        <stop offset="100%" stop-color="#1e3522"/>
                    </radialGradient>
                </defs>
                <rect width="220" height="260" rx="14" fill="url(#bg)"/>
                <rect x="8" y="8" width="204" height="244" rx="10" fill="none" stroke="#d4af37" stroke-width="3"/>
                <path d="M55 190 L25 235 L42 238 L78 195 Z" fill="#141824"/>
                <ellipse cx="112" cy="145" rx="34" ry="44" transform="rotate(-18 112 145)" fill="#181c26"/>
                <ellipse cx="106" cy="154" rx="22" ry="30" transform="rotate(-18 106 154)" fill="#f7f5ef"/>
                <path d="M114 118 Q144 132 134 166 Q116 154 114 118 Z" fill="#23304a"/>
                <path d="M117 132 Q134 140 129 156 Q118 150 117 132 Z" fill="#ffffff"/>
                <circle cx="132" cy="95" r="22" fill="#181c26"/>
                <polygon points="150,90 176,97 150,104" fill="#2b2b2b"/>
                <circle cx="138" cy="91" r="4" fill="#ffffff"/>
                <circle cx="139" cy="91" r="2.2" fill="#000000"/>
                <line x1="20" y1="196" x2="200" y2="196" stroke="#6b3e19" stroke-width="10"/>
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
                    sorokaDataUrlCache = fallbackSvg;
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
                    const sx = iw * 0.135;
                    const sy = ih * 0.195;
                    const sw = iw * 0.115;
                    const sh = ih * 0.21;
                    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
                    sorokaDataUrlCache = canvas.toDataURL('image/jpeg', 0.9);
                    resolve(sorokaDataUrlCache);
                } catch (e) {
                    sorokaDataUrlCache = fallbackSvg;
                    resolve(fallbackSvg);
                }
            };

            img.onerror = tryNext;
            tryNext();
        });
    }

    function injectStyles() {
        if (document.getElementById('gornitsaNewsStyles')) return;
        const style = document.createElement('style');
        style.id = 'gornitsaNewsStyles';
        style.textContent = `
            .gornitsa-news-overlay {
                position: fixed;
                inset: 0;
                z-index: 2147483000;
                background: rgba(12, 6, 2, 0.78);
                backdrop-filter: blur(3px);
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 14px;
                box-sizing: border-box;
                font-family: 'Georgia', 'Times New Roman', serif;
            }
            .gornitsa-news-card {
                width: min(740px, 96vw);
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
            .gornitsa-news-body {
                display: flex;
                gap: 20px;
                align-items: stretch;
            }
            .gornitsa-soroka-box {
                flex: 0 0 170px;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: flex-start;
            }
            .gornitsa-soroka-box img {
                width: 170px;
                height: 200px;
                object-fit: cover;
                border-radius: 12px;
                border: 3px solid #6e4119;
                outline: 2px solid #d4af37;
                box-shadow: 0 6px 18px rgba(0, 0, 0, 0.45);
                background: #23150b;
            }
            .gornitsa-soroka-caption {
                margin-top: 7px;
                font-size: 13px;
                font-weight: bold;
                color: #4a280b;
                text-align: center;
            }
            .gornitsa-news-content {
                flex: 1;
                min-width: 0;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
            }
            .gornitsa-news-header {
                display: flex;
                justify-content: space-between;
                align-items: baseline;
                flex-wrap: wrap;
                gap: 8px;
                border-bottom: 2px dashed rgba(90, 50, 16, 0.45);
                padding-bottom: 8px;
                margin-bottom: 12px;
            }
            .gornitsa-news-badge {
                font-size: 17px;
                font-weight: bold;
                color: #5a1807;
            }
            .gornitsa-news-date {
                font-size: 13px;
                color: #4a2e12;
                font-weight: bold;
            }
            .gornitsa-news-title {
                font-size: 19px;
                font-weight: bold;
                color: #000000;
                margin: 0 0 8px 0;
            }
            .gornitsa-news-text {
                background: #ffffff;
                border: 1.5px solid #8b5a2b;
                border-radius: 10px;
                padding: 12px 15px;
                color: #000000 !important;
                font-size: 16px;
                font-weight: 600;
                line-height: 1.5;
                white-space: pre-wrap;
                word-break: break-word;
                max-height: 46vh;
                overflow-y: auto;
            }
            .gornitsa-news-actions {
                margin-top: 16px;
                display: flex;
                justify-content: flex-end;
                gap: 10px;
                flex-wrap: wrap;
            }
            .gornitsa-news-read-btn {
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
            .gornitsa-news-read-btn:hover {
                filter: brightness(1.1);
                transform: translateY(-1px);
            }
            .gornitsa-archive-item {
                background: #ffffff;
                border: 1.5px solid #8b5a2b;
                border-radius: 10px;
                padding: 12px 15px;
                margin-bottom: 10px;
                color: #000000;
            }
            .gornitsa-archive-meta {
                display: flex;
                justify-content: space-between;
                align-items: center;
                flex-wrap: wrap;
                gap: 6px;
                font-size: 13px;
                color: #5a3210;
                font-weight: bold;
                margin-bottom: 6px;
                border-bottom: 1px solid rgba(139, 90, 43, 0.25);
                padding-bottom: 4px;
            }
            .gornitsa-archive-text {
                color: #000000 !important;
                font-size: 15px;
                font-weight: 600;
                line-height: 1.48;
                white-space: pre-wrap;
                word-break: break-word;
            }
            @media (max-width: 620px) {
                .gornitsa-news-card { padding: 14px 16px; }
                .gornitsa-news-body { flex-direction: column; align-items: center; }
                .gornitsa-soroka-box { flex: none; }
                .gornitsa-soroka-box img { width: 115px; height: 135px; }
                .gornitsa-news-content { width: 100%; }
                .gornitsa-news-read-btn { width: 100%; }
            }
        `;
        document.head.appendChild(style);
    }

    async function fetchNewsList() {
        try {
            const resp = await fetch('/api/news', {
                credentials: 'same-origin',
                cache: 'no-store'
            });
            if (!resp.ok) return null;
            const data = await resp.json();
            if (Array.isArray(data.news)) {
                cachedNews = data.news;
                return cachedNews;
            }
        } catch (e) {}
        return null;
    }

    async function markAsRead(newsId) {
        const item = cachedNews.find(n => n.id === newsId);
        if (item) item.is_read = 1;
        try {
            await fetch('/api/news', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({ news_id: newsId })
            });
        } catch (e) {
            console.error('Не удалось сохранить статус прочтения новости:', e);
        }
    }

    async function showUnreadPopup(item) {
        if (!item || currentPopupNewsId === item.id) return;
        if (document.getElementById('gornitsaNewsPopupOverlay')) return;

        injectStyles();
        currentPopupNewsId = item.id;
        const sorokaUrl = await getSorokaPortraitUrl();

        const overlay = document.createElement('div');
        overlay.id = 'gornitsaNewsPopupOverlay';
        overlay.className = 'gornitsa-news-overlay';

        const card = document.createElement('div');
        card.className = 'gornitsa-news-card';

        const body = document.createElement('div');
        body.className = 'gornitsa-news-body';

        const leftCol = document.createElement('div');
        leftCol.className = 'gornitsa-soroka-box';
        const img = document.createElement('img');
        img.src = sorokaUrl;
        img.alt = 'Сорока на окне';
        const cap = document.createElement('div');
        cap.className = 'gornitsa-soroka-caption';
        cap.textContent = '🐦 Вести от Сороки';
        leftCol.append(img, cap);

        const rightCol = document.createElement('div');
        rightCol.className = 'gornitsa-news-content';

        const topBlock = document.createElement('div');
        const header = document.createElement('div');
        header.className = 'gornitsa-news-header';
        const badge = document.createElement('span');
        badge.className = 'gornitsa-news-badge';
        badge.textContent = '📜 Новости сайта';
        const dateSpan = document.createElement('span');
        dateSpan.className = 'gornitsa-news-date';
        dateSpan.textContent = formatDateTime(item.created_at);
        header.append(badge, dateSpan);
        topBlock.appendChild(header);

        if (item.title) {
            const titleEl = document.createElement('div');
            titleEl.className = 'gornitsa-news-title';
            titleEl.textContent = item.title;
            topBlock.appendChild(titleEl);
        }

        const textEl = document.createElement('div');
        textEl.className = 'gornitsa-news-text';
        textEl.textContent = item.text;
        topBlock.appendChild(textEl);

        const actions = document.createElement('div');
        actions.className = 'gornitsa-news-actions';
        const readBtn = document.createElement('button');
        readBtn.type = 'button';
        readBtn.className = 'gornitsa-news-read-btn';
        readBtn.textContent = '✔ Прочитано';
        readBtn.onclick = async function () {
            readBtn.disabled = true;
            await markAsRead(item.id);
            overlay.remove();
            currentPopupNewsId = null;
            checkAndShowNextUnread();
        };
        actions.appendChild(readBtn);

        rightCol.append(topBlock, actions);
        body.append(leftCol, rightCol);
        card.appendChild(body);
        overlay.appendChild(card);
        document.body.appendChild(overlay);
    }

    function checkAndShowNextUnread() {
        const unread = cachedNews.filter(n => !Number(n.is_read));
        if (!unread.length) return;
        showUnreadPopup(unread[0]);
    }

    async function pollNews() {
        if (location.pathname.endsWith('/login.html')) return;
        const list = await fetchNewsList();
        if (list) checkAndShowNextUnread();
    }

    async function openArchive() {
        injectStyles();
        const existing = document.getElementById('gornitsaNewsArchiveOverlay');
        if (existing) existing.remove();

        await fetchNewsList();
        const sorokaUrl = await getSorokaPortraitUrl();

        const overlay = document.createElement('div');
        overlay.id = 'gornitsaNewsArchiveOverlay';
        overlay.className = 'gornitsa-news-overlay';
        overlay.onclick = function (e) {
            if (e.target === overlay) overlay.remove();
        };

        const card = document.createElement('div');
        card.className = 'gornitsa-news-card';

        const header = document.createElement('div');
        header.className = 'gornitsa-news-header';
        header.style.alignItems = 'center';

        const titleWrap = document.createElement('div');
        titleWrap.style.cssText = 'display:flex; align-items:center; gap:12px;';
        const miniImg = document.createElement('img');
        miniImg.src = sorokaUrl;
        miniImg.alt = 'Сорока';
        miniImg.style.cssText = 'width:48px; height:54px; object-fit:cover; border-radius:8px; border:2px solid #6e4119;';
        const titleEl = document.createElement('div');
        titleEl.innerHTML = '<div style="font-size:20px; font-weight:bold; color:#5a1807;">🐦 Архив новостей от Сороки</div>' +
            '<div style="font-size:13px; color:#4a2e12;">Свежие вести сверху • По датам и времени</div>';
        titleWrap.append(miniImg, titleEl);

        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.textContent = 'ЗАКРЫТЬ';
        closeBtn.style.cssText = 'background:linear-gradient(180deg,#8b1e0b 0%,#520f04 100%); color:#ffe599; border:2px solid #d4af37; border-radius:8px; padding:7px 20px; font-family:Georgia,serif; font-size:14px; font-weight:bold; cursor:pointer;';
        closeBtn.onclick = function () { overlay.remove(); };
        header.append(titleWrap, closeBtn);
        card.appendChild(header);

        const listBox = document.createElement('div');
        listBox.style.cssText = 'max-height:62vh; overflow-y:auto; padding-right:4px;';

        if (!cachedNews.length) {
            const empty = document.createElement('div');
            empty.style.cssText = 'padding:28px; text-align:center; color:#4a2e12; font-size:16px;';
            empty.textContent = 'Сорока пока не приносила новостей на окне Избы.';
            listBox.appendChild(empty);
        } else {
            cachedNews.forEach(item => {
                const row = document.createElement('div');
                row.className = 'gornitsa-archive-item';

                const meta = document.createElement('div');
                meta.className = 'gornitsa-archive-meta';
                const leftMeta = document.createElement('span');
                leftMeta.textContent = item.title ? `📌 ${item.title}` : '📌 Весть от Сороки';
                const rightMeta = document.createElement('span');
                rightMeta.textContent = `🕒 ${formatDateTime(item.created_at)}`;
                meta.append(leftMeta, rightMeta);

                const bodyText = document.createElement('div');
                bodyText.className = 'gornitsa-archive-text';
                bodyText.textContent = item.text;

                row.append(meta, bodyText);
                listBox.appendChild(row);

                if (!Number(item.is_read)) markAsRead(item.id);
            });
        }

        card.appendChild(listBox);
        overlay.appendChild(card);
        document.body.appendChild(overlay);
    }

    // Автоматический перехват нажатия на Сороку в Избе без изменения кода index.html
    function hookIzbaSorokaTrigger() {
        const infoModal = document.getElementById('infoModal');
        if (!infoModal) return;

        const observer = new MutationObserver(() => {
            if (!infoModal.classList.contains('active')) return;
            const titleEl = document.getElementById('modalTitle');
            const titleText = (titleEl && titleEl.innerText || '').toLowerCase();
            if (titleText.includes('сорок') || titleText.includes('новост')) {
                if (typeof window.closeModal === 'function') window.closeModal();
                else infoModal.classList.remove('active');
                openArchive();
            }
        });
        observer.observe(infoModal, { attributes: true, attributeFilter: ['class'] });
    }

    window.GornitsaNews = {
        poll: pollNews,
        openArchive: openArchive
    };

    function init() {
        hookIzbaSorokaTrigger();
        pollNews();
        setInterval(pollNews, POLL_INTERVAL_MS);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})(window);