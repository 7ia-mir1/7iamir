/**
 * МОДУЛЬ 1: ЕДИНАЯ ФИНАНСОВАЯ СИСТЕМА И ТАБЕЛЬ СЛУЖБЫ (wallet.js)
 * Проект: «Волшебная книга: Игра для взрослых. Диагностика взаимоотношений»
 * 
 * Механика:
 * 1. Банковский счёт (bankBalance): сюда поступает стартовое пособие (800 монет), 
 *    служивая зарплата (800 монет за >=22 дня или 5 монет/день), премии от Кабинета труда и Детектива (+1000 монет).
 * 2. Кошелёк / Мешочек на столе в Горнице (cashBalance): наличные монеты. 
 *    Пополняется путём обналичивания в Банке.
 * 3. Статус мешочка (walletTaken): лежит на столе в Горнице (false) или взят с собой в дорогу (true).
 *    Без взятого с собой кошелька и наличных монет нельзя расплатиться у Цыганки, Бабы-Яги или в Справочном бюро!
 */

(function (window) {
    const STORAGE_KEY = `GORNITSA_ECONOMY_V1_${localStorage.getItem('GORNITSA_USER_ID') || 'guest'}`;

    function getCurrentMonthKey() {
        const d = new Date();
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    }

    function getTodayDateString() {
        const d = new Date();
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    function generateRefCode() {
        return 'GORN-' + Math.random().toString(36).substring(2, 7).toUpperCase();
    }

    const defaultState = {
        initialized: true,
        bankBalance: 800,          // Начальное месячное пособие зачисляется на счёт в Банке
        cashBalance: 0,            // Наличные в мешочке (нужно снять в Банке или положить в мешочек)
        walletTaken: false,        // Взят ли мешочек со стола в Горнице с собой
        currentMonth: getCurrentMonthKey(),
        visitedDays: [],           // Даты посещений в текущем месяце ['YYYY-MM-DD']
        udarnikPrivilege: true,    // В первый месяц действует стартовая привилегия (скидка 50% на Диагностику, 90% к Бабе-Яге)
        detectiveBonusClaimed: false, // Получена ли премия 1000 монет у Детектива за анкету поиска
        refCode: generateRefCode(),
        referralsCount: 0,
        lastIdeaDate: '',
        ideasTodayCount: 0,
        transactions: [
            {
                id: Date.now(),
                date: new Date().toLocaleString('ru-RU'),
                type: 'bank_in',
                amount: 800,
                title: 'Подъёмное месячное пособие при регистрации (на счёт в Банке)'
            }
        ],
        diagnosticsArchive: [],    // Архив заказанных Диагностик (для Сундука на площади)
        adminSuggestions: []       // Предложения для страницы Админа
    };

    const GornitsaWallet = {
        state: null,

        init: function () {
            try {
                const raw = localStorage.getItem(STORAGE_KEY);
                if (raw) {
                    this.state = Object.assign({}, defaultState, JSON.parse(raw));
                } else {
                    this.state = JSON.parse(JSON.stringify(defaultState));
                    this.save();
                }
            } catch (e) {
                console.error('Ошибка чтения памяти кошелька:', e);
                this.state = JSON.parse(JSON.stringify(defaultState));
            }

            this.checkMonthlySettlement();
            this.markAttendanceToday();
            return this.state;
        },

        save: function () {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
                this.updateHUD();
                window.dispatchEvent(new CustomEvent('gornitsaWalletUpdated', { detail: this.state }));
            } catch (e) {
                console.error('Ошибка сохранения кошелька:', e);
            }
        },

        // Добавление записи в историю операций (для Банка)
        addTransaction: function (type, amount, title) {
            this.state.transactions.unshift({
                id: Date.now() + Math.floor(Math.random() * 1000),
                date: new Date().toLocaleString('ru-RU'),
                type: type, // 'bank_in', 'withdraw', 'deposit', 'cash_spend'
                amount: amount,
                title: title
            });
            if (this.state.transactions.length > 60) {
                this.state.transactions.length = 60;
            }
        },

        // Ежедневная отметка в Табеле посещений
        markAttendanceToday: function () {
            const today = getTodayDateString();
            if (!this.state.visitedDays.includes(today)) {
                this.state.visitedDays.push(today);
                this.save();
                return true; // Сегодня отмечен впервые
            }
            return false;
        },

        // Проверка смены месяца и расчёт служивой зарплаты (22 дня из 30)
        checkMonthlySettlement: function () {
            const nowMonth = getCurrentMonthKey();
            if (this.state.currentMonth !== nowMonth) {
                const daysCount = this.state.visitedDays.length;
                let payout = 0;
                let note = '';

                if (daysCount >= 22) {
                    payout = 800;
                    this.state.udarnikPrivilege = true;
                    note = `Полная служивая зарплата за ${this.state.currentMonth} (${daysCount} дн. >= 22) + Льготы ударника!`;
                } else {
                    payout = daysCount * 5;
                    this.state.udarnikPrivilege = false;
                    note = `Поденная выплата за ${this.state.currentMonth} (${daysCount} дн. по 5 монет)`;
                }

                if (payout > 0) {
                    this.state.bankBalance += payout;
                    this.addTransaction('bank_in', payout, note);
                }

                this.state.currentMonth = nowMonth;
                this.state.visitedDays = [];
                this.save();
            }
        },

        // Принудительный расчёт зарплаты в последний день месяца (или для теста в Кабинете труда)
        settleCurrentMonthNow: function () {
            const daysCount = this.state.visitedDays.length;
            let payout = 0;
            let note = '';

            if (daysCount >= 22) {
                payout = 800;
                this.state.udarnikPrivilege = true;
                note = `Расчёт месяца: Полная служивая зарплата (${daysCount} дн.) + Скидки 50%/90%`;
            } else {
                payout = daysCount * 5;
                this.state.udarnikPrivilege = false;
                note = `Расчёт месяца: Выплата за посещения (${daysCount} дн. × 5 монет)`;
            }

            this.state.bankBalance += payout;
            this.addTransaction('bank_in', payout, note);
            this.save();
            return { daysCount, payout, udarnik: this.state.udarnikPrivilege, note };
        },

        // Синоним load() для обратной совместимости (чтобы не ломались вызовы GornitsaWallet.load())
        load: function () {
            return this.init();
        },

        // Начисление заработанных монет (все заработки идут В БАНК на счёт!)
        earnToBank: function (amount, reason) {
            this.init();
            amount = Math.floor(Number(amount) || 0);
            if (amount <= 0) return false;
            this.state.bankBalance += amount;
            this.addTransaction('bank_in', amount, reason);
            this.save();
            return true;
        },

        // Списание монет с банковского счёта (например, при проигрыше в Шахматы или Шашки)
        deductFromBank: function (amount, reason) {
            this.init();
            amount = Math.floor(Number(amount) || 0);
            if (amount <= 0) return 0;
            this.state.bankBalance = Math.max(0, this.state.bankBalance - amount);
            this.addTransaction('bank_out', amount, reason);
            this.save();
            return amount;
        },

        // Премия 1000 монет у Детектива за заполнение анкеты на поиск половинки
        claimDetectiveBonus: function () {
            if (this.state.detectiveBonusClaimed) {
                return { ok: false, msg: 'Премия в 1000 монет за анкету у Детектива уже была получена ранее.' };
            }
            this.state.detectiveBonusClaimed = true;
            this.earnToBank(1000, 'Премия от Детектива за заполнение анкеты на поиск второй половинки');
            return { ok: true, msg: 'На ваш счёт в Банке зачислена премия 1000 монет!' };
        },

        // Обналичивание в Банке: перевод со счёта в кошелёк/мешочек
        withdrawToWallet: function (amount) {
            amount = Math.floor(Number(amount) || 0);
            if (amount <= 0) return { ok: false, msg: 'Укажите сумму больше нуля.' };
            if (this.state.bankBalance < amount) {
                return { ok: false, msg: 'Недостаточно монет на банковском счёте!' };
            }
            this.state.bankBalance -= amount;
            this.state.cashBalance += amount;
            this.addTransaction('withdraw', amount, 'Обналичивание в Банке (перевод в наличный кошелёк)');
            this.save();
            return { ok: true, msg: `В кошелёк переведено ${amount} монет наличными.` };
        },

        // Положить наличные из мешочка обратно на счёт в Банке
        depositToBank: function (amount) {
            amount = Math.floor(Number(amount) || 0);
            if (amount <= 0) return { ok: false, msg: 'Укажите сумму больше нуля.' };
            if (this.state.cashBalance < amount) {
                return { ok: false, msg: 'В вашем кошельке нет столько наличных монет!' };
            }
            this.state.cashBalance -= amount;
            this.state.bankBalance += amount;
            this.addTransaction('deposit', amount, 'Взнос наличных из кошелька на счёт в Банке');
            this.save();
            return { ok: true, msg: `На счёт в Банке положено ${amount} монет.` };
        },

        // Управление мешочком на столе в Горнице: взять с собой (true) или оставить на столе (false)
        setWalletTaken: function (taken) {
            this.state.walletTaken = Boolean(taken);
            this.save();
            return this.state.walletTaken;
        },

        // Оплата любого сервиса ТОЛЬКО наличными из взятого с собой кошелька!
        payCash: function (baseCost, serviceType, description) {
            // 1. Проверяем, не забыл ли игрок кошелёк на столе в Горнице
            if (!this.state.walletTaken) {
                return {
                    ok: false,
                    code: 'WALLET_FORGOTTEN',
                    msg: 'Хватились за пояс — а мешочка с монетами нет! Вы забыли кошелёк на столе в Горнице. Придётся вернуться в Горницу и взять его с собой.'
                };
            }

            // 2. Считаем стоимость с учётом льгот ударника (50% на Диагностику, 90% к Бабе-Яге)
            let finalCost = Math.floor(Number(baseCost) || 0);
            let discountApplied = 0;

            if (this.state.udarnikPrivilege) {
                if (serviceType === 'diagnostics') {
                    discountApplied = 50;
                    finalCost = Math.round(finalCost * 0.5);
                } else if (serviceType === 'yaga') {
                    discountApplied = 90;
                    finalCost = Math.round(finalCost * 0.1);
                }
            }

            // 3. Проверяем, хватает ли наличных в мешочке
            if (this.state.cashBalance < finalCost) {
                return {
                    ok: false,
                    code: 'NO_CASH',
                    required: finalCost,
                    cash: this.state.cashBalance,
                    bank: this.state.bankBalance,
                    msg: `В вашем мешочке недостаточно наличных монет! Нужно: ${finalCost} мон., а в кошельке сейчас: ${this.state.cashBalance} мон. (В Банке на счёте: ${this.state.bankBalance} мон. — зайдите в Банк на Площади, чтобы обналичить).`
                };
            }

            // 4. Списываем наличные
            this.state.cashBalance -= finalCost;
            const discText = discountApplied > 0 ? ` (со скидкой ${discountApplied}%)` : '';
            this.addTransaction('cash_spend', finalCost, `${description}${discText}`);
            this.save();

            return {
                ok: true,
                paid: finalCost,
                discountApplied: discountApplied,
                remainingCash: this.state.cashBalance,
                msg: `Оплачено наличными из мешочка: ${finalCost} монет${discText}.`
            };
        },

        // Сохранение заказанной Диагностики в Архивный Сундук
        saveDiagnosticToArchive: function (pairData) {
            this.state.diagnosticsArchive.unshift({
                id: Date.now(),
                date: new Date().toLocaleString('ru-RU'),
                maleBirth: pairData.maleBirth || '',
                femaleBirth: pairData.femaleBirth || '',
                bloodColor: pairData.bloodColor || 'Красный',
                summary: pairData.summary || 'Результат сканирования уровней биополей'
            });
            this.save();
        },

        // Диалоговое окно при клике на Кошелёк/Мешочек на столе в Горнице
        openTablePurseModal: function () {
            let existing = document.getElementById('gornitsaPurseModal');
            if (existing) existing.remove();

            const overlay = document.createElement('div');
            overlay.id = 'gornitsaPurseModal';
            overlay.style.cssText = `
                position: fixed; inset: 0; z-index: 9999;
                background: rgba(12, 6, 2, 0.82);
                display: flex; align-items: center; justify-content: center;
                font-family: 'Georgia', serif;
            `;

            const box = document.createElement('div');
            box.style.cssText = `
                width: min(460px, 92vw);
                background: radial-gradient(circle, #fff8e7 0%, #e8cfa0 100%);
                border: 4px solid #6e4119;
                outline: 2px solid #d4af37;
                border-radius: 16px;
                padding: 24px 28px;
                color: #2b1708;
                text-align: center;
                box-shadow: 0 18px 50px rgba(0,0,0,0.9);
            `;

            const statusBadge = this.state.walletTaken
                ? '<span style="color:#1b6e19;font-weight:bold;">✔ Сейчас взят с собой (на поясе)</span>'
                : '<span style="color:#8b1e0b;font-weight:bold;">📍 Лежит на столе в Горнице</span>';

            box.innerHTML = `
                <div style="font-size: 46px; margin-bottom: 6px;">👛</div>
                <h2 style="margin: 0 0 10px 0; color: #5a1807; font-size: 23px; border-bottom: 2px dashed rgba(110,65,25,0.4); padding-bottom: 8px;">
                    Кошелёк с наличными
                </h2>
                <p style="font-size: 16px; margin: 8px 0;">Статус: ${statusBadge}</p>
                <div style="background: rgba(110,65,25,0.12); border: 2px solid #8b5a2b; border-radius: 12px; padding: 12px; margin: 14px 0;">
                    <div style="font-size: 15px; color: #5a3818;">Наличных монет в мешочке:</div>
                    <div style="font-size: 30px; font-weight: bold; color: #8b1e0b; margin-top: 4px;">
                        🪙 ${this.state.cashBalance} монет
                    </div>
                    <div style="font-size: 13.5px; color: #4a2e12; margin-top: 6px;">
                        (На счёте в Банке лежит: <b>${this.state.bankBalance}</b> монет)
                    </div>
                </div>
                <p style="font-size: 17px; font-weight: bold; color: #2b1708; margin: 16px 0 14px 0;">
                    Взять кошелёк с собой?
                </p>
                <div style="display: flex; gap: 14px; justify-content: center;">
                    <button id="purseBtnYes" style="
                        background: linear-gradient(180deg, #2e7d32 0%, #1b5e20 100%);
                        color: #fff; border: 2px solid #d4af37; border-radius: 10px;
                        padding: 10px 26px; font-family: 'Georgia', serif; font-size: 16px;
                        font-weight: bold; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.4);
                    ">ДА (Взять с собой)</button>
                    <button id="purseBtnNo" style="
                        background: linear-gradient(180deg, #8b1e0b 0%, #520f04 100%);
                        color: #ffe599; border: 2px solid #d4af37; border-radius: 10px;
                        padding: 10px 22px; font-family: 'Georgia', serif; font-size: 16px;
                        font-weight: bold; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.4);
                    ">НЕТ (Оставить)</button>
                </div>
            `;

            overlay.appendChild(box);
            document.body.appendChild(overlay);

            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) overlay.remove();
            });

            document.getElementById('purseBtnYes').onclick = () => {
                this.setWalletTaken(true);
                overlay.remove();
            };

            document.getElementById('purseBtnNo').onclick = () => {
                this.setWalletTaken(false);
                overlay.remove();
            };
        },

        // Верхняя ненавязчивая плашка состояния (опционально для локаций вне Горницы)
        mountHUD: function (containerId) {
            let hud = document.getElementById('gornitsaWalletHUD');
            if (!hud) {
                hud = document.createElement('div');
                hud.id = 'gornitsaWalletHUD';
                hud.style.cssText = `
                    position: fixed; top: 14px; left: 14px; z-index: 90;
                    background: rgba(24, 13, 5, 0.92);
                    border: 2px solid #d4af37; border-radius: 12px;
                    padding: 8px 14px; color: #ffe599;
                    font-family: 'Georgia', serif; font-size: 14px;
                    box-shadow: 0 6px 20px rgba(0,0,0,0.85);
                    display: flex; align-items: center; gap: 14px;
                `;
                const target = containerId ? document.getElementById(containerId) : document.body;
                if (target) target.appendChild(hud);
            }
            this.updateHUD();
        },

        updateHUD: function () {
            const hud = document.getElementById('gornitsaWalletHUD');
            if (!hud) return;

            const purseInfo = this.state.walletTaken
                ? `<span style="color:#98fb98;">👛 В кошельке: <b>${this.state.cashBalance}</b> мон.</span>`
                : `<span style="color:#ff8a80;" title="Вы вышли без кошелька! Расплатиться наличными нельзя.">👛 Кошелёк забыт в Горнице!</span>`;

            const privInfo = this.state.udarnikPrivilege
                ? `<span style="background:#6b3e18;border:1px solid #ffd700;padding:2px 8px;border-radius:8px;font-size:12px;color:#ffd700;">⭐ Льгота 50%/90%</span>`
                : '';

            hud.innerHTML = `
                ${purseInfo}
                <span style="color:#d4af37;">|</span>
                <span>🏦 В Банке: <b>${this.state.bankBalance}</b> мон.</span>
                <span style="color:#d4af37;">|</span>
                <span>📅 Дней: <b>${this.state.visitedDays.length}/22</b></span>
                ${privInfo}
            `;
        }
    };

    GornitsaWallet.init();
    window.addEventListener('storage', function (e) {
        if (e.key === STORAGE_KEY) {
            GornitsaWallet.init();
            GornitsaWallet.updateHUD();
            window.dispatchEvent(new CustomEvent('gornitsaWalletUpdated', { detail: GornitsaWallet.state }));
        }
    });
    window.GornitsaWallet = GornitsaWallet;
})(window);