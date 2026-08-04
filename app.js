/* ==========================================================================
   7. RECONNAISSANCE VOCALE (OPTIMISÉE SPÉCIFIQUEMENT POUR ANDROID CHROME)
   ========================================================================== */
let isStarting = false;

function initVoiceRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
        const speechText = document.getElementById('speechText');
        if (speechText) speechText.textContent = "MICRO NON SUPPORTÉ (UTILISER CHROME)";
        return;
    }

    recognition = new SpeechRecognition();
    recognition.lang = 'fr-FR';
    recognition.continuous = false; // Désactivé : Android gère mieux le mode boucle via restart
    recognition.interimResults = false;

    recognition.onstart = () => {
        isVoiceListening = true;
        isStarting = false;
        console.log("J.A.R.V.I.S. Android à l'écoute...");
        const speechText = document.getElementById('speechText');
        if (speechText) speechText.textContent = "J.A.R.V.I.S. À L'ÉCOUTE...";
    };

    recognition.onresult = (event) => {
        const lastIndex = event.results.length - 1;
        const transcript = event.results[lastIndex][0].transcript.toLowerCase().trim();
        
        const speechText = document.getElementById('speechText');
        if (speechText) speechText.textContent = `"${transcript.toUpperCase()}"`;

        console.log("Commande Android reçue :", transcript);

        const hasSwitch = transcript.includes("switch") || 
                          transcript.includes("switche") || 
                          transcript.includes("suite") || 
                          transcript.includes("swich");

        // --- TRAITEMENT DES COMMANDES VOCALES ---
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

    // RELANCE AUTOMATIQUE EN BOUCLE SUR ANDROID
    recognition.onend = () => {
        isVoiceListening = false;
        isStarting = false;
        
        // Relance automatique si JARVIS est toujours actif
        if (window.jarvisActive) {
            restartSpeechAndroid();
        }
    };

    recognition.onerror = (err) => {
        console.log("Erreur Micro Android :", err.error);
        isVoiceListening = false;
        isStarting = false;

        const speechText = document.getElementById('speechText');
        
        if (err.error === 'not-allowed') {
            if (speechText) speechText.textContent = "AUTORISEZ LE MICRO DANS CHROME";
        } else if (err.error === 'network') {
            if (speechText) speechText.textContent = "CONNEXION INTERNET REQUISE (SPEECH GOOGLE)";
        } else if (err.error === 'no-speech' || err.error === 'aborted') {
            if (window.jarvisActive) {
                restartSpeechAndroid();
            }
        }
    };
}

function restartSpeechAndroid() {
    if (isStarting || isVoiceListening) return;
    isStarting = true;
    setTimeout(() => {
        try {
            if (recognition) recognition.start();
        } catch(e) {
            isStarting = false;
        }
    }, 250);
}

// DÉCLENCHEUR POUR ACTIVER LE MICRO SUR ANDROID
async function startJarvisSystem() {
    initAudioContext();
    window.jarvisActive = true;
    
    // 1. Demande la permission audio explicite
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(track => track.stop()); // Libère le micro
        } catch (err) {
            console.log("Erreur permission micro :", err);
            const speechText = document.getElementById('speechText');
            if (speechText) speechText.textContent = "ACCÈS MICRO REFUSÉ DANS LES PARAMS";
            return;
        }
    }

    // 2. Lance la reconnaissance
    if (recognition && !isVoiceListening && !isStarting) {
        restartSpeechAndroid();
    }
}

// INITIALISATION AU CHARGEMENT DU DOM
window.addEventListener('DOMContentLoaded', () => {
    initBatteryAndGPS();
    fetchWeather();
    initVoiceRecognition();

    // Tap/Click initial requis sur Chrome Android pour débloquer le micro et la voix synthétisée
    document.body.addEventListener('click', startJarvisSystem);
    document.body.addEventListener('touchstart', startJarvisSystem);
});
