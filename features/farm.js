import { getFarmPlots, setFarmPlots } from '/core/global-state.js';
import { savePlayerData } from '/core/saver.js';
import { addSafeClickListener } from '/core/utils.js';
import { updateUIText } from '/ui/language.js';

export function initializePlots() {
  const farmAreaElement = document.getElementById('farm-area');
  if (!farmAreaElement) {
    console.error('farm-area element not found');
    return;
  }

  let farmPlots = getFarmPlots();

  farmAreaElement.innerHTML = '';
  if (!farmPlots || farmPlots.length === 0) {
    farmPlots = Array.from({ length: 4 }, () => ({
      planted: false,
      vegetable: null,
      progress: 0,
      watered: false,
      currentFrame: 1,
      countdown: 0,
      totalCountdown: 0
    }));
    setFarmPlots(farmPlots);
  }

  farmPlots.forEach((plot, i) => {
    const plotElement = document.createElement('div');
    plotElement.classList.add('plot');
    plotElement.innerHTML = `
      <div class="plot-content"></div>
      <div class="countdown-bar"><div class="countdown-fill"></div></div>
      <div class="plot-status"></div>
    `;
    addSafeClickListener(plotElement, () => handlePlotClick(i));
    farmAreaElement.appendChild(plotElement);

    // ...lanjutan render tanaman dan interval tetap sama seperti aslinya
  });

  updateUIText();
}
