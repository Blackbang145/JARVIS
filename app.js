/* ==========================================================================
   J.A.R.V.I.S. SYSTEM - FORCAGE MICRO & AUDIO (OPTIMISÉ ANDROID / PWA)
   ========================================================================== */

let bleDevice = null;
let bleCharacteristic = null;
let currentMode = 'standard';
let alertInterval = null;
let SPEED_LIMIT_KMH = 110;

let audioCtx = null;
let recognition = null;
let isVoiceListening = false;
let isSystemActive = false;

const WINZWON_SERVICE_UUID = "0000fff0-0000-1000-8000-00805f9b34fb";
const WINZWON_CHARACTERISTIC_UUID = "0000fff3-0000-1000-8000-00805f9b34fb";

// 1. DÉBLOCAGE DÉFINITIF DU SYSTÈME AUDIO (HAUT-PARLEURS)
function forceUnlockAudio() {
    if (!audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
            audioCtx = new AudioContextClass();
        }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    // Joue un son inaudible pour débloquer le canal SpeechSynthesis d'Android
    if ('speechSynthesis' in window) {
        const silentUtterance = new SpeechSynthesisUtterance('');
        silentUtterance.volume = 0;
        window.speechSynthesis.speak(silentUtterance);
    }
}

// SYNTHÈSE VOCALE
function speak(text) {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'fr-FR';
        utterance.rate = 1.0;
        utterance.pitch = 0.9;
        window.speechSynthesis.speak(utterance);
    }
}

// SIGNAL SONORE
function playWarningBeep() {
    try {
        forceUnlockAudio();
        if (!audioCtx) return;

        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(880, now);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start(now);
        osc.stop(now + 0.2);
    } catch (e) {
        console.log("Erreur audio warning :", e);
    }
}

function stopAlertBlinking() {
    if (alertInterval) {
        clearInterval(alertInterval);
        alertInterval = null;
    }
}

// 2. HORLOGE
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

// 3. GESTION DES MODES ET DES LEDS BLE
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
            break;

        case 'overdrive':
            body.classList.add('mode-overdrive');
            if (modeDisplay) modeDisplay.textContent = 'OVERDRIVE';
            sendBleColor(0xff, 0x00, 0x00); // Rouge Vif
            break;

        case 'alert':
            body.classList.add('mode-alert');
            if (modeDisplay) modeDisplay.textContent = 'ALERT';
            
            let isYellowOn = false;
            alertInterval = setInterval(() => {
                if (isYellowOn) {
                    sendBleColor(0x00, 0x00, 0x00);
                } else {
                    sendBleColor(0xff, 0xc8, 0x00);
                    playWarningBeep();
                }
                isYellowOn = !isYellowOn;
            }, 400);
            break;

        case 'standard':
        default:
            body.classList.add('mode-standard');
            if (modeDisplay) modeDisplay.textContent = 'STD';
            sendBleColor(0x00, 0xf3, 0xff); // Cyan Cyan
            break;
    }
}

// 4. CONNEXION BLUETOOTH (WINZWON LEDS)
async function connectBluetoothWinzwon() {
    forceUnlockAudio();
    const btn = document.getElementById('bleBtn');
    try {
        if (btn) btn.textContent = "RECHERCHE...";
        
        bleDevice = await navigator.bluetooth.requestDevice({
            acceptAllDevices: true,
            optionalServices: [WINZWON_SERVICE_UUID]
        });

        const server = await bleDevice.gatt.connect();
        const service = await server.getPrimaryService(WINZWON_SERVICE_UUID);
        bleCharacteristic = await service.getCharacteristic(WINZWON_CHARACTERISTIC_UUID);

        if (btn) {
            btn.textContent = "LED CONNECTÉES ⚡";
            btn.style.borderColor = "#00ff88";
            btn.style.color = "#00ff88";
        }
        speak("Connexion Bluetooth établie avec les LEDs Winzwon, Monsieur.");
    } catch (error) {
        console.error("Erreur Bluetooth :", error);
        if (btn) btn.textContent = "ÉTABLIR LA CONNEXION BLE ⚡";
        speak("Échec de la connexion Bluetooth.");
    }
}

function sendBleColor(r, g, b) {
    if (!bleCharacteristic) return;
    const data = new Uint8Array([0x7e, 0x07, 0x05, 0x03, r, g, b, 0x00, 0xef]);
    bleCharacteristic.writeValue(data).catch(err => console.log("Erreur envoi BLE:", err));
}

// 5. BATTERIE ET GPS
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
                const speedKmH = speed ? Math.round(speed * 3.6) : 0;
                const speedVal = document.getElementById('speedVal');
                const headingVal = document.getElementById('headingVal');

                if (speedVal) speedVal.textContent = speedKmH;
                if (headingVal && position.coords.heading !== null) {
                    headingVal.textContent = `DIR (${Math.round(position.coords.heading)}°)`;
                }

                if (speedKmH >= SPEED_LIMIT_KMH && currentMode !== 'alert') {
                    setMode('alert');
                    speak("Attention Monsieur, vitesse excessive. Veuillez ralentir.");
                } else if (speedKmH < SPEED_LIMIT_KMH && currentMode === 'alert') {
                    setMode('standard');
                    speak("Vitesse réinitialisée sous le seuil critique.");
                }
            },
            (err) => console.log("Erreur GPS :", err),
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
                if (weatherDesc) weatherDesc.textContent = "EN DIRECT";
            }
        } catch (e) {
            console.log("Erreur météo:", e);
        }
    });
}

// 7. MOTEUR VOCAL FORCÉ ET RECYCLÉ
function setupVoiceEngine() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        const speechText = document.getElementById('speechText');
        if (speechText) speechText.textContent = "NAVIGATEUR NON COMPATIBLE";
        return;
    }

    recognition = new SpeechRecognition();
    recognition.lang = 'fr-FR';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
        isVoiceListening = true;
        const speechText = document.getElementById('speechText');
        if (speechText) speechText.textContent = "🔴 J.A.R.V.I.S. À L'ÉCOUTE...";
    };

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript.toLowerCase().trim();
        const speechText = document.getElementById('speechText');
        if (speechText) speechText.textContent = `"${transcript.toUpperCase()}"`;

        console.log("Commande reçue :", transcript);

        const hasSwitch = transcript.includes("switch") || 
                          transcript.includes("switche") || 
                          transcript.includes("suite") || 
                          transcript.includes("swich");

        if (
            transcript.includes("chill") || 
            transcript.includes("tchill") || 
            transcript.includes("chille") || 
            transcript.includes("tchille") ||
            transcript.includes("qu'il") || 
            transcript.includes("quil") || 
            transcript.includes("kill")
        ) {
            setMode('chill');
            speak("Activation du mode Chill, Monsieur.");
        }
        else if (hasSwitch) {
            if (currentMode === 'overdrive') {
                setMode('standard');
                speak("Retour au mode Standard.");
            } else {
                setMode('overdrive');
                speak("Mode Overdrive engagé.");
            }
        }
        else if (transcript.includes("alerte") || transcript.includes("alert") || transcript.includes("danger")) {
            setMode('alert');
            speak("Alerte système activée.");
        }
        else if (transcript.includes("connecte") || transcript.includes("bluetooth") || transcript.includes("led")) {
            connectBluetoothWinzwon();
        }
        else if (transcript.includes("heure") || transcript.includes("horloge")) {
            const now = new Date();
            speak(`Il est exactement ${now.getHours()} heures et ${now.getMinutes()} minutes.`);
        }
    };

    recognition.onend = () => {
        isVoiceListening = false;
        // Relance automatique immédiate si le système est actif
        if (isSystemActive) {
            setTimeout(() => {
                startListeningLoop();
            }, 200);
        }
    };

    recognition.onerror = (err) => {
        isVoiceListening = false;
        console.log("Erreur vocal :", err.error);
        if (isSystemActive && (err.error === 'no-speech' || err.error === 'network' || err.error === 'aborted')) {
            setTimeout(() => {
                startListeningLoop();
            }, 300);
        }
    };
}

function startListeningLoop() {
    if (!recognition || isVoiceListening) return;
    try {
        recognition.start();
    } catch (e) {
        console.log("Tentative redémarrage micro...", e);
    }
}

// FONCTION DE DÉCLENCHEMENT FORCÉ (CLIC / BOUTON)
async function forceActivateSystem() {
    forceUnlockAudio();
    isSystemActive = true;

    const btn = document.getElementById('forceStartBtn');
    if (btn) {
        btn.textContent = "SYSTÈME ACTIF 🟢";
        btn.style.borderColor = "#00ff88";
        btn.style.color = "#00ff88";
    }

    // Demande de permission microphone explicite
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(track => track.stop());
        } catch (err) {
            console.error("Accès micro refusé :", err);
            const speechText = document.getElementById('speechText');
            if (speechText) speechText.textContent = "ERREUR : AUTORISER LE MICRO DANS LE NAVIGATEUR";
            return;
        }
    }

    if (!recognition) setupVoiceEngine();
    
    speak("Système vocal et audio activés, Monsieur.");
    startListeningLoop();
}

// INITIALISATION
window.addEventListener('DOMContentLoaded', () => {
    initBatteryAndGPS();
    fetchWeather();
    setupVoiceEngine();

    const forceBtn = document.getElementById('forceStartBtn');
    const arcBtn = document.getElementById('arcBtn');

    if (forceBtn) forceBtn.addEventListener('click', forceActivateSystem);
    if (arcBtn) arcBtn.addEventListener('click', forceActivateSystem);
});
