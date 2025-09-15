// ✅ bot.js — ИСПРАВЛЕННАЯ ВЕРСИЯ ДЛЯ ФЬЮЧЕРСОВ
import { 
    getKlines, 
    getTickerPrice, 
    getAccountInfo, 
    createOrder,
    getContracts // ✅ Новое: получаем список доступных пар
} from './bingxApi.js';

import { 
    calculateRSI, 
    calculateMACD, 
    calculateStochastic,
    calculateBollingerBands,
    calculateSMA,
    calculateEMA
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

function logTrade(trade) {
    const msg = `TRADE | ${trade.mode} | ${trade.side} ${trade.symbol} | Цена: ${trade.price} | Кол-во: ${trade.quantity} | PnL: ${trade.pnl.toFixed(4)} (${trade.pnlPercent.toFixed(2)}%)`;
    logToFile('trades.log', msg);
}

// ✅ Получаем список доступных пар при старте
let AVAILABLE_PAIRS = [];
let isPairsLoaded = false;

async function loadAvailablePairs() {
    try {
        const contracts = await getContracts();
        AVAILABLE_PAIRS = contracts.map(c => c.symbol).filter(symbol => symbol.endsWith('-USDT'));
        console.log(`[✅] Загружено ${AVAILABLE_PAIRS.length} доступных пар`);
        isPairsLoaded = true;
    } catch (error) {
        console.error('[❌] Ошибка загрузки пар:', error.message);
        // Используем fallback список
        AVAILABLE_PAIRS = [
            "BTC-USDT", "ETH-USDT", "BNB-USDT", "SOL-USDT", "XRP-USDT",
            "ADA-USDT", "DOGE-USDT", "TON-USDT", "AVAX-USDT", "SHIB-USDT",
            "LINK-USDT", "BCH-USDT", "DOT-USDT", "LTC-USDT", "NEAR-USDT",
            "MATIC-USDT", "APT-USDT", "UNI-USDT", "ATOM-USDT", "INJ-USDT"
        ];
    }
}

// ✅ Ждём загрузки пар перед анализом
async function waitForPairs() {
    if (isPairsLoaded) return;
    await loadAvailablePairs();
}

let botSettings = {
    strategy: 'advanced',
    riskLevel: 5,
    maxPositionSize: 100,
    isEnabled: true,
    useDemoMode: true,
    analysisInterval: 300000,
    feeRate: 0.001,
    useStopLoss: true,
    stopLossPercent: 2.0,
    useTakeProfit: true,
    takeProfitPercent: 4.0,
    lastTradeTime: null,
    minTradeInterval: 300000,
    maxConcurrentRequests: 10
};

let tradeHistory = [];
let demoBalances = {
    'USDT': 1000.0,
    'BTC': 0.0,
    'ETH': 0.0
};

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
        if (!klines) {
            klines = await getKlines(symbol, '5m', 100);
            if (!klines || klines.length < 14) {
                console.log(`[⚠️] 📉 Недостаточно данных для ${symbol}`);
                return null;
            }
        }

        const closePrices = klines.map(candle => parseFloat(candle[4]));
        const volumes = klines.map(candle => parseFloat(candle[5]));
        const currentPrice = closePrices[closePrices.length - 1];

        // ✅ Исправление ошибки "rsiValues.slice is not a function"
        const rsi = calculateRSI(klines);
        const macd = calculateMACD(klines);
        const stoch = calculateStochastic(klines);
        const bb = calculateBollingerBands(closePrices, 20, 2);
        const sma20 = calculateSMA(closePrices, 20);
        const ema12 = calculateEMA(closePrices, 12);
        const upperBB = bb.upper?.[bb.upper.length - 1] || 0;
        const lowerBB = bb.lower?.[bb.lower.length - 1] || 0;

        let signal = 'NEUTRAL';
        let confidence = 0.3;
        let analysisReason = "Нейтральный рынок";

        if (forcedSide) {
            signal = forcedSide;
            confidence = 0.8;
            analysisReason = "Принудительная ежедневная сделка";
        } else {
            const signals = [];
            if (rsi.rsi < 30) signals.push({ type: 'RSI', signal: 'BUY', weight: 0.2 });
            else if (rsi.rsi > 70) signals.push({ type: 'RSI', signal: 'SELL', weight: 0.2 });
            if (macd.histogram > 0 && macd.macd > macd.signal) signals.push({ type: 'MACD', signal: 'BUY', weight: 0.15 });
            else if (macd.histogram < 0 && macd.macd < macd.signal) signals.push({ type: 'MACD', signal: 'SELL', weight: 0.15 });
            if (stoch.k < 20 && stoch.k > stoch.d) signals.push({ type: 'Stochastic', signal: 'BUY', weight: 0.15 });
            else if (stoch.k > 80 && stoch.k < stoch.d) signals.push({ type: 'Stochastic', signal: 'SELL', weight: 0.15 });
            if (currentPrice < lowerBB) signals.push({ type: 'Bollinger', signal: 'BUY', weight: 0.1 });
            else if (currentPrice > upperBB) signals.push({ type: 'Bollinger', signal: 'SELL', weight: 0.1 });

            const buySignals = signals.filter(s => s.signal === 'BUY');
            const sellSignals = signals.filter(s => s.signal === 'SELL');
            const buyWeight = buySignals.reduce((sum, s) => sum + s.weight, 0);
            const sellWeight = sellSignals.reduce((sum, s) => sum + s.weight, 0);

            if (buyWeight > sellWeight && buyWeight > 0.3) {
                signal = 'BUY';
                confidence = buyWeight;
                analysisReason = `Покупка: ${buySignals.map(s => s.type).join(', ')}`;
            } else if (sellWeight > buyWeight && sellWeight > 0.3) {
                signal = 'SELL';
                confidence = sellWeight;
                analysisReason = `Продажа: ${sellSignals.map(s => s.type).join(', ')}`;
            }
        }

        console.log(`[🎯] 🎯 Итоговый сигнал: ${signal} | Уверенность: ${confidence.toFixed(2)} | Причина: ${analysisReason}`);
        if (signal === 'NEUTRAL') {
            console.log(`[💤] 🛑 Нет торгового сигнала для ${symbol}`);
            return null;
        }

        const ticker = await getTickerPrice(symbol);
        const price = parseFloat(ticker.price);
        console.log(`[💰] 💹 Текущая цена: ${price}`);

        let quoteBalance;
        if (botSettings.useDemoMode) {
            quoteBalance = demoBalances.USDT || 0;
            console.log(`[🏦 DEMO] 📊 Баланс: ${quoteBalance.toFixed(2)} USDT`);
        } else {
            const account = await getAccountInfo();
            quoteBalance = account.balance ? parseFloat(account.balance) : 0;
            console.log(`[🏦 REAL] 📊 Баланс: ${quoteBalance.toFixed(2)} USDT`);
        }

        if (isNaN(quoteBalance)) {
            console.log(`[⚠️] 🛑 Ошибка: баланс равен NaN`);
            return null;
        }

        let quantity = 0;
        const riskAmount = quoteBalance * (botSettings.riskLevel * 0.01);
        quantity = (riskAmount / price) * (1 - botSettings.feeRate);

        if (quantity <= 0.000001) {
            console.log(`[⚠️] 🛑 Недостаточно средств: ${quantity.toFixed(6)}`);
            return null;
        }

        const now = Date.now();
        if (botSettings.lastTradeTime && (now - botSettings.lastTradeTime) < botSettings.minTradeInterval) {
            console.log(`[⏳] ⏸️ Слишком рано для новой сделки`);
            return null;
        }

        let orderResult;
        try {
            if (botSettings.useDemoMode) {
                const amountInQuote = quantity * price;
                const fee = amountInQuote * botSettings.feeRate;

                if (demoBalances.USDT < amountInQuote + fee) {
                    console.log(`[⚠️ DEMO] 🛑 Недостаточно USDT`);
                    return null;
                }
                demoBalances.USDT -= amountInQuote + fee;
                if (signal === 'BUY') {
                    demoBalances[symbol.split('-')[0]] = (demoBalances[symbol.split('-')[0]] || 0) + quantity;
                } else {
                    demoBalances[symbol.split('-')[0]] = (demoBalances[symbol.split('-')[0]] || 0) - quantity;
                }

                orderResult = {
                    orderId: `DEMO-${Date.now()}`,
                    symbol,
                    side: signal,
                    type: 'MARKET',
                    price,
                    quantity,
                    fee,
                    executedQty: quantity,
                    status: 'FILLED'
                };
                console.log(`[🎮 DEMO] ✅ Ордер выполнен`);
            } else {
                orderResult = await createOrder(symbol, signal, 'MARKET', quantity.toFixed(6));
                console.log(`[🚀 REAL] ✅ Ордер отправлен`);
            }

            botSettings.lastTradeTime = now;
            const pnl = calculatePnL(symbol, signal, price, quantity);
            const pnlPercent = quantity > 0 ? (pnl / (quantity * price)) * 100 : 0;

            const tradeRecord = {
                timestamp: now,
                symbol,
                side: signal,
                price,
                quantity,
                confidence,
                analysisReason,
                mode: botSettings.useDemoMode ? 'DEMO' : 'REAL',
                orderId: orderResult.orderId || 'N/A',
                fee: botSettings.useDemoMode ? (quantity * price * botSettings.feeRate) : 0,
                pnl: pnl,
                pnlPercent: pnlPercent,
                status: 'FILLED'
            };

            tradeHistory.push(tradeRecord);
            logTrade(tradeRecord);
            console.log(`[✅] 📝 Сделка добавлена. Баланс:`, demoBalances);

            return tradeRecord;
        } catch (error) {
            console.error(`[❌] 🚨 Ошибка ордера:`, error.message);
            logError(`Ошибка ордера для ${symbol}: ${error.message}`);
            return null;
        }
    } catch (error) {
        console.error(`[❌] 🚨 Ошибка анализа:`, error.message);
        logError(`Ошибка анализа пары ${symbol}: ${error.message}`);
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
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    console.log("[✅] Анализ завершён.");
}

export function startMultiPairAnalysis() {
    loadAvailablePairs(); // Загружаем пары при старте
    console.log(`[⏰] Анализ каждые ${botSettings.analysisInterval / 60000} минут`);
    setInterval(executeTradingLogic, botSettings.analysisInterval);
}
