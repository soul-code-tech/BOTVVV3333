// bingxApi.js
import CryptoJS from 'crypto-js';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const HOST = "open-api.bingx.com";
const PROTOCOL = "https";

// Загружаем ключи из переменных окружения
const API_KEY = process.env.BINGX_API_KEY;
const SECRET_KEY = process.env.BINGX_SECRET_KEY;

if (!API_KEY || !SECRET_KEY) {
    throw new Error("API keys are not configured in environment variables");
}

/**
 * Функция для генерации параметров запроса и подписи.
 * @param {Object} payload - Тело запроса (параметры).
 * @param {boolean} urlEncode - Нужно ли URL-кодировать значения (для GET).
 * @returns {Object} Объект с параметрами и подписью.
 */
function generateSignature(payload, urlEncode = true) {
    const timestamp = Date.now();
    let parameters = "";

    // Формируем строку параметров
    for (const key in payload) {
        if (urlEncode && key !== 'timestamp') { // timestamp не кодируется
            parameters += `${key}=${encodeURIComponent(payload[key])}&`;
        } else {
            parameters += `${key}=${payload[key]}&`;
        }
    }

    // Добавляем timestamp, если он не был в payload
    if (!payload.timestamp) {
        parameters += `timestamp=${timestamp}`;
    } else {
        parameters = parameters.slice(0, -1); // Убираем последний '&'
    }

    // Генерируем подпись HMAC SHA256
    const signature = CryptoJS.HmacSHA256(parameters, SECRET_KEY).toString(CryptoJS.enc.Hex);

    return {
        parameters,
        signature,
        timestamp
    };
}

/**
 * Универсальная функция для выполнения запросов к API BingX.
 * @param {string} path - Путь к эндпоинту API.
 * @param {string} method - HTTP метод ('GET', 'POST', 'DELETE').
 * @param {Object} payload - Параметры запроса.
 * @returns {Promise<Object>} Ответ от API.
 */
export async function callBingxApi(path, method = 'GET', payload = {}) {
    try {
        // Генерируем подпись и параметры
        const { parameters, signature } = generateSignature(payload, method === 'GET');

        let url;
        if (method === 'GET') {
            // Для GET-запросов параметры идут в query string
            url = `${PROTOCOL}://${HOST}${path}?${parameters}&signature=${signature}`;
        }

        const config = {
            method: method,
            url: url,
            headers: {
                'X-BX-APIKEY': API_KEY,
            },
            // Для POST-запросов параметры и подпись идут в теле
            ...(method !== 'GET' && {
                data: {
                    ...payload,
                    signature: signature
                }
            })
        };

        const response = await axios(config);

        // Проверяем успешность запроса по коду BingX
        if (response.data.code !== 0) {
            throw new Error(`BingX API Error [${response.data.code}]: ${response.data.msg}`);
        }

        return response.data.data; // Возвращаем только полезные данные
    } catch (error) {
        // Централизованная обработка ошибок
        console.error(`API Request Failed for ${path}:`, error.message);

        // Самодиагностика: логируем коды ошибок для последующего анализа
        if (error.response && error.response.data) {
            const errorCode = error.response.data.code;
            handleBingxErrorCode(errorCode);
        }

        throw error; // Пробрасываем ошибку дальше для обработки в логике бота
    }
}

/**
 * Функция для обработки распространенных кодов ошибок BingX.
 * Может быть расширена для автоматического восстановления или уведомлений.
 * @param {number} code - Код ошибки от BingX.
 */
function handleBingxErrorCode(code) {
    const errorMap = {
        100001: "Ошибка подписи. Проверьте SECRET_KEY и алгоритм генерации.",
        100500: "Внутренняя ошибка сервера BingX. Повторите запрос позже.",
        429: "Слишком много запросов. Снизьте частоту запросов.",
        101204: "Недостаточно маржины для открытия позиции.",
        80016: "Ордер не существует. Возможно, он был исполнен или отменен.",
        100419: "IP не в белом списке. Проверьте настройки API ключа на сайте BingX.",
        100410: "Превышено ограничение по частоте запросов. Подождите 5 минут.",
        101212: "Есть активные ордера. Отмените их перед новой попыткой.",
        101414: "Превышено максимальное плечо. Уменьшите плечо.",
        101514: "Вы временно заблокированы для открытия позиций. Попробуйте позже."
    };

    if (errorMap[code]) {
        console.warn(`[SELF-DIAGNOSTIC] BingX Error ${code}: ${errorMap[code]}`);
        // Здесь можно добавить логику для автоматического исправления:
        // - При ошибке 429: приостановить запросы на N секунд.
        // - При ошибке 101204: проверить баланс и скорректировать размер ордера.
        // - При ошибке 100419: отправить уведомление о проблеме с IP.
    } else {
        console.warn(`[SELF-DIAGNOSTIC] Неизвестный код ошибки BingX: ${code}`);
    }
}

// Экспортируем полезные функции для торговли и анализа

// Получение текущей цены тикера
export async function getTickerPrice(symbol) {
    return await callBingxApi(`/openApi/swap/v1/ticker/price`, 'GET', { symbol });
}

// Получение данных Kline для технического анализа
export async function getKlines(symbol, interval, limit = 100) {
    return await callBingxApi(`/openApi/swap/v3/quote/klines`, 'GET', { symbol, interval, limit });
}

// Получение баланса пользователя (требует разрешений на чтение аккаунта)
export async function getAccountBalance() {
    return await callBingxApi(`/openApi/swap/v2/user/balance`, 'GET', {});
}

// Создание ордера (требует разрешений на торговлю)
export async function createOrder(symbol, side, type, quantity, price = null) {
    const payload = {
        symbol,
        side, // "BUY" или "SELL"
        type, // "LIMIT", "MARKET" и т.д.
        quantity,
        timestamp: Date.now()
    };

    if (price) {
        payload.price = price;
    }

    return await callBingxApi(`/openApi/swap/v2/trade/order`, 'POST', payload);
}

// Отмена ордера
export async function cancelOrder(symbol, orderId) {
    return await callBingxApi(`/openApi/swap/v2/trade/order`, 'DELETE', { symbol, orderId });
}

// Получение списка активных ордеров
export async function getOpenOrders(symbol) {
    return await callBingxApi(`/openApi/swap/v2/trade/openOrders`, 'GET', { symbol });
}

// Получение времени сервера (для синхронизации)
export async function getServerTime() {
    const response = await axios.get(`${PROTOCOL}://${HOST}/openApi/swap/v2/server/time`);
    return response.data.data.serverTime;
}
