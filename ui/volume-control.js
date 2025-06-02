import { audioElements } from '/core/audio.js';

export function initAudioControls() {
  const musicSlider = document.getElementById('music-volume');
  const voiceSlider = document.getElementById('voice-volume');

  if (musicSlider) {
    const savedMusic = localStorage.getItem('musicVolume') ?? '50';
    musicSlider.value = savedMusic;
    musicSlider.addEventListener('input', () => {
      localStorage.setItem('musicVolume', musicSlider.value);
      updateVolumes();
    });
  }

  if (voiceSlider) {
    const savedVoice = localStorage.getItem('voiceVolume') ?? '50';
    voiceSlider.value = savedVoice;
    voiceSlider.addEventListener('input', () => {
      localStorage.setItem('voiceVolume', voiceSlider.value);
      updateVolumes();
    });
  }

  // Update awal saat load
  updateVolumes();
}

export function updateVolumes() {
  const getVolume = (key, defaultVal = 50) =>
    Math.min(Math.max((parseFloat(localStorage.getItem(key)) || defaultVal) / 100, 0), 1);

  const musicVol = getVolume('musicVolume');
  const voiceVol = getVolume('voiceVolume');

  if (audioElements.music) audioElements.music.volume = musicVol;
  if (audioElements.voice) audioElements.voice.volume = voiceVol;

  const sfxKeys = ['harvesting', 'watering', 'planting', 'menu', 'buying', 'coin'];
  sfxKeys.forEach(key => {
    if (audioElements[key]) audioElements[key].volume = voiceVol;
  });

  console.log('🔊 Volume Updated → Music:', musicVol, '| Voice:', voiceVol);
}
