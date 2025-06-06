// -------------------------------------------- //
//          data.csvへのアクセス               //
// -------------------------------------------- //

const sheetNames = ['main'];
const csvFile = 'data.csv';
let data = {};

async function fetchData(sheetName) {
	console.log('Fetching data from', csvFile);
	try {
		const response = await fetch(csvFile);
		if (!response.ok) {
			throw new Error('Failed to fetch data');
		}
		const text = await response.text();
		const rows = text.trim().split('\n').map(row => row.split(','));
		// 最初の行を削除
		rows.shift();
		return { values: rows };
	} catch (error) {
		console.error('Error fetching data:', error);
		return null;
	}
}

// ---------------------------------------------- //
// データがすべてのシートから取得されたか確認する関数 //
// ---------------------------------------------- //
async function checkAndInit() {
	const promises = sheetNames.map(sheetName => fetchData(sheetName));
	const results = await Promise.all(promises);

	if (results.every(result => result !== null)) {
		results.forEach((result, index) => {
			data[sheetNames[index]] = result;
		});
		console.log('Data object:', data);

		// Wait for both DOM and data to be ready
		if (document.readyState === 'loading') {
			document.addEventListener('DOMContentLoaded', init);
		} else {
			init();
		}
	} else {
		console.log('Failed to fetch data from some or all sheets.');
	}
}

// -------------------------------------------- //
//                さあ始めましょう               //
// -------------------------------------------- //
checkAndInit();
