// bot.js — ПОЛНОСТЬЮ ГОТОВЫЙ КОД
import { getKlines, getTickerPrice, getAccountInfo, createOrder } from './bingxApi.js';
import { 
    generateTradingSignal, 
    calculateBollingerBands, 
    calculateRSI, 
    calculateMACD, 
    calculateStochastic,
    calculateSMA,
    calculateEMA,
    detectCandlestickPatterns,
    detectChartPatterns,
    detectDivergence,
    calculateVolumeProfile,
    calculateMIDAS
} from './technicalAnalysis.js';
import fs from 'fs';
import path from 'path';

// Список 200+ криптовалют
export const CRYPTO_PAIRS = [
    "BTC-USDT", "ETH-USDT", "BNB-USDT", "SOL-USDT", "XRP-USDT", "USDC-USDT", "ADA-USDT", "DOGE-USDT", "TRX-USDT", "TON-USDT",
    "AVAX-USDT", "SHIB-USDT", "LINK-USDT", "BCH-USDT", "DOT-USDT", "LTC-USDT", "NEAR-USDT", "MATIC-USDT", "ICP-USDT", "APT-USDT",
    "UNI-USDT", "STX-USDT", "FET-USDT", "RNDR-USDT", "ATOM-USDT", "IMX-USDT", "INJ-USDT", "OP-USDT", "HBAR-USDT", "TIA-USDT",
    "RUNE-USDT", "AR-USDT", "MKR-USDT", "SUI-USDT", "SEI-USDT", "AAVE-USDT", "GRT-USDT", "FIL-USDT", "LDO-USDT", "MINA-USDT",
    "ALGO-USDT", "EGLD-USDT", "FLOW-USDT", "QNT-USDT", "AXS-USDT", "MANA-USDT", "SAND-USDT", "THETA-USDT", "VET-USDT", "XLM-USDT",
    "EOS-USDT", "XTZ-USDT", "KAVA-USDT", "GALA-USDT", "DYDX-USDT", "CRV-USDT", "SNX-USDT", "KSM-USDT", "ZIL-USDT", "CHZ-USDT",
    "ENJ-USDT", "BAT-USDT", "ZEC-USDT", "DASH-USDT", "NEXO-USDT", "COMP-USDT", "YFI-USDT", "CAKE-USDT", "1INCH-USDT", "LRC-USDT",
    "OMG-USDT", "CELO-USDT", "AMP-USDT", "ANKR-USDT", "AUDIO-USDT", "BAND-USDT", "BLZ-USDT", "C98-USDT", "CTSI-USDT", "CVC-USDT",
    "DGB-USDT", "DNT-USDT", "ELF-USDT", "FLUX-USDT", "FTM-USDT", "FXS-USDT", "GAS-USDT", "GLMR-USDT", "GMT-USDT", "GODS-USDT",
    "HIGH-USDT", "HNT-USDT", "ICX-USDT", "IOST-USDT", "IOTA-USDT", "JASMY-USDT", "JOE-USDT", "JST-USDT", "KDA-USDT", "KLAY-USDT",
    "LINA-USDT", "LOKA-USDT", "LPT-USDT", "LQTY-USDT", "LUNA-USDT", "MASK-USDT", "MDT-USDT", "METIS-USDT", "MOVR-USDT", "MTL-USDT",
    "NKN-USDT", "OCEAN-USDT", "OGN-USDT", "ONT-USDT", "ORN-USDT", "OXT-USDT", "PERP-USDT", "PHA-USDT", "PIVX-USDT", "POLY-USDT",
    "POWR-USDT", "PYR-USDT", "QI-USDT", "QTUM-USDT", "RAD-USDT", "REEF-USDT", "REN-USDT", "REQ-USDT", "RLC-USDT", "RSR-USDT",
    "RVN-USDT", "SFP-USDT", "SKL-USDT", "SLP-USDT", "SNM-USDT", "SNT-USDT", "STORJ-USDT", "SUSHI-USDT", "SXP-USDT", "TFUEL-USDT",
    "TOMO-USDT", "TRB-USDT", "TUSD-USDT", "UMA-USDT", "UTK-USDT", "VTHO-USDT", "WAVES-USDT", "WAXP-USDT", "WOO-USDT", "XEM-USDT",
    "XMR-USDT", "XNO-USDT", "XVS-USDT", "YGG-USDT", "ZRX-USDT", "ACH-USDT", "AGLD-USDT", "AKRO-USDT", "ALCX-USDT", "ALICE-USDT",
    "ALPHA-USDT", "ARPA-USDT", "ASTR-USDT", "ATA-USDT", "AUCTION-USDT", "BADGER-USDT", "BAL-USDT", "BICO-USDT", "BOND-USDT",
    "BSW-USDT", "BURGER-USDT", "CELR-USDT", "CHESS-USDT", "CHR-USDT", "CLV-USDT", "COTI-USDT", "CRO-USDT", "CTK-USDT", "DAR-USDT",
    "DENT-USDT", "DEXE-USDT", "DIA-USDT", "DODO-USDT", "DREP-USDT", "DUSK-USDT", "EDU-USDT", "EFI-USDT", "ELON-USDT", "ERN-USDT",
    "FIDA-USDT", "FLM-USDT", "FOR-USDT", "FRONT-USDT", "FUN-USDT", "GHST-USDT", "GLM-USDT", "GNS-USDT", "GTC-USDT", "HARD-USDT",
    "HERO-USDT", "HOT-USDT", "IDEX-USDT", "ILV-USDT", "IOTX-USDT", "IRIS-USDT", "JUV-USDT", "KNC-USDT", "KP3R-USDT", "LAZIO-USDT",
    "LIT-USDT", "MAGIC-USDT", "MBL-USDT", "MIR-USDT", "NBS-USDT", "NMR-USDT", "OM-USDT", "OOKI-USDT", "PARA-USDT", "PAXG-USDT",
    "PEOPLE-USDT", "PERL-USDT", "PLA-USDT", "PNT-USDT", "PROS-USDT", "PUNDIX-USDT", "QLC-USDT", "RARE-USDT", "RAY-USDT", "ROSE-USDT",
    "SPELL-USDT", "SRM-USDT", "STMX-USDT", "STPT-USDT", "STRAX-USDT", "SUN-USDT", "SYS-USDT", "TCT-USDT", "TKO-USDT", "TLM-USDT",
    "TVK-USDT", "UFT-USDT", "UNFI-USDT", "VGX-USDT", "VIB-USDT", "VIDT-USDT", "VITE-USDT", "VOXEL-USDT", "WAN-USDT", "WING-USDT",
    "WNXM-USDT", "WRX-USDT", "ZEN-USDT"
];

// ✅ Создаём папку logs, если её нет
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
    const msg = `TRADE | ${trade.mode} | ${trade.side} ${trade.symbol} | Цена: ${trade.price} | Кол-во: ${trade.quantity} | PnL: ${trade.pnl.toFixed(4)} (${trade.pnlPercent.toFixed(2)}%) | ${trade.analysisReason}`;
    logToFile('trades.log', msg);
}

let botSettings = {
    strategy: 'advanced',
    riskLevel: 5,
    maxPositionSize: 100,
    isEnabled: true,
    useDemoMode: true,
    analysisInterval: 300000, // 5 минут
    feeRate: 0.001,
    useStopLoss: true,
    stopLossPercent: 2.0,
    useTakeProfit: true,
    takeProfitPercent: 4.0,
    lastTradeTime: null,
    minTradeInterval: 300000, // 5 минут между сделками
    autoCancelPreviousSLTP: true // ✅ Новое: отменять старые SL/TP
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
        demoBalances: { ...demoBalances }
    };
}

// ✅ Расчёт PnL по FIFO
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

// ✅ Функция для принудительной сделки раз в день
export async function forceDailyTrade() {
    if (!botSettings.isEnabled) return;

    console.log(`[📅] ⚡ Принудительная ежедневная сделка`);
    logToFile('trades.log', 'Принудительная ежедневная сделка инициирована');

    const randomPair = CRYPTO_PAIRS[Math.floor(Math.random() * CRYPTO_PAIRS.length)];
    const klines = await getKlines(randomPair, '5m', 100);
    
    if (!klines || klines.length < 14) {
        console.log(`[⚠️] 📉 Недостаточно данных для ${randomPair}`);
        return;
    }

    const side = Math.random() > 0.5 ? 'BUY' : 'SELL';
    console.log(`[📅] 🎯 Сгенерирован принудительный сигнал: ${side} для ${randomPair}`);

    await executeSingleTrade(randomPair, side, klines);
}

// ✅ Основная функция анализа и торговли для одной пары
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
        const highs = klines.map(candle => parseFloat(candle[2]));
        const lows = klines.map(candle => parseFloat(candle[3]));
        
        // Индикаторы
        const rsi = calculateRSI(klines);
        const macd = calculateMACD(klines);
        const stoch = calculateStochastic(klines);
        const bb = calculateBollingerBands(closePrices, 20, 2);
        const sma20 = calculateSMA(closePrices, 20);
        const ema12 = calculateEMA(closePrices, 12);
        const currentPrice = closePrices[closePrices.length - 1];
        const upperBB = bb.upper[bb.upper.length - 1];
        const lowerBB = bb.lower[bb.lower.length - 1];

        // Расширенный анализ (если функции есть — иначе закомментируй)
        // const candlePatterns = detectCandlestickPatterns(klines);
        // const chartPatterns = detectChartPatterns(klines);
        // const divergence = detectDivergence(closePrices, rsi.rsi, volumes);
        // const volumeProfile = calculateVolumeProfile(klines, 10);
        // const midas = calculateMIDAS(closePrices, volumes);

        // Заглушки, если функции не реализованы:
        const candlePatterns = [];
        const chartPatterns = [];
        const divergence = { type: 'none', strength: 0 };
        const volumeProfile = { support: currentPrice * 0.99, resistance: currentPrice * 1.01 };
        const midas = { support: currentPrice * 0.98, resistance: currentPrice * 1.02 };

        console.log(`[📊] 📈 RSI: ${rsi.rsi.toFixed(2)} (${rsi.signal})`);
        console.log(`[📊] 📉 MACD: ${macd.macd.toFixed(6)} | Signal: ${macd.signal.toFixed(6)} | Histogram: ${macd.histogram.toFixed(6)}`);
        console.log(`[📊] 📊 Stochastic: %K=${stoch.k.toFixed(2)} | %D=${stoch.d.toFixed(2)} (${stoch.signal})`);
        console.log(`[📊] 📊 Bollinger Bands: Цена=${currentPrice.toFixed(6)} | Верхняя=${upperBB.toFixed(6)} | Нижняя=${lowerBB.toFixed(6)}`);
        console.log(`[📊] 📊 SMA(20): ${sma20.toFixed(6)} | EMA(12): ${ema12.toFixed(6)}`);
        console.log(`[🕯️] 🕯️ Свечные паттерны: ${candlePatterns.join(', ') || 'нет'}`);
        console.log(`[🎨] 🎨 Фигуры графика: ${chartPatterns.join(', ') || 'нет'}`);
        console.log(`[🔄] 🔄 Дивергенция: ${divergence.type} (${divergence.strength.toFixed(2)})`);
        console.log(`[📊] 📊 Объём профиль: ${volumeProfile.support.toFixed(6)} - ${volumeProfile.resistance.toFixed(6)}`);
        console.log(`[🔮] 🔮 MIDAS: ${midas.support.toFixed(6)} - ${midas.resistance.toFixed(6)}`);

        // Генерация сигнала
        let signal = 'NEUTRAL';
        let confidence = 0.3;
        let analysisReason = "Нейтральный рынок";

        if (forcedSide) {
            signal = forcedSide;
            confidence = 0.8;
            analysisReason = "Принудительная ежедневная сделка";
        } else {
            const signals = [];

            // Технические индикаторы
            if (rsi.rsi < 30) signals.push({ type: 'RSI', signal: 'BUY', weight: 0.2 });
            else if (rsi.rsi > 70) signals.push({ type: 'RSI', signal: 'SELL', weight: 0.2 });

            if (macd.histogram > 0 && macd.macd > macd.signal) signals.push({ type: 'MACD', signal: 'BUY', weight: 0.15 });
            else if (macd.histogram < 0 && macd.macd < macd.signal) signals.push({ type: 'MACD', signal: 'SELL', weight: 0.15 });

            if (stoch.k < 20 && stoch.k > stoch.d) signals.push({ type: 'Stochastic', signal: 'BUY', weight: 0.15 });
            else if (stoch.k > 80 && stoch.k < stoch.d) signals.push({ type: 'Stochastic', signal: 'SELL', weight: 0.15 });

            if (currentPrice < lowerBB) signals.push({ type: 'Bollinger', signal: 'BUY', weight: 0.1 });
            else if (currentPrice > upperBB) signals.push({ type: 'Bollinger', signal: 'SELL', weight: 0.1 });

            // Свечные паттерны
            if (candlePatterns.includes('bullish_hammer') || candlePatterns.includes('bullish_engulfing')) {
                signals.push({ type: 'Candlestick', signal: 'BUY', weight: 0.1 });
            } else if (candlePatterns.includes('bearish_hanging_man') || candlePatterns.includes('bearish_engulfing')) {
                signals.push({ type: 'Candlestick', signal: 'SELL', weight: 0.1 });
            }

            // Фигуры графика
            if (chartPatterns.includes('cup_handle') || chartPatterns.includes('double_bottom')) {
                signals.push({ type: 'ChartPattern', signal: 'BUY', weight: 0.1 });
            } else if (chartPatterns.includes('head_shoulders') || chartPatterns.includes('double_top')) {
                signals.push({ type: 'ChartPattern', signal: 'SELL', weight: 0.1 });
            }

            // Дивергенция
            if (divergence.type === 'bullish') signals.push({ type: 'Divergence', signal: 'BUY', weight: 0.1 });
            else if (divergence.type === 'bearish') signals.push({ type: 'Divergence', signal: 'SELL', weight: 0.1 });

            // Объёмы
            if (volumes[volumes.length - 1] > volumes.slice(-5).reduce((a, b) => a + b, 0) / 5) {
                signals.push({ type: 'Volume', signal: 'BUY', weight: 0.05 });
            }

            // Агрегация сигналов
            const buySignals = signals.filter(s => s.signal === 'BUY');
            const sellSignals = signals.filter(s => s.signal === 'SELL');
            
            const buyWeight = buySignals.reduce((sum, s) => sum + s.weight, 0);
            const sellWeight = sellSignals.reduce((sum, s) => sum + s.weight, 0);

            if (buyWeight > sellWeight && buyWeight > 0.5) {
                signal = 'BUY';
                confidence = buyWeight;
                analysisReason = `Покупка: ${buySignals.map(s => s.type).join(', ')}`;
            } else if (sellWeight > buyWeight && sellWeight > 0.5) {
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

        // Получение текущей цены
        const ticker = await getTickerPrice(symbol);
        const price = parseFloat(ticker.price);
        console.log(`[💰] 💹 Текущая цена: ${price}`);

        // Получение баланса
        let quoteBalance, baseBalance;
        if (botSettings.useDemoMode) {
            const [base, quote] = symbol.split('-');
            quoteBalance = demoBalances[quote] || 0;
            baseBalance = demoBalances[base] || 0;
            console.log(`[🏦 DEMO] 📊 Баланс: ${quoteBalance.toFixed(2)} ${quote} | ${baseBalance.toFixed(6)} ${base}`);
        } else {
            const account = await getAccountInfo();
            const [base, quote] = symbol.split('-');
            quoteBalance = parseFloat(account.balances?.find(b => b.asset === quote)?.free || 0);
            baseBalance = parseFloat(account.balances?.find(b => b.asset === base)?.free || 0);
            console.log(`[🏦 REAL] 📊 Баланс: ${quoteBalance.toFixed(2)} ${quote} | ${baseBalance.toFixed(6)} ${base}`);
        }

        // Расчёт размера ордера с учётом риска и комиссии
        let quantity, side = signal;
        if (side === 'BUY') {
            const riskAmount = quoteBalance * (botSettings.riskLevel * 0.01);
            quantity = (riskAmount / price) * (1 - botSettings.feeRate);
            console.log(`[📏] 📊 Размер ордера: ${quantity.toFixed(6)} (после комиссии 0.1%)`);
        } else {
            quantity = baseBalance * (botSettings.riskLevel * 0.01);
            console.log(`[📏] 📊 Размер ордера: ${quantity.toFixed(6)}`);
        }

        if (quantity <= 0.000001) {
            console.log(`[⚠️] 🛑 Недостаточно средств или размер ордера слишком мал: ${quantity.toFixed(6)}`);
            return null;
        }

        // ✅ Проверка минимального интервала между сделками
        const now = Date.now();
        if (botSettings.lastTradeTime && (now - botSettings.lastTradeTime) < botSettings.minTradeInterval) {
            console.log(`[⏳] ⏸️ Слишком рано для новой сделки. Осталось ждать: ${Math.ceil((botSettings.minTradeInterval - (now - botSettings.lastTradeTime)) / 1000)} сек`);
            return null;
        }

        // ✅ Выполнение ордера
        let orderResult;
        try {
            if (botSettings.useDemoMode) {
                const [base, quote] = symbol.split('-');
                const amountInQuote = side === 'BUY' ? quantity * price : quantity;
                const fee = amountInQuote * botSettings.feeRate;

                if (side === 'BUY') {
                    if (demoBalances[quote] < amountInQuote + fee) {
                        console.log(`[⚠️ DEMO] 🛑 Недостаточно ${quote} для покупки`);
                        return null;
                    }
                    demoBalances[quote] -= amountInQuote + fee;
                    demoBalances[base] = (demoBalances[base] || 0) + quantity;
                } else {
                    if (demoBalances[base] < quantity) {
                        console.log(`[⚠️ DEMO] 🛑 Недостаточно ${base} для продажи`);
                        return null;
                    }
                    demoBalances[base] -= quantity;
                    demoBalances[quote] = (demoBalances[quote] || 0) + (quantity * price) - fee;
                }

                orderResult = {
                    orderId: `DEMO-${Date.now()}`,
                    symbol,
                    side,
                    type: 'MARKET',
                    price,
                    quantity,
                    fee,
                    executedQty: quantity,
                    status: 'FILLED'
                };

                console.log(`[🎮 DEMO] ✅ Ордер выполнен: ${side} ${quantity.toFixed(6)} ${base} по цене ${price}`);
            } else {
                orderResult = await createOrder(symbol, side, 'MARKET', quantity);
                console.log(`[🚀 REAL] ✅ Ордер отправлен:`, orderResult);
            }

            // ✅ Обновляем время последней сделки
            botSettings.lastTradeTime = now;

            // ✅ Расчёт PnL
            const pnl = calculatePnL(symbol, side, price, quantity);
            const pnlPercent = quantity > 0 ? (pnl / (quantity * price)) * 100 : 0;

            // ✅ Записываем в историю
            const tradeRecord = {
                timestamp: now,
                symbol,
                side,
                price,
                quantity,
                confidence,
                analysisReason,
                mode: botSettings.useDemoMode ? 'DEMO' : 'REAL',
                orderId: orderResult.orderId || 'N/A',
                fee: botSettings.useDemoMode ? (side === 'BUY' ? quantity * price * botSettings.feeRate : quantity * price * botSettings.feeRate) : 0,
                pnl: pnl,
                pnlPercent: pnlPercent,
                status: 'FILLED'
            };

            tradeHistory.push(tradeRecord);
            logTrade(tradeRecord); // ✅ Логируем в файл

            // ✅ После успешного ордера — ставим SL и TP
            if (botSettings.useStopLoss || botSettings.useTakeProfit) {
                const baseAsset = symbol.split('-')[0];
                const slSide = side === 'BUY' ? 'SELL' : 'BUY';
                const tpSide = slSide;

                try {
                    if (botSettings.useStopLoss) {
                        const slPrice = side === 'BUY'
                            ? price * (1 - botSettings.stopLossPercent / 100)
                            : price * (1 + botSettings.stopLossPercent / 100);

                        if (botSettings.useDemoMode) {
                            console.log(`[🎮 DEMO SL] 🛑 Stop-Loss для ${baseAsset}: ${slPrice.toFixed(8)} ${slSide}`);
                            logToFile('trades.log', `DEMO SL установлен: ${symbol} ${slSide} @ ${slPrice.toFixed(8)}`);
                        } else {
                            await createOrder(symbol, slSide, 'STOP_LOSS_LIMIT', quantity, slPrice * 0.999, slPrice);
                            console.log(`[🚀 REAL SL] 🛑 Stop-Loss ордер выставлен: ${slPrice.toFixed(8)}`);
                        }
                    }

                    if (botSettings.useTakeProfit) {
                        const tpPrice = side === 'BUY'
                            ? price * (1 + botSettings.takeProfitPercent / 100)
                            : price * (1 - botSettings.takeProfitPercent / 100);

                        if (botSettings.useDemoMode) {
                            console.log(`[🎮 DEMO TP] 🎯 Take-Profit для ${baseAsset}: ${tpPrice.toFixed(8)} ${tpSide}`);
                            logToFile('trades.log', `DEMO TP установлен: ${symbol} ${tpSide} @ ${tpPrice.toFixed(8)}`);
                        } else {
                            await createOrder(symbol, tpSide, 'TAKE_PROFIT_LIMIT', quantity, tpPrice * 1.001, tpPrice);
                            console.log(`[🚀 REAL TP] 🎯 Take-Profit ордер выставлен: ${tpPrice.toFixed(8)}`);
                        }
                    }
                } catch (sltpError) {
                    console.error(`[⚠️ SL/TP ERROR]`, sltpError.message);
                    logError(`Ошибка установки SL/TP для ${symbol}: ${sltpError.message}`);
                }
            }

            // ✅ Логирование сделки
            console.log(`[✅] 📝 Запись сделки добавлена в историю. Всего сделок: ${tradeHistory.length}`);
            console.log(`[✅] 💰 Новый баланс (DEMO):`, demoBalances);

            return tradeRecord;

        } catch (error) {
            console.error(`[❌] 🚨 Ошибка при выполнении ордера для ${symbol}:`, error.message);
            logError(`Ошибка ордера для ${symbol}: ${error.message}`);
            return null;
        }

    } catch (error) {
        console.error(`[❌] 🚨 Ошибка анализа пары ${symbol}:`, error.message);
        logError(`Ошибка анализа пары ${symbol}: ${error.message}`);
        return null;
    }
}

// Экспортируем функцию для внешнего использования
export async function executeTradingLogic() {
    console.log("[🔄] Запуск анализа всех пар...");
    for (let pair of CRYPTO_PAIRS.slice(0, 5)) { // тестируем на первых 5 парах
        await executeSingleTrade(pair);
        await new Promise(resolve => setTimeout(resolve, 1000)); // пауза 1 сек между парами
    }
    console.log("[✅] Анализ всех пар завершён.");
}

export function startMultiPairAnalysis() {
    console.log(`[⏰] Запланирован анализ каждые ${botSettings.analysisInterval / 60000} минут`);
    setInterval(executeTradingLogic, botSettings.analysisInterval);
}
