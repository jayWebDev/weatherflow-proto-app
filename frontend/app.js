const appSettings = {
	units_wind: 'mph',
	units_temp: 'f',
	units_distance: 'mi',
	zoom: 11,
}

const appState = {
	listingCurrentIndex: 0,
	listingsPerClick: 10,
	zoom: 11,
}

class Spot {
	constructor(data) {
		this.id = data.spot_id;
		this.lat = data.lat;
		this.lon = data.lon;
		this.name = data.name;
		this.station_code = data.station_code;
		this.city = data.city;
		this.state = data.state;
		this.county = data.county;
		this.country = data.country;
		this.stars = data.stars;
		this.organization = data.organization_name;
		this.dataNames = data.data_names;

		this.init(data.stations);
	}

	init(stations) {
		this.createStations(stations);
	}

	createStations(stations) {
		this.stations = []
		stations.map(station => this.stations.push(new Station(station, this.dataNames)))
	}

	addMarker(marker) {
		this.marker = marker;
	}

	highlight() {
		if (this.marker) {
			const icon = getMarkerIcon(this, true);
			const label = getMarkerLabel(this, true);

			this.marker.setIcon(icon);
			this.marker.setLabel(label);
			this.marker.setZIndex(google.maps.Marker.MAX_ZINDEX);
		}		
	}

	resetAppearance() {
		if (this.marker) {
			const icon = getMarkerIcon(this);
			const label = getMarkerLabel(this);

			this.marker.setIcon(icon);
			this.marker.setLabel(label);
			this.marker.setZIndex(google.maps.Marker.MAX_ZINDEX);
		}		
	}

	select() {
		this.selected = true;

		if (this.listing) this.listing.classList.add('selected');

		if (this.marker) {
			const icon = getMarkerIcon(this, true);
			const label = getMarkerLabel(this, true);

			this.marker.setIcon(icon);
			this.marker.setLabel(label);
			this.marker.setZIndex(google.maps.Marker.MAX_ZINDEX);
		}
	}

	isSpotSelected() {
		return this.selected;
	}
	
	deselect() {
		this.selected = false;

		if (this.listing) this.listing.classList.remove('selected');

		if (this.marker) {
			const icon = getMarkerIcon(this, false);
			const label = getMarkerLabel(this, false);

			this.marker.setIcon(icon);
			this.marker.setLabel(label);
			this.marker.setZIndex(0);
		}		
	}
}

class Station {
	constructor(data, dataNames) {
		this.data = data;
		this.id = data.station_id;
		this.dataNames = dataNames;
		
		this.init();
	}
	
	init() {
		this.parseValues();
	}

	parseValues() {
		this.values = {};
		this.dataNames.map((dataName, i) => {
			this.values[dataName] = this.data.data_values[0][i]
		});		
	}
}

let geocoder, PopupWindow;

function initApp() {
	const searchButton = document.getElementById('location-search-submit');

	geocoder = new google.maps.Geocoder();
	appState['map'] = new google.maps.Map(document.getElementById("app-map"), {
		center: { lat: 34.006, lng: -118.535 },
		zoom: appState.zoom,
		mapId: 'aacd46ab27a8085e',
		streetViewControl: false,
		fullscreenControl: false,
		mapTypeControl: false,
	});

  class Popup extends google.maps.OverlayView {
    position;
    containerDiv;
    constructor(marker, content) {
			super();
      this.marker = marker;
      content.classList.add("popup-bubble");

			const bubbleAnchor = document.createElement("div");

      bubbleAnchor.classList.add("popup-bubble-anchor");
      bubbleAnchor.appendChild(content);

			this.containerDiv = document.createElement("div");
      this.containerDiv.classList.add("popup-container");
      this.containerDiv.appendChild(bubbleAnchor);

			Popup.preventMapHitsAndGesturesFrom(this.containerDiv);
    }

		onAdd() {
      this.getPanes().floatPane.appendChild(this.containerDiv);
    }

		onRemove() {
      if (this.containerDiv.parentElement) {
        this.containerDiv.parentElement.removeChild(this.containerDiv);
      }
    }

		draw() {
			const divPosition = this.getProjection().fromLatLngToDivPixel(
				this.marker.getPosition()
				);

			const display =
        Math.abs(divPosition.x) < 4000 && Math.abs(divPosition.y) < 4000
				? "block"
				: "none";

      if (display === "block") {
        this.containerDiv.style.left = (divPosition.x - 125) + "px";
        this.containerDiv.style.top = (divPosition.y - 15) + "px";
      }

      if (this.containerDiv.style.display !== display) {
        this.containerDiv.style.display = display;
      }
    }
	}

	PopupWindow = Popup;
	
	google.maps.event.addListenerOnce(appState['map'], 'bounds_changed', updateApp);
	google.maps.event.addListener(appState['map'], 'dragend', updateApp);
	google.maps.event.addListener(appState['map'], 'zoom_changed', updateApp);
	
	searchButton.addEventListener('click', codeAddress);
}

const updateApp = async () => {
	destroyAllInfoWindows();
	updateBounds(appState.map.getBounds());
	resetListings();
	await updateAppData();
	deselectAllSpots();

	if (appState.activeSpot) {
		const spot = appState.spots.find(spot => spot.id === appState.activeSpot.id);
		
		if (!spot) return;
		
		buildInfoWindowContent(spot);
		bringSpotListingIntoView(spot);
		selectSpot(spot);
		setInfoWindowPositionAndShow(spot.marker.infoWindow);
	};	
}

const codeAddress = () => {
	const address = document.getElementById('location-search').value;
	const { map } = appState;

	geocoder.geocode( { 'address': address}, function(results, status) {
		if (status == 'OK') {
			map.setCenter(results[0].geometry.location);
			let marker = new google.maps.Marker({
					map: map,
					position: results[0].geometry.location
			});

			updateApp();
		} else {
			alert('Geocode was not successful for the following reason: ' + status);
		}
	});
}

const updateBounds = (bounds) => {
		const boundsNE = bounds.getNorthEast();
		const boundsSW = bounds.getSouthWest();

		appState['lat_min'] = boundsSW.lat();
		appState['lat_max'] = boundsNE.lat();
		appState['lon_min'] = boundsSW.lng();
		appState['lon_max'] = boundsNE.lng();
		appState['zoom'] = appState.map.getZoom();
}

const updateAppData = async () => {
	let data = await fetchData(buildQueryString());

	setAppSettings(data);
	setAppState(data);

	addMarkers(appState.spots)
	addSpotListings(appState.spots);	
}

const setAppSettings = (data) => {
	appSettings.units_wind = data.units_wind;
	appSettings.units_temp = data.units_temp;
	appSettings.units_distance = data.units_distance;
}

const setAppState = (data) => {
	if (appState.spots && appState.spots.length > 0) {
		removeOutOfBoundsSpots(data);
	}	

	appState['spot_count'] = data.spot_count;
	appState['spots'] = createSpots(data.spots);
	appState['listingCurrentIndex'] = 0;
}

const createSpots = (data) => {
	return data.map(spot => {
		if (appState.spots && appState.spots[spot.spot_id]) return;

		return new Spot(spot)
	});
}

const removeOutOfBoundsSpots = () => {
	const { lat_min, lat_max, lon_min, lon_max } = appState;
	
	appState.spots = appState.spots.filter(spot => {

		if (
			spot.lat < lat_min ||
			spot.lat > lat_max ||
			spot.lon < lon_min ||
			spot.lon > lon_max
		) {
			if (spot.marker) {
				spot.marker.setMap(null);
				spot.marker = null;
			}

			return false
		}

		return true;
	})
}

const createInfoWindow = (marker, latLon) => {
	marker['infoWindow'] = new PopupWindow(
		marker,
    buildInfoWindowContainer()
	);
	marker['infoWindow'].containerDiv.style.display = 'none';
	marker['infoWindow'].setMap(appState.map);	
}

const addMarkers = (spots, map) => {
	spots = spots || appState.spots;
	map = map || appState.map;

	spots.map(spot => {
		const icon = getMarkerIcon(spot);
		const label = getMarkerLabel(spot);

		const marker = new google.maps.Marker({
			position: { lat: spot.lat, lng: spot.lon },
			map: appState.map,
			title: spot.name,
			label,
			icon,
		});

		spot.addMarker(marker);
		marker.setMap(appState.map);
		createInfoWindow(marker, { lat: spot.lat, lng: spot.lon });
		
		marker.addListener('click', () => {
			closeAllInfoWindows();
			bringSpotListingIntoView(spot);
			selectSpot(spot);
			buildInfoWindowContent(spot);
			setInfoWindowPositionAndShow(spot.marker.infoWindow);
		});
		
	})
}

const setInfoWindowPositionAndShow = (infoWindow) => {
	infoWindow.containerDiv.style.transform = 'translateY(-100%)';
	infoWindow.containerDiv.style.display = 'block';
	infoWindow.containerDiv.style.visibility = 'hidden';
	
	const infoWindowBounds = infoWindow.containerDiv.getBoundingClientRect();
	const mapBounds = document.getElementById('app-map').getBoundingClientRect();
	let translateX = 0;
	let translateY = '-100%';
	
	if (infoWindowBounds.y < mapBounds.y) {
		translateY = '30px';
	}
	
	if (infoWindowBounds.bottom > mapBounds.bottom) {
		translateY = '-100%';
	}
	
	if (infoWindowBounds.x < mapBounds.x) {
		translateX = '50%';
	}
	else if (infoWindowBounds.right > mapBounds.right) {
		translateX = '-50%';
	}
	
	infoWindow.containerDiv.style.transform = `translate(${translateX}, ${translateY})`;
	infoWindow.containerDiv.style.visibility = 'visible';
}

const closeAllInfoWindows = () => {
	if (!appState.spots) return;

	appState.spots.forEach(spot => {
		spot.marker.infoWindow.containerDiv.style.display = 'none';
		spot.marker.infoWindow.containerDiv.style.visibility = 'hidden';
		spot.deselect();
	});
}

const destroyAllInfoWindows = () => {
	document.querySelectorAll('.popup-container').forEach(popup => popup.remove());
}

const deselectAllSpots = () => {
	if (!appState.spots) return;

	appState.spots.forEach(spot => spot.deselect());
}

const addSpotListings = (spots, endIndex) => {
	const spotListingsContainer = document.getElementById('spot-listings');
	spots = spots || appState.spots;

	const { listingCurrentIndex, listingsPerClick } = appState;

	if (!endIndex) {
		endIndex = (listingCurrentIndex + listingsPerClick <= spots.length) ? listingCurrentIndex + listingsPerClick : spots.length;
	}

	for (let i = listingCurrentIndex; i < endIndex; i++) {
		let spot = spots[i]

		const spotListing = document.createElement('button');
		const listingName = `<h3 class="spot-listing__name">${spot.name}</h3>`;
		const listingWeather = buildListingWeather(spot);
		const listingLocation = buildListingLocation(spot);
	
		spotListing.classList.add('spot-listing');
		spotListing.id = spot.id;
		spotListing.innerHTML = listingName;
	
		if (listingWeather) spotListing.appendChild(listingWeather);
		if (listingLocation) spotListing.appendChild(listingLocation);
	
		spotListing.addEventListener('click', handleListingClick(spot));
		spotListing.addEventListener('mouseover', handleListingMouseOver(spot));
		spotListing.addEventListener('mouseout', handleListingMouseOut(spot));
		
		spotListingsContainer.appendChild(spotListing);
		spot['listing'] = spotListing;
	}

	appState.listingCurrentIndex = endIndex;
	const remainingSpots = spots.length - endIndex;

	if (remainingSpots > 0) {
		const showMoreContainer = document.createElement('div');
		showMoreContainer.classList.add('sidebar__actions');
		showMoreContainer.id = 'show-more-button-container';

		const showMoreButton = document.createElement('button');
		showMoreButton.classList.add('show-button', 'sidebar__action');

		showMoreButton.innerHTML = `<svg aria-hidden="true" focusable="false"><use xlink:href="#plus-circle"></use></svg>Show More <span class="show-button__remaining">${remainingSpots}</span>`;

		showMoreButton.addEventListener('click', handleShowMoreListingsClick);

		showMoreContainer.appendChild(showMoreButton);
		spotListingsContainer.appendChild(showMoreContainer);
	}
}

const removeSpotListings = () => {
	const spotListingsContainer = document.getElementById('spot-listings');

	spotListingsContainer.innerHTML = '';
}

const resetListingState = () => {
	appState['listingCurrentIndex'] = 0;
}

const resetListings = () => {
	removeSpotListings();
	resetListingState();
}

const buildListingLocation = (spot) => {
	const { city, state, country, organization, county } = spot;
	if (!city && !state && !country && !organization && !county) return;

	const container = document.createElement('div');
	container.classList.add('spot-listing__location');

	if (city) container.innerHTML += `<p class="spot-listing__city">${city},</p>`;
	if (state && state !== 'false') container.innerHTML += `<p class="spot-listing__state">${state}</p>`;
	if (state && state === 'false' && county || !state && county) container.innerHTML += `<p class="spot-listing__county">${county}</p>`;
	if (country) container.innerHTML += `<p class="spot-listing__country">${country}</p>`;
	if (organization && organization === 'WeatherFlow') container.innerHTML += `<div class="badges"><span class="badge"><svg aria-hidden="true" focusable="false"><use xlink:href="#weatherflow-icon"></use></svg></span></div>`;

	return container;
}

const buildListingWeather = (spot) => {
	const { avg, gust, dir_text, atemp } = spot.stations[0].values;
	const units = appSettings.units_wind.toUpperCase();

	if (!avg && !gust && !dir_text && !atemp) return;

	const container = document.createElement('div');
	container.classList.add('spot-listing__weather');

	const gustHTML = gust ? `<span class="spot-listing__gust">&nbsp;/&nbsp;${gust}<span class="units">${units}</span>` : `<span class="spot-listing__gust">&nbsp;/&nbsp;--</span></span>`;

	container.innerHTML += `<p class="spot-listing__stat spot-listing__wind"><svg aria-hidden="true" focusable="false"><use xlink:href="#gust"></use></svg>${avg}<span class="units">${units}</span>${gustHTML}</p>`;
	container.innerHTML += `<p class="spot-listing__stat spot-listing__dir"><svg aria-hidden="true" focusable="false"><use xlink:href="#direction"></use></svg>${(dir_text) ? dir_text.toUpperCase() : '--'}</p>`;
	container.innerHTML += `<p class="spot-listing__stat spot-listing__temp"><svg aria-hidden="true" focusable="false"><use xlink:href="#thermometer"></use></svg>${(atemp) ? Math.round(atemp) + '&deg;' : '--'}</p>`;

	return container;
}

const buildInfoWindowContainer = () => {
	const infoWindow = document.createElement('div');
	infoWindow.classList.add('info-window');
	
	return infoWindow;
}

const buildInfoWindowContent = (spot) => {
	if (spot.marker.infoWindow.containerDiv.querySelector('.info-window__header')) return;
	
	const infoWindowBody = document.createElement('div');
	const infoWindowHeader = buildInfoWindowHeader(spot);
	const windWeather = buildInfoWindowWindWeather(spot);
	const airWeather = buildInfoWindowAirWeather(spot);
	const location = buildInfoWindowLocation(spot);
	const infoWindow = spot.marker.infoWindow.containerDiv.querySelector('.info-window');
	const closeButton = document.createElement('button');

	closeButton.classList.add('info-window__close-button');
	closeButton.innerHTML = `<svg aria-hidden="true" focusable="false"><use xlink:href="#x"></use></svg>`;

	closeButton.addEventListener('click', (e) => {
		e.target.closest('.popup-container').style.display = 'none';
		e.target.closest('.popup-container').style.visibility = 'hidden';
		spot.deselect();
	});

	infoWindowHeader.classList.add('info-window__header');
	infoWindowBody.classList.add('info-window__body');
	infoWindowBody.appendChild(windWeather);
	infoWindowBody.appendChild(airWeather);
	if (location) infoWindowBody.appendChild(location);

	infoWindow.appendChild(closeButton);
	infoWindow.appendChild(infoWindowHeader);
	infoWindow.appendChild(infoWindowBody);	
}

const buildInfoWindowHeader = (spot) => {
	const { name, organization } = spot;

	if (!name && !organization) return;

	const header = document.createElement('header');
	const mapImage = buildInfoWindowMapImage(spot);

	if (organization && organization === 'WeatherFlow') header.innerHTML = `<div class="header__badges"><span class="badge"><svg aria-hidden="true" focusable="false"><use xlink:href="#weatherflow-icon"></use></svg></span></div>`;
	header.innerHTML += `<h3 class="info-window__name">${spot.name}</h3>`;

	header.appendChild(mapImage);

	return header;
}

const buildInfoWindowMapImage = (spot) => {
	const { marker } = spot;

	if (!marker) return;

	const lat = marker.position.lat();
	const lon = marker.position.lng();

	const image = document.createElement('img');
	const token = 'pk.eyJ1Ijoic2hvcmVjbyIsImEiOiJjbDFwZ3QxYXcxZGFiM2RtbXp1dm96c2NiIn0.pSotSEC4QnuFrPeO2D9Z5w';

	image.classList.add('info-window__map-image');
	image.setAttribute('loading', 'lazy');
	image.src = `https://api.mapbox.com/styles/v1/shoreco/cl1pu4ioa001q14o6opmxl1y5/static/pin-s(${lon},${lat})/${lon},${lat},14,0/600x300?access_token=${token}`;

	return image;
}

const buildInfoWindowLocation = (spot) => {
	const { city, state, county, country, organization } = spot;
	if (!city && !state && !country && !county && !organization) return;

	const container = document.createElement('div');
	container.classList.add('info-window__location');

	if (city) container.innerHTML += `<p class="info-window__city">${city},</p>`;
	if (state && state !== 'false') container.innerHTML += `<p class="info-window__city">${state}</p>`;
	if (state && state === 'false' && county || !state && county) container.innerHTML += `<p class="info-window__county">${county}</p>`;
	if (country) container.innerHTML += `<p class="info-window__city">${country}</p>`;
	if (organization) container.innerHTML += `<p class="info-window__organization">${organization}</p>`;

	return container;
}

const buildInfoWindowWindWeather = (spot) => {
	const { avg, gust, dir_text } = spot.stations[0].values;
	const units = appSettings.units_wind.toUpperCase();

	const container = document.createElement('div');
	container.classList.add('info-window__weather', 'info-window__weather--wind');

	const gustHTML = gust ? `&nbsp;/&nbsp;${gust}<span class="units">${units}</span>` : `&nbsp;/&nbsp;--`;

	container.innerHTML += `<p class="info-window__stat info-window__wind"><svg aria-hidden="true" focusable="false"><use xlink:href="#gust"></use></svg>${avg}<span class="units">${units}</span>${gustHTML}</p>`;
	container.innerHTML += `<p class="info-window__stat info-window__dir"><svg aria-hidden="true" focusable="false"><use xlink:href="#direction"></use></svg>${(dir_text) ? dir_text.toUpperCase() : '--'}</p>`;

	return container;
}

const buildInfoWindowAirWeather = (spot) => {
	const { atemp, humidity, precip, pres } = spot.stations[0].values;
	const units = appSettings.units_temp.toUpperCase();

	const container = document.createElement('div');
	container.classList.add('info-window__weather', 'info-window__weather--air');

	container.innerHTML += `<p class="info-window__stat info-window__temp"><svg aria-hidden="true" focusable="false"><use xlink:href="#thermometer"></use></svg>${(atemp) ? Math.round(atemp) + '&deg;' : '--'}</p>`;
	container.innerHTML += `<p class="info-window__stat info-window__humidity"><svg aria-hidden="true" focusable="false"><use xlink:href="#drops"></use></svg>${(humidity) ? humidity + '<span class="units">&#65130;</span>' : '--'}</p>`;
	container.innerHTML += `<p class="info-window__stat info-window__pressure"><svg aria-hidden="true" focusable="false"><use xlink:href="#guage"></use></svg>${(pres) ? Math.round(pres) : '--'}</p>`;
	container.innerHTML += `<p class="info-window__stat info-window__precip"><svg aria-hidden="true" focusable="false"><use xlink:href="#umbrella"></use></svg>${(precip) ? precip : '--'}</p>`;

	return container;
}

const handleListingClick = (spot) => {
	return (e) => {
		e.preventDefault();

		buildInfoWindowContent(spot);
		closeAllInfoWindows();
		selectSpot(spot);

		setInfoWindowPositionAndShow(spot.marker.infoWindow);
	}
}

const handleListingMouseOver = (spot) => {
	return (e) => {
		e.preventDefault();
		
		
		spot.highlight();
	}
}

const handleListingMouseOut = (spot) => {
	return (e) => {
		e.preventDefault();
		
		if (spot.selected === true) return;

		spot.resetAppearance();
	}
}

const handleShowMoreListingsClick = (e) => {
	e.target.parentElement.remove();
	addSpotListings();
}

const selectSpot = (spot) => {
	if (!isSpotListingRendered) return;

	spot.select();
	if (appState['activeSpot']) appState['activeSpot'].deselect();

	appState['activeSpot'] = spot;
}

const bringSpotListingIntoView = (spot) => {
	if (!spot) return;

	const { spots } = appState;
	const showMoreButton = document.getElementById('show-more-button-container');
	const spotIndex = getSpotIndex(spot);
	let renderedSpotListing;

	if (isSpotListingRendered(spot)) {
		getSpotListingElement(spot).scrollIntoView({ behavior: "smooth" });
		return;
	};

	if (showMoreButton) showMoreButton.remove();
	addSpotListings(spots, spotIndex + 1);
	
	renderedSpotListing = document.getElementById(spot.id);
	renderedSpotListing.scrollIntoView({ behavior: "smooth" });
}

const getSpotIndex = (spot) => {
	if (!spot) return;

	return appState.spots.findIndex(currentSpot => currentSpot.id === spot.id );
}

const getSpotListingElement = (spot) => {
	if (!spot) return;

	return document.getElementById(`${spot.id}`);
}

const isSpotListingRendered = (spot) => {
	return getSpotListingElement(spot) ? true : false;
}

const buildQueryString = () => {
	const requestParams = {
		'units_wind': appSettings.units_wind,
		'units_temp': appSettings.units_temp,
		'units_distance': appSettings.units_distance,
		'lat_min': appState['lat_min'],
		'lat_max': appState['lat_max'],
		'lon_min': appState['lon_min'],
		'lon_max': appState['lon_max'],
		'zoom': appState['zoom'],
	}	
	let queryString = '';

	Object.entries(requestParams).map(([key, value]) => queryString += `&${key}=${value}`);

	return queryString;
}

const fetchData = async (queryString) => {
	const url = `https://shoreco.dev/weatherflow/api-wrapper/?${queryString}`;
	const options = {
		method: 'GET',
		mode: 'cors'
	}
	const response = await fetch(url, options);
	const data = await response.json();
	
	return data;
}

const getMarkerIcon = (spot, active) => {
	const markerIconPath = 'M437,75c100,100,100,262.1,0,362S175,537,75,437S-25,175,75,75S337-25,437,75z M255.9,394c9,0.1,17-5.4,20.5-13.9l79.2-198 c3.8-9.6,0.4-20.9-8.3-26.5c-8.7-5.7-20.4-4.5-27.1,2.2L256,222.1l-63.6-63.6c-7.4-7.4-19-8.6-27.7-2.8c-1.3,0.8-2.4,1.8-2.8,2.2 c-6.9,6.9-8.8,16.1-5.5,24.3l79.2,198C239,388.6,247.6,393.4,255.9,394L255.9,394z';
	const color = spot.organization === 'WeatherFlow' ? getMarkerColor(spot.stations[0].values.avg, active, true) : getMarkerColor(spot.stations[0].values.avg, active);
	const scale = 0.05;
	const rotation = spot.stations[0].values.dir;
	const strokeColor = 'white';
	const strokeOpacity = spot.organization === 'WeatherFlow' ? 0.9 : 0.75;
	const strokeWeight = 1;

	return {
		path: markerIconPath,
		fillColor: color,
		fillOpacity: 1,
		strokeColor,
		strokeOpacity,
		strokeWeight,
		scale,
		rotation,
		anchor: new google.maps.Point(256, 256),
		labelOrigin: new google.maps.Point(256, 256),
		origin: new google.maps.Point(256, 256),
	}
};

const getMarkerLabel = (spot, active) => {
	const className = active ? 'marker-label-active' : 'marker-label';
	const color = active ? 'white' : 'black';

	return {
		text: `${Math.round(spot.stations[0].values.avg)}`,
		className,
		color,
		fontSize: '12.5px',
		fontFamily: 'Karla',
		fontWeight: 'bold'
	}
}

const getMarkerColor = (avg, active, wf) => {
	if (active) return 'hsla(27, 100%, 44%, 1.0)';

	const hue = 200 + (200 * (avg / 200));

	return wf ? 'hsla(110, 100%, 31%, 1.0)' :`hsla(${hue}, 90%, 50%, 1)`;
}

const initViewportHeightFix = (() => {
	let vh = window.innerHeight * 0.01;	document.documentElement.style.setProperty('--vh', `${vh}px`);

	// We listen to the resize event
	window.addEventListener('resize', () => {
		let vh = window.innerHeight * 0.01;
		document.documentElement.style.setProperty('--vh', `${vh}px`);
	});
})();