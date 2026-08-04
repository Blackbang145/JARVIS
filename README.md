# ⚡ J.A.R.V.I.S. - Dashboard & Driving Assistant (PWA)

Un HUD futuriste inspiré du système J.A.R.V.I.S., conçu comme une **Progressive Web App (PWA)** nativement optimisée pour smartphone embarqué (cockpit automobile).

---

## 🚀 Fonctionnalités Principales

* 🎙️ **Reconnaissance & Synthèse Vocale :** Contrôle autonome à la voix.
* 💡 **Gestion BLE (Winzwon LEDs) :** Pilotage d'ambiance d'habitacle (Standard, Chill, Overdrive, Alert).
* 📍 **Télémétrie GPS :** Vitesse réelle, orientation et alerte de vitesse (110 km/h).
* 🔋 **Moniteur Système :** Niveau de batterie et état de charge.
* 📱 **PWA & Offline First :** Support hors-ligne complet via Service Worker.

---

## 📁 Structure du Projet

```text
├── index.html        # Interface HTML5 HUD
├── style.css         # Styles CSS3 et thèmes
├── app.js            # Logique Web Bluetooth, Web Speech & Audio
├── manifest.json     # Configuration PWA
├── sw.js             # Service Worker
├── status.json       # Télémétrie JSON
└── README.md         # Documentation
