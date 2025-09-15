// technicalAnalysis.js — ПОЛНЫЙ НАБОР ИНДИКАТОРОВ

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
 * Рассчитывает экспоненциальную скользящую среднюю (EMA)
 */
export function calculateEMA(prices, period) {
    if (!Array.isArray(prices) || prices.length < period) {
        return 0;
    }
    const multiplier = 2 / (period + 1);
    let ema = prices.slice(0, period).reduce((sum, price) => sum + price, 0) / period;
    for (let i = period; i < prices.length; i++) {
        ema = (prices[i] * multiplier) + (ema * (1 - multiplier));
    }
    return ema;
}

/**
 * Рассчитывает простую скользящую среднюю (SMA)
 */
export function calculateSMA(prices, period) {
    if (!Array.isArray(prices) || prices.length < period) {
        return 0;
    }
    const slice = prices.slice(-period);
    return slice.reduce((sum, price) => sum + price, 0) / period;
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
 * Распознаёт свечные паттерны
 */
export function detectCandlestickPatterns(klines) {
    if (klines.length < 3) return [];
    const patterns = [];
    const closes = klines.map(c => parseFloat(c[4]));
    const opens = klines.map(c => parseFloat(c[1]));
    const highs = klines.map(c => parseFloat(c[2]));
    const lows = klines.map(c => parseFloat(c[3]));

    // Bullish Hammer (молот)
    const isBullishHammer = (i) => {
        const body = Math.abs(closes[i] - opens[i]);
        const totalRange = highs[i] - lows[i];
        const lowerShadow = opens[i] > closes[i] ? opens[i] - lows[i] : closes[i] - lows[i];
        return lowerShadow > 2 * body && (highs[i] - Math.max(opens[i], closes[i])) < body;
    };

    // Bearish Hanging Man (повешенный)
    const isBearishHangingMan = (i) => {
        const body = Math.abs(closes[i] - opens[i]);
        const totalRange = highs[i] - lows[i];
        const lowerShadow = opens[i] < closes[i] ? closes[i] - lows[i] : opens[i] - lows[i];
        return lowerShadow > 2 * body && (highs[i] - Math.max(opens[i], closes[i])) < body;
    };

    // Bullish Engulfing (поглощение)
    const isBullishEngulfing = (i) => {
        if (i < 1) return false;
        return closes[i-1] < opens[i-1] && closes[i] > opens[i] && opens[i] < closes[i-1] && closes[i] > opens[i-1];
    };

    // Bearish Engulfing
    const isBearishEngulfing = (i) => {
        if (i < 1) return false;
        return closes[i-1] > opens[i-1] && closes[i] < opens[i] && opens[i] > closes[i-1] && closes[i] < opens[i-1];
    };

    const lastIndex = klines.length - 1;

    if (isBullishHammer(lastIndex)) patterns.push('bullish_hammer');
    if (isBearishHangingMan(lastIndex)) patterns.push('bearish_hanging_man');
    if (isBullishEngulfing(lastIndex)) patterns.push('bullish_engulfing');
    if (isBearishEngulfing(lastIndex)) patterns.push('bearish_engulfing');

    return patterns;
}

/**
 * Распознаёт фигуры графика (очень упрощённо)
 */
export function detectChartPatterns(klines) {
    if (klines.length < 10) return [];
    const patterns = [];
    const closes = klines.map(c => parseFloat(c[4]));

    // Double Bottom (двойное дно) — упрощённо
    if (closes.length >= 5) {
        const recent = closes.slice(-5);
        if (recent[0] > recent[1] && recent[1] < recent[2] && recent[2] > recent[3] && recent[3] < recent[4] && Math.abs(recent[1] - recent[3]) < recent[1] * 0.02) {
            patterns.push('double_bottom');
        }
    }

    // Double Top (двойная вершина)
    if (closes.length >= 5) {
        const recent = closes.slice(-5);
        if (recent[0] < recent[1] && recent[1] > recent[2] && recent[2] < recent[3] && recent[3] > recent[4] && Math.abs(recent[1] - recent[3]) < recent[1] * 0.02) {
            patterns.push('double_top');
        }
    }

    // Head and Shoulders (голова и плечи) — очень упрощённо
    if (closes.length >= 7) {
        const recent = closes.slice(-7);
        if (recent[1] < recent[2] && recent[2] > recent[3] && recent[3] < recent[4] && recent[4] > recent[5] && recent[5] < recent[6] && recent[2] < recent[4] && recent[6] < recent[4]) {
            patterns.push('head_shoulders');
        }
    }

    return patterns;
}

/**
 * Обнаруживает дивергенцию между ценой и RSI
 */
export function detectDivergence(prices, rsiValues, volumes) {
    if (prices.length < 5 || rsiValues.length < 5) {
        return { type: 'none', strength: 0 };
    }

    const recentPrices = prices.slice(-5);
    const recentRSI = rsiValues.slice(-5);

    // Bullish Divergence: цена ↓, RSI ↑
    if (recentPrices[0] > recentPrices[4] && recentRSI[0] < recentRSI[4]) {
        const priceChange = (recentPrices[0] - recentPrices[4]) / recentPrices[0];
        const rsiChange = (recentRSI[4] - recentRSI[0]) / recentRSI[0];
        return { type: 'bullish', strength: Math.abs(priceChange) + Math.abs(rsiChange) };
    }

    // Bearish Divergence: цена ↑, RSI ↓
    if (recentPrices[0] < recentPrices[4] && recentRSI[0] > recentRSI[4]) {
        const priceChange = (recentPrices[4] - recentPrices[0]) / recentPrices[0];
        const rsiChange = (recentRSI[0] - recentRSI[4]) / recentRSI[0];
        return { type: 'bearish', strength: Math.abs(priceChange) + Math.abs(rsiChange) };
    }

    return { type: 'none', strength: 0 };
}

/**
 * Рассчитывает профиль объёмов (упрощённо — поддержка/сопротивление по объёмам)
 */
export function calculateVolumeProfile(klines, zones = 10) {
    if (klines.length < 2) {
        const price = parseFloat(klines[0][4]);
        return { support: price * 0.99, resistance: price * 1.01 };
    }

    const prices = klines.map(c => parseFloat(c[4]));
    const volumes = klines.map(c => parseFloat(c[5]));
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const step = (maxPrice - minPrice) / zones;

    const volumeZones = Array(zones).fill(0);
    const zoneLevels = Array(zones).fill(0).map((_, i) => minPrice + i * step);

    for (let i = 0; i < prices.length; i++) {
        const price = prices[i];
        const vol = volumes[i];
        const zoneIndex = Math.min(Math.floor((price - minPrice) / step), zones - 1);
        volumeZones[zoneIndex] += vol;
    }

    // Находим зоны с максимальным объёмом
    const sortedZones = volumeZones
        .map((vol, i) => ({ volume: vol, level: zoneLevels[i] }))
        .sort((a, b) => b.volume - a.volume);

    const support = sortedZones.length > 1 ? sortedZones[1].level : minPrice;
    const resistance = sortedZones[0].level;

    return { support, resistance };
}

/**
 * Упрощённый MIDAS (Market Interpretation/Data Analysis System)
 * Использует объёмы для поиска ключевых уровней поддержки/сопротивления
 */
export function calculateMIDAS(prices, volumes) {
    if (prices.length < 5) {
        const current = prices[prices.length - 1];
        return { support: current * 0.98, resistance: current * 1.02 };
    }

    // Веса на основе объёмов
    const weightedSum = prices.reduce((sum, price, i) => sum + price * volumes[i], 0);
    const totalVolume = volumes.reduce((sum, vol) => sum + vol, 0);
    const vwap = weightedSum / totalVolume;

    // Упрощённый расчёт уровней
    const recentVolatility = prices.slice(-5).reduce((maxDiff, price, i, arr) => {
        if (i === 0) return 0;
        return Math.max(maxDiff, Math.abs(price - arr[i-1]));
    }, 0);

    return {
        support: vwap - recentVolatility,
        resistance: vwap + recentVolatility
    };
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
