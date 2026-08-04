// ==========================================
// 1. VARIABLES GLOBALES & ÉTATS
// ==========================================
let currentMode = 'STANDARD';
let previousMode = 'STANDARD'; // Garde en mémoire le mode avant l'alerte
let recognition = null;
let isListening = false;
let isSpeaking = false;
let bluetoothDevice = null;
let bluetoothCharacteristic = null;
let watchdogInterval = null;
let currentTemp = null;

// Gestion du Warning Sonore et Visuel
let alertInterval = null;
let audioCtx = null;

// ==========================================
// 2. GESTION DES MODES ET LEDS
// ==========================================
function setMode(mode, silent = false) {
    // Si on quitte le mode ALERT, on arrête le clignotement et le son
    if (currentMode === 'ALERT' && mode !== 'ALERT') {
        stopAlertWarning();
    }

    if (mode !== 'ALERT') {
        previousMode = mode; // Mémorise le dernier mode choisi manuellement
    }

    currentMode = mode;
    const body = document.body;
    const modeDisplay = document.getElementById('modeDisplay');

    body.classList.remove('mode-standard', 'mode-overdrive', 'mode-chill', 'mode-alert');

    if (mode === 'OVERDRIVE') {
        body.classList.add('mode-overdrive');
        if (modeDisplay) modeDisplay.innerText = 'OVD';
        updateSpeechHUD("MODE OVERDRIVE ACTIVÉ");
        if (!silent) speak("Mode Overdrive activé. Pleine puissance.");
        sendLedColor(255, 0, 0);

    } else if (mode === 'CHILL') {
        body.classList.add('mode-chill');
        if (modeDisplay) modeDisplay.innerText = 'CHILL';
        updateSpeechHUD("MODE CHILL ACTIVÉ");
        if (!silent) speak("Mode Chill activé. Ambiance relaxante.");
        sendLedColor(255, 0, 128);

    } else if (mode === 'ALERT') {
        body.classList.add('mode-alert');
        if (modeDisplay) modeDisplay.innerText = 'ALT';
        updateSpeechHUD("⚠️ EXCÈS DE VITESSE !");
        startAlertWarning(); // Déclenche le son de warning + clignotement jaune

    } else {
        body.classList.add('mode-standard');
        if (modeDisplay) modeDisplay.innerText = 'STD';
        updateSpeechHUD("MODE STANDARD ACTIVÉ");
        if (!silent) speak("Mode Standard rétabli.");
        sendLedColor(0, 243, 255);
    }
}

// ==========================================
// SYSTÈME D'ALERTE (BIPS + CLIGNOTEMENT JAUNE)
// ==========================================
function playBeepSound() {
    try {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }

        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(880, audioCtx.currentTime); // Note A5 (Aigu Warning)
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start();
        osc.stop(audioCtx.currentTime + 0.15); // Durée du bip : 150ms
    } catch (e) {
        console.warn("Erreur AudioContext :", e);
    }
}

function startAlertWarning() {
    stopAlertWarning(); // Évite les doublons d'intervalles

    let toggle = false;
    speak("Attention monsieur, vitesse excessive. Réduisez votre vitesse.");

    alertInterval = setInterval(() => {
        playBeepSound();

        // Clignotement Jaune Ambre (On/Off)
        if (toggle) {
            sendLedColor(255, 183, 0); // Jaune Ambre
            document.body.classList.add('mode-alert');
        } else {
            sendLedColor(0, 0, 0); // Éteint
            document.body.classList.remove('mode-alert');
        }
        toggle = !toggle;
    }, 500); // Clignote et bippe toutes les 500ms
}

function stopAlertWarning() {
    if (alertInterval) {
        clearInterval(alertInterval);
        alertInterval = null;
    }
}

function updateSpeechHUD(text) {
    const speechBox = document.getElementById('speechText');
    if (speechBox) speechBox.innerText = text;
}

function speak(text) {
    if ('speechSynthesis' in window) {
        pauseRecognition();
        isSpeaking = true;

        window.speechSynthesis.resume();
        window.speechSynthesis.cancel(); 

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'fr-FR';
        utterance.pitch = currentMode === 'CHILL' ? 1.0 : 0.9;
        utterance.rate = currentMode === 'CHILL' ? 1.0 : 1.1;

        utterance.onend = () => {
            isSpeaking = false;
            resumeRecognition();
        };

        utterance.onerror = () => {
            isSpeaking = false;
            resumeRecognition();
        };

        window.speechSynthesis.speak(utterance);
    }
}

function welcomeMessage() {
    updateSpeechHUD("BIENVENUE À BORD");
    speak("Bienvenue à bord de la Suzuki dizailleur monsieur, je vous souhaite un bon trajet.");
}

// ==========================================
// 3. BATTERIE
// ==========================================
function initBattery() {
    if ('getBattery' in navigator) {
        navigator.getBattery().then((battery) => {
            function updateBatteryInfo() {
                const level = Math.round(battery.level * 100);
                const batVal = document.getElementById('batteryVal');
                const batStatus = document.getElementById('batteryStatus');
                const batBar = document.getElementById('batteryBar');

                if (batVal) batVal.innerText = `${level}%`;
                if (batBar) batBar.style.width = `${level}%`;
                if (batStatus) {
                    batStatus.innerText = battery.charging ? "EN CHARGE ⚡" : "SUR BATTERIE";
                }
            }

            updateBatteryInfo();
            battery.addEventListener('levelchange', updateBatteryInfo);
            battery.addEventListener('chargingchange', updateBatteryInfo);
        });
    }
}

// ==========================================
// 4. GPS & DÉCLENCHEMENT SÉCURITÉ AUTOMATIQUE
// ==========================================
function initGPS() {
    if ("geolocation" in navigator) {
        navigator.geolocation.watchPosition(
            (position) => {
                let speedMS = position.coords.speed || 0;
                let speedKMH = Math.round(speedMS * 3.6);
                
                const speedEl = document.getElementById('speedVal');
                if (speedEl) speedEl.innerText = speedKMH;

                if (position.coords.heading !== null && !isNaN(position.coords.heading)) {
                    const headingEl = document.getElementById('headingVal');
                    const degrees = position.coords.heading;
                    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
                    const dir = directions[Math.round(degrees / 45) % 8];
                    if (headingEl) headingEl.innerText = `${dir} (${Math.round(degrees)}°)`;
                }

                // GESTION AUTOMATIQUE DE L'EXCÈS DE VITESSE (110 km/h)
                if (speedKMH >= 110) {
                    if (currentMode !== 'ALERT') {
                        setMode('ALERT'); // Activation de l'Alerte
                    }
                } else {
                    if (currentMode === 'ALERT') {
                        setMode(previousMode); // Rétablissement du mode d'origine dès la baisse de vitesse
                    }
                }

                fetchWeather(position.coords.latitude, position.coords.longitude);
            },
            (error) => console.warn("GPS error:", error.message),
            { enableHighAccuracy: true, maximumAge: 1000, timeout: 5000 }
        );
    }
}

// ==========================================
// 5. MÉTÉO
// ==========================================
async function fetchWeather(lat, lon) {
    try {
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
        const data = await res.json();
        if (data.current_weather) {
            currentTemp = Math.round(data.current_weather.temperature);
            const tempEl = document.getElementById('tempVal');
            const descEl = document.getElementById('weatherDesc');
            if (tempEl) tempEl.innerText = `${currentTemp}°C`;
            if (descEl) descEl.innerText = "TEMPÉRATURE LOCALE";
        }
    } catch (e) {}
}

// ==========================================
// 6. HORLOGE
// ==========================================
function initClock() {
    const clockEl = document.getElementById('clockVal');
    setInterval(() => {
        const now = new Date();
        if (clockEl) clockEl.innerText = now.toLocaleTimeString('fr-FR');
    }, 1000);
}

// ==========================================
// 7. RECONNAISSANCE VOCALE
// ==========================================
function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    recognition = new SpeechRecognition();
    recognition.lang = 'fr-FR';
    recognition.continuous = true;
    recognition.interimResults = false;

    recognition.onstart = () => {
        isListening = true;
        if (!isSpeaking) updateSpeechHUD("JARVIS À L'ÉCOUTE...");
    };

    recognition.onresult = (event) => {
        if (isSpeaking) return;
        const lastResultIndex = event.results.length - 1;
        const command = event.results[lastResultIndex][0].transcript;
        updateSpeechHUD(`"${command.toUpperCase()}"`);
        executeCommand(command);
    };

    recognition.onerror = () => { isListening = false; };
    recognition.onend = () => {
        isListening = false;
        if (!isSpeaking) forceRestartRecognition();
    };

    startRecognition();

    if (!watchdogInterval) {
        watchdogInterval = setInterval(() => {
            if (!isListening && !isSpeaking) forceRestartRecognition();
        }, 1500);
    }
}

function pauseRecognition() {
    if (recognition) { try { recognition.stop(); } catch (e) {} }
    isListening = false;
}

function resumeRecognition() {
    if (!isSpeaking) forceRestartRecognition();
}

function startRecognition() {
    if (isSpeaking) return;
    try { recognition.start(); isListening = true; } catch (e) {}
}

function forceRestartRecognition() {
    if (isSpeaking) return;
    if (recognition) { try { recognition.stop(); } catch (e) {} }
    setTimeout(() => { if (!isSpeaking) startRecognition(); }, 100);
}

// ==========================================
// 8. COMMANDES VOCALES
// ==========================================
function executeCommand(command) {
    if (isSpeaking) return;
    const cmd = command.toLowerCase().trim();

    // 1. ALTERNANCE / SWITCH
    if (
        cmd.includes('switch') || cmd.includes('switche') || cmd.includes('schwitch') || 
        cmd.includes('switcher') || cmd.includes('twitch') || cmd.includes('twitche') || 
        cmd.includes('witch') || cmd.includes('witche') || cmd.includes('standard')
    ) {
        setMode(currentMode === 'OVERDRIVE' ? 'STANDARD' : 'OVERDRIVE');
        return;
    }

    // 2. MODE CHILL
    if (
        cmd.includes('chill') || 
        cmd.includes('chille') || 
        cmd.includes('tchill') || 
        cmd.includes('tchille')
    ) {
        setMode('CHILL');
        return;
    }

    // 3. OVERDRIVE DIRECT
    if (cmd.includes('overdrive') || cmd.includes('sport') || cmd.includes('boost')) {
        setMode('OVERDRIVE');
        return;
    }

    // 4. INFORMATIONS
    if (cmd.includes('heure') || cmd.includes('horloge')) {
        const timeStr = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        speak(`Il est ${timeStr}.`);
        return;
    }

    if (cmd.includes('météo') || cmd.includes('température')) {
        speak(currentTemp !== null ? `Météo : ${currentTemp} degrés.` : "Récupération de la météo.");
        return;
    }

    if (cmd.includes('batterie') || cmd.includes('niveau de batterie')) {
        const batVal = document.getElementById('batteryVal');
        if (batVal) speak(`Batterie à ${batVal.innerText}.`);
        return;
    }

    // 5. APPLICATIONS
    if (cmd.includes('musique') || cmd.includes('music') || cmd.includes('youtube') || cmd.includes('joue')) {
        speak("Lancement de la musique.");
        setTimeout(() => { window.open('https://music.youtube.com', '_blank') || window.open('https://www.youtube.com', '_blank'); }, 300);
        return;
    }

    if (cmd.includes('spotify')) {
        speak("Ouverture de Spotify.");
        setTimeout(() => { window.open('https://open.spotify.com', '_blank'); }, 300);
        return;
    }

    if (cmd.includes('gps') || cmd.includes('waze') || cmd.includes('navigation')) {
        speak("Lancement de la navigation.");
        setTimeout(() => { window.open('https://waze.com/ul', '_blank'); }, 300);
        return;
    }
}

// ==========================================
// 9. CONNEXION BLUETOOTH
// ==========================================
async function connectBluetoothWinzwon() {
    try {
        if ('speechSynthesis' in window) window.speechSynthesis.resume();

        updateSpeechHUD("RECHERCHE LEDS BLE...");
        bluetoothDevice = await navigator.bluetooth.requestDevice({
            acceptAllDevices: true,
            optionalServices: [0xFFE0, 0xFFF0, '0000ffe0-0000-1000-8000-00805f9b34fb']
        });

        const server = await bluetoothDevice.gatt.connect();
        const services = await server.getPrimaryServices();
        
        for (const service of services) {
            const characteristics = await service.getCharacteristics();
            if (characteristics.length > 0) {
                bluetoothCharacteristic = characteristics[0];
                break;
            }
        }

        updateSpeechHUD("LEDS CONNECTÉES !");
        
        welcomeMessage();
        setMode(currentMode, true);

    } catch (error) {
        console.error("Erreur Bluetooth :", error);
        updateSpeechHUD("ÉCHEC CONNEXION BLE");
    }
}

function sendLedColor(r, g, b) {
    if (bluetoothCharacteristic) {
        const frame = new Uint8Array([0x7e, 0x07, 0x05, 0x03, r, g, b, 0x00, 0xef]);
        bluetoothCharacteristic.writeValue(frame).catch(err => console.error("Erreur écriture BLE :", err));
    }
}

// ==========================================
// 10. DÉMARRAGE
// ==========================================
window.onload = () => {
    setMode('STANDARD', true);
    initClock();

    const startSystem = () => {
        if ('speechSynthesis' in window) window.speechSynthesis.resume();
        initSpeechRecognition();
        initGPS();
        initBattery();
        
        document.removeEventListener('click', startSystem);
        document.removeEventListener('touchstart', startSystem);
    };

    document.addEventListener('click', startSystem);
    document.addEventListener('touchstart', startSystem);
};