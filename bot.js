// bot.js
import { getKlines, getTickerPrice, getAccountInfo, callBingxApi } from './bingxApi.js';
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
    "POWR-USDT", "PYR-USDT", "QI-USDT", "QTUM-USDT", "RAD-USDT", "REEF-USDT", "REN-USDT", "REQ-US", "RLC-USDT", "RSR-USDT",
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
    scanAllPairs: false, // true = сканировать все 200+ пар, false = только выбранную
    analysisInterval: 300000, // 5 минут
    lastAnalysisTime: null,
    feeRate: 0.001
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
    console.log(`\n[🔍] Начинаем анализ пары: ${symbol}`);
    
    try {
        const klines = await getKlines(symbol, '5m', 100);
        if (!klines || klines.length < 14) {
            console.log(`[⚠️] Недостаточно данных для ${symbol}`);
            return null;
        }

        const signalData = generateTradingSignal(klines, botSettings.strategy);
        console.log(`[📊] ${symbol} — Сигнал: ${signalData.signal} | Уверенность: ${signalData.confidence.toFixed(2)}`);

        if (signalData.signal === 'NEUTRAL' || signalData.confidence < 0.5) {
            console.log(`[💤] ${symbol} — Нет сильного сигнала, пропускаем`);
            return null;
        }

        const ticker = await getTickerPrice(symbol);
        const currentPrice = parseFloat(ticker.price);
        console.log(`[💰] ${symbol} — Текущая цена: ${currentPrice}`);

        const account = await getAccountInfo();
        const [base, quote] = symbol.split('-');
        const quoteBalance = parseFloat(account.balances?.find(b => b.asset === quote)?.free || 0);
        const baseBalance = parseFloat(account.balances?.find(b => b.asset === base)?.free || 0);

        let side, quantity, totalPrice;
        if (signalData.signal === 'BUY') {
            const riskAmount = quoteBalance * (botSettings.riskLevel * 0.01);
            quantity = (riskAmount / currentPrice) * (1 - botSettings.feeRate);
            side = 'BUY';
            totalPrice = quantity * currentPrice;
            if (totalPrice > botSettings.maxPositionSize) {
                quantity = (botSettings.maxPositionSize / currentPrice) * (1 - botSettings.feeRate);
                console.log(`[📏] ${symbol} — Превышен лимит позиции, уменьшаем до ${botSettings.maxPositionSize} USDT`);
            }
        } else {
            quantity = baseBalance * (botSettings.riskLevel * 0.01);
            side = 'SELL';
            totalPrice = quantity * currentPrice;
        }

        if (quantity <= 0.000001) {
            console.log(`[⚠️] ${symbol} — Недостаточно баланса для сделки`);
            return null;
        }

        console.log(`[🚀] ${symbol} — Сигнал: ${side} ${quantity.toFixed(6)} по цене ${currentPrice}`);

        // !!! ЗАКОММЕНТИРОВАНО ДЛЯ БЕЗОПАСНОСТИ !!!
        // const order = await createOrder(symbol, side, 'LIMIT', quantity.toFixed(6), currentPrice.toFixed(8));
        // console.log(`[✅] ${symbol} — Ордер размещен:`, order);

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

        tradeHistory.push({
            ...mockOrder,
            signal: signalData.signal,
            confidence: signalData.confidence,
            indicators: signalData.indicators
        });

        if (tradeHistory.length > 100) tradeHistory = tradeHistory.slice(-100);

        botSettings.lastAnalysisTime = Date.now();

        return mockOrder;

    } catch (error) {
        console.error(`[❌] Ошибка при анализе ${symbol}:`, error.message);
        if (error.message.includes('BingX API Error')) {
            const match = error.message.match(/\[(\d+)\]/);
            if (match) handleBotError(parseInt(match[1]), symbol);
        }
        return null;
    }
}

export async function startMultiPairAnalysis() {
    console.log(`[🤖] Запуск анализа ${botSettings.scanAllPairs ? 'всех пар' : 'выбранной пары'}`);

    setInterval(async () => {
        if (!botSettings.isEnabled) {
            console.log("[⏸️] Бот приостановлен");
            return;
        }

        if (botSettings.scanAllPairs) {
            console.log(`\n[🔄] Сканируем все ${CRYPTO_PAIRS.length} пар...`);
            for (const pair of CRYPTO_PAIRS) {
                await executeTradingLogic(pair);
                await new Promise(resolve => setTimeout(resolve, 1000)); // Задержка 1 сек между парами
            }
            console.log(`[✅] Сканирование всех пар завершено`);
        } else {
            await executeTradingLogic(botSettings.tradingPair);
        }

    }, botSettings.analysisInterval);
}

function handleBotError(errorCode, symbol) {
    const actions = {
        100001: () => console.error("[🔐] Ошибка подписи. Проверьте SECRET_KEY"),
        100419: () => console.error("[🌐] IP не в белом списке. Добавьте IP Render в BingX"),
        101204: () => console.warn("[💰] Недостаточно средств для открытия позиции"),
        429: () => {
            console.warn("[⏱️] Слишком много запросов. Пауза 1 мин");
            botSettings.isEnabled = false;
            setTimeout(() => { botSettings.isEnabled = true; console.log("[✅] Торговля возобновлена"); }, 60000);
        },
        100410: () => {
            console.warn("[⏱️] Превышен лимит частоты. Пауза 5 мин");
            botSettings.isEnabled = false;
            setTimeout(() => { botSettings.isEnabled = true; console.log("[✅] Торговля возобновлена"); }, 300000);
        },
        101212: () => console.warn("[📋] Есть активные ордера. Отмените их вручную"),
        101414: () => console.warn("[📈] Превышено максимальное плечо"),
        101514: () => {
            console.warn("[⛔] Временная блокировка открытия позиций. Пауза 10 мин");
            botSettings.isEnabled = false;
            setTimeout(() => { botSettings.isEnabled = true; console.log("[✅] Торговля возобновлена"); }, 600000);
        }
    };

    if (actions[errorCode]) {
        console.log(`[🛠️] Самодиагностика для ошибки ${errorCode} на паре ${symbol}`);
        actions[errorCode]();
    } else {
        console.warn(`[❓] Неизвестная ошибка ${errorCode} на паре ${symbol}`);
    }
}

// Запускаем сразу
setTimeout(() => {
    console.log("[🤖] Бот инициализирован и готов к анализу!");
    startMultiPairAnalysis();
}, 5000);
