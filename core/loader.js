import { setLangData, setVegetables } from './global-state.js';
import { showNotification } from '/ui/notification.js';

export async function loadData() {
  try {
    // Fetch dan validasi file bahasa
    const langRes = await fetch('/data/lang.json');
    if (!langRes.ok) throw new Error(`Failed to load lang.json: ${langRes.status}`);
    const langJson = await langRes.json();
    setLangData(langJson);
    console.log('✅ Language data loaded');

    // Fetch dan validasi file tanaman
    const vegRes = await fetch('/data/vegetables.json');
    if (!vegRes.ok) throw new Error(`Failed to load vegetables.json: ${vegRes.status}`);
    const vegJson = await vegRes.json();
    setVegetables(vegJson.vegetables);
    console.log('✅ Vegetables data loaded');
  } catch (error) {
    console.error('❌ Error loading game data:', error.message);
    showNotification('Error loading game data.');
    throw error; // Lempar error ke atas biar init tahu
  }
}
