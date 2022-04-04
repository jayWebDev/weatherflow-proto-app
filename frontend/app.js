
function initApp() {
	let map, wfData;

	map = new google.maps.Map(document.getElementById("weather-map"), {
		center: { lat: -34.397, lng: 150.644 },
		zoom: 8,
		mapId: 'aacd46ab27a8085e'
	});

	const requestParams = {
		'units_wind': 'mph',
		'units_temp': 'f',
		'units_distance': 'mi',
	}

	let changing = false;
	let debounceTimer;

	google.maps.event.addListener(map, 'bounds_changed', async () => {
		const bounds = map.getBounds();
		const boundsNE = bounds.getNorthEast();
		const boundsSW = bounds.getSouthWest();

		requestParams['lat_min'] = boundsSW.lat();
		requestParams['lat_max'] = boundsNE.lat();
		requestParams['lon_min'] = boundsSW.lng();
		requestParams['lon_max'] = boundsNE.lng();
		requestParams['zoom'] = map.getZoom();

		if (!debounceTimer & changing) {

			debounceTimer = setTimeout(async () => {
				debounceTimer = null;
				changing = false;

				wfData = await fetchData(buildQueryString(requestParams));
				addMarkers(wfData.spots, map)
			}, 1000);
		}
		
		if (!changing) {
			wfData = await fetchData(buildQueryString(requestParams));
			addMarkers(wfData.spots, map)
		}

		changing = true;
	});
	
}

const addMarkers = (markerData, map) => {
console.log("🚀 ~ addMarkers ~ markerData", markerData)
	markerData.map(marker => {
		const currentMarker = new google.maps.Marker({
			position: { lat: marker.lat, lng: marker.lon },
			map,
			title: marker.name,
		})
	})
}

const buildQueryString = (params) => {
	let queryString = '';

	Object.entries(params).map(([key, value]) => queryString += `&${key}=${value}`);

	return queryString;
}

const fetchData = async (queryString) => {
	const url = `http://localhost:5000/weatherflow/api-wrapper/?${queryString}`;
	const response = await fetch(url);
	const data = await response.json();
  console.log("🚀 ~ fetchData ~ data", data)
	
	return data;
}