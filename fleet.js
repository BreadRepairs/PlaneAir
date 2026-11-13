const fleetState = {
  aircraft: [],
  statusFilter: 'all',
  searchTerm: '',
  warnings: [],
  errors: [],
};

const fleetStatusValues = new Set(['active', 'maintenance', 'retired']);

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function cleanRequiredText(aircraft, key, label, index, errors) {
  const value = aircraft[key];
  if (typeof value !== 'string' || !value.trim()) {
    errors.push(`Aircraft ${index}: ${label} must be a non-empty string.`);
    return '';
  }
  return value.trim();
}

function cleanPositiveNumber(aircraft, key, label, index, errors, wholeNumber = false) {
  const value = aircraft[key];
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || (wholeNumber && !Number.isInteger(value))) {
    errors.push(`Aircraft ${index}: ${label} must be a positive${wholeNumber ? ' whole' : ''} number.`);
    return null;
  }
  return value;
}

function validateAircraftList(data) {
  if (!isPlainObject(data) || !Array.isArray(data.aircraft)) {
    throw new Error('fleet.json must contain an "aircraft" array.');
  }

  const validAircraft = [];
  const errors = [];
  const seenIds = new Set();

  data.aircraft.forEach((source, offset) => {
    const index = offset + 1;
    if (!isPlainObject(source)) {
      errors.push(`Aircraft ${index}: each aircraft entry must be a JSON object.`);
      return;
    }

    const entryErrors = [];
    const id = cleanRequiredText(source, 'id', 'id', index, entryErrors);
    const manufacturer = cleanRequiredText(source, 'manufacturer', 'manufacturer', index, entryErrors);
    const model = cleanRequiredText(source, 'model', 'model', index, entryErrors);
    const icaoCode = cleanRequiredText(source, 'icaoCode', 'icaoCode', index, entryErrors);
    const registration = cleanRequiredText(source, 'registration', 'registration', index, entryErrors);
    const statusText = cleanRequiredText(source, 'status', 'status', index, entryErrors);
    const capacity = cleanPositiveNumber(source, 'capacity', 'capacity', index, entryErrors, true);
    const rangeKm = cleanPositiveNumber(source, 'rangeKm', 'rangeKm', index, entryErrors);
    const cruisingSpeedKmh = cleanPositiveNumber(source, 'cruisingSpeedKmh', 'cruisingSpeedKmh', index, entryErrors);

    if (icaoCode && !/^[a-z0-9]{3,4}$/i.test(icaoCode)) {
      entryErrors.push(`Aircraft ${index}: icaoCode must be a 3- or 4-character ICAO aircraft type designator.`);
    }

    const status = statusText.toLowerCase();
    if (statusText && !fleetStatusValues.has(status)) {
      entryErrors.push(`Aircraft ${index}: status must be Active, Maintenance or Retired.`);
    }

    const normalizedId = id.toLocaleLowerCase();
    if (id && seenIds.has(normalizedId)) {
      entryErrors.push(`Aircraft ${index}: duplicate aircraft id "${id}".`);
    } else if (id) {
      seenIds.add(normalizedId);
    }

    let image = '';
    if (source.image !== undefined && source.image !== null && source.image !== '') {
      if (typeof source.image !== 'string' || !source.image.trim()) {
        fleetState.warnings.push(`Aircraft ${index}: image must be a local path under images/fleet/; the image was ignored.`);
      } else {
        const imagePath = source.image.trim().replaceAll('\\', '/');
        if (!imagePath.startsWith('images/fleet/') || imagePath.includes('..') || imagePath.startsWith('/') || /^[a-z][a-z\d+.-]*:/i.test(imagePath)) {
          fleetState.warnings.push(`Aircraft ${index}: image must be a local path under images/fleet/; the image was ignored.`);
        } else {
          image = imagePath;
        }
      }
    }

    if (entryErrors.length) {
      errors.push(...entryErrors);
      return;
    }

    validAircraft.push({
      id,
      manufacturer,
      model,
      icaoCode: icaoCode.toUpperCase(),
      registration,
      name: typeof source.name === 'string' && source.name.trim() ? source.name.trim() : '',
      capacity,
      rangeKm,
      cruisingSpeedKmh,
      status: status.charAt(0).toUpperCase() + status.slice(1),
      image,
      description: typeof source.description === 'string' && source.description.trim() ? source.description.trim() : '',
    });
  });

  return { aircraft: validAircraft, errors };
}

function addFleetMessage(message, type = 'error') {
  const messageRoot = document.querySelector('[data-fleet-message]');
  if (!messageRoot) return;

  const line = document.createElement('p');
  line.className = `fleet-message-line is-${type}`;
  line.textContent = message;
  messageRoot.append(line);
}

function showFleetMessages(errors) {
  const messageRoot = document.querySelector('[data-fleet-message]');
  if (!messageRoot) return;

  messageRoot.replaceChildren();
  errors.forEach((message) => addFleetMessage(message, 'error'));
  fleetState.warnings.forEach((message) => addFleetMessage(message, 'warning'));
}

function formatFleetNumber(value) {
  return new Intl.NumberFormat('en').format(value);
}

function createTextElement(tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  element.textContent = text;
  return element;
}

function createAircraftImage(aircraft, className = 'aircraft-image') {
  const imageFrame = document.createElement('div');
  imageFrame.className = `${className}-frame`;

  const showPlaceholder = () => {
    imageFrame.replaceChildren(createTextElement('span', 'aircraft-image-placeholder', 'Aircraft image unavailable'));
  };

  if (!aircraft.image) {
    showPlaceholder();
    return imageFrame;
  }

  const image = document.createElement('img');
  image.className = className;
  image.src = aircraft.image;
  image.alt = `${aircraft.manufacturer} ${aircraft.model}`;
  image.loading = 'lazy';
  image.addEventListener('error', () => {
    showPlaceholder();
    const label = `${aircraft.manufacturer} ${aircraft.model}`;
    const message = `Image unavailable for ${label}; showing a neutral placeholder.`;
    if (!fleetState.warnings.includes(message)) {
      fleetState.warnings.push(message);
      showFleetMessages(fleetState.errors);
    }
  }, { once: true });
  imageFrame.append(image);
  return imageFrame;
}

function createAircraftCard(aircraft) {
  const card = document.createElement('article');
  card.className = 'aircraft-card';
  card.append(createAircraftImage(aircraft));

  const content = document.createElement('div');
  content.className = 'aircraft-card-content';

  const top = document.createElement('div');
  top.className = 'aircraft-card-top';
  top.append(createTextElement('span', 'aircraft-status', aircraft.status));
  top.append(createTextElement('span', 'aircraft-registration', aircraft.registration));
  content.append(top);

  const title = createTextElement('h3', 'aircraft-card-title', `${aircraft.manufacturer} ${aircraft.model}`);
  content.append(title);
  if (aircraft.name) content.append(createTextElement('p', 'aircraft-name', aircraft.name));

  const type = document.createElement('p');
  type.className = 'aircraft-type-code';
  type.append(createTextElement('span', '', 'ICAO aircraft type designator'));
  type.append(createTextElement('strong', '', aircraft.icaoCode));
  content.append(type);

  const specs = document.createElement('dl');
  specs.className = 'aircraft-card-specs';
  [
    ['Capacity', `${formatFleetNumber(aircraft.capacity)} passengers`],
    ['Range', `${formatFleetNumber(aircraft.rangeKm)} km`],
    ['Cruising speed', `${formatFleetNumber(aircraft.cruisingSpeedKmh)} km/h`],
  ].forEach(([label, value]) => {
    const item = document.createElement('div');
    item.append(createTextElement('dt', '', label), createTextElement('dd', '', value));
    specs.append(item);
  });
  content.append(specs);

  const detailsButton = document.createElement('button');
  detailsButton.type = 'button';
  detailsButton.className = 'aircraft-details-button';
  detailsButton.textContent = 'View aircraft details';
  detailsButton.addEventListener('click', () => openAircraftDetails(aircraft));
  content.append(detailsButton);
  card.append(content);
  return card;
}

function getVisibleAircraft() {
  const keyword = fleetState.searchTerm.trim().toLocaleLowerCase();
  return fleetState.aircraft.filter((aircraft) => {
    const matchesStatus = fleetState.statusFilter === 'all' || aircraft.status === fleetState.statusFilter;
    const searchableText = [aircraft.manufacturer, aircraft.model, aircraft.icaoCode, aircraft.registration, aircraft.name]
      .join(' ')
      .toLocaleLowerCase();
    return matchesStatus && searchableText.includes(keyword);
  });
}

function renderAircraft() {
  const list = document.querySelector('[data-fleet-list]');
  if (!list) return;

  const aircraft = getVisibleAircraft();
  list.replaceChildren();
  if (!aircraft.length) {
    list.append(createTextElement('p', 'fleet-no-results', 'No aircraft match your search and selected filter.'));
    return;
  }

  aircraft.forEach((item) => list.append(createAircraftCard(item)));
}

function addDetailRow(container, label, value) {
  if (value === null || value === undefined || value === '') return;
  const row = document.createElement('div');
  row.className = 'aircraft-detail-row';
  row.append(createTextElement('dt', '', label), createTextElement('dd', '', String(value)));
  container.append(row);
}

function openAircraftDetails(aircraft) {
  const dialog = document.querySelector('[data-aircraft-dialog]');
  const detailRoot = document.querySelector('[data-aircraft-details]');
  if (!dialog || !detailRoot) return;

  detailRoot.replaceChildren();
  detailRoot.append(createAircraftImage(aircraft, 'aircraft-detail-image'));
  const heading = document.createElement('header');
  heading.className = 'aircraft-detail-heading';
  heading.append(createTextElement('span', 'eyebrow', 'Aircraft details'));
  const title = createTextElement('h2', '', `${aircraft.manufacturer} ${aircraft.model}`);
  title.id = 'aircraft-dialog-title';
  heading.append(title);
  if (aircraft.name) heading.append(createTextElement('p', 'aircraft-name', aircraft.name));
  detailRoot.append(heading);

  const specs = document.createElement('dl');
  specs.className = 'aircraft-detail-specs';
  addDetailRow(specs, 'ICAO aircraft type designator', aircraft.icaoCode);
  addDetailRow(specs, 'Registration', aircraft.registration);
  addDetailRow(specs, 'Manufacturer', aircraft.manufacturer);
  addDetailRow(specs, 'Model', aircraft.model);
  addDetailRow(specs, 'Passenger capacity', `${formatFleetNumber(aircraft.capacity)} passengers`);
  addDetailRow(specs, 'Range', `${formatFleetNumber(aircraft.rangeKm)} km`);
  addDetailRow(specs, 'Cruising speed', `${formatFleetNumber(aircraft.cruisingSpeedKmh)} km/h`);
  addDetailRow(specs, 'Status', aircraft.status);
  detailRoot.append(specs);

  if (aircraft.description) {
    detailRoot.append(createTextElement('p', 'aircraft-description', aircraft.description));
  }
  if (typeof dialog.showModal === 'function') dialog.showModal();
}

function initializeFleetControls() {
  const controls = document.querySelector('[data-fleet-controls]');
  const count = document.querySelector('[data-fleet-count]');
  const search = document.querySelector('[data-fleet-search]');
  if (controls) controls.hidden = fleetState.aircraft.length === 0;
  if (count) {
    count.hidden = false;
    count.replaceChildren();
    count.append(createTextElement('strong', '', formatFleetNumber(fleetState.aircraft.length)));
    count.append(createTextElement('span', '', `aircraft in the PlaneAir fleet`));
  }

  if (search) {
    search.addEventListener('input', () => {
      fleetState.searchTerm = search.value;
      renderAircraft();
    });
  }

  document.querySelectorAll('[data-fleet-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      fleetState.statusFilter = button.dataset.fleetFilter || 'all';
      document.querySelectorAll('[data-fleet-filter]').forEach((filterButton) => {
        const selected = filterButton === button;
        filterButton.classList.toggle('is-selected', selected);
        filterButton.setAttribute('aria-pressed', String(selected));
      });
      renderAircraft();
    });
  });
}

function initializeDialog() {
  const dialog = document.querySelector('[data-aircraft-dialog]');
  const closeButton = document.querySelector('[data-dialog-close]');
  if (!dialog || !closeButton) return;

  closeButton.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
}

async function loadFleet() {
  const list = document.querySelector('[data-fleet-list]');
  try {
    const response = await fetch('./fleet.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`Unable to load fleet.json (HTTP ${response.status}).`);

    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error('fleet.json contains invalid JSON. Check the file syntax and try again.');
    }

    const result = validateAircraftList(data);
    fleetState.aircraft = result.aircraft;
    fleetState.errors = result.errors;
    if (data.aircraft.length === 0) {
      initializeFleetControls();
      list.append(createTextElement('p', 'fleet-empty-state', 'No aircraft have been added to the PlaneAir fleet yet.'));
    } else if (fleetState.aircraft.length) {
      initializeFleetControls();
      renderAircraft();
    }
    showFleetMessages(result.errors);
  } catch (error) {
    list?.replaceChildren();
    addFleetMessage(error.message || 'Unable to load PlaneAir fleet data.', 'error');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initializeDialog();
  loadFleet();
});
