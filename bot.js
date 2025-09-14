// bot.js
import { getKlines, createOrder, getAccountBalance, getOpenOrders, cancelOrder, callBingxApi } from './bingxApi.js';
import { generateTradingSignal } from './technicalAnalysis.js';

// Глобальные настройки бота (могут обновляться через веб-интерфейс)
let botSettings = {
    tradingPair: 'BTC-USDT',    // Торговая пара
    strategy: 'stochastic',     // Стратегия: 'stochastic', 'rsi', 'macd', 'combo'
    riskLevel: 5,               // Уровень риска 1-10 (процент от доступного баланса)
    maxPositionSize: 0.1,       // Максимальный размер позиции в USDT (защита от больших ордеров)
    isEnabled: true,            // Включен ли бот
    useStopLoss: true,          // Использовать стоп-лосс
    stopLossPercent: 2.0,       // Стоп-лосс в процентах от цены входа
    useTakeProfit: true,        // Использовать тейк-профит
    takeProfitPercent: 4.0,     // Тейк-профит в процентах от цены входа
    lastSignal: 'NEUTRAL',      // Последний сигнал
    lastTradeTime: null,        // Время последней сделки
    minTradeInterval: 300000,   // Минимальный интервал между сделками (5 минут)
    leverage: 5,                // Плечо (для фьючерсов, но оставим для совместимости)
    orderType: 'MARKET',        // Тип ордера: 'MARKET' или 'LIMIT'
    trailingStop: false,        // Трейлинг-стоп (пока не реализован)
    sentimentThreshold: 0.6,    // Порог настроения рынка (если будет фундаментальный анализ)
};

// История сигналов и сделок (для логики и интерфейса)
let tradeHistory = [];
let activeOrders = [];

// Функция для обновления настроек из веб-интерфейса
export function updateBotSettings(newSettings) {
    botSettings = { ...botSettings, ...newSettings };
    console.log(`[BOT] Настройки обновлены:`, botSettings);
}

// Основная торговая логика
export async function executeTradingLogic() {
    if (!botSettings.isEnabled) {
        console.log("[BOT] ⏸️  Бот приостановлен.");
        return;
    }

    try {
        const symbol = botSettings.tradingPair;
        const interval = '5m'; // Интервал для анализа

        // Проверяем, не слишком ли рано для новой сделки
        if (botSettings.lastTradeTime && Date.now() - botSettings.lastTradeTime < botSettings.minTradeInterval) {
            console.log("[BOT] ⏳ Слишком рано для новой сделки. Ожидание...");
            return;
        }

        // Получаем данные Kline
        const klines = await getKlines(symbol, interval, 100);
        if (!klines || klines.length === 0) {
            console.warn("[BOT] ⚠️  Нет данных Kline для анализа.");
            return;
        }

        // Генерируем торговый сигнал
        const signalData = generateTradingSignal(klines, botSettings.strategy);
        console.log(`[BOT] 📊 Сигнал: ${signalData.signal} | Уверенность: ${signalData.confidence}`);

        // Если сигнал нейтральный или уверенность низкая — ничего не делаем
        if (signalData.signal === 'NEUTRAL' || signalData.confidence < 0.5) {
            return;
        }

        // Получаем текущую цену
        const ticker = await callBingxApi(`/openApi/swap/v1/ticker/price`, 'GET', { symbol });
        const currentPrice = parseFloat(ticker.price);

        // Получаем баланс
        const balanceData = await getAccountBalance();
        const availableBalance = parseFloat(balanceData.balance.availableBalance || 0);

        // Рассчитываем размер ордера
        const riskPercentage = botSettings.riskLevel * 0.01; // 1-10 -> 1%-10%
        let orderValue = availableBalance * riskPercentage;

        // Ограничиваем максимальный размер позиции
        if (orderValue > botSettings.maxPositionSize) {
            orderValue = botSettings.maxPositionSize;
        }

        const quantity = orderValue / currentPrice;

        // Учитываем комиссию (пример: 0.1% для мейкеров, 0.1% для тейкеров)
        // Для рыночных ордеров — тейкер, комиссия вычитается из количества
        const feeRate = botSettings.orderType === 'MARKET' ? 0.001 : 0.001; // 0.1%
        const quantityAfterFee = quantity * (1 - feeRate);

        // Логируем расчёт
        console.log(`[BOT] 💰 Баланс: ${availableBalance} USDT | Риск: ${riskPercentage * 100}% | Значение ордера: ${orderValue} USDT`);
        console.log(`[BOT] 📉 Цена: ${currentPrice} | Кол-во: ${quantity.toFixed(6)} | После комиссии: ${quantityAfterFee.toFixed(6)}`);

        // Определяем сторону ордера
        const side = signalData.signal === 'BUY' ? 'BUY' : 'SELL';

        // Размещаем ордер
        console.log(`[BOT] 🚀 Размещаем ордер: ${side} ${quantityAfterFee.toFixed(6)} ${symbol}`);
        
        // !!! ЗАКОММЕНТИРОВАНО ДЛЯ БЕЗОПАСНОСТИ !!!
        // const orderResponse = await createOrder(symbol, side, botSettings.orderType, quantityAfterFee.toFixed(6));
        // console.log("[BOT] ✅ Ордер успешно размещен:", orderResponse);

        // Заглушка: имитируем успешный ордер
        const mockOrder = {
            orderId: `mock-${Date.now()}`,
            symbol: symbol,
            side: side,
            type: botSettings.orderType,
            quantity: quantityAfterFee.toFixed(6),
            price: currentPrice,
            status: 'FILLED',
            time: Date.now()
        };

        // Обновляем состояние бота
        botSettings.lastSignal = signalData.signal;
        botSettings.lastTradeTime = Date.now();

        // Сохраняем в историю
        tradeHistory.push({
            ...mockOrder,
            signal: signalData.signal,
            confidence: signalData.confidence,
            indicators: signalData.indicators
        });

        // Ограничиваем историю последними 100 сделками
        if (tradeHistory.length > 100) {
            tradeHistory = tradeHistory.slice(-100);
        }

        console.log(`[BOT] 🎯 Сделка выполнена: ${side} ${quantityAfterFee.toFixed(6)} ${symbol} по цене ${currentPrice}`);

        // Если включены стоп-лосс и тейк-профит — размещаем их (для лимитных ордеров)
        if (botSettings.useStopLoss || botSettings.useTakeProfit) {
            await placeConditionalOrders(symbol, side, currentPrice, quantityAfterFee.toFixed(6));
        }

    } catch (error) {
        console.error("[BOT] ❌ Ошибка в торговом цикле:", error.message);

        // Самодиагностика: проверяем коды ошибок BingX
        if (error.message.includes('BingX API Error')) {
            const match = error.message.match(/\[(\d+)\]/);
            if (match) {
                const errorCode = parseInt(match[1]);
                handleBotError(errorCode);
            }
        }
    }
}

/**
 * Размещение условных ордеров (стоп-лосс и тейк-профит)
 * @param {string} symbol - Торговая пара
 * @param {string} side - Сторона основного ордера ('BUY' или 'SELL')
 * @param {number} entryPrice - Цена входа
 * @param {string} quantity - Количество
 */
async function placeConditionalOrders(symbol, side, entryPrice, quantity) {
    try {
        if (botSettings.useStopLoss) {
            const stopPrice = side === 'BUY' 
                ? entryPrice * (1 - botSettings.stopLossPercent / 100) 
                : entryPrice * (1 + botSettings.stopLossPercent / 100);
            
            // Для реального использования нужно использовать эндпоинт условных ордеров
            // Пока просто логируем
            console.log(`[BOT] 🛑 Стоп-лосс: ${side === 'BUY' ? 'SELL' : 'BUY'} ${quantity} ${symbol} по цене ${stopPrice.toFixed(8)}`);
        }

        if (botSettings.useTakeProfit) {
            const profitPrice = side === 'BUY' 
                ? entryPrice * (1 + botSettings.takeProfitPercent / 100) 
                : entryPrice * (1 - botSettings.takeProfitPercent / 100);
            
            console.log(`[BOT] 🎯 Тейк-профит: ${side === 'BUY' ? 'SELL' : 'BUY'} ${quantity} ${symbol} по цене ${profitPrice.toFixed(8)}`);
        }
    } catch (error) {
        console.error("[BOT] ❌ Ошибка при размещении условных ордеров:", error.message);
    }
}

/**
 * Обработка ошибок бота и самодиагностика
 * @param {number} errorCode - Код ошибки от BingX
 */
function handleBotError(errorCode) {
    const recoveryActions = {
        100001: () => {
            console.error("[SELF-DIAGNOSTIC] ❌ Ошибка подписи. Проверьте SECRET_KEY и алгоритм генерации.");
            // Можно отправить уведомление администратору
        },
        100419: () => {
            console.error("[SELF-DIAGNOSTIC] ❌ IP не в белом списке. Проверьте настройки API ключа на сайте BingX.");
            // Можно попробовать использовать альтернативный домен
        },
        101204: async () => {
            console.warn("[SELF-DIAGNOSTIC] ⚠️ Недостаточно маржины. Уменьшаем размер ордера в 2 раза.");
            botSettings.riskLevel = Math.max(1, Math.floor(botSettings.riskLevel / 2));
        },
        429: () => {
            console.warn("[SELF-DIAGNOSTIC] ⚠️ Слишком много запросов. Приостанавливаем торговлю на 1 минуту.");
            botSettings.isEnabled = false;
            setTimeout(() => {
                botSettings.isEnabled = true;
                console.log("[SELF-DIAGNOSTIC] ✅ Торговля возобновлена после паузы.");
            }, 60000);
        },
        100410: () => {
            console.warn("[SELF-DIAGNOSTIC] ⚠️ Превышено ограничение по частоте. Ждем 5 минут.");
            botSettings.isEnabled = false;
            setTimeout(() => {
                botSettings.isEnabled = true;
                console.log("[SELF-DIAGNOSTIC] ✅ Торговля возобновлена после 5-минутной паузы.");
            }, 300000);
        },
        101212: async () => {
            console.warn("[SELF-DIAGNOSTIC] ⚠️ Есть активные ордера. Отменяем их...");
            try {
                const orders = await getOpenOrders(botSettings.tradingPair);
                for (const order of orders) {
                    await cancelOrder(botSettings.tradingPair, order.orderId);
                    console.log(`[SELF-DIAGNOSTIC] ✅ Ордер ${order.orderId} отменен.`);
                }
            } catch (cancelError) {
                console.error("[SELF-DIAGNOSTIC] ❌ Не удалось отменить ордера:", cancelError.message);
            }
        },
        101414: () => {
            console.warn("[SELF-DIAGNOSTIC] ⚠️ Превышено максимальное плечо. Уменьшаем плечо до 5x.");
            botSettings.leverage = 5;
        },
        101514: () => {
            console.warn("[SELF-DIAGNOSTIC] ⚠️ Временная блокировка открытия позиций. Приостанавливаем торговлю на 10 минут.");
            botSettings.isEnabled = false;
            setTimeout(() => {
                botSettings.isEnabled = true;
                console.log("[SELF-DIAGNOSTIC] ✅ Торговля возобновлена после 10-минутной паузы.");
            }, 600000);
        }
    };

    if (recoveryActions[errorCode]) {
        console.log(`[SELF-DIAGNOSTIC] 🛠️  Применяем меру восстановления для ошибки ${errorCode}`);
        recoveryActions[errorCode]();
    } else {
        console.warn(`[SELF-DIAGNOSTIC] ❓ Неизвестная ошибка ${errorCode}. Требуется ручная проверка.`);
    }
}

/**
 * Функция для получения текущего состояния бота (для server.js)
 * @returns {Object} Текущее состояние бота
 */
export function getBotStatus() {
    return {
        settings: { ...botSettings },
        lastSignal: botSettings.lastSignal,
        lastTradeTime: botSettings.lastTradeTime,
        tradeHistory: [...tradeHistory],
        activeOrders: [...activeOrders]
    };
}

/**
 * Запускаем торговый цикл каждые 5 минут
 */
setInterval(executeTradingLogic, 5 * 60 * 1000); // 5 минут

// Запускаем сразу при старте
setTimeout(executeTradingLogic, 5000); // Первый запуск через 5 секунд

console.log("[BOT] 🤖 Торговый бот инициализирован и готов к работе!");
