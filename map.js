let map; // グローバル変数として定義

function init() {
	// dataが未定義またはmain/valuesが未定義なら初期化しない
	if (typeof data === 'undefined' || !data.main || !data.main.values) {
		return;
	}
	
	let lastClickedMarker = null; // 最後にクリックしたマーカーを追跡
	// 言語切り替え設定
	 let currentLanguage = 'japanese';
	let rows = data.main.values;
	// ...existing code...

	function setLanguage(language) {
		currentLanguage = language;
		renderShonanInfo(); // 言語切り替え時も再描画
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
			id, category, jName, eName, lat, lon,
			SiteLink, SiteLinkname, englishSiteLinkname,
			InstagramLink, InstagramLinkname, englishInstagramLinkname,
			FacebookLink, FacebookLinkname, englishFacebookLinkname,
			XLink, XLinkname, englishXLinkname
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
	}

	// setupSNSButtonsを必ず呼び出す
	setupSNSButtons();

	// Add tools panel toggle functionality
	const toolsToggle = document.getElementById('tools-toggle');
	const mapTools = document.getElementById('map-tools');
	if (toolsToggle && mapTools) {
		toolsToggle.addEventListener('click', () => {
			const isVisible = mapTools.classList.contains('visible');
			mapTools.classList.toggle('visible');
		});
	}

}