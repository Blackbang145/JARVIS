# ⚡ J.A.R.V.I.S. - Dashboard & Driving Assistant (PWA)

Un HUD futuriste inspiré du système J.A.R.V.I.S., conçu comme une **Progressive Web App (PWA)** nativement optimisée pour smartphone embarqué (cockpit automobile). 

L'application intègre le contrôle vocal en temps réel, la géolocalisation GPS, des indicateurs système et la gestion d'un ruban LED d'habitacle via Bluetooth Low Energy (BLE).

---

## 🚀 Fonctionnalités Principales

* 🎙️ **Reconnaissance & Synthèse Vocale :** Contrôle autonome à la voix (activation des modes, horloge, statut).
* 💡 **Gestion BLE (Winzwon LEDs) :** Pilotage dynamique des couleurs d'ambiance de l'habitacle selon le mode sélectionné :
  * **Standard (STD) :** Éclairage Cyan / Bleu HUD.
  * **Chill :** Éclairage Rose Néon.
  * **Overdrive :** Éclairage Rouge Vif.
  * **Alert :** Signal d'alerte jaune clignotant avec avertisseur sonore cockpit.
* 📍 **Télémétrie GPS & Alerte Vitesse :** Affichage de la vitesse réelle en km/h, orientation et déclenchement automatique du mode **Alert** en cas de dépassement de la limite configurée (110 km/h).
* 🔋 **Moniteur Système :** Suivi de la batterie et de la charge du téléphone en temps réel.
* 🌤️ **Météo en direct :** Intégration API météo basée sur la position GPS.
* 📱 **PWA & Offline First :** Installable sur l'écran d'accueil, fonctionne hors-ligne via Service Worker.

---

## 📁 Structure du Projet

```text
├── index.html        # Interface HTML5 HUD
├── style.css         # Styles CSS3, thèmes dynamiques et animations Arc Reactor
├── app.js            # Logique centrale, Web Bluetooth, Web Speech & Audio API
├── manifest.json     # Configuration PWA pour installation mobile
├── sw.js             # Service Worker pour le cache hors-ligne
├── status.json       # Statut système et télémétrie JSON
├── jarvis2.jpeg      # Icône officielle du système
└── README.md         # Documentation
