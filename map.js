let map; // グローバル変数として定義

// Remove the DOMContentLoaded wrapper and let getdata.js handle initialization
function init() {
	
	let lastClickedMarker = null; // 最後にクリックしたマーカーを追跡
	// 言語切り替え設定
	 let currentLanguage = 'japanese';
	let rows = data.main.values;
	// ...existing code...

	function setLanguage(language) {
		currentLanguage = language;
		renderShonanInfo(); // 言語切り替え時も再描画
	}

	document.getElementById('languageToggle').addEventListener('change', function(e) {
		const newLanguage = e.target.checked ? 'english' : 'japanese';
		document.querySelectorAll('[data-ja], [data-en]').forEach(element => {
			element.textContent = element.getAttribute(newLanguage === 'english' ? 'data-en' : 'data-ja');
		});
		setLanguage(newLanguage);
	});

	// 「道の駅しょうなん」の情報のみを表示
	function renderShonanInfo() {
		const info = document.getElementById('info');
		const shonanRow = rows.find(row =>
			(row[2] && row[2].includes('道の駅しょうなん')) ||
			(row[3] && row[3].toLowerCase().includes('shonan'))
		);
		if (!shonanRow) {
			info.innerHTML = 'unable to find "道の駅しょうなん" information';
			return;
		}
		// CSV列: id,category,jName,eName,lat,lon,SiteLink,SiteLinkname,english-SiteLink,InstagramLink,InstagramLinkname,english-InstagramLinkname,FacebookLink,FacebookLinkname,english-FacebookLinkname,XLink,XLinkname,english-XLinkname
		const [
			id, category, jName, eName, lat, lon,
			SiteLink, SiteLinkname, englishSiteLinkname,
			InstagramLink, InstagramLinkname, englishInstagramLinkname,
			FacebookLink, FacebookLinkname, englishFacebookLinkname,
			XLink, XLinkname, englishXLinkname
		] = shonanRow;
		const name = currentLanguage === 'japanese' ? jName : eName;
		const siteLabel = currentLanguage === 'japanese' ? SiteLinkname : englishSiteLinkname;
		const instaLabel = currentLanguage === 'japanese' ? InstagramLinkname : englishInstagramLinkname;
		const fbLabel = currentLanguage === 'japanese' ? FacebookLinkname : englishFacebookLinkname;
		const xLabel = currentLanguage === 'japanese' ? XLinkname : englishXLinkname;
		info.innerHTML = `
			<h2>${name}</h2>
			${InstagramLink ? `<a href="${InstagramLink}" target="_blank" class="info-link">${instaLabel}</a><br>` : ''}
			${FacebookLink ? `<a href="${FacebookLink}" target="_blank" class="info-link">${fbLabel}</a><br>` : ''}
			${XLink ? `<a href="${XLink}" target="_blank" class="info-link">${xLabel}</a><br>` : ''}
			${SiteLink ? `<a href="${SiteLink}" target="_blank" class="info-link">${siteLabel}</a>` : ''}
			${SiteLink ? `<iframe src="${SiteLink}" width="100%" height="400" style="border:none; background:white;"></iframe>` : ''}
		`;
	}

	// 初期メッセージを設定
	  document.getElementById('info').innerHTML = '言語の選択とアイコンをクリックまたはタップして詳細を表示';
		const element = document.getElementById('info');

		// 要素の位置を少し下げる
		element.style.marginTop = '20px';

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
			centerLat = 35.85765992012899;
			centerLon = 140.02231879551516;
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
				center: [137.726, 36.2048], // 日本の中心付近
				zoom: 4, // 日本全体が見えるズーム
				pitchWithRotate: true, // ピッチ変更を有効化
				touchPitch: true,       // 2本指上下でピッチ変更を有効化
				touchZoomRotate: true   // 2本指ピンチズーム・回転を有効化
			});
			map.on('style.load', () => {
				setTimeout(() => {
					map.flyTo({
						center: [centerLon, centerLat],
						zoom: 18,
						speed: 0.8,
						curve: 1.5,
						essential: true
					});
				}, 1000); // 1秒後に拡大開始
			});
		} else {
			map.flyTo({
				center: [centerLon, centerLat],
				zoom: 18,
				speed: 0.8,
				curve: 1.5,
				essential: true
			});
		}

		// Restore previous view if preserving position
		if (preservePosition && currentCenter && currentZoom) {
			map.setCenter(currentCenter);
			map.setZoom(currentZoom);
		}

		// マーカーをマップに追加
		rows.forEach((row, index) => {
			const [id, category, jName, eName, lat, lon, SiteLink, SiteLinkname, InstagramLink, InstagramLinkname, FacebookLink, FacebookLinkname, XLink, XLinkname] = row;

			const markerConfig = {
				0: { image: `reitaku-${id}-1.jpg`, size: '40px', radius: '50%', zIndex: '1000' }
			};

			const customMarker = document.createElement('div');
			const config = markerConfig[category] || { 
				image: `reitaku-${id}-1.jpg`, 
				size: '40px', 
				radius: '50%',
				zIndex: index
			};

			Object.assign(customMarker.style, {
				backgroundImage: `url(images/pin.png)`,
				width: config.size,
				height: config.size,
				zIndex: config.zIndex || index,
				backgroundSize: 'cover',
				cursor: 'pointer',
			});

			const marker = new maplibregl.Marker({ element: customMarker })
				.setLngLat([parseFloat(lon), parseFloat(lat)])
				.addTo(map);

			markers.push(marker);
			customMarker.title = currentLanguage === 'japanese' ? jName : eName;

			// マーカークリック時にスマホレイアウトならleft-panelを表示
			marker.getElement().addEventListener('click', () => {
				const leftPanel = document.getElementById('left-panel');
				if (window.innerWidth <= 767) {
					leftPanel.classList.remove('closed');
				}
			});
		});

		// 初期表示
		renderShonanInfo();
	}
	// create a function that regenerates the left panel based on the current marker id
	function regenerateLeftPanel() {
		// find the row that matches the current marker id
		const row = rows.find(row => row[0] === currentMarkerId);
		if (!row) return; // if no row is found, exit the function

		const [id, category, jName, eName, lat, lon, SiteLink, SiteLinkname, InstagramLink, InstagramLinkname, FacebookLink, FacebookLinkname, XLink, XLinkname] = row;

		const name = currentLanguage === 'japanese' ? jName : eName;
		document.getElementById('info').innerHTML = `
			<h2>${name}</h2>
			<a href="${InstagramLink}" target="_blank" class="info-link">${InstagramLinkname}</a><br>
			<a href="${FacebookLink}" target="_blank" class="info-link">${FacebookLinkname}</a><br>
			<a href="${XLink}" target="_blank" class="info-link">${XLinkname}</a><br>
			<a href="${SiteLink}" target="_blank" class="info-link">${SiteLinkname}</a>
			<iframe src="${SiteLink}" width="100%" height="400" style="border:none; background:white;"></iframe>
		`;
	}

	// Add panel toggle functionality
	const leftPanel = document.getElementById('left-panel');
	const panelHandle = document.getElementById('panel-handle');

	panelHandle.addEventListener('click', () => {
		if (window.innerWidth <= 767) {
			leftPanel.classList.add('closed'); // ← 追加: スマホ時は閉じる
		}
		setTimeout(() => {
			map.resize();
		}, 300);
	});

	// Add tools panel toggle functionality
	const toolsToggle = document.getElementById('tools-toggle');
	const mapTools = document.getElementById('map-tools');
	
	toolsToggle.addEventListener('click', () => {
		const isVisible = mapTools.classList.contains('visible');
		mapTools.classList.toggle('visible');
	});

}

document.addEventListener('DOMContentLoaded', () => {
    init();
});