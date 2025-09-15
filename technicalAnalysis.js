// technicalAnalysis.js — МИНИМАЛЬНАЯ РАБОЧАЯ ВЕРСИЯ
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
