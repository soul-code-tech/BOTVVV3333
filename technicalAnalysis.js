// technicalAnalysis.js

/**
 * Рассчитывает стохастический осциллятор (Stochastic Oscillator) на основе данных Kline.
 * @param {Array} klines - Массив свечей, полученный от API. Каждая свеча: [openTime, open, high, low, close, volume, ...]
 * @param {number} kPeriod - Период для %K (обычно 14).
 * @param {number} dPeriod - Период для %D (обычно 3).
 * @param {number} smoothK - Сглаживание %K (обычно 1 или 3).
 * @returns {Object} Объект с текущими значениями %K и %D.
 */
export function calculateStochastic(klines, kPeriod = 14, dPeriod = 3, smoothK = 1) {
    if (!Array.isArray(klines) || klines.length < kPeriod) {
        return { k: null, d: null, signal: 'INSUFFICIENT_DATA' };
    }

    // Берем последние N свечей для расчета
    const recentKlines = klines.slice(-kPeriod);
    
    // Находим highest high и lowest low за период
    const highestHigh = Math.max(...recentKlines.map(candle => parseFloat(candle[2]))); // high
    const lowestLow = Math.min(...recentKlines.map(candle => parseFloat(candle[3])));   // low
    const currentClose = parseFloat(klines[klines.length - 1][4]); // close последней свечи

    // Защита от деления на ноль
    if (highestHigh === lowestLow) {
        return { k: 50, d: 50, signal: 'NEUTRAL' }; // Нейтральный сигнал
    }

    // Рассчитываем %K
    let percentK = ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;

    // Применяем сглаживание %K (если smoothK > 1)
    if (smoothK > 1 && klines.length >= kPeriod + smoothK - 1) {
        const kValues = [];
        for (let i = 0; i < smoothK; i++) {
            const slice = klines.slice(-(kPeriod + i), -i || undefined);
            if (slice.length < kPeriod) break;
            const hh = Math.max(...slice.map(c => parseFloat(c[2])));
            const ll = Math.min(...slice.map(c => parseFloat(c[3])));
            const close = parseFloat(slice[slice.length - 1][4]);
            kValues.push(((close - ll) / (hh - ll)) * 100);
        }
        percentK = kValues.reduce((a, b) => a + b, 0) / kValues.length;
    }

    // Для %D нам нужно усреднить последние `dPeriod` значений %K.
    // В реальном боте вы должны хранить историю значений %K.
    // Для простоты примера, мы вернем %K как %D, если данных для усреднения нет.
    // В продакшене: сохраняйте массив последних значений %K и усредняйте их.
    const percentD = percentK; // Упрощение

    // Генерируем торговый сигнал
    let signal = 'NEUTRAL';
    if (percentK < 20 && percentK > percentD) {
        signal = 'BUY'; // Перепроданность + пересечение снизу вверх
    } else if (percentK > 80 && percentK < percentD) {
        signal = 'SELL'; // Перекупленность + пересечение сверху вниз
    }

    return {
        k: parseFloat(percentK.toFixed(2)),
        d: parseFloat(percentD.toFixed(2)),
        signal: signal
    };
}

/**
 * Рассчитывает RSI (Relative Strength Index)
 * @param {Array} klines - Массив свечей
 * @param {number} period - Период RSI (обычно 14)
 * @returns {Object} { rsi: number, signal: string }
 */
export function calculateRSI(klines, period = 14) {
    if (!Array.isArray(klines) || klines.length < period + 1) {
        return { rsi: null, signal: 'INSUFFICIENT_DATA' };
    }

    const closes = klines.map(candle => parseFloat(candle[4])); // close цены
    const changes = [];
    for (let i = 1; i < closes.length; i++) {
        changes.push(closes[i] - closes[i - 1]);
    }

    const gains = changes.slice(-period).filter(c => c > 0);
    const losses = changes.slice(-period).filter(c => c < 0).map(c => -c);

    const avgGain = gains.reduce((a, b) => a + b, 0) / period;
    const avgLoss = losses.reduce((a, b) => a + b, 0) / period;

    if (avgLoss === 0) {
        return { rsi: 100, signal: 'OVERBOUGHT' };
    }

    const rs = avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));

    let signal = 'NEUTRAL';
    if (rsi < 30) signal = 'BUY';
    else if (rsi > 70) signal = 'SELL';

    return {
        rsi: parseFloat(rsi.toFixed(2)),
        signal: signal
    };
}

/**
 * Рассчитывает простую скользящую среднюю (SMA)
 * @param {Array} klines - Массив свечей
 * @param {number} period - Период SMA
 * @returns {number} Значение SMA
 */
export function calculateSMA(klines, period) {
    if (!Array.isArray(klines) || klines.length < period) {
        return null;
    }
    const closes = klines.slice(-period).map(candle => parseFloat(candle[4]));
    const sum = closes.reduce((a, b) => a + b, 0);
    return parseFloat((sum / period).toFixed(8));
}

/**
 * Рассчитывает экспоненциальную скользящую среднюю (EMA)
 * @param {Array} klines - Массив свечей
 * @param {number} period - Период EMA
 * @returns {number} Значение EMA
 */
export function calculateEMA(klines, period) {
    if (!Array.isArray(klines) || klines.length < period) {
        return null;
    }
    const closes = klines.map(candle => parseFloat(candle[4]));
    const multiplier = 2 / (period + 1);
    let ema = calculateSMA(klines.slice(0, period), period); // Начинаем с SMA

    for (let i = period; i < closes.length; i++) {
        ema = (closes[i] * multiplier) + (ema * (1 - multiplier));
    }

    return parseFloat(ema.toFixed(8));
}

/**
 * Рассчитывает MACD
 * @param {Array} klines - Массив свечей
 * @param {number} fastPeriod - Быстрый период (обычно 12)
 * @param {number} slowPeriod - Медленный период (обычно 26)
 * @param {number} signalPeriod - Период сигнальной линии (обычно 9)
 * @returns {Object} { macd: number, signal: number, histogram: number, action: string }
 */
export function calculateMACD(klines, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
    if (!Array.isArray(klines) || klines.length < slowPeriod + signalPeriod) {
        return { macd: null, signal: null, histogram: null, action: 'INSUFFICIENT_DATA' };
    }

    const fastEMA = calculateEMA(klines, fastPeriod);
    const slowEMA = calculateEMA(klines, slowPeriod);
    const macdLine = fastEMA - slowEMA;

    // Рассчитываем сигнальную линию (EMA от MACD)
    const macdHistory = [];
    for (let i = slowPeriod; i <= klines.length; i++) {
        const slice = klines.slice(0, i);
        const f = calculateEMA(slice, fastPeriod);
        const s = calculateEMA(slice, slowPeriod);
        macdHistory.push(f - s);
    }
    const signalLine = calculateEMA(macdHistory.slice(-signalPeriod), signalPeriod);
    const histogram = macdLine - signalLine;

    let action = 'NEUTRAL';
    if (macdLine > signalLine && histogram > 0) {
        action = 'BUY';
    } else if (macdLine < signalLine && histogram < 0) {
        action = 'SELL';
    }

    return {
        macd: parseFloat(macdLine.toFixed(8)),
        signal: parseFloat(signalLine.toFixed(8)),
        histogram: parseFloat(histogram.toFixed(8)),
        action: action
    };
}

/**
 * Комплексный анализ: объединяет несколько индикаторов для генерации сигнала
 * @param {Array} klines - Массив свечей
 * @param {string} strategy - Стратегия: 'stochastic', 'rsi', 'macd', 'combo'
 * @returns {Object} { signal: 'BUY' | 'SELL' | 'NEUTRAL', confidence: number, indicators: {} }
 */
export function generateTradingSignal(klines, strategy = 'stochastic') {
    let signal = 'NEUTRAL';
    let confidence = 0;
    const indicators = {};

    switch (strategy) {
        case 'stochastic':
            const stoch = calculateStochastic(klines);
            indicators.stochastic = stoch;
            signal = stoch.signal;
            confidence = signal !== 'NEUTRAL' ? 0.7 : 0.3;
            break;

        case 'rsi':
            const rsi = calculateRSI(klines);
            indicators.rsi = rsi;
            signal = rsi.signal;
            confidence = signal !== 'NEUTRAL' ? 0.6 : 0.4;
            break;

        case 'macd':
            const macd = calculateMACD(klines);
            indicators.macd = macd;
            signal = macd.action;
            confidence = signal !== 'NEUTRAL' ? 0.65 : 0.35;
            break;

        case 'combo':
            const stochCombo = calculateStochastic(klines);
            const rsiCombo = calculateRSI(klines);
            const macdCombo = calculateMACD(klines);

            indicators.stochastic = stochCombo;
            indicators.rsi = rsiCombo;
            indicators.macd = macdCombo;

            // Простая логика консенсуса: если 2 из 3 индикаторов дают одинаковый сигнал — действуем
            const signals = [stochCombo.signal, rsiCombo.signal, macdCombo.action].filter(s => s !== 'NEUTRAL');
            const buyCount = signals.filter(s => s === 'BUY').length;
            const sellCount = signals.filter(s => s === 'SELL').length;

            if (buyCount >= 2) {
                signal = 'BUY';
                confidence = 0.9;
            } else if (sellCount >= 2) {
                signal = 'SELL';
                confidence = 0.9;
            } else {
                signal = 'NEUTRAL';
                confidence = 0.2;
            }
            break;

        default:
            signal = 'NEUTRAL';
            confidence = 0.1;
    }

    return {
        signal,
        confidence,
        indicators
    };
}
