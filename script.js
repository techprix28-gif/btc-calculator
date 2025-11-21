document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const startDateInput = document.getElementById('start-date');
    const endDateInput = document.getElementById('end-date');
    const btnCheckHistory = document.getElementById('btn-check-history');

    const historicalResult = document.getElementById('historical-result');
    const statMax = document.getElementById('stat-max');
    const statMin = document.getElementById('stat-min');
    const statAvg = document.getElementById('stat-avg');

    const btcInput = document.getElementById('btc-input');
    const usdtInput = document.getElementById('usdt-input');
    const currentPriceDisplay = document.getElementById('current-price-display');

    const holdingsInput = document.getElementById('holdings-input');
    const futurePriceInput = document.getElementById('future-price-input');
    const projectedValue = document.getElementById('projected-value');

    // State
    let currentBtcPrice = 0;

    // Constants
    const API_BASE = 'https://api.coingecko.com/api/v3';

    // Initialize
    init();

    function init() {
        // Set max date to yesterday for historical lookup
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const maxDate = yesterday.toISOString().split('T')[0];

        startDateInput.max = maxDate;
        endDateInput.max = maxDate;

        // Fetch current price immediately
        fetchCurrentPrice();

        // Refresh price every 60 seconds
        setInterval(fetchCurrentPrice, 60000);

        // Event Listeners
        btnCheckHistory.addEventListener('click', fetchHistoricalStats);

        btcInput.addEventListener('input', handleBtcToUsdt);
        usdtInput.addEventListener('input', handleUsdtToBtc);

        holdingsInput.addEventListener('input', calculateProjection);
        futurePriceInput.addEventListener('input', calculateProjection);
    }

    // --- API Functions ---

    async function fetchCurrentPrice() {
        try {
            // 1. Try CoinGecko Simple Price
            const response = await fetchWithTimeout(`${API_BASE}/simple/price?ids=bitcoin&vs_currencies=usd`, 5000);
            if (!response.ok) throw new Error('CoinGecko Simple failed');
            const data = await response.json();
            currentBtcPrice = data.bitcoin.usd;
            updatePriceUI();
        } catch (error) {
            console.warn('CoinGecko Simple failed, trying fallback 1 (Market Chart)...', error);
            try {
                // 2. Fallback: CoinGecko Market Chart (1 day)
                const response = await fetchWithTimeout(`${API_BASE}/coins/bitcoin/market_chart?vs_currency=usd&days=1`, 5000);
                if (!response.ok) throw new Error('CoinGecko Market Chart failed');
                const data = await response.json();
                if (data.prices && data.prices.length > 0) {
                    // Get the last price in the array
                    currentBtcPrice = data.prices[data.prices.length - 1][1];
                    updatePriceUI();
                } else {
                    throw new Error('No data in fallback');
                }
            } catch (fallbackError1) {
                console.warn('CoinGecko Market Chart failed, trying fallback 2 (Binance)...', fallbackError1);
                try {
                    // 3. Fallback: Binance API
                    const response = await fetchWithTimeout('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT', 5000);
                    if (!response.ok) throw new Error('Binance API failed');
                    const data = await response.json();
                    currentBtcPrice = parseFloat(data.price);
                    updatePriceUI();
                } catch (fallbackError2) {
                    console.error('All price fetches failed. Using static fallback.', fallbackError2);
                    // 4. Final Fallback: Static Price (User requested "average or whatever is easier")
                    currentBtcPrice = 95000; // Approximate price
                    updatePriceUI(true); // true indicates static/fallback
                }
            }
        }
    }

    async function fetchWithTimeout(resource, timeout = 5000) {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        const response = await fetch(resource, {
            signal: controller.signal
        });
        clearTimeout(id);
        return response;
    }

    async function fetchHistoricalStats() {
        const startVal = startDateInput.value;
        const endVal = endDateInput.value;

        if (!startVal || !endVal) {
            alert('Por favor selecciona ambas fechas.');
            return;
        }

        if (startVal > endVal) {
            alert('La fecha de inicio no puede ser mayor que la fecha de fin.');
            return;
        }

        // Convert to UNIX timestamp (seconds)
        const from = Math.floor(new Date(startVal).getTime() / 1000);
        const to = Math.floor(new Date(endVal).getTime() / 1000) + 86400; // Add 1 day to include end date

        // Show loading state
        btnCheckHistory.textContent = 'Calculando...';
        btnCheckHistory.disabled = true;
        historicalResult.classList.add('hidden');

        try {
            const response = await fetch(`${API_BASE}/coins/bitcoin/market_chart/range?vs_currency=usd&from=${from}&to=${to}`);

            if (!response.ok) {
                if (response.status === 429) {
                    throw new Error('Límite de solicitudes excedido (429). Intenta en 1 minuto.');
                }
                throw new Error(`Error del servidor: ${response.status}`);
            }

            const data = await response.json();

            if (data.prices && data.prices.length > 0) {
                const prices = data.prices.map(p => p[1]);

                const maxPrice = Math.max(...prices);
                const minPrice = Math.min(...prices);
                const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;

                statMax.textContent = formatCurrency(maxPrice);
                statMin.textContent = formatCurrency(minPrice);
                statAvg.textContent = formatCurrency(avgPrice);

                historicalResult.classList.remove('hidden');
            } else {
                alert('No se encontraron datos para este rango de fechas.');
            }
        } catch (error) {
            console.error('Error:', error);
            alert(`Error: ${error.message}`);
        } finally {
            btnCheckHistory.textContent = 'Consultar Estadísticas';
            btnCheckHistory.disabled = false;
        }
    }

    // --- Logic Functions ---

    function handleBtcToUsdt() {
        if (!currentBtcPrice) return;
        const btcVal = parseFloat(btcInput.value);
        if (!isNaN(btcVal)) {
            const usdtVal = btcVal * currentBtcPrice;
            usdtInput.value = usdtVal.toFixed(2);
        } else {
            usdtInput.value = '';
        }
    }

    function handleUsdtToBtc() {
        if (!currentBtcPrice) return;
        const usdtVal = parseFloat(usdtInput.value);
        if (!isNaN(usdtVal)) {
            const btcVal = usdtVal / currentBtcPrice;
            btcInput.value = btcVal.toFixed(8); // BTC usually needs more decimals
        } else {
            btcInput.value = '';
        }
    }

    function calculateProjection() {
        const holdings = parseFloat(holdingsInput.value);
        const futurePrice = parseFloat(futurePriceInput.value);

        if (!isNaN(holdings) && !isNaN(futurePrice)) {
            const totalValue = holdings * futurePrice;
            projectedValue.textContent = formatCurrency(totalValue);
        } else {
            projectedValue.textContent = '0.00 USDT';
        }
    }

    // --- Retirement Calculator Logic ---
    const annualExpenseInput = document.getElementById('annual-expense');
    const withdrawalRateInput = document.getElementById('withdrawal-rate');
    const currentAgeInput = document.getElementById('current-age');
    const btcGrowthInput = document.getElementById('btc-growth');
    const annualSavingsBtcInput = document.getElementById('annual-savings-btc');
    const btnCalculateRetirement = document.getElementById('btn-calculate-retirement');

    const retirementResult = document.getElementById('retirement-result');
    const requiredCapitalDisplay = document.getElementById('required-capital');
    const requiredBtcNowDisplay = document.getElementById('required-btc-now');
    const retirementProjectionDisplay = document.getElementById('retirement-projection');

    if (btnCalculateRetirement) {
        btnCalculateRetirement.addEventListener('click', calculateRetirement);
    }

    function calculateRetirement() {
        const expense = parseFloat(annualExpenseInput.value);
        const withdrawalRate = parseFloat(withdrawalRateInput.value);
        const age = parseFloat(currentAgeInput.value);
        const growth = parseFloat(btcGrowthInput.value);
        const savingsBtc = parseFloat(annualSavingsBtcInput.value);

        if (isNaN(expense) || isNaN(withdrawalRate) || isNaN(age) || isNaN(growth) || isNaN(savingsBtc)) {
            alert('Por favor completa todos los campos de la calculadora de retiro.');
            return;
        }

        if (withdrawalRate <= 0) {
            alert('La tasa de retiro debe ser mayor a 0.');
            return;
        }

        // 1. Calculate Required Capital
        // Capital = Expense / (Rate / 100)
        const requiredCapital = expense / (withdrawalRate / 100);
        requiredCapitalDisplay.textContent = formatCurrency(requiredCapital);

        // 2. Calculate Required BTC Now
        if (currentBtcPrice > 0) {
            const requiredBtc = requiredCapital / currentBtcPrice;
            requiredBtcNowDisplay.textContent = requiredBtc.toFixed(4) + ' BTC';
        } else {
            requiredBtcNowDisplay.textContent = 'Precio no disponible';
        }

        // 3. Project Retirement Age
        // We simulate year by year accumulation
        let accumulatedBtc = 0;
        let projectedBtcPrice = currentBtcPrice;
        let years = 0;
        let reached = false;
        const maxYears = 100; // Safety break

        while (years < maxYears) {
            // Add annual savings
            accumulatedBtc += savingsBtc;

            // Apply growth to price
            projectedBtcPrice = projectedBtcPrice * (1 + (growth / 100));

            // Check total value
            const totalValue = accumulatedBtc * projectedBtcPrice;

            years++;

            if (totalValue >= requiredCapital) {
                reached = true;
                break;
            }
        }

        retirementResult.classList.remove('hidden');

        if (reached) {
            const retirementAge = age + years;
            retirementProjectionDisplay.textContent = `${years} años (Edad: ${retirementAge})`;
        } else {
            retirementProjectionDisplay.textContent = `Más de ${maxYears} años`;
        }
    }

    // --- Helper Functions ---

    function updatePriceUI(isStatic = false) {
        const formatted = formatCurrency(currentBtcPrice);
        currentPriceDisplay.textContent = isStatic ? `${formatted} (Simulado)` : formatted;

        // Trigger recalculation if inputs exist
        if (btcInput.value) handleBtcToUsdt();
        // Also update retirement BTC needed if visible/calculated
        if (retirementResult && !retirementResult.classList.contains('hidden')) calculateRetirement();
    }

    function formatCurrency(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount).replace('$', '') + ' USDT';
    }
});
