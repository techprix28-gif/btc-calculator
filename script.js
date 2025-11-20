document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const historicalDateInput = document.getElementById('historical-date');
    const btnCheckHistory = document.getElementById('btn-check-history');
    const historicalResult = document.getElementById('historical-result');
    const historicalPriceValue = document.getElementById('historical-price-value');

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
        historicalDateInput.max = yesterday.toISOString().split('T')[0];

        // Fetch current price immediately
        fetchCurrentPrice();

        // Refresh price every 60 seconds
        setInterval(fetchCurrentPrice, 60000);

        // Event Listeners
        btnCheckHistory.addEventListener('click', fetchHistoricalPrice);
        
        btcInput.addEventListener('input', handleBtcToUsdt);
        usdtInput.addEventListener('input', handleUsdtToBtc);

        holdingsInput.addEventListener('input', calculateProjection);
        futurePriceInput.addEventListener('input', calculateProjection);
    }

    // --- API Functions ---

    async function fetchCurrentPrice() {
        try {
            const response = await fetch(`${API_BASE}/simple/price?ids=bitcoin&vs_currencies=usd`);
            if (!response.ok) throw new Error('Error fetching price');
            const data = await response.json();
            currentBtcPrice = data.bitcoin.usd;
            
            // Update UI
            currentPriceDisplay.textContent = formatCurrency(currentBtcPrice);
            
            // Trigger recalculation if inputs exist
            if (btcInput.value) handleBtcToUsdt();
        } catch (error) {
            console.error('Error:', error);
            currentPriceDisplay.textContent = 'Error al cargar';
        }
    }

    async function fetchHistoricalPrice() {
        const dateVal = historicalDateInput.value;
        if (!dateVal) {
            alert('Por favor selecciona una fecha.');
            return;
        }

        // Format date for CoinGecko: dd-mm-yyyy
        const [year, month, day] = dateVal.split('-');
        const formattedDate = `${day}-${month}-${year}`;

        // Show loading state
        btnCheckHistory.textContent = 'Cargando...';
        btnCheckHistory.disabled = true;
        historicalResult.classList.add('hidden');

        try {
            const response = await fetch(`${API_BASE}/coins/bitcoin/history?date=${formattedDate}`);
            if (!response.ok) throw new Error('Error fetching historical data');
            const data = await response.json();

            if (data.market_data && data.market_data.current_price) {
                const price = data.market_data.current_price.usd;
                historicalPriceValue.textContent = formatCurrency(price);
                historicalResult.classList.remove('hidden');
            } else {
                alert('No hay datos disponibles para esta fecha.');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Error al consultar el precio histórico. Intenta de nuevo.');
        } finally {
            btnCheckHistory.textContent = 'Consultar Precio';
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

    // --- Helper Functions ---

    function formatCurrency(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount).replace('$', '') + ' USDT';
    }
});
