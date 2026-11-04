# InfoTB REA — București–Ilfov (Web + Android APK)

Reconstrucție ușoară și fidelă **1:1** a interfeței oficiale **InfoTB** (`https://info.stb.ro/`), realizată cu **REA (Reverse Engineer Anything)** și alimentată de **API-ul TPBI** (`https://maps.mo-bi.ro/api/*`), **fără autentificare / cont și fără modulul de plăți / bilete / carduri**.

- **Web Live (GitHub Pages)**: [https://dodoloiu1.github.io/infotb-rea/](https://dodoloiu1.github.io/infotb-rea/)
- **Android APK**: disponibil în secțiunea [Releases (`v1.0.0`)](https://github.com/dodoloiu1/infotb-rea/releases)

## Funcționalități

- **Hartă interactivă implicită (Zero API Key)**: randare rapidă pe Canvas (Leaflet + OpenStreetMap argintiu) cu toate cele **3.878 de stații** STB / TPBI / Metrorex și inelele oficiale pe categorii (`#df2027` tramvai/autobuz, `#1565c0` troleibuz/regional, `#1b6e2b` metrou).
- **Vehicule în timp real prin GPS TPBI**: poziții live din `https://maps.mo-bi.ro/api/busData` pentru tramvaie, troleibuze, autobuze urbane, linii regionale și de noapte (`203` linii).
- **Sosiri în stație & Program săptămânal**: card flotant `.view-line-content` cu timpi GPS în timp real, program săptămânal tabelar (`Luni - Vineri`, `Sâmbătă`, `Duminică`) și bară de reîmprospătare la 20 secunde.
- **Planificator multimodal de rute (`De la` → `Până la`)**: integrare TPBI `/api/Route` pe Android + motor local multimodal RAPTOR (tramvai, troleibuz, autobuz, metrou M1–M5) pe Web/GitHub Pages, cu opțiuni avansate (distanță maximă pe jos, filtre moduri, accesibilitate).
- **Favorite 100% locale (`localStorage`)**: salvare stații, linii și locații personalizate pe hartă fără cont sau autentificare.
- **Bilingv (`RO` / `EN`)** și **Notificări & Alerte trafic TPBI/STB**.

## Dezvoltare locală & Build

```bash
npm install
npm run dev        # Server dezvoltare Vite
npm run build      # Build producție Web (./dist)
```

### Build Android APK (Capacitor 7)

```bash
npx vite build
npx cap sync android
cd android && ./gradlew assembleDebug
```
