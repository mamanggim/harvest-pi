import { audioElements } from '/core/audio.js';

export function initAudioControls() {
  const musicSlider = document.getElementById('music-volume');
  const voiceSlider = document.getElementById('voice-volume');

  if (musicSlider) {
    musicSlider.value = localStorage.getItem('musicVolume') ?? 50;
    musicSlider.addEventListener('input', () => {
      localStorage.setItem('musicVolume', musicSlider.value);
      updateVolumes();
    });
  }

  if (voiceSlider) {
    voiceSlider.value = localStorage.getItem('voiceVolume') ?? 50;
    voiceSlider.addEventListener('input', () => {
      localStorage.setItem('voiceVolume', voiceSlider.value);
      updateVolumes();
    });
  }
}

export function updateVolumes() {
  const musicVol = Math.min(Math.max((parseFloat(localStorage.getItem('musicVolume')) || 50) / 100, 0), 1);
  const voiceVol = Math.min(Math.max((parseFloat(localStorage.getItem('voiceVolume')) || 50) / 100, 0), 1);

  if (audioElements.music) audioElements.music.volume = musicVol;
  if (audioElements.voice) audioElements.voice.volume = voiceVol;

  ['harvesting', 'watering', 'planting', 'menu', 'buying', 'coin'].forEach(key => {
    if (audioElements[key]) audioElements[key].volume = voiceVol;
  });

  console.log('Updated Volumes:', { musicVol, voiceVol });
}
