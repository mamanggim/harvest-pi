const audioElements = {
  music: document.getElementById('bg-music'),
  voice: document.getElementById('bg-voice'),
  harvesting: document.getElementById('harvesting-sound'),
  watering: document.getElementById('watering-sound'),
  planting: document.getElementById('planting-sound'),
  menu: document.getElementById('menu-sound'),
  buying: document.getElementById('buying-sound'),
  coin: document.getElementById('coin-sound')
};

let isAudioPlaying = false;

function tryPlay(audioKey) {
  const audio = audioElements[audioKey];
  if (audio) {
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch(e => console.warn(`${audioKey} sound failed:`, e.message));
    }
  }
}

function playBgMusic() {
  const music = audioElements.music;
  if (music && !isAudioPlaying) {
    const promise = music.play();
    if (promise !== undefined) {
      promise
        .then(() => {
          console.log('Background music started');
          isAudioPlaying = true;
        })
        .catch(e => {
          console.warn('BG Music failed:', e.message);
          setTimeout(() => music.play().catch(err => console.warn('Retry failed:', err.message)), 100);
        });
    }
  }
}

function playBgVoice() {
  const voice = audioElements.voice;
  if (voice && !isAudioPlaying) {
    const promise = voice.play();
    if (promise !== undefined) {
      promise.catch(e => {
        console.warn('BG Voice failed:', e.message);
        setTimeout(() => voice.play().catch(err => console.warn('Retry voice failed:', err.message)), 100);
      });
    }
  }
}

const playHarvestingSound = () => tryPlay('harvesting');
const playWateringSound = () => tryPlay('watering');
const playPlantingSound = () => tryPlay('planting');
const playMenuSound = () => tryPlay('menu');
const playBuyingSound = () => tryPlay('buying');
const playCoinSound = () => tryPlay('coin');

export {
  playBgMusic,
  playBgVoice,
  playHarvestingSound,
  playWateringSound,
  playPlantingSound,
  playMenuSound,
  playBuyingSound,
  playCoinSound
};
