import { setLangData, setVegetables } from './global-state.js';
import { showNotification } from '/ui/notification.js';

export async function loadData() {
  try {
    const langRes = await fetch('/data/lang.json');
    const langJson = await langRes.json();
    setLangData(langJson);
    console.log('Language data loaded:', langJson);

    const vegRes = await fetch('/data/vegetables.json');
    const vegJson = await vegRes.json();
    setVegetables(vegJson.vegetables);
    console.log('Vegetables data loaded:', vegJson.vegetables);
  } catch (error) {
    console.error('Error loading data:', error.message);
    showNotification('Error loading game data.');
  }
}
