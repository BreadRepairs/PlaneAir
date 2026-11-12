const state = {
  airports: new Map(),
  flights: [],
  selectedDate: null,
};

function formatDate(dateString) {
  if (!dateString) return 'Not set';
  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return dateString;
  }
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toIsoDate(date) {
  const local = new Date(date);
  const offset = local.getTimezoneOffset();
  const adjusted = new Date(local.getTime() - offset * 60000);
  return adjusted.toISOString().slice(0, 10);
}

function getAirportByCode(code) {
  return state.airports.get(String(code).toUpperCase()) || null;
}

function getDefaultDate() {
  const today = new Date();
  return toIsoDate(today);
}

function flightMatchesDate(flight, dateString) {
  const targetDate = parseDate(dateString);
  if (!targetDate) {
    return false;
  }

  const startDate = parseDate(flight.activeStartDate);
  const endDate = flight.activeEndDate ? parseDate(flight.activeEndDate) : null;

  if (startDate && targetDate < startDate) {
    return false;
  }

  if (endDate && targetDate > endDate) {
    return false;
  }

  const frequency = String(flight.frequency || 'daily').toLowerCase();
  if (frequency === 'daily') {
    return true;
  }

  if (frequency === 'weekdays') {
    return [1, 2, 3, 4, 5].includes(targetDate.getDay());
  }

  if (frequency === 'weekends') {
    return [0, 6].includes(targetDate.getDay());
  }

  return true;
}

function matchAirportSearch(flight, queryValue) {
  const keyword = (queryValue || '').trim().toLowerCase();
  if (!keyword) {
    return true;
  }

  const departureAirport = getAirportByCode(flight.departureAirport);
  const destinationAirport = getAirportByCode(flight.destinationAirport);
  const departureText = `${flight.departureAirport} ${departureAirport ? departureAirport.name : ''} ${departureAirport ? departureAirport.city || '' : ''}`.toLowerCase();
  const destinationText = `${flight.destinationAirport} ${destinationAirport ? destinationAirport.name : ''} ${destinationAirport ? destinationAirport.city || '' : ''}`.toLowerCase();

  return departureText.includes(keyword) || destinationText.includes(keyword);
}

function getFlightsForDate(dateString, searchTerm = '') {
  return state.flights.filter((flight) => {
    return flightMatchesDate(flight, dateString) && matchAirportSearch(flight, searchTerm);
  });
}

function showStatus(message, isError = true) {
  const banner = document.querySelector('[data-status-banner]');
  if (!banner) return;

  banner.textContent = message;
  banner.classList.toggle('visible', Boolean(message));
  banner.style.background = isError ? 'rgba(217, 91, 97, 0.08)' : 'rgba(43, 182, 115, 0.08)';
  banner.style.color = isError ? '#d95b61' : '#2bb673';
  banner.style.borderColor = isError ? 'rgba(217, 91, 97, 0.15)' : 'rgba(43, 182, 115, 0.15)';
}

function createFlightCardMarkup(flight, dateString) {
  const departureAirport = getAirportByCode(flight.departureAirport);
  const destinationAirport = getAirportByCode(flight.destinationAirport);
  const dateLabel = formatDate(dateString);

  return `
    <article class="flight-card">
      <div class="flight-header">
        <span class="flight-number">${flight.flightNumber}</span>
        <span class="flight-aircraft">${flight.aircraft}</span>
      </div>

      <div class="route-block">
        <div>
          <span class="route-label">From</span>
          <span class="airport-code">${flight.departureAirport}</span>
          <span class="airport-country">${departureAirport ? departureAirport.name : 'Airport'} </span>
        </div>
        <span class="route-arrow">→</span>
        <div>
          <span class="route-label">To</span>
          <span class="airport-code">${flight.destinationAirport}</span>
          <span class="airport-country">${destinationAirport ? destinationAirport.name : 'Airport'} </span>
        </div>
      </div>

      <div class="time-list">
        <div class="time-box">
          <span>Departure</span>
          <strong>${flight.departureTime}</strong>
        </div>
        <div class="time-box">
          <span>Arrival</span>
          <strong>${flight.arrivalTime}</strong>
        </div>
      </div>

      <div class="meta-row">
        <div>
          <span class="meta-text">Frequency</span>
          <span class="meta-value">${(flight.frequency || 'daily').toLowerCase()}</span>
        </div>
        <div>
          <span class="meta-text">Date</span>
          <span class="meta-value">${dateLabel}</span>
        </div>
      </div>

      <a class="card-link" href="flight-details.html?flight=${encodeURIComponent(flight.flightNumber)}&date=${encodeURIComponent(dateString)}">View flight details</a>
    </article>
  `;
}

async function loadData() {
  try {
    const response = await fetch('./flights.json', { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Unable to load flights.json (${response.status}).`);
    }

    const data = await response.json();
    if (!Array.isArray(data.airports) || !Array.isArray(data.flights)) {
      throw new Error('The JSON file is missing valid airport or flight data.');
    }

    state.airports = new Map(data.airports.map((airport) => [String(airport.code).toUpperCase(), airport]));
    state.flights = data.flights;
    return true;
  } catch (error) {
    showStatus(error.message || 'Unable to load flight schedules.', true);
    return false;
  }
}

function renderFlightBoard(dateString, searchTerm = '') {
  const board = document.querySelector('[data-flight-board]');
  if (!board) return;

  const flights = getFlightsForDate(dateString, searchTerm);
  if (!flights.length) {
    board.innerHTML = '<div class="empty-state">No flights match your selected date and airport search.</div>';
    return;
  }

  board.innerHTML = flights.map((flight) => createFlightCardMarkup(flight, dateString)).join('');
}

function initFlightsPage() {
  const searchInput = document.querySelector('[data-flight-search]');
  const dateInput = document.querySelector('[data-flight-date]');
  const board = document.querySelector('[data-flight-board]');

  if (!dateInput || !board) return;

  const initialDate = state.selectedDate || getDefaultDate();
  dateInput.value = initialDate;
  state.selectedDate = initialDate;

  const updateResults = () => {
    const query = searchInput ? searchInput.value : '';
    state.selectedDate = dateInput.value || initialDate;
    renderFlightBoard(state.selectedDate, query);
  };

  if (searchInput) {
    searchInput.addEventListener('input', updateResults);
  }
  dateInput.addEventListener('change', updateResults);
  updateResults();
}

function renderAirportList() {
  const list = document.querySelector('[data-airport-list]');
  if (!list) return;

  const airports = Array.from(state.airports.values());
  if (!airports.length) {
    list.innerHTML = '<div class="empty-state">Airport data is currently unavailable.</div>';
    return;
  }

  list.innerHTML = airports.map((airport) => {
    const routeCount = state.flights.filter((flight) => flight.departureAirport === airport.code || flight.destinationAirport === airport.code).length;
    return `
      <article class="airport-card">
        <div class="airport-header">
          <span class="airport-code">${airport.code}</span>
          <span class="badge">${routeCount} flights</span>
        </div>
        <h3>${airport.name}</h3>
        <p class="airport-country">${airport.city || 'City not provided'}${airport.country ? `, ${airport.country}` : ''}</p>
      </article>
    `;
  }).join('');
}

function initAirportPage() {
  renderAirportList();
}

function renderHomeSummary(dateString = getDefaultDate()) {
  const summaryRoot = document.querySelector('[data-home-summary]');
  if (!summaryRoot) return;

  const flights = getFlightsForDate(dateString, '');
  summaryRoot.innerHTML = flights.slice(0, 4).map((flight) => createFlightCardMarkup(flight, dateString)).join('');
}

function initHomePage() {
  const dateInput = document.querySelector('[data-home-date]');
  const summaryRoot = document.querySelector('[data-home-summary]');

  if (!dateInput || !summaryRoot) return;

  const initialDate = getDefaultDate();
  dateInput.value = initialDate;

  const updateSummary = () => {
    renderHomeSummary(dateInput.value || initialDate);
  };

  dateInput.addEventListener('change', updateSummary);
  updateSummary();
}

function initBookingPage() {
  const form = document.querySelector('[data-booking-form]');
  const dateInput = document.querySelector('[data-booking-date]');
  const fromSelect = document.querySelector('[data-booking-from]');
  const toSelect = document.querySelector('[data-booking-to]');
  const flightSelect = document.querySelector('[data-booking-flight]');
  const flightHint = document.querySelector('[data-flight-hint]');
  const summary = document.querySelector('[data-booking-summary]');
  const submitButton = document.querySelector('[data-booking-submit]');

  if (!form || !dateInput || !fromSelect || !toSelect || !flightSelect || !summary || !submitButton) return;

  const populateAirportSelect = (select) => {
    const placeholder = select.options[0].outerHTML;
    select.innerHTML = placeholder + Array.from(state.airports.values())
      .map((airport) => `<option value="${airport.code}">${airport.code} — ${airport.name}</option>`)
      .join('');
  };

  const updateBookingSummary = () => {
    const flight = state.flights.find((item) => item.flightNumber === flightSelect.value);
    if (!flight || !flightMatchesDate(flight, dateInput.value)) {
      summary.innerHTML = '<p>Choose a travel date and flight to see the schedule summary.</p>';
      return;
    }

    const departureAirport = getAirportByCode(flight.departureAirport);
    const destinationAirport = getAirportByCode(flight.destinationAirport);
    summary.innerHTML = `
      <div class="booking-summary-route">
        <div><span class="route-label">From</span><strong>${flight.departureAirport}</strong><span>${departureAirport ? departureAirport.name : ''}</span></div>
        <span class="route-arrow">→</span>
        <div><span class="route-label">To</span><strong>${flight.destinationAirport}</strong><span>${destinationAirport ? destinationAirport.name : ''}</span></div>
      </div>
      <div class="booking-summary-row"><span>Flight</span><strong>${flight.flightNumber}</strong></div>
      <div class="booking-summary-row"><span>Travel date</span><strong>${formatDate(dateInput.value)}</strong></div>
      <div class="booking-summary-times"><div><span>Departure</span><strong>${flight.departureTime}</strong></div><div><span>Arrival</span><strong>${flight.arrivalTime}</strong></div></div>
      <div class="booking-summary-row"><span>Aircraft</span><strong>${flight.aircraft}</strong></div>
    `;
  };

  const updateFlightOptions = () => {
    const dateString = dateInput.value;
    const previousSelection = flightSelect.value;
    const matchingFlights = getFlightsForDate(dateString).filter((flight) => {
      return (!fromSelect.value || flight.departureAirport === fromSelect.value)
        && (!toSelect.value || flight.destinationAirport === toSelect.value);
    }).sort((first, second) => first.departureTime.localeCompare(second.departureTime));

    flightSelect.innerHTML = '<option value="">Choose an available flight</option>' + matchingFlights
      .map((flight) => `<option value="${flight.flightNumber}">${flight.flightNumber} · ${flight.departureTime} → ${flight.arrivalTime} · ${flight.aircraft}</option>`)
      .join('');

    if (matchingFlights.some((flight) => flight.flightNumber === previousSelection)) {
      flightSelect.value = previousSelection;
    }

    flightSelect.disabled = matchingFlights.length === 0;
    if (flightHint) {
      flightHint.textContent = matchingFlights.length
        ? `${matchingFlights.length} scheduled flight${matchingFlights.length === 1 ? '' : 's'} available for this date and route.`
        : 'No PlaneAir flights are scheduled for this date and route.';
    }

    updateBookingSummary();
  };

  populateAirportSelect(fromSelect);
  populateAirportSelect(toSelect);
  dateInput.value = getDefaultDate();
  dateInput.min = getDefaultDate();

  dateInput.addEventListener('change', updateFlightOptions);
  fromSelect.addEventListener('change', updateFlightOptions);
  toSelect.addEventListener('change', updateFlightOptions);
  flightSelect.addEventListener('change', updateBookingSummary);
  updateFlightOptions();

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const selectedFlight = state.flights.find((flight) => flight.flightNumber === flightSelect.value);
    if (!selectedFlight || !flightMatchesDate(selectedFlight, dateInput.value)) {
      showStatus('Choose a flight that operates on the selected date.', true);
      return;
    }

    const config = window.PLANEAIR_EMAILJS_CONFIG || {};
    const hasConfiguration = ['publicKey', 'serviceId', 'templateId'].every((key) => {
      return typeof config[key] === 'string' && config[key].trim() && !config[key].startsWith('YOUR_');
    });

    if (!hasConfiguration) {
      showStatus('EmailJS is not configured yet. Add your public key, service ID, and template ID in emailjs-config.js.', true);
      return;
    }

    if (!window.emailjs || typeof window.emailjs.send !== 'function') {
      showStatus('The EmailJS service could not be loaded. Check your internet connection and try again.', true);
      return;
    }

    const formData = new FormData(form);
    const templateParams = {
      passenger_name: String(formData.get('passenger_name') || '').trim(),
      passenger_email: String(formData.get('passenger_email') || '').trim(),
      passenger_count: String(formData.get('passenger_count') || '1'),
      flight_number: selectedFlight.flightNumber,
      departure_airport: selectedFlight.departureAirport,
      destination_airport: selectedFlight.destinationAirport,
      departure_time: selectedFlight.departureTime,
      arrival_time: selectedFlight.arrivalTime,
      travel_date: dateInput.value,
      aircraft: selectedFlight.aircraft,
      booking_notes: String(formData.get('booking_notes') || '').trim(),
    };

    submitButton.disabled = true;
    submitButton.textContent = 'Sending request…';

    try {
      window.emailjs.init({ publicKey: config.publicKey });
      await window.emailjs.send(config.serviceId, config.templateId, templateParams);
      showStatus('Your booking request was sent. PlaneAir will contact you to confirm it.', false);
    } catch (error) {
      showStatus('Your request could not be sent right now. Please try again later.', true);
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = 'Send booking request';
    }
  });
}

function renderFlightDetail() {
  const detailRoot = document.querySelector('[data-flight-detail]');
  if (!detailRoot) return;

  const params = new URLSearchParams(window.location.search);
  const flightNumber = params.get('flight');
  const selectedDate = params.get('date') || getDefaultDate();

  const flight = state.flights.find((item) => item.flightNumber.toLowerCase() === String(flightNumber || '').toLowerCase());
  if (!flight) {
    detailRoot.innerHTML = '<div class="empty-state">The requested flight could not be found.</div>';
    return;
  }

  const departureAirport = getAirportByCode(flight.departureAirport);
  const destinationAirport = getAirportByCode(flight.destinationAirport);
  const operatesOnDate = flightMatchesDate(flight, selectedDate);

  detailRoot.innerHTML = `
    <div class="detail-layout">
      <div class="detail-panel">
        <div class="detail-header">
          <div>
            <span class="route-label">Flight</span>
            <h2>${flight.flightNumber}</h2>
          </div>
          <span class="badge">${operatesOnDate ? 'Operating' : 'Paused'}</span>
        </div>

        <div class="route-block">
          <div>
            <span class="route-label">From</span>
            <span class="airport-code">${flight.departureAirport}</span>
            <span class="airport-country">${departureAirport ? departureAirport.name : 'Airport'} </span>
          </div>
          <span class="route-arrow">→</span>
          <div>
            <span class="route-label">To</span>
            <span class="airport-code">${flight.destinationAirport}</span>
            <span class="airport-country">${destinationAirport ? destinationAirport.name : 'Airport'} </span>
          </div>
        </div>

        <div class="time-list">
          <div class="time-box">
            <span>Departure</span>
            <strong>${flight.departureTime}</strong>
          </div>
          <div class="time-box">
            <span>Arrival</span>
            <strong>${flight.arrivalTime}</strong>
          </div>
        </div>

        <div class="detail-row">
          <span class="detail-label">Aircraft</span>
          <span class="detail-value">${flight.aircraft}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Frequency</span>
          <span class="detail-value">${(flight.frequency || 'daily').toLowerCase()}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Active start</span>
          <span class="detail-value">${flight.activeStartDate || 'Not set'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Active end</span>
          <span class="detail-value">${flight.activeEndDate || 'Open ended'}</span>
        </div>
      </div>

      <aside class="summary-card">
        <div class="summary-top">
          <span class="route-label">Selected date</span>
          <span class="badge">${formatDate(selectedDate)}</span>
        </div>

        <div class="meta-row">
          <div>
            <span class="meta-text">Status</span>
            <span class="meta-value">${operatesOnDate ? 'Scheduled for this date' : 'Not operating on this date'}</span>
          </div>
        </div>

        <div class="meta-row">
          <div>
            <span class="meta-text">Route</span>
            <span class="meta-value">${flight.departureAirport} → ${flight.destinationAirport}</span>
          </div>
        </div>

        <div class="meta-row">
          <div>
            <span class="meta-text">Flight time</span>
            <span class="meta-value">${flight.departureTime} to ${flight.arrivalTime}</span>
          </div>
        </div>
      </aside>
    </div>
  `;
}

function initDetailPage() {
  renderFlightDetail();
}

async function initializeApp() {
  const loaded = await loadData();
  if (!loaded) {
    return;
  }

  const page = document.body.dataset.page;

  if (page === 'flights') {
    initFlightsPage();
  }

  if (page === 'airports') {
    initAirportPage();
  }

  if (page === 'home') {
    initHomePage();
  }

  if (page === 'detail') {
    initDetailPage();
  }

  if (page === 'booking') {
    initBookingPage();
  }
}

document.addEventListener('DOMContentLoaded', initializeApp);
