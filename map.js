let map; // グローバル変数として定義

function init() {
	// dataが未定義またはmain/valuesが未定義なら初期化しない
	if (typeof data === 'undefined' || !data.main || !data.main.values) {
		return;
	}
	
	let lastClickedMarker = null; // 最後にクリックしたマーカーを追跡
	let currentLanguage = 'japanese';
	let rows = data.main.values;

	function setLanguage(language) {
		currentLanguage = language;
		renderShonanInfo();
	}

	// 言語切り替えトグルが存在する場合のみイベントを設定
	const langToggle = document.getElementById('languageToggle');
	if (langToggle) {
		langToggle.addEventListener('change', function(e) {
			const newLanguage = e.target.checked ? 'english' : 'japanese';
			document.querySelectorAll('[data-ja], [data-en]').forEach(element => {
				element.textContent = element.getAttribute(newLanguage === 'english' ? 'data-en' : 'data-ja');
			});
			setLanguage(newLanguage);
		});
	}

	// 「道の駅しょうなん」の情報のみを表示
	function renderShonanInfo() {
		// #info要素がないので何もしない
	}

	// SNSボタンのクリックで「道の駅しょうなん」のリンクにアクセス
	function setupSNSButtons() {
		const shonanRow = rows.find(row =>
			(row[2] && row[2].includes('道の駅しょうなん')) ||
			(row[3] && row[3].toLowerCase().includes('shonan'))
		);
		if (!shonanRow) return;
		const [
			, , , , , ,
			SiteLink, , ,
			InstagramLink, , ,
			FacebookLink, , ,
			XLink
		] = shonanRow;

		// X(Twitter)ボタン
		const btnX = document.getElementById('btn-x');
		btnX.onclick = () => { if (XLink) window.open(XLink, '_blank'); };

		// Instagramボタン
		const btnInstagram = document.getElementById('btn-instagram');
		btnInstagram.onclick = () => { if (InstagramLink) window.open(InstagramLink, '_blank'); };

		// ホームページボタン
		const btnHome = document.getElementById('btn-home');
		btnHome.onclick = () => { if (SiteLink) window.open(SiteLink, '_blank'); };

		// Facebookボタン
		const btnFacebook = document.getElementById('btn-facebook');
		btnFacebook.onclick = () => { if (FacebookLink) window.open(FacebookLink, '_blank'); };
	}

	// すべてのマーカーの平均緯度と経度を計算
	let latSum = 0;
	let lonSum = 0;

	// データを取得
	let markers = [];
	initMap();

	// current marker idの変数
	let currentMarkerId = null;

	function initMap(preservePosition = false) {
		// Calculate initial center coordinates regardless of preservePosition
		latSum = 0;
		lonSum = 0;
		let validPoints = 0;
		let bounds = new maplibregl.LngLatBounds();

		rows.forEach(row => {
			const [, , , , lat, lon] = row;
			if (lat && lon) {
				latSum += parseFloat(lat);
				lonSum += parseFloat(lon);
				validPoints++;
				bounds.extend([parseFloat(lon), parseFloat(lat)]);
			}
		});

		// Default center coordinates if no valid points
		let centerLat = 35.60651518008034;  // Default latitude
		let centerLon = 140.118780167884; // Default longitude

		if (validPoints) {
			centerLat = 35.85767560509979;
			centerLon = 140.02295862179918;
		}

		// Get current view state if preserving position
		const currentCenter = preservePosition && map ? map.getCenter() : null;
		const currentZoom = preservePosition && map ? map.getZoom() : null;

		// Clear existing markers
		markers.forEach(marker => marker.remove());
		markers = [];

		// Initialize or update map
		if (!map) {
			map = new maplibregl.Map({
				container: 'map',
				style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
				center: [137.726, 36.2048],
				zoom: 4,
				pitchWithRotate: true,
				touchPitch: true,
				touchZoomRotate: true,
				pitch: 0 // ← 初期値は0、後でflyToで変更
			});
			map.on('style.load', () => {
				showGuidePopup(); // 操作ガイドを表示
			});
		} else {
			map.flyTo({
				center: [centerLon, centerLat],
				zoom: 18,
				speed: 0.8,
				curve: 1.5,
				essential: true,
				pitch: 60 // ← ここでも傾きを加える
			});
			showCurrentLocation(); // 位置情報取得＆表示
		}

		// Restore previous view if preserving position
		if (preservePosition && currentCenter && currentZoom) {
			map.setCenter(currentCenter);
			map.setZoom(currentZoom);
		}
	}

	// 2点間の距離（m）を計算（Haversine式）
	function calcDistance(lat1, lon1, lat2, lon2) {
		const R = 6371000; // 地球半径(m)
		const toRad = x => x * Math.PI / 180;
		const dLat = toRad(lat2 - lat1);
		const dLon = toRad(lon2 - lon1);
		const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
			Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
			Math.sin(dLon/2) * Math.sin(dLon/2);
		const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
		return R * c;
	}

	// 線分全体の長さ（m）を計算
	function calcLineLength(coords) {
		let sum = 0;
		for (let i = 1; i < coords.length; i++) {
			const [lon1, lat1] = coords[i-1];
			const [lon2, lat2] = coords[i];
			sum += calcDistance(lat1, lon1, lat2, lon2);
		}
		return sum;
	}

	// 線分の中間点（全長の50%地点）を返す
	function getLineMidpoint(coords) {
		const total = calcLineLength(coords);
		let acc = 0;
		for (let i = 1; i < coords.length; i++) {
			const [lon1, lat1] = coords[i-1];
			const [lon2, lat2] = coords[i];
			const seg = calcDistance(lat1, lon1, lat2, lon2);
			if (acc + seg >= total/2) {
				const ratio = (total/2 - acc) / seg;
				const lat = lat1 + (lat2 - lat1) * ratio;
				const lon = lon1 + (lon2 - lon1) * ratio;
				return [lon, lat];
			}
			acc += seg;
		}
		// fallback: 最初の点
		return coords[0];
	}

	// setupSNSButtonsを必ず呼び出す
	setupSNSButtons();

	// Add tools panel toggle functionality
	const toolsToggle = document.getElementById('tools-toggle');
	const mapTools = document.getElementById('map-tools');
	if (toolsToggle && mapTools) {
		toolsToggle.addEventListener('click', () => {
			mapTools.classList.toggle('visible');
		});
	}

	const lines = [
		[
			[140.02247036374916,35.857351475012855],
			[140.02249263591895,35.85734696883766],
			[140.0229420793391,35.85764094599428],
			[140.02314815712387,35.85775912092171]
		],
		[
			[140.02247036374916,35.857351475012855],
			[140.02249263591895,35.85734696883766],
			[140.0229420793391,35.85764094599428],
			[140.02298434465897,35.857605347669946],
			[140.02307848872718,35.85759777135079],
			[140.02326252210872,35.857550232721074],
			[140.0232989863063,35.8576449377277]
		],
		null, // [2] 現在地→てんと棟（API取得後に座標配列を格納）
		null  // [3] 現在地→つばさ棟（API取得後に座標配列を格納）
	];
	const colors = [
		'#b3b3ff', '#ffb84d', '#4db3ff', '#4dffe1', '#4dff4d', '#ffe14d', '#ff85ff'
	];

	// 線とポップアップを全て非表示にする関数
	function hideCustomLines() {
		lines.forEach((_, idx) => {
			const id = `custom-line-${idx}`;
			if (map.getLayer(id)) map.removeLayer(id);
			if (map.getSource(id)) map.removeSource(id);
			const popupId = `custom-line-popup-${idx}`;
			if (map._customLinePopups && map._customLinePopups[popupId]) {
				map._customLinePopups[popupId].remove();
				delete map._customLinePopups[popupId];
			}
		});
	}

	// 指定した線のみ表示
	async function showCustomLine(idx) {
		// 現在地ルートの場合はAPIで道路ルートを取得
		if (idx === 2 || idx === 3) {
			if (map._currentLocationMarker && map._currentLocationMarker.getLngLat) {
				const cur = map._currentLocationMarker.getLngLat();
				const start = [cur.lng, cur.lat];
				const goal = idx === 2
					? [140.02247036374916,35.857351475012855] // てんと棟
					: [140.0232989863063,35.8576449377277];   // つばさ棟

				// OSRM APIで道路ルート取得
				const url = `https://router.project-osrm.org/route/v1/foot/${start[0]},${start[1]};${goal[0]},${goal[1]}?overview=full&geometries=geojson`;
				try {
					const resp = await fetch(url);
					const data = await resp.json();
					if (data.routes && data.routes.length > 0) {
						const coords = data.routes[0].geometry.coordinates;
						lines[idx] = coords;

						// 両端点が収まるようにfitBounds
						const bounds = new maplibregl.LngLatBounds();
						bounds.extend(start);
						bounds.extend(goal);
						map.fitBounds(bounds, {
							padding: 80,
							maxZoom: 18,
							duration: 800
						});
					} else {
						alert('ルートが見つかりませんでした');
						const switchEl = document.getElementById(`route-switch-${idx}`);
						if (switchEl) switchEl.checked = false;
						return;
					}
				} catch (e) {
					alert('ルート取得に失敗しました');
					const switchEl = document.getElementById(`route-switch-${idx}`);
					if (switchEl) switchEl.checked = false;
					return;
				}
			} else {
				alert('現在地が取得できません');
				const switchEl = document.getElementById(`route-switch-${idx}`);
				if (switchEl) switchEl.checked = false;
				return;
			}
		}
		const coords = lines[idx];
		const id = `custom-line-${idx}`;
		const color = colors[idx % colors.length];

		// 既存を消してから追加
		if (map.getLayer(id)) map.removeLayer(id);
		if (map.getSource(id)) map.removeSource(id);
		const popupId = `custom-line-popup-${idx}`;
		if (map._customLinePopups && map._customLinePopups[popupId]) {
			map._customLinePopups[popupId].remove();
			delete map._customLinePopups[popupId];
		}
		if (!map._customLinePopups) map._customLinePopups = {};

		map.addSource(id, {
			'type': 'geojson',
			'data': {
				'type': 'Feature',
				'geometry': {
					'type': 'LineString',
					'coordinates': coords
				}
			}
		});
		map.addLayer({
			'id': id,
			'type': 'line',
			'source': id,
			'layout': {
				'line-join': 'round',
				'line-cap': 'round'
			},
			'paint': {
				'line-color': color,
				'line-width': 5
			}
		});

		const distanceMeters = calcLineLength(coords);
		const walkMin = Math.round(distanceMeters / 80);
		const walkText = `徒歩約${walkMin}分 (${distanceMeters < 1000 ? distanceMeters.toFixed(0) + 'm' : (distanceMeters/1000).toFixed(2) + 'km'})`;
		const midCoord = getLineMidpoint(coords);

		const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false })
			.setLngLat(midCoord)
			.setHTML(`<div style="font-size:14px;font-weight:bold;">${walkText}</div>`)
			.addTo(map);

		map._customLinePopups[popupId] = popup;
	}

	// 指定した線のみ非表示
	function hideCustomLine(idx) {
		const id = `custom-line-${idx}`;
		if (map.getLayer(id)) map.removeLayer(id);
		if (map.getSource(id)) map.removeSource(id);
		const popupId = `custom-line-popup-${idx}`;
		if (map._customLinePopups && map._customLinePopups[popupId]) {
			map._customLinePopups[popupId].remove();
			delete map._customLinePopups[popupId];
		}
		// 現在地ルートの両方がオフならズーム・中心をリセット
		if (idx === 2 || idx === 3) {
			const sw2 = document.getElementById('route-switch-2');
			const sw3 = document.getElementById('route-switch-3');
			if (sw2 && sw3 && !sw2.checked && !sw3.checked) {
				resetMapView();
			}
		}
	}

	// 地図のズーム・中心を初期状態に戻す
	function resetMapView() {
		// 初期中心座標（データがあればそれを利用）
		let centerLat = 35.85767560509979;
		let centerLon = 140.02295862179918;
		let zoom = 18;
		let pitch = 60;
		map.flyTo({
			center: [centerLon, centerLat],
			zoom: zoom,
			speed: 0.8,
			curve: 1.5,
			essential: true,
			pitch: pitch
		});
	}

	// ルート表示ボタンのイベント
	const showRoutesBtn = document.getElementById('show-routes-btn');
	const routesTogglePanel = document.getElementById('routes-toggle-panel');
	if (showRoutesBtn && routesTogglePanel) {
		showRoutesBtn.addEventListener('click', () => {
			const isVisible = routesTogglePanel.style.display === "block";
			routesTogglePanel.style.display = isVisible ? "none" : "block";
		});
	}

	// 各スイッチのイベント
	lines.forEach((_, idx) => {
		const switchEl = document.getElementById(`route-switch-${idx}`);
		if (switchEl) {
			switchEl.checked = false; // 初期は非表示
			switchEl.addEventListener('change', function() {
				if (switchEl.checked) {
					showCustomLine(idx);
				} else {
					hideCustomLine(idx);
				}
			});
		}
	});

	// 現在地が変わったら現在地ルートを再描画
	async function redrawCurrentLocationRoutes() {
		for (const idx of [2, 3]) {
			const switchEl = document.getElementById(`route-switch-${idx}`);
			if (switchEl && switchEl.checked) {
				await showCustomLine(idx);
			}
		}
	}

}

// 現在地を取得してcp_blue2.pngで表示（ライブ追従対応）
function showCurrentLocation() {
	if (!navigator.geolocation) return;

	if (map._currentLocationWatcherId) {
		navigator.geolocation.clearWatch(map._currentLocationWatcherId);
		map._currentLocationWatcherId = null;
	}

	map._currentLocationWatcherId = navigator.geolocation.watchPosition(function(pos) {
		const lng = pos.coords.longitude;
		const lat = pos.coords.latitude;

		if (map._currentLocationMarker) {
			map._currentLocationMarker.remove();
		}

		const el = document.createElement('div');
		el.style.backgroundImage = 'url(images/cp_blue2.png)';
		el.style.width = '40px';
		el.style.height = '40px';
		el.style.backgroundSize = 'contain';
		el.style.backgroundRepeat = 'no-repeat';
		el.style.borderRadius = '50%';

		const marker = new maplibregl.Marker({ element: el })
			.setLngLat([lng, lat])
			.addTo(map);

		map._currentLocationMarker = marker;

		// 現在地ルートがONなら再描画
		if (typeof redrawCurrentLocationRoutes === 'function') {
			redrawCurrentLocationRoutes();
		}
	}, function(error) {
		// エラー時は何もしない
	}, {
		enableHighAccuracy: true,
		maximumAge: 0,
		timeout: 10000
	});
}

// 操作ガイドポップアップを表示
function showGuidePopup() {
	const guideHtml = `
		<div style="max-width:320px;">
			<b>つかいかた</b><br>
			<span class="guide-popup-lines">
				・地図をドラッグして移動できます<br>
				・マウスホイールやピンチで拡大縮小<br>
				・ルート表示ボタンで経路を表示<br>
			</span>
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

	// 閉じるボタンのイベント
	setTimeout(() => {
		const btn = document.getElementById('close-guide-popup');
		if (btn) {
			btn.onclick = () => {
				popup.remove();
				const ov = document.getElementById('guide-popup-overlay');
				if (ov) ov.remove();
				startInitialFlyTo();
			};
		}
	}, 0);
}

// ポップアップ閉じた後にzoomを開始
function startInitialFlyTo() {
	let centerLat = 35.85767560509979;
	let centerLon = 140.02295862179918;
	map.flyTo({
		center: [centerLon, centerLat],
		zoom: 18,
		speed: 0.8,
		curve: 1.5,
		essential: true,
		pitch: 60
	});
	showCurrentLocation();
}