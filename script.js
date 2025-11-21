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
        fetchAnnualGrowth();

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

    async function fetchAnnualGrowth() {
        const growthDisplay = document.getElementById('btc-1y-growth');
        try {
            // Get date 365 days ago
            const today = new Date();
            const lastYear = new Date(today.setDate(today.getDate() - 365));
            const from = Math.floor(lastYear.getTime() / 1000);
            const to = from + 3600; // 1 hour window to get a price point

            // Fetch price from 1 year ago
            const response = await fetch(`${API_BASE}/coins/bitcoin/market_chart/range?vs_currency=usd&from=${from}&to=${to}`);
            if (!response.ok) throw new Error('Failed to fetch history');

            const data = await response.json();
            if (data.prices && data.prices.length > 0) {
                const oldPrice = data.prices[0][1];

                // We need current price. If not set yet, wait or fetch.
                // For simplicity, we'll use the one we hopefully just fetched or fetch simple again if needed.
                // But to be safe, let's just use the simple price endpoint again here to ensure we have "now" vs "then".

                const currentRes = await fetch(`${API_BASE}/simple/price?ids=bitcoin&vs_currencies=usd`);
                const currentData = await currentRes.json();
                const currentPrice = currentData.bitcoin.usd;

                const growth = ((currentPrice - oldPrice) / oldPrice) * 100;
                const sign = growth >= 0 ? '+' : '';

                growthDisplay.textContent = `${sign}${growth.toFixed(2)}%`;

                // Color code
                growthDisplay.style.color = growth >= 0 ? '#00ff88' : '#ff4444';
            } else {
                growthDisplay.textContent = "N/A";
            }
        } catch (error) {
            console.error('Error fetching annual growth:', error);
            growthDisplay.textContent = "Error";
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

    function updatePriceUI(isStatic = false) {
        const formatted = formatCurrency(currentBtcPrice);
        currentPriceDisplay.textContent = isStatic ? `${formatted} (Simulado)` : formatted;

        // Trigger recalculation if inputs exist
        if (btcInput.value) handleBtcToUsdt();
        // Also update retirement BTC needed if visible/calculated
        const retirementResult = document.getElementById('retirement-result');
        if (retirementResult && !retirementResult.classList.contains('hidden')) calculateRetirement();
    }

    // --- Retirement Calculator Logic ---
    const annualExpenseInput = document.getElementById('annual-expense');
    const currentAgeInput = document.getElementById('current-age');
    const lifeExpectancyInput = document.getElementById('life-expectancy');
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
        const currentAge = parseFloat(currentAgeInput.value);
        const lifeExpectancy = parseFloat(lifeExpectancyInput.value);
        const growth = parseFloat(btcGrowthInput.value);
        const savingsBtc = parseFloat(annualSavingsBtcInput.value);

        if (isNaN(expense) || isNaN(currentAge) || isNaN(lifeExpectancy) || isNaN(growth) || isNaN(savingsBtc)) {
            alert('Por favor completa todos los campos de la calculadora de retiro.');
            return;
        }

        if (lifeExpectancy <= currentAge) {
            alert('La esperanza de vida debe ser mayor que la edad actual.');
            return;
        }

        // Simulation: Find the minimum years to save (work)
        let yearsToWork = 0;
        let found = false;
        const maxYears = lifeExpectancy - currentAge;

        let finalAccumulatedCapital = 0;
        let finalRequiredBtc = 0;

        // Loop through possible years of work (0 to max)
        for (yearsToWork = 0; yearsToWork <= maxYears; yearsToWork++) {
            let retirementAge = currentAge + yearsToWork;

            // Let's redo the simulation loop with BTC balance check which is cleaner
            let btcBalance = 0;
            let simPrice = currentBtcPrice;

            // 1. Accumulate
            for (let i = 0; i < yearsToWork; i++) {
                btcBalance += savingsBtc;
                simPrice *= (1 + growth / 100);
            }

            let btcAtRetirement = btcBalance;
            let priceAtRetirement = simPrice;

            // 2. Drawdown
            let drawdownSuccess = true;
            let tempBtcBalance = btcBalance;
            let tempPrice = simPrice;

            for (let j = 0; j < (lifeExpectancy - retirementAge); j++) {
                // Calculate BTC needed for expense
                let btcNeeded = expense / tempPrice;

                tempBtcBalance -= btcNeeded;

                if (tempBtcBalance < 0) {
                    drawdownSuccess = false;
                    break;
                }

                // Price grows for next year
                tempPrice *= (1 + growth / 100);
            }

            if (drawdownSuccess) {
                found = true;
                finalAccumulatedCapital = btcAtRetirement * priceAtRetirement;
                finalRequiredBtc = btcAtRetirement;
                break;
            }
        }

        retirementResult.classList.remove('hidden');

        if (found) {
            const retirementAge = currentAge + yearsToWork;
            retirementProjectionDisplay.textContent = `${yearsToWork} años (Edad: ${retirementAge})`;

            requiredCapitalDisplay.textContent = formatCurrency(finalAccumulatedCapital);
            requiredBtcNowDisplay.textContent = finalRequiredBtc.toFixed(4) + ' BTC';

        } else {
            retirementProjectionDisplay.textContent = `Imposible con los parámetros actuales`;
            requiredCapitalDisplay.textContent = "---";
            requiredBtcNowDisplay.textContent = "---";
        }
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
