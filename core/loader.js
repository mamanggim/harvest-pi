import { setLangData, setVegetables } from './global-state.js';
import { showNotification } from '/ui/notification.js';

export async function loadData() {
  try {
    console.log('🔁 Mulai fetch lang.json');
    const langRes = await fetch('/data/lang.json');
    console.log('✅ lang.json status:', langRes.status);
    if (!langRes.ok) throw new Error(`lang.json gagal: ${langRes.status}`);
    const langJson = await langRes.json();
    console.log('✅ lang.json loaded:', langJson);
    setLangData(langJson);

    console.log('🔁 Mulai fetch vegetables.json');
    const vegRes = await fetch('/data/vegetables.json');
    console.log('✅ vegetables.json status:', vegRes.status);
    if (!vegRes.ok) throw new Error(`vegetables.json gagal: ${vegRes.status}`);
    const vegJson = await vegRes.json();
    console.log('✅ vegetables.json loaded:', vegJson);
    setVegetables(vegJson.vegetables);

    console.log('🌱 Semua data berhasil dimuat');
  } catch (error) {
    console.error('❌ Gagal load data:', error);
    showNotification('❌ Gagal load data game!');
    throw error;
  }
}
