/* ==========================================================================
   J.A.R.V.I.S. SYSTEM - CORE CONTROLLER & VOICE RECOGNITION (MOBILE READY)
   ========================================================================== */

// 1. CONFIGURATION & VARIABLES GLOBALES
let bleDevice = null;
let bleCharacteristic = null;
let currentMode = 'standard'; // Suivi de l'état pour la commande "switch"
let alertInterval = null;     // Intervalle pour le clignotement du mode Alert
let SPEED_LIMIT_KMH = 110;    // Seuil de vitesse excessive (km/h)

let audioCtx = null;          // AudioContext global débloqué au clic pour mobile
let recognition = null;
let isVoiceListening = false;

const WINZWON_SERVICE_UUID = "0000fff0-0000-1000-8000-00805f9b34fb";
const WINZWON_CHARACTERISTIC_UUID = "0000fff3-0000-1000-8000-00805f9b34fb";

// Déblocage du système audio mobile (Requis pour iOS/Android)
function initAudioContext() {
    if (!audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
            audioCtx = new AudioContextClass();
        }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

// Synthèse Vocale (J.A.R.V.I.S. parle)
function speak(text) {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel(); // Stoppe la parole en cours
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'fr-FR';
        utterance.rate = 1.0;
        utterance.pitch = 0.9; // Voix légèrement plus grave style JARVIS
        window.speechSynthesis.speak(utterance);
    }
}

// Générateur de Bip d'Alerte Tactique (Double Tonalité Warning style Cockpit)
function playWarningBeep() {
    try {
        initAudioContext();
        if (!audioCtx) return;

        const now = audioCtx.currentTime;

        // Ton 1 : Impulsion aiguë principale
        const osc1 = audioCtx.createOscillator();
        const gain1 = audioCtx.createGain();
        osc1.type = 'square'; // Onde carrée style cockpit
        osc1.frequency.setValueAtTime(960, now);
        gain1.gain.setValueAtTime(0.12, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc1.connect(gain1);
        gain1.connect(audioCtx.destination);

        // Ton 2 : Sous-harmonique de choc
        const osc2 = audioCtx.createOscillator();
        const gain2 = audioCtx.createGain();
        osc2.type = 'sawtooth';
        osc2.frequency.setValueAtTime(480, now + 0.05);
        gain2.gain.setValueAtTime(0.15, now + 0.05);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc2.connect(gain2);
        gain2.connect(audioCtx.destination);

        osc1.start(now);
        osc1.stop(now + 0.15);
        osc2.start(now + 0.05);
        osc2.stop(now + 0.2);
    } catch (e) {
        console.log("Erreur audio warning :", e);
    }
}

// Stop le clignotement si actif
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
    if (clockElement) {
        clockElement.textContent = `${hours}:${minutes}:${seconds}`;
    }
}
setInterval(updateClock, 1000);
updateClock();

// 3. GESTION DES MODES ET DES LEDS BLE
function setMode(mode) {
    const body = document.body;
    const modeDisplay = document.getElementById('modeDisplay');
    
    // Nettoyage des animations et classes de mode
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
            
            // Clignotement Jaune Chaud Vif (255, 200, 0) + Bip Warning Tactique
            let isYellowOn = false;
            alertInterval = setInterval(() => {
                if (isYellowOn) {
                    sendBleColor(0x00, 0x00, 0x00); // Éteint
                } else {
                    sendBleColor(0xff, 0xc8, 0x00); // Jaune Ambre Chaud Pur
                    playWarningBeep();             // Signal bi-ton
                }
                isYellowOn = !isYellowOn;
            }, 400); // Cadence dynamique
            break;

        case 'standard':
        default:
            body.classList.add('mode-standard');
            if (modeDisplay) modeDisplay.textContent = 'STD';
            sendBleColor(0x00, 0xf3, 0xff); // Cyan Cyan
            break;
    }
}

// 4. CONNEXION ET ENVOI BLUETOOTH (WINZWON LEDS)
async function connectBluetoothWinzwon() {
    initAudioContext();
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
    // Trame standard pour ruban LED Winzwon BLE
    const data = new Uint8Array([0x7e, 0x07, 0x05, 0x03, r, g, b, 0x00, 0xef]);
    bleCharacteristic.writeValue(data).catch(err => console.log("Erreur envoi BLE:", err));
}

// 5. BATTERIE ET GÉOLOCALISATION / VITESSE (SURVEILLANCE VITESSE EXCESSIVE)
function initBatteryAndGPS() {
    // Batterie
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

    // Vitesse GPS et alerte automatique
    if ('geolocation' in navigator) {
        navigator.geolocation.watchPosition(
            (position) => {
                const speed = position.coords.speed; // en m/s
                const speedKmH = speed ? Math.round(speed * 3.6) : 0;
                const speedVal = document.getElementById('speedVal');
                const headingVal = document.getElementById('headingVal');

                if (speedVal) speedVal.textContent = speedKmH;
                if (headingVal && position.coords.heading !== null) {
                    headingVal.textContent = `DIR (${Math.round(position.coords.heading)}°)`;
                }

                // DÉTECTION VITESSE EXCESSIVE (Seuil 110 km/h)
                if (speedKmH >= SPEED_LIMIT_KMH && currentMode !== 'alert') {
                    setMode('alert');
                    speak("Attention Monsieur, vitesse excessive. Veuillez ralentir et conduire avec prudence s'il vous plaît.");
                } else if (speedKmH < SPEED_LIMIT_KMH && currentMode === 'alert') {
                    setMode('standard');
                    speak("Vitesse réinitialisée sous le seuil critique. Retour au mode Standard.");
                }
            },
            (err) => console.log("Erreur GPS :", err),
            { enableHighAccuracy: true }
        );
    }
}

// 6. MÉTÉO (Optionnelle via Open-Meteo API)
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

// 7. RECONNAISSANCE VOCALE INTELLIGENTE (J.A.R.V.I.S.)
function initVoiceRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
        const speechText = document.getElementById('speechText');
        if (speechText) speechText.textContent = "RECONNAISSANCE VOCALE NON SUPPORTÉE";
        return;
    }

    recognition = new SpeechRecognition();
    recognition.lang = 'fr-FR';
    recognition.continuous = true;
    recognition.interimResults = false;

    recognition.onstart = () => {
        isVoiceListening = true;
        console.log("J.A.R.V.I.S. à l'écoute...");
        const speechText = document.getElementById('speechText');
        if (speechText) speechText.textContent = "J.A.R.V.I.S. À L'ÉCOUTE...";
    };

    recognition.onresult = (event) => {
        const lastIndex = event.results.length - 1;
        const transcript = event.results[lastIndex][0].transcript.toLowerCase().trim();
        
        const speechText = document.getElementById('speechText');
        if (speechText) speechText.textContent = `"${transcript.toUpperCase()}"`;

        console.log("Commande reçue :", transcript);

        // Détection élargie de la commande "switch"
        const hasSwitch = transcript.includes("switch") || 
                          transcript.includes("switche") || 
                          transcript.includes("suite") || 
                          transcript.includes("swich");

        // --- DÉTECTION DES COMMANDES VOCALES ---

        // A) MODE CHILL (Prononciations multiples)
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
            speak("Activation du mode Chill, Monsieur. Éclairage néon activé.");
        }

        // B) BASCULEMENT VIA "SWITCH" (Standard <-> Overdrive)
        else if (hasSwitch) {
            if (currentMode === 'overdrive') {
                setMode('standard');
                speak("Retour au mode Standard. Éclairage cyan rétabli.");
            } else {
                setMode('overdrive');
                speak("Mode Overdrive engagé. Puissance maximale, éclairage rouge vif.");
            }
        }

        // C) MODE ALERTE MANUEL
        else if (
            transcript.includes("alerte") || 
            transcript.includes("alert") || 
            transcript.includes("danger")
        ) {
            setMode('alert');
            speak("Alerte système activée. Éclairage jaune clignotant et signal sonore engagés.");
        }

        // D) CONNEXION BLUETOOTH
        else if (
            transcript.includes("connecte") || 
            transcript.includes("bluetooth") || 
            transcript.includes("led")
        ) {
            connectBluetoothWinzwon();
        }

        // E) HORLOGE
        else if (transcript.includes("heure") || transcript.includes("horloge")) {
            const now = new Date();
            speak(`Il est exactement ${now.getHours()} heures et ${now.getMinutes()} minutes, Monsieur.`);
        }
    };

    // Relance automatique intelligente
    recognition.onend = () => {
        isVoiceListening = false;
        setTimeout(() => {
            try {
                recognition.start();
            } catch(e) {}
        }, 300);
    };

    recognition.onerror = (err) => {
        console.log("Erreur reconnaissance :", err.error);
        if (err.error === 'not-allowed') {
            alert("Veuillez autoriser l'accès au microphone dans les réglages de votre navigateur mobile.");
        }
    };
}

// DÉCLENCHEUR TACTILE POUR MOBILE (DÉBLOQUE MICRO + AUDIO)
async function startJarvisSystem() {
    initAudioContext();
    
    // Demande d'accès explicite au micro pour téléphone
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(track => track.stop()); // Libère le flux après autorisation
        } catch (err) {
            console.log("Erreur permission micro mobile :", err);
        }
    }

    if (recognition && !isVoiceListening) {
        try {
            recognition.start();
        } catch(e) {}
    }
}

// INITIALISATION AU CHARGEMENT DU DOM
window.addEventListener('DOMContentLoaded', () => {
    initBatteryAndGPS();
    fetchWeather();
    initVoiceRecognition();

    // Attachement de l'interaction tactile pour mobile
    document.body.addEventListener('click', startJarvisSystem, { once: true });
    document.body.addEventListener('touchstart', startJarvisSystem, { once: true });
});
