/* ==========================================================================
   J.A.R.V.I.S. DASHBOARD - 100% TACTILE & OPTIMISÉ MOBILE
   ========================================================================== */

let bleDevice = null;
let bleCharacteristic = null;
let currentMode = 'standard';
let alertInterval = null;
let SPEED_LIMIT_KMH = 110;
let audioCtx = null;
let currentSpeed = 0;
let synthVoices = [];

const WINZWON_SERVICE_UUID = "0000fff0-0000-1000-8000-00805f9b34fb";
const WINZWON_CHARACTERISTIC_UUID = "0000fff3-0000-1000-8000-00805f9b34fb";

// 1. GESTION DES VOIX ET AUDIO SUR MOBILE
function loadVoices() {
    if ('speechSynthesis' in window) {
        synthVoices = window.speechSynthesis.getVoices();
    }
}

if ('speechSynthesis' in window) {
    loadVoices();
    if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = loadVoices;
    }
}

function initAudioEngine() {
    if (!audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) audioCtx = new AudioContextClass();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function speak(text) {
    initAudioEngine();
    
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel(); // Annule la parole précédente

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'fr-FR';
        utterance.rate = 0.95;
        utterance.pitch = 0.85;

        if (synthVoices.length === 0) loadVoices();
        const frVoice = synthVoices.find(v => v.lang && v.lang.includes('fr'));
        if (frVoice) {
            utterance.voice = frVoice;
        }

        const speechText = document.getElementById('speechText');
        if (speechText) speechText.textContent = text.toUpperCase();

        window.speechSynthesis.speak(utterance);
    }
}

function playWarningBeep() {
    try {
        initAudioEngine();
        if (!audioCtx) return;
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(900, now);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start(now);
        osc.stop(now + 0.25);
    } catch (e) {
        console.log("Erreur Beep :", e);
    }
}

function stopAlertBlinking() {
    if (alertInterval) {
        clearInterval(alertInterval);
        alertInterval = null;
    }
}

// 2. ACTIONS DES BOUTONS TACTILES
function triggerJarvisGreeting() {
    const greetings = [
        "Systèmes opérationnels. Je suis à votre entière disposition, Monsieur.",
        "Connexion à la télémétrie établie. Tous les modules fonctionnent dans les marges nominales.",
        "Bonjour Monsieur. Réacteur ARC stabilisé à cent pour cent."
    ];
    const randomSpeech = greetings[Math.floor(Math.random() * greetings.length)];
    speak(randomSpeech);
}

function toggleSwitchMode() {
    if (currentMode === 'overdrive') {
        setMode('standard');
    } else {
        setMode('overdrive');
    }
}

function playMusicControl() {
    speak("Lancement de YouTube, Monsieur. Bon voyage.");
    setTimeout(() => {
        window.location.href = "intent://www.youtube.com/#Intent;scheme=https;package=com.google.android.youtube;end";
    }, 1500);
}

function speakStatusReport() {
    const now = new Date();
    const hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const batVal = document.getElementById('batteryVal')?.textContent || "inconnue";
    const tempVal = document.getElementById('tempVal')?.textContent || "inconnue";

    speak(`Rapport de situation, Monsieur. Il est ${hours} heures ${minutes}. La batterie est à ${batVal}. Vitesse actuelle : ${currentSpeed} kilomètres heure. Température extérieure : ${tempVal}.`);
}

// 3. GESTION DES MODES ET SÉCURITÉ
function setMode(mode) {
    const body = document.body;
    const modeDisplay = document.getElementById('modeDisplay');
    
    stopAlertBlinking();
    body.classList.remove('mode-standard', 'mode-overdrive', 'mode-chill', 'mode-alert');
    currentMode = mode;

    switch(mode) {
        case 'chill':
            body.classList.add('mode-chill');
            if (modeDisplay) modeDisplay.textContent = 'CHILL';
            sendBleColor(0xff, 0x00, 0x80); // Rose Néon
            speak("Mode Chill activé. Ambiance lumineuse ajustée et paramètres de conduite assouplis, Monsieur.");
            break;

        case 'overdrive':
            body.classList.add('mode-overdrive');
            if (modeDisplay) modeDisplay.textContent = 'OVERDRIVE';
            sendBleColor(0xff, 0x00, 0x00); // Rouge Vif
            speak("Mode Overdrive engagé. Réponse châssis et télémétrie prioritaires.");
            break;

        case 'alert':
            body.classList.add('mode-alert');
            if (modeDisplay) modeDisplay.textContent = 'ALERT';
            speak("Alerte, veuillez ralentir et rouler prudemment.");
            
            let isYellowOn = false;
            alertInterval = setInterval(() => {
                if (isYellowOn) {
                    sendBleColor(0x00, 0x00, 0x00);
                } else {
                    sendBleColor(0xff, 0xc8, 0x00);
                    playWarningBeep();
                }
                isYellowOn = !isYellowOn;
            }, 350);
            break;

        case 'standard':
        default:
            body.classList.add('mode-standard');
            if (modeDisplay) modeDisplay.textContent = 'STD';
            sendBleColor(0x00, 0xf3, 0xff); // Cyan HUD
            speak("Mode Standard rétabli. Paramètres d'usine appliqués.");
            break;
    }
}

// 4. BLUETOOTH BLE
async function connectBluetoothWinzwon() {
    initAudioEngine();
    const btn = document.getElementById('bleBtn');
    try {
        if (btn) btn.textContent = "RECHERCHE BLE...";
        
        bleDevice = await navigator.bluetooth.requestDevice({
            acceptAllDevices: true,
            optionalServices: [WINZWON_SERVICE_UUID]
        });

        const server = await bleDevice.gatt.connect();
        const service = await server.getPrimaryService(WINZWON_SERVICE_UUID);
        bleCharacteristic = await service.getCharacteristic(WINZWON_CHARACTERISTIC_UUID);

        if (btn) {
            btn.textContent = "LIAISON BLE ACTIVE ⚡";
            btn.style.borderColor = "#00ff88";
            btn.style.color = "#00ff88";
        }

        speak("Bienvenue à bord de la Suzuki Dizailleur, Monsieur. Je vous souhaite un bon trajet.");

    } catch (error) {
        console.error("Erreur BLE :", error);
        if (btn) btn.textContent = "ÉTABLIR LIAISON BLE ⚡";
        speak("Échec de la connexion Bluetooth avec le véhicule.");
    }
}

function sendBleColor(r, g, b) {
    if (!bleCharacteristic) return;
    const data = new Uint8Array([0x7e, 0x07, 0x05, 0x03, r, g, b, 0x00, 0xef]);
    bleCharacteristic.writeValue(data).catch(err => console.log("Erreur BLE:", err));
}

// 5. HORLOGE, BATTERIE ET GPS
function updateClock() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    
    const clockElement = document.getElementById('clockVal');
    if (clockElement) clockElement.textContent = `${hours}:${minutes}:${seconds}`;
}
setInterval(updateClock, 1000);
updateClock();

function initBatteryAndGPS() {
    if ('getBattery' in navigator) {
        navigator.getBattery().then(battery => {
            function updateBatteryInfo() {
                const level = Math.round(battery.level * 100);
                const batVal = document.getElementById('batteryVal');
                const batBar = document.getElementById('batteryBar');
                const batStatus = document.getElementById('batteryStatus');

                if (batVal) batVal.textContent = `${level}%`;
                if (batBar) batBar.style.width = `${level}%`;
                if (batStatus) batStatus.textContent = battery.charging ? "EN CHARGE ⚡" : "SUR BATTERIE";
            }
            updateBatteryInfo();
            battery.addEventListener('levelchange', updateBatteryInfo);
            battery.addEventListener('chargingchange', updateBatteryInfo);
        });
    }

    if ('geolocation' in navigator) {
        navigator.geolocation.watchPosition(
            (position) => {
                const speed = position.coords.speed;
                currentSpeed = speed ? Math.round(speed * 3.6) : 0;
                const speedVal = document.getElementById('speedVal');
                const headingVal = document.getElementById('headingVal');

                if (speedVal) speedVal.textContent = currentSpeed;
                if (headingVal && position.coords.heading !== null) {
                    headingVal.textContent = `CAP ${Math.round(position.coords.heading)}°`;
                }

                if (currentSpeed >= SPEED_LIMIT_KMH && currentMode !== 'alert') {
                    setMode('alert');
                } else if (currentSpeed < SPEED_LIMIT_KMH && currentMode === 'alert') {
                    setMode('standard');
                    speak("Vitesse de nouveau stabilisée sous le seuil de sécurité.");
                }
            },
            (err) => console.log("GPS :", err),
            { enableHighAccuracy: true }
        );
    }
}

// 6. MÉTÉO
async function fetchWeather() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(async (pos) => {
        try {
            const lat = pos.coords.latitude;
            const lon = pos.coords.longitude;
            const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
            const data = await res.json();
            
            if (data.current_weather) {
                const temp = Math.round(data.current_weather.temperature);
                const tempVal = document.getElementById('tempVal');
                const weatherDesc = document.getElementById('weatherDesc');
                
                if (tempVal) tempVal.textContent = `${temp}°C`;
                if (weatherDesc) weatherDesc.textContent = "CAPTEUR OPTIMAL";
            }
        } catch (e) {
            console.log("Erreur Météo :", e);
        }
    });
}

// 7. INITIALISATION ET ENREGISTREMENT SERVICE WORKER
window.addEventListener('DOMContentLoaded', () => {
    initBatteryAndGPS();
    fetchWeather();
});

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').then((registration) => {
            registration.update();
            registration.onupdatefound = () => {
                const installingWorker = registration.installing;
                installingWorker.onstatechange = () => {
                    if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        window.location.reload();
                    }
                };
            };
        });
    });
}
