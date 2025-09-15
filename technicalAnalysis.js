// technicalAnalysis.js

/**
 * Рассчитывает RSI (Relative Strength Index)
 */
export function calculateRSI(klines, period = 14) {
    if (!Array.isArray(klines) || klines.length < period + 1) {
        return { rsi: 50, signal: 'NEUTRAL' };
    }
    const closes = klines.map(candle => parseFloat(candle[4]));
    const changes = [];
    for (let i = 1; i < closes.length; i++) {
        changes.push(closes[i] - closes[i - 1]);
    }
    const gains = changes.slice(-period).filter(c => c > 0);
    const losses = changes.slice(-period).filter(c => c < 0).map(c => -c);
    const avgGain = gains.reduce((a, b) => a + b, 0) / period;
    const avgLoss = losses.reduce((a, b) => a + b, 0) / period;
    if (avgLoss === 0) return { rsi: 100, signal: 'OVERBOUGHT' };
    const rs = avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));
    let signal = 'NEUTRAL';
    if (rsi < 30) signal = 'BUY';
    else if (rsi > 70) signal = 'SELL';
    return { rsi, signal };
}

/**
 * Рассчитывает MACD
 */
export function calculateMACD(klines, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
    if (!Array.isArray(klines) || klines.length < slowPeriod + signalPeriod) {
        return { macd: 0, signal: 0, histogram: 0, action: 'NEUTRAL' };
    }
    const closes = klines.map(candle => parseFloat(candle[4]));
    const calculateEMA = (data, period) => {
        const multiplier = 2 / (period + 1);
        let ema = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
        for (let i = period; i < data.length; i++) {
            ema = (data[i] * multiplier) + (ema * (1 - multiplier));
        }
        return ema;
    };
    const fastEMA = calculateEMA(closes, fastPeriod);
    const slowEMA = calculateEMA(closes, slowPeriod);
    const macdLine = fastEMA - slowEMA;
    const signalLine = macdLine * 0.8; // Упрощённый расчёт
    const histogram = macdLine - signalLine;
    let action = 'NEUTRAL';
    if (macdLine > signalLine && histogram > 0) action = 'BUY';
    else if (macdLine < signalLine && histogram < 0) action = 'SELL';
    return { macd: macdLine, signal: signalLine, histogram, action };
}

/**
 * Рассчитывает стохастический осциллятор
 */
export function calculateStochastic(klines, kPeriod = 14, dPeriod = 3) {
    if (!Array.isArray(klines) || klines.length < kPeriod) {
        return { k: 50, d: 50, signal: 'NEUTRAL' };
    }
    const recentKlines = klines.slice(-kPeriod);
    const highestHigh = Math.max(...recentKlines.map(candle => parseFloat(candle[2])));
    const lowestLow = Math.min(...recentKlines.map(candle => parseFloat(candle[3])));
    const currentClose = parseFloat(klines[klines.length - 1][4]);
    if (highestHigh === lowestLow) return { k: 50, d: 50, signal: 'NEUTRAL' };
    const percentK = ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;
    const percentD = percentK; // Упрощение
    let signal = 'NEUTRAL';
    if (percentK < 20 && percentK > percentD) signal = 'BUY';
    else if (percentK > 80 && percentK < percentD) signal = 'SELL';
    return { k: percentK, d: percentD, signal };
}

/**
 * Рассчитывает полосы Боллинджера
 */
export function calculateBollingerBands(prices, period = 20, stdDev = 2) {
    if (prices.length < period) {
        return { middle: [], upper: [], lower: [] };
    }
    const middle = [];
    const upper = [];
    const lower = [];
    for (let i = period - 1; i < prices.length; i++) {
        const slice = prices.slice(i - period + 1, i + 1);
        const sum = slice.reduce((a, b) => a + b, 0);
        const sma = sum / period;
        const variance = slice.reduce((a, b) => a + Math.pow(b - sma, 2), 0) / period;
        const std = Math.sqrt(variance);
        middle.push(sma);
        upper.push(sma + (stdDev * std));
        lower.push(sma - (stdDev * std));
    }
    return { middle, upper, lower };
}

/**
 * Генерирует торговый сигнал (для совместимости)
 */
export function generateTradingSignal(klines, strategy = 'combo') {
    const rsi = calculateRSI(klines);
    const macd = calculateMACD(klines);
    const stoch = calculateStochastic(klines);
    
    let signal = 'NEUTRAL';
    let confidence = 0.3;
    
    if (strategy === 'combo') {
        const buyCount = [rsi.signal, macd.action, stoch.signal].filter(s => s === 'BUY').length;
        const sellCount = [rsi.signal, macd.action, stoch.signal].filter(s => s === 'SELL').length;
        if (buyCount >= 2) {
            signal = 'BUY';
            confidence = 0.7;
        } else if (sellCount >= 2) {
            signal = 'SELL';
            confidence = 0.7;
        }
    }
    
    return { signal, confidence, indicators: { rsi, macd, stoch } };
}
