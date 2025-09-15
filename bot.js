// bot.js
import { getKlines, getTickerPrice, getAccountInfo } from './bingxApi.js';
import { generateTradingSignal } from './technicalAnalysis.js';

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

let botSettings = {
    tradingPair: 'BTC-USDT',
    strategy: 'stochastic',
    riskLevel: 5,
    maxPositionSize: 100,
    isEnabled: true,
    scanAllPairs: true,
    analysisInterval: 300000,
    lastAnalysisTime: null,
    feeRate: 0.001,
    minTradeInterval: 300000
};

let tradeHistory = [];

export function updateBotSettings(newSettings) {
    botSettings = { ...botSettings, ...newSettings };
    console.log(`[BOT] 🔄 Настройки обновлены:`, botSettings);
}

export function getBotStatus() {
    return {
        settings: { ...botSettings },
        lastAnalysisTime: botSettings.lastAnalysisTime,
        tradeHistory: [...tradeHistory]
    };
}

export async function executeTradingLogic(symbol = botSettings.tradingPair) {
    console.log(`\n[🔍 ${new Date().toISOString()}] === 🤖 НАЧИНАЕМ АНАЛИЗ ПАРЫ: ${symbol} ===`);
    
    try {
        // Проверка интервала между сделками
        if (botSettings.lastTradeTime && Date.now() - botSettings.lastTradeTime < botSettings.minTradeInterval) {
            const waitMinutes = Math.ceil((botSettings.minTradeInterval - (Date.now() - botSettings.lastTradeTime)) / 60000);
            console.log(`[⏳] ⏸️  Слишком рано для новой сделки. Ждём ещё ${waitMinutes} минут.`);
            return null;
        }

        // Получение данных Kline
        console.log(`[📊] 📈 Запрашиваем данные Kline для ${symbol}...`);
        const klines = await getKlines(symbol, '5m', 100);
        if (!klines || klines.length < 14) {
            console.log(`[⚠️] 📉 Недостаточно данных для анализа ${symbol} (требуется минимум 14 свечей, получено: ${klines?.length || 0})`);
            return null;
        }
        console.log(`[✅] 📊 Получено ${klines.length} свечей для анализа`);

        // Генерация торгового сигнала
        console.log(`[🧠] 🧠 Генерируем торговый сигнал по стратегии: ${botSettings.strategy}`);
        const signalData = generateTradingSignal(klines, botSettings.strategy);
        console.log(`[🎯] 📊 Сигнал: ${signalData.signal} | Уверенность: ${signalData.confidence.toFixed(2)}`);

        // Проверка силы сигнала
        if (signalData.signal === 'NEUTRAL' || signalData.confidence < 0.5) {
            console.log(`[💤] 🛑 Нет сильного торгового сигнала. Пропускаем пару ${symbol}.`);
            return null;
        }

        // Получение текущей цены
        console.log(`[💰] 💹 Запрашиваем текущую цену для ${symbol}...`);
        const ticker = await getTickerPrice(symbol);
        const currentPrice = parseFloat(ticker.price);
        console.log(`[✅] 💰 Текущая цена: ${currentPrice}`);

        // Получение баланса
        console.log(`[🏦] 📊 Запрашиваем баланс для ${symbol}...`);
        const account = await getAccountInfo();
        const [base, quote] = symbol.split('-');
        const quoteBalance = parseFloat(account.balances?.find(b => b.asset === quote)?.free || 0);
        const baseBalance = parseFloat(account.balances?.find(b => b.asset === base)?.free || 0);
        console.log(`[✅] 🏦 Баланс: ${quoteBalance.toFixed(2)} ${quote} | ${baseBalance.toFixed(6)} ${base}`);

        let side, quantity, totalPrice;
        if (signalData.signal === 'BUY') {
            // Расчёт размера ордера на покупку
            const riskAmount = quoteBalance * (botSettings.riskLevel * 0.01);
            console.log(`[📏] 📊 Риск: ${botSettings.riskLevel}% от баланса = ${riskAmount.toFixed(2)} ${quote}`);
            quantity = (riskAmount / currentPrice) * (1 - botSettings.feeRate); // Учёт комиссии 0.1%
            console.log(`[📏] 📊 Размер ордера до комиссии: ${(riskAmount / currentPrice).toFixed(6)} ${base}`);
            console.log(`[💰] 💹 Размер ордера после комиссии 0.1%: ${quantity.toFixed(6)} ${base}`);
            side = 'BUY';
            totalPrice = quantity * currentPrice;
            
            // Проверка лимита позиции
            if (totalPrice > botSettings.maxPositionSize) {
                quantity = (botSettings.maxPositionSize / currentPrice) * (1 - botSettings.feeRate);
                console.log(`[📏] 📊 Превышен лимит позиции (${botSettings.maxPositionSize} USDT), уменьшаем размер ордера до ${quantity.toFixed(6)} ${base}`);
            }
        } else {
            // Расчёт размера ордера на продажу
            quantity = baseBalance * (botSettings.riskLevel * 0.01);
            console.log(`[📏] 📊 Продаём ${botSettings.riskLevel}% от баланса = ${quantity.toFixed(6)} ${base}`);
            side = 'SELL';
            totalPrice = quantity * currentPrice;
        }

        // Проверка минимального размера ордера
        if (quantity <= 0.000001) {
            console.log(`[⚠️] 🛑 Недостаточно баланса для сделки (quantity: ${quantity}). Пропускаем.`);
            return null;
        }

        console.log(`[🚀] 💹 Сигнал: ${side} ${quantity.toFixed(6)} ${base} по цене ${currentPrice}`);

        // !!! ЗАКОММЕНТИРОВАНО ДЛЯ БЕЗОПАСНОСТИ !!!
        // const order = await createOrder(symbol, side, 'LIMIT', quantity.toFixed(6), currentPrice.toFixed(8));
        // console.log(`[✅] 💹 Ордер размещен:`, order);

        // Заглушка: имитация ордера
        const mockOrder = {
            orderId: `mock-${Date.now()}`,
            symbol,
            side,
            type: 'LIMIT',
            quantity: quantity.toFixed(6),
            price: currentPrice.toFixed(8),
            status: 'FILLED',
            time: Date.now()
        };

        // Сохраняем в историю
        tradeHistory.push({
            ...mockOrder,
            signal: signalData.signal,
            confidence: signalData.confidence,
            indicators: signalData.indicators,
            timestamp: new Date().toISOString()
        });

        if (tradeHistory.length > 100) tradeHistory = tradeHistory.slice(-100);

        botSettings.lastTradeTime = Date.now();
        botSettings.lastSignal = signalData.signal;

        console.log(`[🎯] 💹 СДЕЛКА ВЫПОЛНЕНА: ${side} ${quantity.toFixed(6)} ${base} по цене ${currentPrice}`);
        return mockOrder;

    } catch (error) {
        console.error(`[❌] ❗️ Ошибка при анализе ${symbol}:`, error.message);
        
        // Самодиагностика по кодам ошибок BingX
        if (error.message.includes('BingX API Error')) {
            const match = error.message.match(/\[(\d+)\]/);
            if (match) handleBotError(parseInt(match[1]), symbol);
        }
        
        return null;
    }
}

export async function startMultiPairAnalysis() {
    console.log(`[🤖] 🤖 Бот инициализирован. Анализ ${botSettings.scanAllPairs ? 'всех ' + CRYPTO_PAIRS.length + ' пар' : 'выбранной пары ' + botSettings.tradingPair}`);

    setInterval(async () => {
        if (!botSettings.isEnabled) {
            console.log("[⏸️] ⏸️  Бот приостановлен");
            return;
        }

        if (botSettings.scanAllPairs) {
            console.log(`\n[🔄 ${new Date().toISOString()}] === 🔄 НАЧИНАЕМ СКАНИРОВАНИЕ ВСЕХ ${CRYPTO_PAIRS.length} ПАР ===`);
            for (const pair of CRYPTO_PAIRS) {
                await executeTradingLogic(pair);
                await new Promise(resolve => setTimeout(resolve, 1000)); // Задержка 1 сек между парами
            }
            console.log(`[✅] ✅ Сканирование всех пар завершено`);
        } else {
            await executeTradingLogic(botSettings.tradingPair);
        }

    }, botSettings.analysisInterval);
}

function handleBotError(errorCode, symbol) {
    console.log(`[🛠️] 🛠️  Самодиагностика для ошибки ${errorCode} на паре ${symbol}`);
    
    const actions = {
        100001: () => console.error("[🔐] ❗️ Ошибка подписи. Проверьте SECRET_KEY и алгоритм генерации."),
        100419: () => console.error("[🌐] ❗️ IP не в белом списке. Добавьте IP Render в BingX API Management."),
        101204: () => console.warn("[💰] ⚠️ Недостаточно средств для открытия позиции."),
        429: () => {
            console.warn("[⏱️] ⚠️ Слишком много запросов. Приостанавливаем торговлю на 1 минуту.");
            botSettings.isEnabled = false;
            setTimeout(() => { 
                botSettings.isEnabled = true; 
                console.log("[✅] ✅ Торговля возобновлена"); 
            }, 60000);
        },
        100410: () => {
            console.warn("[⏱️] ⚠️ Превышен лимит частоты запросов. Пауза 5 минут.");
            botSettings.isEnabled = false;
            setTimeout(() => { 
                botSettings.isEnabled = true; 
                console.log("[✅] ✅ Торговля возобновлена"); 
            }, 300000);
        },
        101212: () => console.warn("[📋] ⚠️ Есть активные ордера. Отмените их вручную."),
        101414: () => console.warn("[📈] ⚠️ Превышено максимальное плечо."),
        101514: () => {
            console.warn("[⛔] ⚠️ Временная блокировка открытия позиций. Пауза 10 минут.");
            botSettings.isEnabled = false;
            setTimeout(() => { 
                botSettings.isEnabled = true; 
                console.log("[✅] ✅ Торговля возобновлена"); 
            }, 600000);
        }
    };

    if (actions[errorCode]) {
        actions[errorCode]();
    } else {
        console.warn(`[❓] ❓ Неизвестная ошибка ${errorCode}. Требуется ручная проверка.`);
    }
}

// Запускаем сразу после инициализации
setTimeout(() => {
    console.log("[🤖] 🤖 Бот полностью инициализирован и готов к анализу!");
    startMultiPairAnalysis();
}, 5000);
