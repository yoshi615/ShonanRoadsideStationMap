// 定数定義
const MAP_CONFIG = {
	defaultCenter: [137.726, 36.2048],
	defaultZoom: 4,
	targetCenter: [140.02295862179918, 35.85767560509979],
	targetZoom: 18,
	targetPitch: 60,
	style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'
};

const ROUTES = [
	[
		[140.02247036374916, 35.857351475012855],
		[140.02249263591895, 35.85734696883766],
		[140.0229420793391, 35.85764094599428],
		[140.02314815712387, 35.85775912092171]
	],
	[
		[140.02247036374916, 35.857351475012855],
		[140.02249263591895, 35.85734696883766],
		[140.0229420793391, 35.85764094599428],
		[140.02298434465897, 35.857605347669946],
		[140.02307848872718, 35.85759777135079],
		[140.02326252210872, 35.857550232721074],
		[140.0232989863063, 35.8576449377277]
	],
	null, // 現在地→てんと棟
	null  // 現在地→つばさ棟
];

const ROUTE_COLORS = ['#b3b3ff', '#ffb84d', '#4db3ff', '#4dffe1', '#4dff4d', '#ffe14d', '#ff85ff'];
const DESTINATIONS = {
	tent: [140.02247036374916, 35.857351475012855],
	tsubasa: [140.0232989863063, 35.8576449377277]
};

let map;

function init() {
	if (typeof data === 'undefined' || !data.main || !data.main.values) {
		return;
	}
	
	const rows = data.main.values;
	initMap();
	setupSNSButtons(rows);
	setupRouteControls();
}

function initMap() {
	map = new maplibregl.Map({
		container: 'map',
		style: MAP_CONFIG.style,
		center: MAP_CONFIG.defaultCenter,
		zoom: MAP_CONFIG.defaultZoom,
		pitchWithRotate: true,
		touchPitch: true,
		touchZoomRotate: true,
		pitch: 0
	});

	map.on('style.load', () => {
		loadAreaData();
		addParkingLots();
		showGuidePopup();
	});
}

async function loadAreaData() {
	try {
		const response = await fetch('道の駅.geojson');
		if (!response.ok) throw new Error(`HTTP ${response.status}`);
		
		const geojsonData = await response.json();
		if (!geojsonData?.type) throw new Error('Invalid GeoJSON');
		
		addAreaLayers(geojsonData);
		console.log('道の駅.geojsonを正常に読み込みました');
	} catch (error) {
		console.warn('道の駅.geojsonの読み込みをスキップしました:', error.message);
	}
}

function addAreaLayers(geojsonData) {
	map.addSource('shonan-area', {
		type: 'geojson',
		data: geojsonData
	});
	
	map.addLayer({
		id: 'shonan-area-fill',
		type: 'fill',
		source: 'shonan-area',
		paint: {
			'fill-color': '#4de7ff',
			'fill-opacity': 0.3
		}
	});
	
	map.addLayer({
		id: 'shonan-area-line',
		type: 'line',
		source: 'shonan-area',
		paint: {
			'line-color': '#4de7ff',
			'line-width': 2,
			'line-opacity': 0.8
		}
	});
}

function setupSNSButtons(rows) {
	const shonanRow = rows.find(row =>
		(row[2]?.includes('道の駅しょうなん')) ||
		(row[3]?.toLowerCase().includes('shonan'))
	);
	
	if (!shonanRow) return;
	
	const [, , , , , , SiteLink, , , InstagramLink, , , FacebookLink, , , XLink] = shonanRow;
	
	const buttons = {
		'btn-x': XLink,
		'btn-instagram': InstagramLink,
		'btn-home': SiteLink,
		'btn-facebook': FacebookLink
	};
	
	Object.entries(buttons).forEach(([id, link]) => {
		const btn = document.getElementById(id);
		if (btn && link) {
			btn.onclick = () => window.open(link, '_blank');
		}
	});
}

function setupRouteControls() {
	const toggleBtn = document.getElementById('show-routes-btn');
	const panel = document.getElementById('routes-panel');
	
	if (!toggleBtn || !panel) return;
	
	toggleBtn.addEventListener('click', () => {
		const isVisible = panel.classList.contains('show');
		panel.classList.toggle('show', !isVisible);
	});
	
	// ルートスイッチのセットアップ
	ROUTES.forEach((_, idx) => {
		const checkbox = document.getElementById(`route-${idx}`);
		if (!checkbox) return;
		
		checkbox.addEventListener('change', () => {
			if (checkbox.checked) {
				// 他のルートを非表示
				ROUTES.forEach((_, otherIdx) => {
					if (otherIdx !== idx) {
						const otherCheckbox = document.getElementById(`route-${otherIdx}`);
						if (otherCheckbox?.checked) {
							otherCheckbox.checked = false;
							hideRoute(otherIdx);
						}
					}
				});
				showRoute(idx);
			} else {
				hideRoute(idx);
			}
		});
	});
}

async function showRoute(idx) {
	let coords = ROUTES[idx];
	
	// 現在地ルートの場合はAPI取得
	if ((idx === 2 || idx === 3) && map._currentLocationMarker) {
		const current = map._currentLocationMarker.getLngLat();
		const destination = idx === 2 ? DESTINATIONS.tent : DESTINATIONS.tsubasa;
		
		try {
			coords = await fetchRoute([current.lng, current.lat], destination);
			ROUTES[idx] = coords;
			
			// 経路全体を表示
			const bounds = new maplibregl.LngLatBounds();
			coords.forEach(coord => bounds.extend(coord));
			map.fitBounds(bounds, { padding: 80, maxZoom: 18, duration: 800 });
		} catch (error) {
			console.warn('ルート取得エラー:', error);
			document.getElementById(`route-${idx}`).checked = false;
			return;
		}
	}
	
	if (!coords) return;
	
	addRouteToMap(idx, coords);
}

async function fetchRoute(start, end) {
	const url = `https://router.project-osrm.org/route/v1/foot/${start[0]},${start[1]};${end[0]},${end[1]}?overview=full&geometries=geojson`;
	
	const response = await fetch(url);
	if (!response.ok) throw new Error(`HTTP ${response.status}`);
	
	const data = await response.json();
	if (!data.routes?.length) throw new Error('No routes found');
	
	return data.routes[0].geometry.coordinates;
}

function addRouteToMap(idx, coords) {
	const sourceId = `route-${idx}`;
	const layerId = `route-layer-${idx}`;
	const popupId = `route-popup-${idx}`;
	
	// 既存を削除
	removeRoute(idx);
	
	// ソース追加
	map.addSource(sourceId, {
		type: 'geojson',
		data: {
			type: 'Feature',
			geometry: { type: 'LineString', coordinates: coords }
		}
	});
	
	// レイヤー追加
	map.addLayer({
		id: layerId,
		type: 'line',
		source: sourceId,
		layout: { 'line-join': 'round', 'line-cap': 'round' },
		paint: {
			'line-color': ROUTE_COLORS[idx % ROUTE_COLORS.length],
			'line-width': 5
		}
	});
	
	// 距離表示ポップアップ
	const distance = calculateDistance(coords);
	const walkTime = Math.round(distance / 80);
	const distanceText = distance < 1000 ? `${distance.toFixed(0)}m` : `${(distance/1000).toFixed(2)}km`;
	const text = `徒歩約${walkTime}分 (${distanceText})`;
	
	const midpoint = getLineMidpoint(coords);
	const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false })
		.setLngLat(midpoint)
		.setHTML(`<div style="font-size:14px;font-weight:bold;">${text}</div>`)
		.addTo(map);
	
	if (!map._routePopups) map._routePopups = {};
	map._routePopups[popupId] = popup;
}

function hideRoute(idx) {
	removeRoute(idx);
	
	// 現在地ルートがすべてオフなら地図をリセット
	if (idx === 2 || idx === 3) {
		const route2 = document.getElementById('route-2');
		const route3 = document.getElementById('route-3');
		if (!route2?.checked && !route3?.checked) {
			resetMapView();
		}
	}
}

function removeRoute(idx) {
	const sourceId = `route-${idx}`;
	const layerId = `route-layer-${idx}`;
	const popupId = `route-popup-${idx}`;
	
	if (map.getLayer(layerId)) map.removeLayer(layerId);
	if (map.getSource(sourceId)) map.removeSource(sourceId);
	
	if (map._routePopups?.[popupId]) {
		map._routePopups[popupId].remove();
		delete map._routePopups[popupId];
	}
}

function calculateDistance(coords) {
	let total = 0;
	for (let i = 1; i < coords.length; i++) {
		const [lon1, lat1] = coords[i-1];
		const [lon2, lat2] = coords[i];
		total += getDistanceBetweenPoints(lat1, lon1, lat2, lon2);
	}
	return total;
}

function getDistanceBetweenPoints(lat1, lon1, lat2, lon2) {
	const R = 6371000;
	const toRad = x => x * Math.PI / 180;
	const dLat = toRad(lat2 - lat1);
	const dLon = toRad(lon2 - lon1);
	const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
		Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
		Math.sin(dLon/2) * Math.sin(dLon/2);
	return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function getLineMidpoint(coords) {
	const totalDistance = calculateDistance(coords);
	let accumulated = 0;
	
	for (let i = 1; i < coords.length; i++) {
		const [lon1, lat1] = coords[i-1];
		const [lon2, lat2] = coords[i];
		const segmentDistance = getDistanceBetweenPoints(lat1, lon1, lat2, lon2);
		
		if (accumulated + segmentDistance >= totalDistance / 2) {
			const ratio = (totalDistance / 2 - accumulated) / segmentDistance;
			return [
				lon1 + (lon2 - lon1) * ratio,
				lat1 + (lat2 - lat1) * ratio
			];
		}
		accumulated += segmentDistance;
	}
	return coords[0];
}

function resetMapView() {
	map.flyTo({
		center: MAP_CONFIG.targetCenter,
		zoom: MAP_CONFIG.targetZoom,
		pitch: MAP_CONFIG.targetPitch,
		speed: 0.8,
		curve: 1.5,
		essential: true
	});
}

function showCurrentLocation() {
	if (!navigator.geolocation) return;
	
	if (map._currentLocationWatcherId) {
		navigator.geolocation.clearWatch(map._currentLocationWatcherId);
	}
	
	map._currentLocationWatcherId = navigator.geolocation.watchPosition(
		pos => {
			if (map._currentLocationMarker) {
				map._currentLocationMarker.remove();
			}
			
			const el = document.createElement('div');
			el.style.cssText = `
				background-image: url(images/cp_blue2.png);
				width: 40px; height: 40px;
				background-size: contain;
				background-repeat: no-repeat;
				border-radius: 50%;
			`;
			
			map._currentLocationMarker = new maplibregl.Marker({ element: el })
				.setLngLat([pos.coords.longitude, pos.coords.latitude])
				.addTo(map);
		},
		error => console.warn('位置情報取得エラー:', error.message),
		{ enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
	);
}

function showGuidePopup() {
	const guideHtml = `
		<div style="width:230px;">
			<b>つかいかた</b><br>
			<span class="guide-popup-lines">
				・地図をドラッグして移動できます<br>
				・マウスホイールやピンチで拡大縮小<br>
				・ルート表示ボタンで経路を表示<br>
				・下記のような青いマーカーが現在地です<br>
			</span>
			<img src="images/arrow.png" style="width:50px;height:50px;position:absolute;left:45px;top:117px;"><br>
			<img src="images/cp_blue2.png" style="width:40px;height:40px;margin:8px 0;"><br>
			<button id="close-guide-popup" style="margin-top:16px;padding:8px 24px;border-radius:6px;background:#4de7ff;color:#222;font-weight:bold;border:none;cursor:pointer;">閉じる</button>
		</div>
	`;
	
	const popup = new maplibregl.Popup({
		closeButton: false,
		closeOnClick: false,
		className: 'guide-popup'
	})
		.setLngLat(map.getCenter())
		.setHTML(guideHtml)
		.addTo(map);
	
	setTimeout(() => {
		const btn = document.getElementById('close-guide-popup');
		if (btn) {
			btn.onclick = () => {
				popup.remove();
				startInitialFlyTo();
			};
		}
	}, 0);
}

function startInitialFlyTo() {
	map.flyTo({
		center: MAP_CONFIG.targetCenter,
		zoom: MAP_CONFIG.targetZoom,
		pitch: MAP_CONFIG.targetPitch,
		speed: 0.8,
		curve: 1.5,
		essential: true
	});
	showCurrentLocation();
}

function addParkingLots() {
	const parkingData = [
		{
			id: 'p1-parking',
			name: 'P1駐車場',
			coordinates: [[
				[140.02305617165973, 35.856743052557476],
				[140.02308, 35.85672], [140.02312, 35.85670], [140.02316, 35.85669],
				[140.02321710418968, 35.856664792558526], [140.0233284158564, 35.85674033519591],
				[140.0234310103444, 35.856639792820964], [140.0234886778473, 35.856685987983184],
				[140.0236690564004, 35.85709196077594], [140.02352555822168, 35.85723598007687],
				[140.02352287601283, 35.857240327825174], [140.02352354656506, 35.85724521904175],
				[140.02351751159514, 35.8573283696773], [140.02340, 35.85720], [140.02330, 35.85715],
				[140.02320, 35.85710], [140.02315, 35.85708], [140.02310, 35.85706],
				[140.02307512454288, 35.85705226820829], [140.0230758772123, 35.85703274742992],
				[140.02307361920327, 35.85702176698772], [140.0230788878892, 35.85699858605393],
				[140.02308942526102, 35.856971744964626], [140.02309544661637, 35.856951004116034],
				[140.02309770462458, 35.85694856401588], [140.02311125267408, 35.85692660311115],
				[140.02302319035238, 35.85695222416607], [140.02301265297922, 35.85688695146025],
				[140.0231022206398, 35.8568723108464], [140.0230984572927, 35.85685156997214],
				[140.02307361920197, 35.85683753937764], [140.02305617165973, 35.856743052557476]
			]]
		},
		{
			id: 'p2-parking',
			name: 'P2駐車場',
			coordinates: [[
				[140.0238679411788, 35.85816527674272], [140.02378092433892, 35.8579013131723],
				[140.02361766417113, 35.85761249706043], [140.02377346574247, 35.857562793717356],
				[140.02389114567345, 35.85778847351408], [140.02399390841606, 35.858137738600746],
				[140.0238679411788, 35.85816527674272]
			]]
		},
		{
			id: 'p3-parking',
			name: 'P3駐車場',
			coordinates: [[
				[140.0223750940883, 35.85715136543750], [140.0223337483892, 35.85680908559884],
				[140.02284466309908, 35.85676600131863], [140.02288305553392, 35.85710349422029],
				[140.02280, 35.85708], [140.02270, 35.85707], [140.02260, 35.85706],
				[140.02250, 35.85707], [140.02242, 35.85708], [140.0223750940883, 35.85715136543750]
			]]
		},
		{
			id: 'p4-parking',
			name: 'P4駐車場',
			coordinates: [[
				[140.02078277923582, 35.857680604304086], [140.02220, 35.85740], [140.02225, 35.85725],
				[140.02220, 35.85710], [140.02215, 35.85695], [140.02210, 35.85680], [140.02195, 35.85672],
				[140.02180, 35.85667], [140.02160, 35.85663], [140.02145, 35.85661], [140.02130, 35.85660],
				[140.02110, 35.85661], [140.02090, 35.85662], [140.02075, 35.85663], [140.02070, 35.85670],
				[140.02067, 35.85700], [140.02070, 35.85720], [140.02074, 35.85740], [140.02078, 35.85760],
				[140.02078277923582, 35.857680604304086]
			]]
		}
	];
	
	parkingData.forEach(parking => {
		const sourceId = parking.id;
		const fillLayerId = `${parking.id}-fill`;
		const lineLayerId = `${parking.id}-line`;
		const labelLayerId = `${parking.id}-label`;
		
		map.addSource(sourceId, {
			type: 'geojson',
			data: {
				type: 'Feature',
				properties: { name: parking.name },
				geometry: { type: 'Polygon', coordinates: parking.coordinates }
			}
		});
		
		map.addLayer({
			id: fillLayerId,
			type: 'fill',
			source: sourceId,
			paint: { 'fill-color': '#4de7ff', 'fill-opacity': 0.6 }
		});
		
		map.addLayer({
			id: lineLayerId,
			type: 'line',
			source: sourceId,
			paint: { 'line-color': '#4de7ff', 'line-width': 2, 'line-opacity': 1.0 }
		});
		
		map.addLayer({
			id: labelLayerId,
			type: 'symbol',
			source: sourceId,
			layout: {
				'text-field': parking.name,
				'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
				'text-size': 14,
				'text-anchor': 'center'
			},
			paint: {
				'text-color': '#000000',
				'text-halo-color': '#FFFFFF',
				'text-halo-width': 2
			}
		});
	});
	
	console.log('駐車場エリア（P1-P4）を表示しました');
}

// クリーンアップ
window.addEventListener('beforeunload', () => {
	if (map?._currentLocationWatcherId) {
		navigator.geolocation.clearWatch(map._currentLocationWatcherId);
	}
});