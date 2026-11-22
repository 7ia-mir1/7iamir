/**
 * МОДУЛЬ МЕДИАТЕКИ, НАСТРОЕК ПЛЕЙЛИСТОВ И ПЛЕЕРА (media.js — Версия 4)
 * Граммофон (музыка), Кот Баюн (песни), Волшебное Зеркало (клипы) и Кинотеатр.
 *
 * Новые возможности:
 * 1. Разворачивающиеся настройки (⚙ Настройки) отдельно для Граммофона, Кота Баюна, Зеркала и Кинотеатра:
 *    - Регулировка громкости звука (0–100%) с сохранением для каждого устройства.
 *    - Изменение очерёдности проигрываемых файлов в списке (кнопки ⬆ и ⬇).
 *    - Временное закрытие (отключение) надоевших файлов (кнопка «👁 Вкл / 🙈 Скрыт»), которые пропускаются при проигрывании, но остаются в списке и включаются обратно в один клик.
 * 2. Показ видеоклипов сначала в нормальном окне с возможностью развернуть «⛶ На весь экран» (и вернуть в обычное окно).
 * 3. Строгая блокировка перехода на сайт YouTube: все ролики YouTube открываются ТОЛЬКО внутри окна плеера (без ссылок на сайт YouTube и с защитной рамкой от перехода на внешний сайт).
 * 4. Полная интеграция с Приказной Палатой Администратора (admin.html) + сохранение загруженных с компьютера аудио/видео файлов в IndexedDB.
 */

(function (window) {
    const MEDIA_STORAGE_KEY = 'GORNITSA_MEDIA_LIBRARY_V4';
    const LEGACY_STORAGE_KEY = 'GORNITSA_MEDIA_LIBRARY_V3';
    const BEGET_SERVER_BASE_URL = '';

    // Прямые потоковые видеоролики (MP4) для гарантированного воспроизведения
    const SAMPLE_VIDEO_STREAMS = [
        'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
        'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
        'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoy.mp4',
        'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4'
    ];

    const defaultLibrary = {
        gramophone: [
            { id: 'g_synth1', title: 'Старинная шкатулка — Вальс Горницы', url: 'synth:waltz', source: 'builtin', disabled: false },
            { id: 'g_synth2', title: 'Вечер у камина — Тихая мелодия души', url: 'synth:romance', source: 'builtin', disabled: false },
            { id: 'g1', title: 'Мелодия для души (Инструментальная)', url: 'https://www.youtube.com/watch?v=zNHhr2Ozsgg', source: 'youtube', disabled: false },
            { id: 'g2', title: 'Музыкальный плейлист Горницы', url: 'https://www.youtube.com/watch?v=pHx15DoyfAk&list=PLuB_W_hxb8VkiaES755G6tgH_Ywwz7g4p', source: 'youtube', disabled: false }
        ],
        bayun: [
            { id: 'b_synth1', title: 'Кот Баюн — Сказочные гусли и колыбельная', url: 'synth:gusli', source: 'builtin', disabled: false },
            { id: 'b2', title: 'Павел Кашин — На крыльях любви (Песня)', url: SAMPLE_VIDEO_STREAMS[0], fileHint: 'pavel-kashin-na-kryilyah-lyubvi_154847.mp4', source: 'server', disabled: false },
            { id: 'b1', title: 'Песни и баллады Кота Баюна', url: 'https://www.youtube.com/watch?v=pHx15DoyfAk&list=PLuB_W_hxb8VkiaES755G6tgH_Ywwz7g4p', source: 'youtube', disabled: false }
        ],
        mirror: [
            { id: 'm1', title: 'Сказочный видеоклип №1 — Живая картина в Зеркале', url: SAMPLE_VIDEO_STREAMS[0], fileHint: 'pavel-kashin-alisa_276919.mp4', source: 'server', disabled: false },
            { id: 'm2', title: 'Сказочный видеоклип №2 — Лесные просторы', url: SAMPLE_VIDEO_STREAMS[1], fileHint: 'pavel-kashin-baryishnya_265530.mp4', source: 'server', disabled: false },
            { id: 'm3', title: 'Сказочный видеоклип №3 — Праздник в Горнице', url: SAMPLE_VIDEO_STREAMS[2], fileHint: 'pavel-kashin-slepaya-lyubov_143321.mp4', source: 'server', disabled: false },
            { id: 'm4', title: 'Сказочный видеоклип №4 — Радость встречи', url: SAMPLE_VIDEO_STREAMS[3], fileHint: 'pavel-kashin-ya-budu-s-toboy_530172.mp4', source: 'server', disabled: false },
            { id: 'm5', title: 'Сказочный видеоклип №5 — Путешествие', url: SAMPLE_VIDEO_STREAMS[4], fileHint: 'irina-krug-zahodi-ko-mne-vo-sne_351528.mp4', source: 'server', disabled: false },
            { id: 'm6', title: 'Музыкальный клип в Зеркале (YouTube в окне)', url: 'https://www.youtube.com/watch?v=zNHhr2Ozsgg', source: 'youtube', disabled: false }
        ],
        cinema: [
            { id: 'c0', title: 'Кинокартина в Иллюзионе — Сеанс №1', url: SAMPLE_VIDEO_STREAMS[1], source: 'server', disabled: false },
            { id: 'c1', title: 'Киносеанс в Иллюзионе — Сеанс №2 (YouTube в окне)', url: 'https://www.youtube.com/watch?v=pHx15DoyfAk', source: 'youtube', disabled: false }
        ]
    };

    const CATEGORY_META = {
        gramophone: { title: '📻 Старинный граммофон — Музыка', shortTitle: '📻 Граммофон (Музыка)', subtitle: 'Инструментальные мелодии для души в Горнице' },
        bayun:      { title: '🐈 Кот Баюн — Песни и баллады', shortTitle: '🐈 Кот Баюн (Песни)', subtitle: 'Мудрые песни, баллады и колыбельные в Горнице' },
        mirror:     { title: '🪞 Волшебное зеркало — Видеоклипы', shortTitle: '🪞 Зеркало (Клипы)', subtitle: 'Музыкальные видеоклипы в Горнице (в окне и на весь экран)' },
        cinema:     { title: '🎬 Иллюзионъ — Кинотеатр', shortTitle: '🎬 Кинотеатр (Фильмы)', subtitle: 'Поучительные фильмы о любви, семье и характерах' }
    };

    // Хранилище IndexedDB для загруженных с компьютера файлов (.mp3 / .mp4), чтобы они сохранялись между перезагрузками
    const LocalFileStore = {
        dbName: 'GornitsaMediaFilesDB',
        storeName: 'files',
        dbPromise: null,

        open: function () {
            if (this.dbPromise) return this.dbPromise;
            this.dbPromise = new Promise((resolve, reject) => {
                if (!window.indexedDB) return resolve(null);
                const req = indexedDB.open(this.dbName, 1);
                req.onupgradeneeded = (e) => {
                    const db = e.target.result;
                    if (!db.objectStoreNames.contains(this.storeName)) {
                        db.createObjectStore(this.storeName);
                    }
                };
                req.onsuccess = (e) => resolve(e.target.result);
                req.onerror = () => resolve(null);
            });
            return this.dbPromise;
        },

        saveFile: async function (id, fileBlob) {
            const db = await this.open();
            if (!db) return false;
            return new Promise((resolve) => {
                const tx = db.transaction(this.storeName, 'readwrite');
                tx.objectStore(this.storeName).put(fileBlob, id);
                tx.oncomplete = () => resolve(true);
                tx.onerror = () => resolve(false);
            });
        },

        getFileUrl: async function (id) {
            const db = await this.open();
            if (!db) return null;
            return new Promise((resolve) => {
                const tx = db.transaction(this.storeName, 'readonly');
                const req = tx.objectStore(this.storeName).get(id);
                req.onsuccess = () => {
                    if (req.result) {
                        resolve(URL.createObjectURL(req.result));
                    } else {
                        resolve(null);
                    }
                };
                req.onerror = () => resolve(null);
            });
        },

        deleteFile: async function (id) {
            const db = await this.open();
            if (!db) return;
            const tx = db.transaction(this.storeName, 'readwrite');
            tx.objectStore(this.storeName).delete(id);
        }
    };

    const FairyTaleSynth = {
        ctx: null,
        timer: null,
        isPlaying: false,
        step: 0,
        volume: 0.8,

        setVolume: function (vol0to1) {
            this.volume = Math.max(0, Math.min(1, Number(vol0to1)));
        },

        play: function (mode, vol0to1) {
            this.stop();
            if (typeof vol0to1 === 'number') this.setVolume(vol0to1);
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            this.ctx = new AudioCtx();
            this.isPlaying = true;
            this.step = 0;

            const melodies = {
                waltz:   [293.66, 349.23, 440.00, 349.23, 440.00, 349.23, 329.63, 392.00, 523.25, 392.00, 493.88, 392.00, 293.66, 349.23, 440.00, 587.33, 523.25, 440.00],
                romance: [220.00, 261.63, 329.63, 440.00, 392.00, 329.63, 293.66, 349.23, 440.00, 392.00, 329.63, 246.94],
                gusli:   [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 440.00, 392.00, 329.63, 293.66, 329.63, 392.00]
            };
            const notes = melodies[mode] || melodies.waltz;
            const tempoMs = mode === 'gusli' ? 380 : 480;

            const playNextNote = () => {
                if (!this.isPlaying || !this.ctx) return;
                const freq = notes[this.step % notes.length];
                const now = this.ctx.currentTime;
                const peakGain = Math.max(0.0005, 0.22 * this.volume);

                if (this.volume > 0.005) {
                    const osc = this.ctx.createOscillator();
                    const gain = this.ctx.createGain();

                    osc.type = mode === 'gusli' ? 'triangle' : 'sine';
                    osc.frequency.setValueAtTime(freq, now);

                    gain.gain.setValueAtTime(0.0005, now);
                    gain.gain.exponentialRampToValueAtTime(peakGain, now + 0.04);
                    gain.gain.exponentialRampToValueAtTime(0.0005, now + (tempoMs / 1000) * 1.4);

                    osc.connect(gain);
                    gain.connect(this.ctx.destination);

                    osc.start(now);
                    osc.stop(now + (tempoMs / 1000) * 1.45);
                }

                this.step++;
                this.timer = setTimeout(playNextNote, tempoMs);
            };

            playNextNote();
        },

        stop: function () {
            this.isPlaying = false;
            if (this.timer) {
                clearTimeout(this.timer);
                this.timer = null;
            }
            if (this.ctx) {
                try { this.ctx.close(); } catch (e) {}
                this.ctx = null;
            }
        }
    };

    const GornitsaMedia = {
        library: null,
        volumes: { gramophone: 80, bayun: 80, mirror: 85, cinema: 90 },
        apiSyncReady: false,
        apiSyncPromise: null,
        activeCategory: 'mirror',
        activeIndex: 0,
        modalSettingsOpen: true,
        isModalFullscreen: false,
        bgCategory: null,
        bgIndex: 0,
        bgSettingsOpen: false,
        blobUrlCache: {},

        init: function () {
            try {
                let raw = localStorage.getItem(MEDIA_STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
                if (raw) {
                    const parsed = JSON.parse(raw);
                    if (parsed.library) {
                        this.library = Object.assign({}, defaultLibrary, parsed.library);
                        this.volumes = Object.assign({ gramophone: 80, bayun: 80, mirror: 85, cinema: 90 }, parsed.volumes || {});
                    } else {
                        this.library = Object.assign({}, defaultLibrary, parsed);
                    }
                } else {
                    this.library = JSON.parse(JSON.stringify(defaultLibrary));
                }
                // Гарантируем поле disabled у каждого элемента
                for (let cat in this.library) {
                    if (Array.isArray(this.library[cat])) {
                        this.library[cat].forEach(item => {
                            if (typeof item.disabled !== 'boolean') item.disabled = false;
                        });
                    }
                }
                this.save();
            } catch (e) {
                this.library = JSON.parse(JSON.stringify(defaultLibrary));
            }
            this.apiSyncPromise = this.syncFromApi();
            return this.library;
        },

        syncFromApi: async function () {
            try {
                const response = await fetch('/api/media', {
                    cache: 'no-store',
                    credentials: 'same-origin'
                });
                if (!response.ok) throw new Error('API media unavailable');
                const data = await response.json();
                const remoteItems = Array.isArray(data.items) ? data.items : [];

                const remoteByCategory = { gramophone: [], bayun: [], mirror: [], cinema: [] };
                for (const remote of remoteItems) {
                    if (!remoteByCategory[remote.category]) remoteByCategory[remote.category] = [];
                    remoteByCategory[remote.category].push({
                        id: remote.id,
                        _apiId: remote.id,
                        title: remote.title,
                        url: remote.url,
                        source: remote.source,
                        disabled: Boolean(remote.disabled),
                        position: Number(remote.position) || 0
                    });
                }

                for (const category of Object.keys(remoteByCategory)) {
                    const localItems = (this.library[category] || []).filter(item =>
                        item.url && item.url.startsWith('indexeddb:')
                    );
                    const remote = remoteByCategory[category].sort((a, b) =>
                        (a.position - b.position) || a.title.localeCompare(b.title)
                    );
                    this.library[category] = remote.concat(localItems);
                }

                this.apiSyncReady = true;
                this.save();
            } catch (error) {
                this.apiSyncReady = true;
                console.warn('Не удалось загрузить общую медиатеку:', error);
            }
        },

        saveApiItem: async function (category, item) {
            if (!item || item.url.startsWith('indexeddb:') || item.source === 'builtin') return;
            try {
                const response = await fetch('/api/media', {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({
                        id: item._apiId || item.id,
                        category,
                        title: item.title,
                        url: item.url,
                        source: item.source,
                        disabled: Boolean(item.disabled),
                        position: (this.library[category] || []).indexOf(item)
                    })
                });
                if (!response.ok) throw new Error('Не удалось сохранить медиафайл');
                const data = await response.json();
                if (data.item) {
                    item._apiId = data.item.id;
                    this.save();
                }
            } catch (error) {
                console.error(error);
                alert('Не удалось сохранить запись в общей базе D1.');
            }
        },

        updateApiItem: async function (item) {
            if (!item || !item._apiId) return;
            try {
                await fetch('/api/media', {
                    method: 'PUT',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify(item)
                });
            } catch (error) {
                console.error('Не удалось обновить медиафайл:', error);
            }
        },

        deleteApiItem: async function (item) {
            if (!item || !item._apiId) return;
            try {
                await fetch('/api/media?id=' + encodeURIComponent(item._apiId), {
                    method: 'DELETE'
                });
            } catch (error) {
                console.error('Не удалось удалить медиафайл:', error);
            }
        },

        syncCategoryOrderToApi: async function (category) {
            const list = this.library[category] || [];
            for (let position = 0; position < list.length; position++) {
                const item = list[position];
                if (item._apiId) {
                    await this.updateApiItem({
                        id: item._apiId,
                        category,
                        title: item.title,
                        url: item.url,
                        source: item.source,
                        disabled: Boolean(item.disabled),
                        position
                    });
                }
            }
        },

        save: function () {
            try {
                localStorage.setItem(MEDIA_STORAGE_KEY, JSON.stringify({
                    library: this.library,
                    volumes: this.volumes
                }));
                window.dispatchEvent(new CustomEvent('gornitsaMediaUpdated'));
            } catch (e) {
                console.error('Ошибка сохранения медиатеки:', e);
            }
        },

        getVolume: function (category) {
            const v = this.volumes[category];
            return typeof v === 'number' ? v : 80;
        },

        setVolume: function (category, vol0to100) {
            const v = Math.max(0, Math.min(100, Math.round(Number(vol0to100) || 0)));
            this.volumes[category] = v;
            this.save();

            const norm = v / 100;
            FairyTaleSynth.setVolume(norm);

            // Применяем громкость ко всем открытым audio/video элементам
            document.querySelectorAll('#gornitsaMediaModal video, #gornitsaMediaModal audio, #gornitsaBgMusicBar audio, #gornitsaBgMusicBar video').forEach(el => {
                try {
                    el.volume = norm;
                    el.muted = (v === 0);
                } catch (e) {}
            });

            // Применяем громкость к YouTube IFrame через YouTube IFrame API postMessage
            document.querySelectorAll('.gornitsa-yt-iframe').forEach(ifr => {
                try {
                    ifr.contentWindow.postMessage(JSON.stringify({
                        event: 'command',
                        func: 'setVolume',
                        args: [v]
                    }), '*');
                    if (v === 0) {
                        ifr.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'mute', args: [] }), '*');
                    } else {
                        ifr.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'unMute', args: [] }), '*');
                    }
                } catch (e) {}
            });

            const lbl1 = document.getElementById('modalVolVal');
            if (lbl1) lbl1.textContent = v + '%';
            const lbl2 = document.getElementById('bgVolVal');
            if (lbl2) lbl2.textContent = v + '%';
        },

        // Получение только активных (не закрытых временно) индексов
        getEnabledIndices: function (category) {
            const list = this.library[category] || [];
            const indices = [];
            list.forEach((item, idx) => {
                if (!item.disabled) indices.push(idx);
            });
            return indices;
        },

        findNextEnabledIndex: function (category, currentIndex, stepDir) {
            const list = this.library[category] || [];
            if (list.length === 0) return -1;
            const enabled = this.getEnabledIndices(category);
            if (enabled.length === 0) return -1;

            if (stepDir === 0) {
                return enabled.includes(currentIndex) ? currentIndex : enabled[0];
            }
            const pos = enabled.indexOf(currentIndex);
            if (pos === -1) return enabled[0];
            const nextPos = (pos + stepDir + enabled.length) % enabled.length;
            return enabled[nextPos];
        },

        addItem: function (category, title, url, sourceType, extra) {
            if (!this.library[category]) this.library[category] = [];
            const item = Object.assign({
                id: 'med_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
                title: (title || '').trim() || (url || '').trim(),
                url: (url || '').trim(),
                source: sourceType || this.detectSource(url),
                disabled: false
            }, extra || {});
            this.library[category].unshift(item);
            this.save();
            this.saveApiItem(category, item);
            return item;
        },

        addUploadedFile: async function (category, file, customTitle) {
            if (!file) return null;
            const id = 'localfile_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
            await LocalFileStore.saveFile(id, file);
            const blobUrl = URL.createObjectURL(file);
            this.blobUrlCache[id] = blobUrl;
            const isAudio = file.type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|flac)$/i.test(file.name);
            const item = this.addItem(
                category,
                customTitle || file.name.replace(/\.[^/.]+$/, ''),
                'indexeddb:' + id,
                isAudio ? 'local_audio' : 'local_video',
                { fileName: file.name, mimeType: file.type }
            );
            return item;
        },

        moveItem: function (category, index, direction) {
            const list = this.library[category];
            if (!list || index < 0 || index >= list.length) return false;
            const target = index + direction;
            if (target < 0 || target >= list.length) return false;

            const temp = list[index];
            list[index] = list[target];
            list[target] = temp;

            if (this.activeCategory === category) {
                if (this.activeIndex === index) this.activeIndex = target;
                else if (this.activeIndex === target) this.activeIndex = index;
            }
            if (this.bgCategory === category) {
                if (this.bgIndex === index) this.bgIndex = target;
                else if (this.bgIndex === target) this.bgIndex = index;
            }

            this.save();
            this.syncCategoryOrderToApi(category);
            return true;
        },

        toggleItemDisabled: function (category, index) {
            const list = this.library[category];
            if (!list || !list[index]) return;
            list[index].disabled = !list[index].disabled;
            this.save();
            this.updateApiItem({
                id: list[index]._apiId,
                category,
                title: list[index].title,
                url: list[index].url,
                source: list[index].source,
                disabled: list[index].disabled,
                position: index
            });
            return list[index].disabled;
        },

        removeItem: function (category, index) {
            const list = this.library[category];
            if (list && list[index]) {
                const removed = list.splice(index, 1)[0];
                if (removed && removed.url && removed.url.startsWith('indexeddb:')) {
                    LocalFileStore.deleteFile(removed.url.replace('indexeddb:', ''));
                }
                this.deleteApiItem(removed);
                this.save();
                this.syncCategoryOrderToApi(category);
            }
        },

        resetCategoryToDefault: function (category) {
            if (defaultLibrary[category]) {
                this.library[category] = JSON.parse(JSON.stringify(defaultLibrary[category]));
                this.save();
            }
        },

        detectSource: function (url) {
            const u = (url || '').toLowerCase();
            if (u.startsWith('synth:')) return 'builtin';
            if (u.startsWith('indexeddb:')) return 'local_file';
            if (u.includes('youtube.com') || u.includes('youtu.be')) return 'youtube';
            if (u.includes('vk.com') || u.includes('vkvideo.ru')) return 'vk';
            if (u.includes('rutube.ru')) return 'rutube';
            if (u.includes('pexels.com')) return 'pexels';
            if (u.includes('archive.org')) return 'archive';
            if (u.includes('clipmuz')) return 'clipmuz';
            if (u.includes('mobclip')) return 'mobclip';
            return 'server';
        },

        // Формирует строго встроенный URL плеера YouTube без переходов на внешний сайт
        getYouTubeEmbedUrl: function (url) {
            let videoId = '';
            let listId = '';
            try {
                const uObj = new URL(url);
                if (uObj.hostname.includes('youtu.be')) {
                    videoId = uObj.pathname.slice(1);
                } else if (uObj.pathname.includes('/embed/')) {
                    const parts = uObj.pathname.split('/embed/');
                    videoId = parts[1] ? parts[1].split(/[/?&]/)[0] : '';
                    listId = uObj.searchParams.get('list') || '';
                } else if (uObj.pathname.includes('/shorts/')) {
                    const parts = uObj.pathname.split('/shorts/');
                    videoId = parts[1] ? parts[1].split(/[/?&]/)[0] : '';
                } else {
                    videoId = uObj.searchParams.get('v') || '';
                    listId = uObj.searchParams.get('list') || '';
                }
            } catch (e) {
                const m = url.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/);
                if (m) videoId = m[1];
            }

            if (listId && listId.startsWith('RD')) {
                listId = '';
            }

            const params = 'autoplay=1&rel=0&modestbranding=1&iv_load_policy=3&playsinline=1&enablejsapi=1&fs=1';
            if (videoId && listId) {
                return `https://www.youtube-nocookie.com/embed/${videoId}?list=${listId}&${params}`;
            } else if (videoId) {
                return `https://www.youtube-nocookie.com/embed/${videoId}?${params}`;
            } else if (listId) {
                return `https://www.youtube-nocookie.com/embed/videoseries?list=${listId}&${params}`;
            }
            return url;
        },

        // Встраиваемый YouTube-контейнер с защитой от клика по логотипу YouTube (чтобы нельзя было уйти на сайт YouTube)
        buildProtectedYouTubeBox: function (url, heightCss, isCompact) {
            const embedUrl = this.getYouTubeEmbedUrl(url);
            const boxStyle = heightCss
                ? `position:relative; width:100%; height:${heightCss}; background:#000; border-radius:10px; overflow:hidden; border:2px solid #d4af37;`
                : `position:relative; width:100%; padding-top:56.25%; background:#000; border-radius:10px; overflow:hidden; border:2px solid #d4af37;`;

            return `
                <div class="gornitsa-video-stage" style="${boxStyle}">
                    <iframe class="gornitsa-yt-iframe" src="${embedUrl}"
                        style="position:absolute; inset:0; width:100%; height:100%; border:0;"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                        allowfullscreen
                        sandbox="allow-scripts allow-same-origin allow-presentation"></iframe>
                    <!-- Защитная прозрачная планка сверху и над логотипом YouTube: блокирует переход на сайт YouTube -->
                    <div title="Просмотр внутри окна Сказочной Горницы"
                        style="position:absolute; top:0; left:0; right:0; height:${isCompact ? '34px' : '54px'}; z-index:4; background:transparent; cursor:default;"
                        onclick="event.stopPropagation(); event.preventDefault();"></div>
                    <div title="Переход на внешний сайт отключён"
                        style="position:absolute; bottom:0; right:42px; width:115px; height:42px; z-index:4; background:transparent; cursor:default;"
                        onclick="event.stopPropagation(); event.preventDefault();"></div>
                </div>
            `;
        },

        // Фоновый мини-плеер для Граммофона (музыка) и Кота Баюна (песни) с разворачивающимися настройками
        startBackgroundMusic: async function (category, requestedIndex) {
            let bigModal = document.getElementById('gornitsaMediaModal');
            if (bigModal) bigModal.remove();
            FairyTaleSynth.stop();

            this.bgCategory = category || 'gramophone';
            const list = this.library[this.bgCategory] || [];
            if (list.length === 0) return;

            let targetIdx = typeof requestedIndex === 'number' ? requestedIndex : this.bgIndex;
            const enabledIndices = this.getEnabledIndices(this.bgCategory);

            if (enabledIndices.length === 0) {
                // Если все файлы были временно закрыты, открываем окно настроек, чтобы пользователь мог включить нужные
                this.openPlayerModal(this.bgCategory);
                return;
            }

            if (!enabledIndices.includes(targetIdx)) {
                targetIdx = enabledIndices[0];
            }
            this.bgIndex = targetIdx;

            const item = list[this.bgIndex];
            const meta = CATEGORY_META[this.bgCategory] || CATEGORY_META.gramophone;
            const vol = this.getVolume(this.bgCategory);

            let bar = document.getElementById('gornitsaBgMusicBar');
            if (!bar) {
                bar = document.createElement('div');
                bar.id = 'gornitsaBgMusicBar';
                bar.style.cssText = `
                    position: fixed; bottom: 18px; left: 18px; z-index: 250;
                    width: min(460px, calc(100vw - 90px));
                    background: linear-gradient(135deg, rgba(43, 24, 10, 0.97), rgba(22, 12, 5, 0.99));
                    border: 2px solid #d4af37; border-radius: 14px;
                    padding: 12px 14px; color: #f4e8d1;
                    font-family: 'Georgia', serif;
                    box-shadow: 0 12px 36px rgba(0,0,0,0.92);
                `;
                document.body.appendChild(bar);
            }

            let url = (item.url || '').trim();
            if (url.startsWith('indexeddb:')) {
                const fileId = url.replace('indexeddb:', '');
                if (!this.blobUrlCache[fileId]) {
                    this.blobUrlCache[fileId] = await LocalFileStore.getFileUrl(fileId);
                }
                url = this.blobUrlCache[fileId] || '';
            }

            let engineHTML = '';
            if (url.startsWith('synth:')) {
                const mode = url.split(':')[1] || 'waltz';
                FairyTaleSynth.play(mode, vol / 100);
                engineHTML = `
                    <div style="margin-top:7px; font-size:12.5px; color:#50fa7b; display:flex; align-items:center; justify-content:space-between; background:rgba(0,0,0,0.3); padding:5px 10px; border-radius:7px;">
                        <span>🎶 Звучит мелодия...</span>
                        <button id="bgPauseSynthBtn" style="background:#4a2c14; color:#ffd700; border:1px solid #d4af37; border-radius:5px; padding:3px 10px; cursor:pointer; font-size:12px; font-family:'Georgia',serif;">⏸ Пауза</button>
                    </div>
                `;
            } else if (url.includes('youtube.com') || url.includes('youtu.be')) {
                engineHTML = `<div style="margin-top:8px;">${this.buildProtectedYouTubeBox(url, '120px', true)}</div>`;
            } else {
                const fullUrl = (url.startsWith('http') || url.startsWith('data:') || url.startsWith('blob:'))
                    ? url : (BEGET_SERVER_BASE_URL + url);
                const isVideo = /\.(mp4|webm)(\?.*)?$/i.test(fullUrl) || item.source === 'local_video' || item.source === 'server';
                if (isVideo && !/\.(mp3|wav|ogg)$/i.test(fullUrl)) {
                    engineHTML = `
                        <div style="margin-top:8px; position:relative;">
                            <video id="bgMediaEl" controls autoplay style="width:100%; max-height:150px; border-radius:8px; background:#000; border:1px solid #d4af37;">
                                <source src="${fullUrl}">
                            </video>
                        </div>
                    `;
                } else {
                    engineHTML = `
                        <div style="margin-top:8px;">
                            <audio id="bgMediaEl" controls autoplay style="width:100%; height:34px;">
                                <source src="${fullUrl}">
                            </audio>
                        </div>
                    `;
                }
            }

            bar.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
                    <div style="overflow:hidden;">
                        <div style="font-size:12px; color:#ffd700; font-weight:bold;">
                            ${meta.shortTitle} • Активно: ${enabledIndices.length}/${list.length}
                        </div>
                        <div style="font-size:13.5px; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:2px;" title="${item.title}">
                            🎵 ${item.title}
                        </div>
                    </div>
                    <div style="display:flex; gap:5px; flex-shrink:0; align-items:center;">
                        <button id="bgPrevBtn" title="Предыдущая запись" style="background:#5c4033; color:#ffd700; border:1px solid #d4af37; border-radius:6px; padding:4px 8px; cursor:pointer; font-size:12px;">⏮</button>
                        <button id="bgNextBtn" title="Следующая запись" style="background:#5c4033; color:#ffd700; border:1px solid #d4af37; border-radius:6px; padding:4px 8px; cursor:pointer; font-size:12px;">⏭</button>
                        <button id="bgSettingsToggleBtn" title="Развернуть/свернуть настройки очереди и звука" style="background:${this.bgSettingsOpen ? '#8c6239' : '#4a2c14'}; color:#ffd700; border:1.5px solid #ffd700; border-radius:6px; padding:4px 9px; cursor:pointer; font-size:12px; font-weight:bold; font-family:'Georgia',serif;">
                            ⚙ Настройки ${this.bgSettingsOpen ? '▲' : '▼'}
                        </button>
                        <button id="bgExpandModalBtn" title="Открыть в большом окне" style="background:#2e5cb8; color:#fff; border:1px solid #ffd700; border-radius:6px; padding:4px 7px; cursor:pointer; font-size:12px;">❐</button>
                        <button id="bgStopBtn" title="Выключить" style="background:#8b0000; color:#fff; border:1px solid #ffd700; border-radius:6px; padding:4px 8px; cursor:pointer; font-size:12px; font-weight:bold;">✖</button>
                    </div>
                </div>
                ${engineHTML}
                <div id="bgSettingsDrawer" style="display:${this.bgSettingsOpen ? 'block' : 'none'}; margin-top:10px; padding-top:10px; border-top:1px dashed rgba(212,175,55,0.5);">
                    <!-- Ползунок громкости -->
                    <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:8px; background:rgba(0,0,0,0.35); padding:6px 10px; border-radius:8px; border:1px solid rgba(212,175,55,0.35);">
                        <span style="font-size:12.5px; color:#ffd700; font-weight:bold;">🔊 Звук:</span>
                        <input type="range" id="bgVolSlider" min="0" max="100" value="${vol}" style="flex:1; accent-color:#ffd700; cursor:pointer;">
                        <span id="bgVolVal" style="font-size:12.5px; color:#fff; min-width:36px; text-align:right; font-weight:bold;">${vol}%</span>
                    </div>
                    <div style="font-size:11.5px; color:#d8c39e; margin-bottom:6px;">
                        Очерёдность (⬆/⬇) и временное закрытие надоевших файлов (👁/🙈):
                    </div>
                    <div id="bgPlaylistItems" style="max-height:175px; overflow-y:auto; display:flex; flex-direction:column; gap:5px; padding-right:3px;"></div>
                </div>
            `;

            const mediaEl = document.getElementById('bgMediaEl');
            if (mediaEl) {
                mediaEl.volume = vol / 100;
                mediaEl.onended = () => {
                    const nextIdx = this.findNextEnabledIndex(this.bgCategory, this.bgIndex, 1);
                    if (nextIdx !== -1) this.startBackgroundMusic(this.bgCategory, nextIdx);
                };
            }

            document.getElementById('bgPrevBtn').onclick = () => {
                const prevIdx = this.findNextEnabledIndex(this.bgCategory, this.bgIndex, -1);
                if (prevIdx !== -1) this.startBackgroundMusic(this.bgCategory, prevIdx);
            };
            document.getElementById('bgNextBtn').onclick = () => {
                const nextIdx = this.findNextEnabledIndex(this.bgCategory, this.bgIndex, 1);
                if (nextIdx !== -1) this.startBackgroundMusic(this.bgCategory, nextIdx);
            };
            document.getElementById('bgSettingsToggleBtn').onclick = () => {
                this.bgSettingsOpen = !this.bgSettingsOpen;
                const dr = document.getElementById('bgSettingsDrawer');
                const btn = document.getElementById('bgSettingsToggleBtn');
                if (dr) dr.style.display = this.bgSettingsOpen ? 'block' : 'none';
                if (btn) {
                    btn.style.background = this.bgSettingsOpen ? '#8c6239' : '#4a2c14';
                    btn.innerHTML = `⚙ Настройки ${this.bgSettingsOpen ? '▲' : '▼'}`;
                }
            };
            document.getElementById('bgExpandModalBtn').onclick = () => {
                const cat = this.bgCategory;
                const idx = this.bgIndex;
                this.stopBackgroundMusic();
                this.openPlayerModal(cat, idx);
            };
            document.getElementById('bgStopBtn').onclick = () => this.stopBackgroundMusic();

            const volSlider = document.getElementById('bgVolSlider');
            if (volSlider) {
                volSlider.oninput = (e) => this.setVolume(this.bgCategory, e.target.value);
            }

            const pauseBtn = document.getElementById('bgPauseSynthBtn');
            if (pauseBtn) {
                pauseBtn.onclick = () => {
                    if (FairyTaleSynth.isPlaying) {
                        FairyTaleSynth.stop();
                        pauseBtn.textContent = '▶ Играть';
                    } else {
                        const mode = url.split(':')[1] || 'waltz';
                        FairyTaleSynth.play(mode, this.getVolume(this.bgCategory) / 100);
                        pauseBtn.textContent = '⏸ Пауза';
                    }
                };
            }

            this.renderBgPlaylistSettings();
        },

        renderBgPlaylistSettings: function () {
            const container = document.getElementById('bgPlaylistItems');
            if (!container || !this.bgCategory) return;
            const list = this.library[this.bgCategory] || [];
            container.innerHTML = '';

            list.forEach((item, idx) => {
                const isCurrent = (idx === this.bgIndex && !item.disabled);
                const row = document.createElement('div');
                row.style.cssText = `
                    display:flex; align-items:center; justify-content:space-between; gap:6px;
                    padding:5px 8px; border-radius:6px; font-size:12.5px;
                    background:${isCurrent ? 'rgba(212,175,55,0.28)' : 'rgba(255,255,255,0.05)'};
                    border:1px solid ${isCurrent ? '#ffd700' : 'rgba(212,175,55,0.2)'};
                    opacity:${item.disabled ? '0.5' : '1'};
                `;

                const titleSpan = document.createElement('span');
                titleSpan.style.cssText = `
                    flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; cursor:pointer;
                    text-decoration:${item.disabled ? 'line-through' : 'none'};
                    color:${isCurrent ? '#ffd700' : '#f4e8d1'};
                `;
                titleSpan.textContent = `${idx + 1}. ${item.title}`;
                titleSpan.title = item.disabled ? 'Файл временно закрыт (нажмите 🙈 справа, чтобы включить)' : 'Нажмите, чтобы проиграть';
                titleSpan.onclick = () => {
                    if (item.disabled) {
                        item.disabled = false;
                        this.save();
                    }
                    this.startBackgroundMusic(this.bgCategory, idx);
                };

                const controls = document.createElement('div');
                controls.style.cssText = 'display:flex; gap:3px; flex-shrink:0;';

                const upBtn = document.createElement('button');
                upBtn.textContent = '⬆';
                upBtn.title = 'Переместить выше в очереди';
                upBtn.disabled = (idx === 0);
                upBtn.style.cssText = 'background:#3b2312; color:#ffd700; border:1px solid #8b5a2b; border-radius:4px; padding:1px 5px; cursor:pointer; font-size:11px;';
                upBtn.onclick = (e) => {
                    e.stopPropagation();
                    if (this.moveItem(this.bgCategory, idx, -1)) {
                        this.renderBgPlaylistSettings();
                    }
                };

                const downBtn = document.createElement('button');
                downBtn.textContent = '⬇';
                downBtn.title = 'Переместить ниже в очереди';
                downBtn.disabled = (idx === list.length - 1);
                downBtn.style.cssText = 'background:#3b2312; color:#ffd700; border:1px solid #8b5a2b; border-radius:4px; padding:1px 5px; cursor:pointer; font-size:11px;';
                downBtn.onclick = (e) => {
                    e.stopPropagation();
                    if (this.moveItem(this.bgCategory, idx, 1)) {
                        this.renderBgPlaylistSettings();
                    }
                };

                const toggleBtn = document.createElement('button');
                toggleBtn.innerHTML = item.disabled ? '🙈 Скрыт' : '👁 Вкл';
                toggleBtn.title = item.disabled ? 'Файл временно закрыт — нажмите, чтобы снова слушать' : 'Временно закрыть файл (пропускать при проигрывании)';
                toggleBtn.style.cssText = `
                    background:${item.disabled ? '#520f04' : '#1b5e20'};
                    color:${item.disabled ? '#ffccbc' : '#fff'};
                    border:1px solid #d4af37; border-radius:4px; padding:1px 6px; cursor:pointer; font-size:11px;
                `;
                toggleBtn.onclick = (e) => {
                    e.stopPropagation();
                    const nowDisabled = this.toggleItemDisabled(this.bgCategory, idx);
                    if (nowDisabled && idx === this.bgIndex) {
                        const nextIdx = this.findNextEnabledIndex(this.bgCategory, idx, 1);
                        if (nextIdx !== -1) {
                            this.startBackgroundMusic(this.bgCategory, nextIdx);
                            return;
                        } else {
                            FairyTaleSynth.stop();
                        }
                    }
                    this.renderBgPlaylistSettings();
                };

                controls.appendChild(upBtn);
                controls.appendChild(downBtn);
                controls.appendChild(toggleBtn);

                row.appendChild(titleSpan);
                row.appendChild(controls);
                container.appendChild(row);
            });
        },

        stopBackgroundMusic: function () {
            FairyTaleSynth.stop();
            const bar = document.getElementById('gornitsaBgMusicBar');
            if (bar) bar.remove();
            this.bgCategory = null;
        },

        onLocationChange: function (newLoc) {
            if (newLoc !== 'izba') {
                this.stopBackgroundMusic();
                const modal = document.getElementById('gornitsaMediaModal');
                if (modal && this.activeCategory !== 'cinema') {
                    modal.remove();
                }
            }
        },

        buildPlayerHTML: async function (item, category) {
            FairyTaleSynth.stop();
            if (!item || !item.url) {
                const list = this.library[category || this.activeCategory] || [];
                const message = list.length === 0
                    ? 'Плейлист пока пуст'
                    : 'Нет активных записей для воспроизведения. Включите запись в настройках справа!';
                return `<div style="padding:40px; text-align:center; color:#ffe599;">${message}</div>`;
            }

            const vol = this.getVolume(category || this.activeCategory);
            let url = item.url.trim();

            if (url.startsWith('indexeddb:')) {
                const fileId = url.replace('indexeddb:', '');
                if (!this.blobUrlCache[fileId]) {
                    this.blobUrlCache[fileId] = await LocalFileStore.getFileUrl(fileId);
                }
                url = this.blobUrlCache[fileId] || '';
                if (!url) {
                    return `<div style="padding:30px; text-align:center; color:#ff9e80;">Локальный файл не найден в памяти браузера. Загрузите его заново.</div>`;
                }
            }

            if (url.startsWith('synth:')) {
                const mode = url.split(':')[1] || 'waltz';
                FairyTaleSynth.play(mode, vol / 100);
                return `
                    <div class="gornitsa-video-stage" style="padding:45px 20px; text-align:center; background:radial-gradient(circle, #3b2210 0%, #1a0d05 100%); border-radius:10px; border:2px solid #d4af37;">
                        <div style="font-size:60px; margin-bottom:12px;">🎻✨</div>
                        <div style="font-size:20px; color:#ffd700; font-weight:bold; margin-bottom:10px;">${item.title}</div>
                        <div style="font-size:15px; color:#50fa7b; margin-bottom:18px;">Сейчас звучит встроенная мелодия Горницы (громкость: ${vol}%)</div>
                        <button onclick="GornitsaMedia.startBackgroundMusic('${this.activeCategory}', ${this.activeIndex})" style="background:linear-gradient(to bottom, #7a5230, #4a301a); color:#ffd700; border:2px solid #ffd700; padding:10px 22px; border-radius:8px; cursor:pointer; font-family:'Georgia',serif; font-size:15px; font-weight:bold;">
                            🔉 Свернуть окно и оставить музыку фоном в Горнице
                        </button>
                    </div>
                `;
            }

            // Если это YouTube — открываем ТОЛЬКО внутри встроенного окна плеера (переход на сайт YouTube заблокирован)
            if (url.includes('youtube.com') || url.includes('youtu.be')) {
                const heightCss = this.isModalFullscreen ? 'calc(100vh - 135px)' : null;
                return `
                    ${this.buildProtectedYouTubeBox(url, heightCss, false)}
                    <div style="margin-top:8px; font-size:13px; color:#ffd700; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                        <span>▶ Сейчас играет в окне: <b>${item.title}</b></span>
                        <div style="display:flex; gap:8px; align-items:center;">
                            <button onclick="GornitsaMedia.toggleModalFullscreen()" style="background:linear-gradient(to bottom, #5c3512, #361e09); color:#ffd700; border:1.5px solid #d4af37; border-radius:6px; padding:4px 12px; cursor:pointer; font-family:'Georgia',serif; font-size:12.5px; font-weight:bold;">
                                ${this.isModalFullscreen ? '❐ Обычное окно' : '⛶ Развернуть на весь экран'}
                            </button>
                        </div>
                    </div>
                `;
            }

            const isAudioOnly = url.match(/\.(mp3|wav|ogg|m4a)(\?.*)?$/i) || item.source === 'local_audio';
            if (isAudioOnly) {
                const fullAudioUrl = (url.startsWith('http') || url.startsWith('data:') || url.startsWith('blob:'))
                    ? url : (BEGET_SERVER_BASE_URL + url);
                return `
                    <div class="gornitsa-video-stage" style="padding:36px 20px; text-align:center; background:radial-gradient(circle, #3b2210 0%, #1a0d05 100%); border-radius:10px; border:2px solid #d4af37;">
                        <div style="font-size:54px; margin-bottom:12px;">🎶</div>
                        <div style="font-size:18px; color:#ffd700; font-weight:bold; margin-bottom:16px;">${item.title}</div>
                        <audio id="modalActiveMediaEl" controls autoplay style="width:90%; max-width:460px;">
                            <source src="${fullAudioUrl}">
                        </audio>
                    </div>
                `;
            }

            const fullVideoUrl = (url.startsWith('http') || url.startsWith('data:') || url.startsWith('blob:'))
                ? url : (BEGET_SERVER_BASE_URL + url);
            const maxH = this.isModalFullscreen ? 'calc(100vh - 140px)' : '440px';

            return `
                <div class="gornitsa-video-stage" style="background:#000; border-radius:10px; overflow:hidden; border:2px solid #d4af37; text-align:center; position:relative;">
                    <video id="modalActiveMediaEl" controls autoplay style="width:100%; max-height:${maxH}; display:block; margin:0 auto;">
                        <source src="${fullVideoUrl}">
                    </video>
                </div>
                <div style="margin-top:8px; font-size:13px; color:#ffd700; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                    <span>▶ Сейчас играет: <b>${item.title}</b></span>
                    <button onclick="GornitsaMedia.toggleModalFullscreen()" style="background:linear-gradient(to bottom, #5c3512, #361e09); color:#ffd700; border:1.5px solid #d4af37; border-radius:6px; padding:4px 12px; cursor:pointer; font-family:'Georgia',serif; font-size:12.5px; font-weight:bold;">
                        ${this.isModalFullscreen ? '❐ Обычное окно' : '⛶ Развернуть на весь экран'}
                    </button>
                </div>
            `;
        },

        // Переключение между обычным окном и полноэкранным режимом («На весь экран»)
        toggleModalFullscreen: function () {
            const win = document.getElementById('gornitsaMediaWin');
            if (!win) return;
            this.isModalFullscreen = !this.isModalFullscreen;

            if (this.isModalFullscreen) {
                win.style.width = '100vw';
                win.style.height = '100vh';
                win.style.maxHeight = '100vh';
                win.style.borderRadius = '0';
                if (win.requestFullscreen) {
                    win.requestFullscreen().catch(() => {});
                }
            } else {
                win.style.width = 'min(1020px, 95vw)';
                win.style.height = 'auto';
                win.style.maxHeight = '92vh';
                win.style.borderRadius = '16px';
                if (document.fullscreenElement && document.exitFullscreen) {
                    document.exitFullscreen().catch(() => {});
                }
            }

            const fsBtn = document.getElementById('modalFullscreenToggleBtn');
            if (fsBtn) {
                fsBtn.innerHTML = this.isModalFullscreen ? '❐ Обычное окно' : '⛶ На весь экран';
            }
            this.applyModalLayout();
            this.renderModalPlayerOnly();
        },

        applyModalLayout: function () {
            const grid = document.getElementById('mediaModalBodyGrid');
            const settingsBox = document.getElementById('mediaSettingsSidePanel');
            if (!grid || !settingsBox) return;

            if (!this.modalSettingsOpen) {
                settingsBox.style.display = 'none';
                grid.style.gridTemplateColumns = '1fr';
            } else {
                settingsBox.style.display = 'flex';
                grid.style.gridTemplateColumns = window.innerWidth < 800 ? '1fr' : '1.55fr 1fr';
            }
        },

        // Открытие модального окна (Зеркало, Кинотеатр, или развёрнутый Граммофон / Кот Баюн)
        // Всегда сначала открывается в нормальном окне!
        openPlayerModal: function (category, startIndex) {
            this.stopBackgroundMusic();
            this.activeCategory = category || 'mirror';
            const openedCategory = this.activeCategory;
            this.isModalFullscreen = false; // Сначала всегда нормальным окном!
            this.modalSettingsOpen = true;

            const enabled = this.getEnabledIndices(this.activeCategory);
            if (typeof startIndex === 'number') {
                this.activeIndex = startIndex;
            } else {
                this.activeIndex = enabled.length > 0 ? enabled[0] : 0;
            }

            let existing = document.getElementById('gornitsaMediaModal');
            if (existing) existing.remove();

            const meta = CATEGORY_META[this.activeCategory] || CATEGORY_META.mirror;
            const vol = this.getVolume(this.activeCategory);
            const isBgCapable = (this.activeCategory === 'gramophone' || this.activeCategory === 'bayun');

            const overlay = document.createElement('div');
            overlay.id = 'gornitsaMediaModal';
            overlay.style.cssText = `
                position: fixed; inset: 0; z-index: 9500;
                background: rgba(10, 5, 2, 0.88);
                display: flex; align-items: center; justify-content: center;
                padding: 12px; font-family: 'Georgia', serif;
                backdrop-filter: blur(4px);
            `;

            const win = document.createElement('div');
            win.id = 'gornitsaMediaWin';
            win.style.cssText = `
                width: min(1020px, 95vw); max-height: 92vh;
                background: linear-gradient(135deg, #2b180a 0%, #1c0f06 100%);
                border: 4px solid #8b5a2b; outline: 2px solid #d4af37;
                border-radius: 16px; color: #f4e8d1;
                display: flex; flex-direction: column; overflow: hidden;
                box-shadow: 0 20px 60px rgba(0,0,0,0.95);
                transition: width 0.2s ease, height 0.2s ease;
            `;

            win.innerHTML = `
                <div style="padding:12px 20px; background:linear-gradient(to bottom, #422611, #241307); border-bottom:2px solid #d4af37; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                    <div>
                        <div style="font-size:20px; font-weight:bold; color:#ffd700;">${meta.title}</div>
                        <div style="font-size:13px; color:#e0cba8; margin-top:2px;">${meta.subtitle}</div>
                    </div>
                    <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                        ${isBgCapable ? `
                            <button id="switchToMiniBgBtn" style="background:linear-gradient(to bottom, #7a5230, #4a301a); color:#ffd700; border:1.5px solid #ffd700; padding:6px 11px; border-radius:7px; cursor:pointer; font-family:'Georgia',serif; font-size:12.5px; font-weight:bold;">
                                🔉 В фоновый режим
                            </button>
                        ` : ''}
                        <button id="modalSettingsToggleBtn" style="background:linear-gradient(to bottom, #6b4423, #3e2410); color:#ffd700; border:1.5px solid #d4af37; padding:6px 12px; border-radius:7px; cursor:pointer; font-family:'Georgia',serif; font-size:13px; font-weight:bold;">
                            ⚙ Настройки и список ▲
                        </button>
                        <button id="modalFullscreenToggleBtn" style="background:linear-gradient(to bottom, #2e5cb8, #1b3875); color:#fff; border:1.5px solid #ffd700; padding:6px 13px; border-radius:7px; cursor:pointer; font-family:'Georgia',serif; font-size:13px; font-weight:bold;">
                            ⛶ На весь экран
                        </button>
                        <button id="closeMediaModalBtn" style="background:linear-gradient(to bottom, #8b0000, #500000); color:#fff; border:1.5px solid #ffd700; padding:6px 16px; border-radius:7px; cursor:pointer; font-family:'Georgia',serif; font-size:13.5px; font-weight:bold;">
                            ✖ Закрыть
                        </button>
                    </div>
                </div>

                <div style="display:grid; grid-template-columns: 1.55fr 1fr; gap:16px; padding:16px 20px; overflow-y:auto; flex:1;" id="mediaModalBodyGrid">
                    <!-- Левая часть: окно проигрывателя -->
                    <div style="display:flex; flex-direction:column; justify-content:center;">
                        <div id="mediaPlayerContainer"></div>
                        <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; margin-top:10px; background:rgba(0,0,0,0.35); padding:8px 12px; border-radius:8px; border:1px solid rgba(212,175,55,0.35); flex-wrap:wrap;">
                            <div style="display:flex; gap:6px;">
                                <button id="modalPrevTrackBtn" style="background:#5c4033; color:#ffd700; border:1px solid #d4af37; border-radius:6px; padding:5px 12px; cursor:pointer; font-family:'Georgia',serif; font-size:13px; font-weight:bold;">⏮ Предыдущий</button>
                                <button id="modalNextTrackBtn" style="background:#5c4033; color:#ffd700; border:1px solid #d4af37; border-radius:6px; padding:5px 12px; cursor:pointer; font-family:'Georgia',serif; font-size:13px; font-weight:bold;">Следующий ⏭</button>
                            </div>
                            <div style="display:flex; align-items:center; gap:8px; flex:1; min-width:180px; max-width:280px;">
                                <span style="font-size:13px; color:#ffd700; font-weight:bold;">🔊 Звук:</span>
                                <input type="range" id="modalVolSlider" min="0" max="100" value="${vol}" style="flex:1; accent-color:#ffd700; cursor:pointer;">
                                <span id="modalVolVal" style="font-size:13px; color:#fff; font-weight:bold; min-width:36px; text-align:right;">${vol}%</span>
                            </div>
                        </div>
                    </div>

                    <!-- Правая часть: Разворачивающаяся панель настроек очереди и временного закрытия файлов -->
                    <div id="mediaSettingsSidePanel" style="display:flex; flex-direction:column; background:rgba(0,0,0,0.38); border:1.5px solid rgba(212,175,55,0.5); border-radius:10px; padding:12px; max-height:500px; overflow-y:auto;">
                        <div style="font-weight:bold; color:#ffd700; font-size:15px; margin-bottom:4px;">
                            ⚙ Настройки списка воспроизведения
                        </div>
                        <div style="font-size:12px; color:#d8c39e; margin-bottom:10px; border-bottom:1px dashed rgba(212,175,55,0.35); padding-bottom:6px;">
                            • Меняйте очерёдность кнопками <b>⬆ / ⬇</b><br>
                            • Временно закрывайте надоевшие файлы кнопкой <b>👁 Вкл / 🙈 Скрыт</b>
                        </div>
                        <div id="mediaPlaylistContainer" style="display:flex; flex-direction:column; gap:6px; flex:1; overflow-y:auto; padding-right:4px;"></div>

                        <!-- Быстрое добавление своего файла или ссылки -->
                        <div style="margin-top:10px; padding-top:10px; border-top:1px dashed rgba(212,175,55,0.4); display:flex; flex-direction:column; gap:6px;">
                            <label style="background:linear-gradient(to bottom, #1f5c33, #123b1d); color:#fff; border:1.5px solid #50fa7b; padding:7px 10px; border-radius:7px; cursor:pointer; font-size:12.5px; font-weight:bold; text-align:center;">
                                📂 Загрузить свой файл с ПК (.mp4 / .mp3)
                                <input type="file" accept="video/*,audio/*" style="display:none;" id="localMediaFilePicker">
                            </label>
                        </div>
                    </div>
                </div>
            `;

            overlay.appendChild(win);
            document.body.appendChild(overlay);

            this.applyModalLayout();

            if (isBgCapable) {
                document.getElementById('switchToMiniBgBtn').onclick = () => {
                    const idx = this.activeIndex;
                    const cat = this.activeCategory;
                    if (document.fullscreenElement && document.exitFullscreen) {
                        document.exitFullscreen().catch(() => {});
                    }
                    overlay.remove();
                    this.startBackgroundMusic(cat, idx);
                };
            }

            document.getElementById('modalSettingsToggleBtn').onclick = () => {
                this.modalSettingsOpen = !this.modalSettingsOpen;
                const btn = document.getElementById('modalSettingsToggleBtn');
                if (btn) {
                    btn.innerHTML = `⚙ Настройки и список ${this.modalSettingsOpen ? '▲' : '▼'}`;
                }
                this.applyModalLayout();
            };

            document.getElementById('modalFullscreenToggleBtn').onclick = () => {
                this.toggleModalFullscreen();
            };

            document.getElementById('modalPrevTrackBtn').onclick = () => {
                const prevIdx = this.findNextEnabledIndex(this.activeCategory, this.activeIndex, -1);
                if (prevIdx !== -1) {
                    this.activeIndex = prevIdx;
                    this.renderModalContent();
                }
            };

            document.getElementById('modalNextTrackBtn').onclick = () => {
                const nextIdx = this.findNextEnabledIndex(this.activeCategory, this.activeIndex, 1);
                if (nextIdx !== -1) {
                    this.activeIndex = nextIdx;
                    this.renderModalContent();
                }
            };

            document.getElementById('modalVolSlider').oninput = (e) => {
                this.setVolume(this.activeCategory, e.target.value);
            };

            document.getElementById('closeMediaModalBtn').onclick = () => {
                FairyTaleSynth.stop();
                if (document.fullscreenElement && document.exitFullscreen) {
                    document.exitFullscreen().catch(() => {});
                }
                overlay.remove();
            };

            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    FairyTaleSynth.stop();
                    if (document.fullscreenElement && document.exitFullscreen) {
                        document.exitFullscreen().catch(() => {});
                    }
                    overlay.remove();
                }
            });

            document.getElementById('localMediaFilePicker').onchange = async (ev) => {
                const file = ev.target.files && ev.target.files[0];
                if (!file) return;
                await this.addUploadedFile(this.activeCategory, file);
                this.activeIndex = 0;
                this.renderModalContent();
            };

            this.renderModalContent();
            if (this.apiSyncPromise && !this.apiSyncReady) {
                this.apiSyncPromise.then(() => {
                    if (document.getElementById('gornitsaMediaModal') !== overlay ||
                        this.activeCategory !== openedCategory) return;
                    const enabledAfterSync = this.getEnabledIndices(this.activeCategory);
                    if (!enabledAfterSync.includes(this.activeIndex)) {
                        this.activeIndex = enabledAfterSync.length > 0 ? enabledAfterSync[0] : 0;
                    }
                    this.renderModalContent();
                });
            }
        },

        renderModalPlayerOnly: async function () {
            const list = this.library[this.activeCategory] || [];
            const playerBox = document.getElementById('mediaPlayerContainer');
            if (!playerBox) return;

            let currentItem = list[this.activeIndex];
            if (!currentItem || currentItem.disabled) {
                const nextEnabled = this.findNextEnabledIndex(this.activeCategory, this.activeIndex, 0);
                if (nextEnabled !== -1) {
                    this.activeIndex = nextEnabled;
                    currentItem = list[this.activeIndex];
                } else {
                    currentItem = null;
                }
            }

            playerBox.innerHTML = await this.buildPlayerHTML(currentItem, this.activeCategory);

            const mediaEl = document.getElementById('modalActiveMediaEl');
            if (mediaEl) {
                mediaEl.volume = this.getVolume(this.activeCategory) / 100;
                mediaEl.onended = () => {
                    const nextIdx = this.findNextEnabledIndex(this.activeCategory, this.activeIndex, 1);
                    if (nextIdx !== -1) {
                        this.activeIndex = nextIdx;
                        this.renderModalContent();
                    }
                };
            }
        },

        renderModalPlaylistOnly: function () {
            const list = this.library[this.activeCategory] || [];
            const listBox = document.getElementById('mediaPlaylistContainer');
            if (!listBox) return;

            listBox.innerHTML = '';
            if (list.length === 0) {
                const emptyMessage = document.createElement('div');
                emptyMessage.textContent = 'Плейлист пока пуст';
                emptyMessage.style.cssText = 'padding:12px 8px; color:#ffe599; text-align:center; font-size:13px;';
                listBox.appendChild(emptyMessage);
                return;
            }
            list.forEach((item, idx) => {
                const isAct = (idx === this.activeIndex && !item.disabled);
                const row = document.createElement('div');
                row.style.cssText = `
                    padding: 8px 10px; border-radius: 7px;
                    background: ${isAct ? 'linear-gradient(to right, #7a5230, #4a301a)' : 'rgba(255,255,255,0.06)'};
                    border: 1px solid ${isAct ? '#ffd700' : 'rgba(212,175,55,0.25)'};
                    color: ${isAct ? '#fff' : '#f4e8d1'};
                    opacity: ${item.disabled ? '0.52' : '1'};
                    font-size: 13.5px; display: flex; justify-content: space-between; align-items: center; gap: 6px;
                `;

                const titlePart = document.createElement('div');
                titlePart.style.cssText = `
                    flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: pointer;
                    text-decoration: ${item.disabled ? 'line-through' : 'none'};
                `;
                const badge = item.source === 'builtin' ? '🎻' : (item.source === 'youtube' ? '🎬' : '🎞');
                titlePart.textContent = `${idx + 1}. ${badge} ${item.title}`;
                titlePart.title = item.disabled ? 'Временно закрыт (нажмите 🙈 справа, чтобы включить)' : 'Нажмите для воспроизведения';
                titlePart.onclick = () => {
                    if (item.disabled) {
                        item.disabled = false;
                        this.save();
                    }
                    this.activeIndex = idx;
                    this.renderModalContent();
                };

                const btnGroup = document.createElement('div');
                btnGroup.style.cssText = 'display:flex; gap:4px; flex-shrink:0; align-items:center;';

                const upBtn = document.createElement('button');
                upBtn.textContent = '⬆';
                upBtn.title = 'Переместить выше';
                upBtn.disabled = (idx === 0);
                upBtn.style.cssText = 'background:#3b2312; color:#ffd700; border:1px solid #8b5a2b; border-radius:5px; padding:2px 6px; cursor:pointer; font-size:11.5px;';
                upBtn.onclick = (e) => {
                    e.stopPropagation();
                    if (this.moveItem(this.activeCategory, idx, -1)) {
                        this.renderModalPlaylistOnly();
                    }
                };

                const downBtn = document.createElement('button');
                downBtn.textContent = '⬇';
                downBtn.title = 'Переместить ниже';
                downBtn.disabled = (idx === list.length - 1);
                downBtn.style.cssText = 'background:#3b2312; color:#ffd700; border:1px solid #8b5a2b; border-radius:5px; padding:2px 6px; cursor:pointer; font-size:11.5px;';
                downBtn.onclick = (e) => {
                    e.stopPropagation();
                    if (this.moveItem(this.activeCategory, idx, 1)) {
                        this.renderModalPlaylistOnly();
                    }
                };

                const disableBtn = document.createElement('button');
                disableBtn.innerHTML = item.disabled ? '🙈 Скрыт' : '👁 Вкл';
                disableBtn.title = item.disabled
                    ? 'Файл временно закрыт (надоел) — нажмите, чтобы снова включить его в очередь'
                    : 'Временно закрыть файл (пока надоел, пропускать при проигрывании)';
                disableBtn.style.cssText = `
                    background: ${item.disabled ? '#520f04' : '#1b5e20'};
                    color: ${item.disabled ? '#ffccbc' : '#fff'};
                    border: 1px solid #d4af37; border-radius: 5px; padding: 2px 7px; cursor: pointer; font-size: 11.5px;
                `;
                disableBtn.onclick = (e) => {
                    e.stopPropagation();
                    const nowDisabled = this.toggleItemDisabled(this.activeCategory, idx);
                    if (nowDisabled && idx === this.activeIndex) {
                        const nextIdx = this.findNextEnabledIndex(this.activeCategory, idx, 1);
                        this.activeIndex = nextIdx !== -1 ? nextIdx : 0;
                        this.renderModalContent();
                    } else {
                        this.renderModalPlaylistOnly();
                    }
                };

                btnGroup.appendChild(upBtn);
                btnGroup.appendChild(downBtn);
                btnGroup.appendChild(disableBtn);

                row.appendChild(titlePart);
                row.appendChild(btnGroup);
                listBox.appendChild(row);
            });
        },

        renderModalContent: function () {
            this.renderModalPlayerOnly();
            this.renderModalPlaylistOnly();
        }
    };

    GornitsaMedia.init();
    window.GornitsaMedia = GornitsaMedia;
})(window);
