# Piazza Dante, Napoli — mappa della città

Sito statico: nessuna installazione e nessuna build. Serve solo un piccolo server
locale, perché il browser non carica moduli e dati JSON aprendo `index.html` con un doppio clic.

## Avvio in localhost

Dal terminale, dentro questa cartella:

    python3 -m http.server 8080

poi apri <http://localhost:8080>. Su Windows il comando è `py -m http.server 8080`.
In alternativa, con Node: `npx serve -l 8080`.

Serve la connessione a internet: la mappa (edifici, strade) arriva da OpenFreeMap,
il meteo da Open-Meteo, le foto degli eventi da Wikimedia Commons.

Su Windows, se il terminale non è aperto dentro la cartella, indica il percorso:

    py -m http.server 8080 --directory "C:\percorso\della\cartella\piazza-dante-napoli"

## Cosa è reale e cosa è simulato

| Parte | Stato |
| --- | --- |
| Modello 3D della home | Sagome reali degli edifici (OpenStreetMap via OpenFreeMap); facciate, tetti e altezze mancanti sono generati |
| Mappa 2D di Trasporti e Parcheggio | Dati reali OpenStreetMap, serviti da OpenFreeMap |
| Meteo, data e ora | Dati reali (Open-Meteo) |
| Qualità dell'aria | Fissata su "Scarsa" in `js/config.js` (`AIR_QUALITY_FIXED`); con `null` torna il dato reale |
| Ricerca luoghi | Elenco in `data/places.json`; con Invio cerca online su Nominatim |
| Heat map (affluenza) | Simulata, in attesa del servizio LLM |
| Linee 169, 130, 182 | Posizioni e orari dimostrativi (`data/lines.json`) |
| Parcheggi | Disponibilità dimostrativa (`data/parking.json`) |
| Eventi | Tre eventi di esempio (`data/events.json`) con foto reali dei luoghi |
| Traffic prediction | Simulata |
| Account | Non collegato |

## Foto degli eventi

Le foto vengono caricate da Wikimedia Commons e sono sotto licenza Creative Commons
Attribuzione-Condividi allo stesso modo: il credito sotto ogni card va mantenuto.

| Luogo | File su Commons | Autore | Licenza |
| --- | --- | --- | --- |
| Piazza Dante | `Piazza Dante (Naples).jpg` | IlSistemone | CC BY-SA 3.0 |
| Teatro Bellini | `TeatroBelliniNaples1.jpg` | IlSistemone | CC BY-SA 3.0 |
| Teatro di San Carlo | `Napoli - teatro di San Carlo.jpg` | Udine2812 | CC BY-SA 4.0 |

Per non dipendere da Wikimedia, scarica le immagini in una cartella `img/` e metti il
percorso locale nel campo `photo` di `data/events.json`.

## Font

I testi usano Sophia Nubian (SIL Open Font License, `fonts/OFL.txt`). Le etichette
dentro la mappa restano in Noto Sans, perché arrivano già disegnate dal server delle mappe.

## Collegare l'LLM alla heat map

In `js/config.js` imposta `ENDPOINTS.crowd` con l'URL del servizio. Il sito lo
interroga ogni 2,5 secondi e si aspetta un valore tra 0 e 1 per zona:

    { "zones": [ { "id": "centro", "affluence": 0.72 }, { "id": "toledo", "affluence": 0.4 } ] }

Le zone disponibili (`centro`, `port-alba`, `emiciclo`, `toledo`, `metro`) sono
definite in `js/crowd-feed.js`. Se il servizio non risponde, il sito torna ai dati simulati.

## Struttura

    index.html          struttura della pagina
    css/styles.css      stile; in cima font e token (celeste #12A0D7, bianchi, grigi)
    js/main.js          avvio, viste e collegamento dei componenti
    js/config.js        coordinate, inquadrature, servizi esterni, qualità dell'aria fissa
    js/map-style.js     stile della mappa: modello 3D, monocromatico, mappa 2D
    js/map-images.js    facciate, tetti e icone disegnati al volo; monumento a Dante
    js/city-map.js      mappa, movimenti di camera, traffico
    js/heat-layer.js    resa della heat map
    js/crowd-feed.js    dati di affluenza (simulati o dal servizio)
    js/pins.js          pallini con etichetta
    js/combobox.js      barra di ricerca con menu a tendina
    js/events.js        cards degli eventi
    js/conditions.js    orologio, meteo, qualità dell'aria
    data/               linee, parcheggi, luoghi, eventi
    fonts/              Sophia Nubian (regular e bold) con licenza
    vendor/             MapLibre GL JS 6.18.0 (licenza BSD-3-Clause)
