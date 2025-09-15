// bot.js — АВТОМАТИЧЕСКИЙ ТОРГОВЫЙ БОТ ДЛЯ ФЬЮЧЕРСОВ
import { 
    getKlines, 
    getTickerPrice, 
    getAccountInfo, 
    createOrder,
    getContracts,
    setLeverage
} from './bingxApi.js';

import { 
    calculateRSI, 
    calculateBollingerBands
} from './technicalAnalysis.js';

import fs from 'fs';
import path from 'path';

// 📁 Создаём папку logs
const LOGS_DIR = './logs';
if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR);

function logToFile(filename, message) {
    const logPath = path.join(LOGS_DIR, filename);
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    fs.appendFileSync(logPath, logMessage, 'utf8');
}

function logError(message) {
    logToFile('errors.log', `ERROR: ${message}`);
}

// ✅ Получаем список доступных пар при старте
let AVAILABLE_PAIRS = [];
let isPairsLoaded = false;

async function loadAvailablePairs() {
    try {
        const contracts = await getContracts();
       AVAILABLE_PAIRS = contracts
        .filter(c => c.symbol.endsWith('-USDT') && c.status === "TRADING")
        .map(c => c.symbol); // ✅ Только торгуемые пары
        );
        console.log(`[✅] Загружено ${AVAILABLE_PAIRS.length} доступных пар`);
        isPairsLoaded = true;
    } catch (error) {
        console.error('[❌] Ошибка загрузки пар:', error.message);
        // Fallback список
        AVAILABLE_PAIRS = [
            "BTC-USDT", "ETH-USDT", "BNB-USDT", "SOL-USDT", "XRP-USDT",
            "ADA-USDT", "DOGE-USDT", "TON-USDT", "AVAX-USDT", "SHIB-USDT"
        ];
    }
}

async function waitForPairs() {
    if (isPairsLoaded) return;
    await loadAvailablePairs();
}

let botSettings = {
    strategy: 'simple',
    riskLevel: 3, // 3% от баланса на сделку
    isEnabled: true,
    useDemoMode: true,
    analysisInterval: 300000, // 5 минут
    feeRate: 0.001, // 0.1% комиссия
    useStopLoss: true,
    stopLossPercent: 2.0,
    useTakeProfit: true,
    takeProfitPercent: 4.0,
    lastTradeTime: null,
    minTradeInterval: 300000,
    maxConcurrentRequests: 5,
    defaultLeverage: 10 // ✅ Плечо 10x
};

let tradeHistory = [];
let demoBalances = { 'USDT': 1000.0 };

export function updateBotSettings(newSettings) {
    if (newSettings.useDemoMode !== undefined) {
        botSettings.useDemoMode = newSettings.useDemoMode;
        console.log(`[BOT] 🔄 Переключен режим: ${botSettings.useDemoMode ? 'ДЕМО' : 'РЕАЛЬНЫЙ'}`);
    }
    botSettings = { ...botSettings, ...newSettings };
    console.log(`[BOT] 🔄 Настройки обновлены:`, botSettings);
}

export function getBotStatus() {
    return {
        settings: { ...botSettings },
        tradeHistory: [...tradeHistory],
        demoMode: botSettings.useDemoMode,
        demoBalances: { ...demoBalances },
        availablePairs: [...AVAILABLE_PAIRS]
    };
}

function calculatePnL(symbol, currentSide, currentPrice, currentQuantity) {
    const history = tradeHistory.filter(t => t.symbol === symbol && t.status === 'FILLED');
    if (history.length === 0) return 0;
    let totalPnL = 0;
    let remainingQty = currentQuantity;
    for (let i = 0; i < history.length && remainingQty > 0; i++) {
        const prev = history[i];
        if (prev.side === currentSide) continue;
        const closeQty = Math.min(remainingQty, prev.quantity);
        let pnl = 0;
        if (currentSide === 'SELL') {
            pnl = (currentPrice - prev.price) * closeQty;
        } else {
            pnl = (prev.price - currentPrice) * closeQty;
        }
        totalPnL += pnl;
        remainingQty -= closeQty;
    }
    return totalPnL;
}

export async function forceDailyTrade() {
    if (!botSettings.isEnabled) return;
    await waitForPairs();
    
    console.log(`[📅] ⚡ Принудительная ежедневная сделка`);
    logToFile('trades.log', 'Принудительная сделка инициирована');
    
    const randomPair = AVAILABLE_PAIRS[Math.floor(Math.random() * AVAILABLE_PAIRS.length)];
    const klines = await getKlines(randomPair, '5m', 100);
    if (!klines || klines.length < 14) {
        console.log(`[⚠️] 📉 Недостаточно данных для ${randomPair}`);
        return;
    }
    const side = Math.random() > 0.5 ? 'BUY' : 'SELL';
    console.log(`[📅] 🎯 Сгенерирован принудительный сигнал: ${side} для ${randomPair}`);
    await executeSingleTrade(randomPair, side, klines);
}

async function executeSingleTrade(symbol, forcedSide = null, klines = null) {
    console.log(`\n[🔍 ${new Date().toISOString()}] === 🤖 АНАЛИЗ ПАРЫ: ${symbol} ===`);
    
    try {
        // ✅ Проверяем существование пары
        try {
            await getTickerPrice(symbol);
        } catch (e) {
            console.log(`[⚠️] Пара ${symbol} не существует или не торгуется`);
            return null;
        }

        if (!klines) {
            klines = await getKlines(symbol, '5m', 100);
            if (!klines || klines.length < 14) {
                console.log(`[⚠️] 📉 Недостаточно данных для ${symbol}`);
                return null;
            }
        }

        const closePrices = klines.map(candle => parseFloat(candle[4]));
        const currentPrice = closePrices[closePrices.length - 1];

        // ✅ Простая и надёжная стратегия
        const rsi = calculateRSI(klines);
        const bb = calculateBollingerBands(closePrices, 20, 2);
        const upperBB = bb.upper[bb.upper.length - 1];
        const lowerBB = bb.lower[bb.lower.length - 1];

        let signal = 'NEUTRAL';
        if (rsi.rsi < 30 && currentPrice < lowerBB) signal = 'BUY';
        else if (rsi.rsi > 70 && currentPrice > upperBB) signal = 'SELL';

        if (signal === 'NEUTRAL') {
            console.log(`[💤] 🛑 Нет торгового сигнала для ${symbol}`);
            return null;
        }

        // ✅ Получаем баланс
        let availableBalance;
        if (botSettings.useDemoMode) {
            availableBalance = demoBalances.USDT || 0;
            console.log(`[🏦 DEMO] 📊 Баланс: ${availableBalance.toFixed(2)} USDT`);
        } else {
            const account = await getAccountInfo();
            availableBalance = account.balance ? parseFloat(account.balance) : 0;
            console.log(`[🏦 REAL] 📊 Баланс: ${availableBalance.toFixed(2)} USDT`);
        }

        if (isNaN(availableBalance) || availableBalance <= 0) {
            console.log(`[⚠️] 🛑 Недостаточно баланса`);
            return null;
        }

        // ✅ Устанавливаем плечо
        if (!botSettings.useDemoMode) {
            try {
                await setLeverage(symbol, botSettings.defaultLeverage);
                console.log(`[⚖️] Установлено плечо ${botSettings.defaultLeverage}x для ${symbol}`);
            } catch (e) {
                console.log(`[⚠️] Не удалось установить плечо:`, e.message);
            }
        }

        // ✅ Рассчитываем размер позиции с учётом риска и плеча
        const riskAmount = availableBalance * (botSettings.riskLevel * 0.01);
        const positionSize = (riskAmount * botSettings.defaultLeverage) / currentPrice;
        const quantity = positionSize;

        if (quantity <= 0.000001) {
            console.log(`[⚠️] 🛑 Слишком маленький размер ордера: ${quantity.toFixed(6)}`);
            return null;
        }

        // ✅ Проверка интервала между сделками
        const now = Date.now();
        if (botSettings.lastTradeTime && (now - botSettings.lastTradeTime) < botSettings.minTradeInterval) {
            console.log(`[⏳] ⏸️ Слишком рано для новой сделки`);
            return null;
        }

        // ✅ Выполнение ордера
        let orderResult;
        if (botSettings.useDemoMode) {
            // 🎮 Демо-режим с учётом плеча и комиссии
            const notionalValue = quantity * currentPrice;
            const fee = notionalValue * botSettings.feeRate;
            demoBalances.USDT -= fee;
            
            // Имитация PnL (1% прибыли/убытка для демо)
            const pnl = signal === 'BUY' ? notionalValue * 0.01 : notionalValue * -0.01;
            demoBalances.USDT += pnl;
            
            orderResult = { 
                orderId: `DEMO-${Date.now()}`, 
                status: 'FILLED',
                price: currentPrice,
                quantity: quantity
            };
            console.log(`[🎮 DEMO] ✅ Ордер: ${signal} ${quantity.toFixed(6)} ${symbol} с плечом ${botSettings.defaultLeverage}x`);
        } else {
            // 🚀 Реальный ордер
            orderResult = await createOrder(symbol, signal, 'MARKET', quantity.toFixed(6));
            console.log(`[🚀 REAL] ✅ Ордер отправлен: ${signal} ${quantity.toFixed(6)} ${symbol}`);
        }

        botSettings.lastTradeTime = now;

        // ✅ Расчёт PnL и запись в историю
        const pnl = calculatePnL(symbol, signal, currentPrice, quantity);
        const pnlPercent = quantity > 0 ? (pnl / (quantity * currentPrice)) * 100 : 0;

        const tradeRecord = {
            timestamp: now,
            symbol,
            side: signal,
            price: currentPrice,
            quantity: quantity,
            leverage: botSettings.defaultLeverage,
            mode: botSettings.useDemoMode ? 'DEMO' : 'REAL',
            orderId: orderResult.orderId || 'N/A',
            fee: botSettings.useDemoMode ? (quantity * currentPrice * botSettings.feeRate) : 0,
            pnl: pnl,
            pnlPercent: pnlPercent,
            status: 'FILLED'
        };

        tradeHistory.push(tradeRecord);
        logToFile('trades.log', `TRADE | ${tradeRecord.mode} | ${signal} ${symbol} @ ${currentPrice} | Кол-во: ${quantity.toFixed(6)} | Плечо: ${botSettings.defaultLeverage}x | PnL: ${pnl.toFixed(4)}`);
        console.log(`[✅] 📝 Сделка добавлена`);

        // ✅ Установка Stop-Loss и Take-Profit
        if (botSettings.useStopLoss || botSettings.useTakeProfit) {
            const slSide = signal === 'BUY' ? 'SELL' : 'BUY';
            const tpSide = slSide;

            try {
                if (botSettings.useStopLoss && !botSettings.useDemoMode) {
                    const slPrice = signal === 'BUY'
                        ? currentPrice * (1 - botSettings.stopLossPercent / 100)
                        : currentPrice * (1 + botSettings.stopLossPercent / 100);
                    await createOrder(symbol, slSide, 'STOP_MARKET', quantity.toFixed(6), null, slPrice.toFixed(8));
                    console.log(`[🚀 REAL SL] 🛑 Stop-Loss установлен: ${slPrice.toFixed(8)}`);
                }

                if (botSettings.useTakeProfit && !botSettings.useDemoMode) {
                    const tpPrice = signal === 'BUY'
                        ? currentPrice * (1 + botSettings.takeProfitPercent / 100)
                        : currentPrice * (1 - botSettings.takeProfitPercent / 100);
                    await createOrder(symbol, tpSide, 'TAKE_PROFIT_MARKET', quantity.toFixed(6), null, tpPrice.toFixed(8));
                    console.log(`[🚀 REAL TP] 🎯 Take-Profit установлен: ${tpPrice.toFixed(8)}`);
                }
            } catch (sltpError) {
                console.error(`[⚠️ SL/TP ERROR]`, sltpError.message);
                logError(`Ошибка установки SL/TP для ${symbol}: ${sltpError.message}`);
            }
        }

        return tradeRecord;

    } catch (error) {
        console.error(`[❌] 🚨 Ошибка для ${symbol}:`, error.message);
        logError(`Ошибка анализа/торговли для ${symbol}: ${error.message}`);
        return null;
    }
}

export async function executeTradingLogic() {
    await waitForPairs();
    console.log(`[🔄] Запуск анализа ${AVAILABLE_PAIRS.length} доступных пар...`);

    const results = [];
    const batchSize = botSettings.maxConcurrentRequests;

    for (let i = 0; i < AVAILABLE_PAIRS.length; i += batchSize) {
        const batch = AVAILABLE_PAIRS.slice(i, i + batchSize);
        const batchPromises = batch.map(pair => executeSingleTrade(pair));
        const batchResults = await Promise.allSettled(batchPromises);
        results.push(...batchResults);
        
        if (i + batchSize < AVAILABLE_PAIRS.length) {
            await new Promise(resolve => setTimeout(resolve, 2000)); // пауза 2 сек
        }
    }

    console.log("[✅] Анализ и торговля завершены.");
}

export function startMultiPairAnalysis() {
    loadAvailablePairs();
    console.log(`[⏰] Автоматическая торговля каждые ${botSettings.analysisInterval / 60000} минут`);
    setInterval(executeTradingLogic, botSettings.analysisInterval);
}
