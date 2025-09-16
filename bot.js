// ✅ bot.js — АВТОМАТИЧЕСКИЙ ТОРГОВЫЙ БОТ (торгует КАЖДЫЙ ЦИКЛ)
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

// ✅ Актуальный список пар (проверено на BingX Perp Futures)
const KNOWN_GOOD_PAIRS = [
    "BTC-USDT", "ETH-USDT", "BNB-USDT", "SOL-USDT", "XRP-USDT",
    "ADA-USDT", "DOGE-USDT", "AVAX-USDT", "DOT-USDT", "LINK-USDT",
    "TRX-USDT", "NEAR-USDT", "ATOM-USDT", "UNI-USDT", "APT-USDT",
    "LTC-USDT", "SHIB-USDT", "BCH-USDT", "XLM-USDT", "ETC-USDT"
];

let AVAILABLE_PAIRS = [...KNOWN_GOOD_PAIRS];
let isPairsLoaded = false;

async function loadAvailablePairs() {
    try {
        const contracts = await getContracts();
        if (Array.isArray(contracts) && contracts.length > 0) {
            const validPairs = contracts
                .filter(c => c && c.symbol && c.symbol.endsWith('-USDT') && c.status === "TRADING")
                .map(c => c.symbol);
            if (validPairs.length > 0) {
                AVAILABLE_PAIRS = validPairs;
                console.log(`[✅] Загружено ${AVAILABLE_PAIRS.length} реальных пар`);
            }
        }
    } catch (error) {
        console.log('[⚠️] Используем проверенный список пар');
    }
    isPairsLoaded = true;
}

async function waitForPairs() {
    if (isPairsLoaded) return;
    await loadAvailablePairs();
}

let botSettings = {
    riskLevel: 2, // 2% риска на сделку
    useDemoMode: true,
    analysisInterval: 300000,
    feeRate: 0.001,
    useStopLoss: true,
    stopLossPercent: 3.0,
    useTakeProfit: true,
    takeProfitPercent: 6.0,
    lastTradeTime: null,
    minTradeInterval: 300000,
    maxConcurrentRequests: 5,
    defaultLeverage: 10
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

export async function forceDailyTrade() {
    if (!botSettings.isEnabled) return;
    await waitForPairs();
    
    const randomPair = AVAILABLE_PAIRS[Math.floor(Math.random() * AVAILABLE_PAIRS.length)];
    const side = Math.random() > 0.5 ? 'BUY' : 'SELL';
    await executeSingleTrade(randomPair, side);
}

async function executeSingleTrade(symbol, forcedSide = null) {
    console.log(`\n[🔍 ${new Date().toISOString()}] === 🤖 ТОРГОВЛЯ ПО ПАРЕ: ${symbol} ===`);
    
    try {
        // ✅ Проверяем пару
        try {
            await getTickerPrice(symbol);
        } catch (e) {
            console.log(`[⚠️] Пара ${symbol} недоступна`);
            return null;
        }

        // ✅ Получаем баланс
        let availableBalance;
        if (botSettings.useDemoMode) {
            availableBalance = demoBalances.USDT || 0;
        } else {
            const account = await getAccountInfo();
            availableBalance = account.balance ? parseFloat(account.balance) : 0;
        }

        if (isNaN(availableBalance) || availableBalance <= 10) {
            console.log(`[⚠️] 🛑 Недостаточно баланса`);
            return null;
        }

        // ✅ Получаем цену
        const ticker = await getTickerPrice(symbol);
        const price = parseFloat(ticker.price);

        // ✅ Устанавливаем плечо
        if (!botSettings.useDemoMode) {
            try {
                await setLeverage(symbol, botSettings.defaultLeverage);
            } catch (e) {
                console.log(`[⚠️] Не удалось установить плечо`);
            }
        }

        // ✅ Рассчитываем размер позиции (2% от баланса с плечом 10x)
        const riskAmount = availableBalance * (botSettings.riskLevel * 0.01);
        const positionSize = (riskAmount * botSettings.defaultLeverage) / price;
        const quantity = positionSize;

        if (quantity <= 0.000001) {
            console.log(`[⚠️] 🛑 Слишком маленький размер ордера`);
            return null;
        }

        // ✅ Определяем сторону сделки
        let side = forcedSide || (Math.random() > 0.5 ? 'BUY' : 'SELL');

        // ✅ Выполняем ордер
        let orderResult;
        if (botSettings.useDemoMode) {
            const notionalValue = quantity * price;
            const fee = notionalValue * botSettings.feeRate;
            demoBalances.USDT -= fee;
            
            // Имитация прибыли/убытка
            const pnl = side === 'BUY' ? notionalValue * 0.02 : notionalValue * -0.02;
            demoBalances.USDT += pnl;
            
            orderResult = { orderId: `DEMO-${Date.now()}`, status: 'FILLED' };
            console.log(`[🎮 DEMO] ✅ Ордер: ${side} ${quantity.toFixed(6)} ${symbol}`);
        } else {
            orderResult = await createOrder(symbol, side, 'MARKET', quantity.toFixed(6));
            console.log(`[🚀 REAL] ✅ Ордер отправлен: ${side} ${quantity.toFixed(6)} ${symbol}`);
        }

        // ✅ Записываем в историю
        const tradeRecord = {
            timestamp: Date.now(),
            symbol,
            side,
            price,
            quantity,
            leverage: botSettings.defaultLeverage,
            mode: botSettings.useDemoMode ? 'DEMO' : 'REAL',
            orderId: orderResult.orderId || 'N/A',
            status: 'FILLED'
        };

        tradeHistory.push(tradeRecord);
        logToFile('trades.log', `TRADE | ${tradeRecord.mode} | ${side} ${symbol} @ ${price} | Кол-во: ${quantity.toFixed(6)} | Плечо: ${botSettings.defaultLeverage}x`);
        console.log(`[✅] 📝 Сделка добавлена`);

        // ✅ Устанавливаем SL/TP
        if (botSettings.useStopLoss && !botSettings.useDemoMode) {
            const slSide = side === 'BUY' ? 'SELL' : 'BUY';
            const slPrice = side === 'BUY' 
                ? price * (1 - botSettings.stopLossPercent / 100)
                : price * (1 + botSettings.stopLossPercent / 100);
            await createOrder(symbol, slSide, 'STOP_MARKET', quantity.toFixed(6), null, slPrice.toFixed(8));
        }

        if (botSettings.useTakeProfit && !botSettings.useDemoMode) {
            const tpSide = side === 'BUY' ? 'SELL' : 'BUY';
            const tpPrice = side === 'BUY'
                ? price * (1 + botSettings.takeProfitPercent / 100)
                : price * (1 - botSettings.takeProfitPercent / 100);
            await createOrder(symbol, tpSide, 'TAKE_PROFIT_MARKET', quantity.toFixed(6), null, tpPrice.toFixed(8));
        }

        return tradeRecord;

    } catch (error) {
        console.error(`[❌] Ошибка для ${symbol}:`, error.message);
        return null;
    }
}

export async function executeTradingLogic() {
    await waitForPairs();
    console.log(`[🔄] Запуск торговли по ${AVAILABLE_PAIRS.length} парам...`);

    // ✅ Торгуем по случайным 5 парам каждые 5 минут
    const shuffled = [...AVAILABLE_PAIRS].sort(() => 0.5 - Math.random());
    const pairsToTrade = shuffled.slice(0, 5);

    for (let pair of pairsToTrade) {
        await executeSingleTrade(pair);
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log("[✅] Торговля завершена.");
}

export function startMultiPairAnalysis() {
    loadAvailablePairs();
    console.log(`[⏰] Автоматическая торговля каждые 5 минут`);
    setInterval(executeTradingLogic, botSettings.analysisInterval);
}
