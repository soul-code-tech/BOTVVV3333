// bot.js
import { getKlines, createOrder, getAccountInfo, getOpenOrders, callBingxApi } from './bingxApi.js';
import { generateTradingSignal } from './technicalAnalysis.js';

// Настройки бота
let botSettings = {
    tradingPair: 'BTC-USDT',
    strategy: 'stochastic',
    riskLevel: 5,
    maxPositionSize: 100,
    isEnabled: true,
    useStopLoss: false, // Для спота стоп-лосс не поддерживается напрямую
    useTakeProfit: false,
    lastSignal: 'NEUTRAL',
    lastTradeTime: null,
    minTradeInterval: 300000, // 5 минут
    orderType: 'LIMIT', // Для спота лучше LIMIT
    feeRate: 0.001, // 0.1% комиссия
};

let tradeHistory = [];

export function updateBotSettings(newSettings) {
    botSettings = { ...botSettings, ...newSettings };
    console.log("[BOT] Настройки обновлены:", botSettings);
}

export async function executeTradingLogic() {
    if (!botSettings.isEnabled) {
        console.log("[BOT] ⏸️  Приостановлен");
        return;
    }

    if (botSettings.lastTradeTime && Date.now() - botSettings.lastTradeTime < botSettings.minTradeInterval) {
        console.log("[BOT] ⏳ Слишком рано для новой сделки");
        return;
    }

    try {
        const symbol = botSettings.tradingPair;
        const klines = await getKlines(symbol, '5m', 100);
        if (!klines || klines.length === 0) return;

        const signalData = generateTradingSignal(klines, botSettings.strategy);
        if (signalData.signal === 'NEUTRAL' || signalData.confidence < 0.5) return;

        const ticker = await callBingxApi(`/openApi/swap/v1/ticker/price`, 'GET', { symbol });
        const currentPrice = parseFloat(ticker.price);
        const account = await getAccountInfo();

        // Определяем базовую и котируемую валюту
        const [baseAsset, quoteAsset] = symbol.split('-');
        const quoteBalance = account.balances?.find(b => b.asset === quoteAsset)?.free || 0;
        const baseBalance = account.balances?.find(b => b.asset === baseAsset)?.free || 0;

        let side, quantity, totalPrice;
        if (signalData.signal === 'BUY') {
            const riskAmount = parseFloat(quoteBalance) * (botSettings.riskLevel * 0.01);
            quantity = (riskAmount / currentPrice) * (1 - botSettings.feeRate); // Учёт комиссии
            side = 'BUY';
            totalPrice = quantity * currentPrice;
            if (totalPrice > botSettings.maxPositionSize) {
                quantity = (botSettings.maxPositionSize / currentPrice) * (1 - botSettings.feeRate);
            }
        } else {
            quantity = parseFloat(baseBalance) * (botSettings.riskLevel * 0.01);
            side = 'SELL';
            totalPrice = quantity * currentPrice;
        }

        if (quantity <= 0) {
            console.log("[BOT] ⚠️  Недостаточно баланса");
            return;
        }

        console.log(`[BOT] 🚀 ${side} ${quantity.toFixed(6)} ${symbol} по цене ${currentPrice}`);

        // !!! ЗАКОММЕНТИРОВАНО ДЛЯ БЕЗОПАСНОСТИ !!!
        // const order = await createOrder(symbol, side, botSettings.orderType, quantity.toFixed(6), currentPrice.toFixed(8));
        // console.log("[BOT] ✅ Ордер:", order);

        // Заглушка
        const mockOrder = {
            orderId: `mock-${Date.now()}`,
            symbol,
            side,
            type: botSettings.orderType,
            quantity: quantity.toFixed(6),
            price: currentPrice.toFixed(8),
            status: 'FILLED',
            time: Date.now()
        };

        botSettings.lastSignal = signalData.signal;
        botSettings.lastTradeTime = Date.now();
        tradeHistory.push({ ...mockOrder, signal: signalData.signal, confidence: signalData.confidence });

        if (tradeHistory.length > 100) tradeHistory = tradeHistory.slice(-100);

        console.log(`[BOT] 🎯 Сделка: ${side} ${quantity.toFixed(6)} ${symbol}`);

    } catch (error) {
        console.error("[BOT] ❌ Ошибка:", error.message);
        if (error.message.includes('BingX API Error')) {
            const match = error.message.match(/\[(\d+)\]/);
            if (match) handleBotError(parseInt(match[1]));
        }
    }
}

function handleBotError(errorCode) {
    const actions = {
        100001: () => console.error("❌ Ошибка подписи. Проверьте SECRET_KEY"),
        100419: () => console.error("❌ IP не в белом списке. Добавьте IP Render в BingX"),
        101204: () => console.warn("⚠️ Недостаточно средств. Уменьшаем риск"),
        429: () => {
            console.warn("⚠️ Слишком много запросов. Пауза 1 мин");
            botSettings.isEnabled = false;
            setTimeout(() => { botSettings.isEnabled = true; }, 60000);
        },
        100410: () => {
            console.warn("⚠️ Лимит частоты. Пауза 5 мин");
            botSettings.isEnabled = false;
            setTimeout(() => { botSettings.isEnabled = true; }, 300000);
        },
        80016: () => console.warn("⚠️ Ордер не существует"),
        101212: async () => {
            console.warn("⚠️ Есть активные ордера. Отменяем...");
            const orders = await getOpenOrders(botSettings.tradingPair);
            for (const order of orders) {
                console.log(`✅ Отменён ордер ${order.orderId}`);
            }
        }
    };
    if (actions[errorCode]) actions[errorCode]();
}

export function getBotStatus() {
    return {
        settings: { ...botSettings },
        lastSignal: botSettings.lastSignal,
        lastTradeTime: botSettings.lastTradeTime,
        tradeHistory: [...tradeHistory]
    };
}

// Запуск каждые 5 минут
setInterval(executeTradingLogic, 5 * 60 * 1000);
setTimeout(executeTradingLogic, 10000);

console.log("[BOT] 🤖 Готов к торговле на SPOT!");
