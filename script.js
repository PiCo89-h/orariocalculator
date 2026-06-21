if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('Service Worker registrato con successo!', reg))
      .catch(err => console.log('Errore nella registrazione del Service Worker:', err));
  });
}

// Funzione per salvare lo stato dei campi
function salvaStatoTemporaneo() {
    localStorage.setItem('ingresso', inputIngresso.value);
    localStorage.setItem('inizioPausa', inputInizioPausa.value);
    localStorage.setItem('finePausa', inputFinePausa.value);
}

// Funzione per ripristinare i campi all'apertura
function ripristinaStato() {
    inputIngresso.value = localStorage.getItem('ingresso') || "";
    inputInizioPausa.value = localStorage.getItem('inizioPausa') || "";
    inputFinePausa.value = localStorage.getItem('finePausa') || "";
    aggiornaCalcoliInterfaccia();
}

// Esegui questo all'avvio
window.addEventListener('load', ripristinaStato);

// Aggiungi un ascoltatore (event listener) a ogni input per salvare automaticamente
[inputIngresso, inputInizioPausa, inputFinePausa].forEach(el => {
    el.addEventListener('input', salvaStatoTemporaneo);
});


// --- STATO DELL'APPLICAZIONE ---
let calcoliOggi = {
    stdMins: 0,
    minMins: 0,
    pausaMins: 30,
    stringaStandard: "--:--"
};

let archivioBancaOre = [];
let allarmeSuonato = false;

// --- CONFIGURAZIONE INDEXEDDB ---
let db = null;
const DB_NAME = "BancaOreProDB";
const DB_VERSION = 1;
const STORE_NAME = "giornateLavorative";

// --- RIFERIMENTI DOM ---
let tabDashboard, tabArchivio, viewDashboard, viewArchivio;
let selectTipoGiornata, divPermessoOrario, inputPermessoOrario;
let inputIngresso, inputInizioPausa, inputFinePausa, inputUscita;
let pCircle, oraCentroWidget, testoContoRovescia, badgeStato, toggleNotifica, silenceAudio;
let btnSalvaGiornata, tabellaLogArchivio, totaleStoricoBancaOre, btnEsportaCSV, btnSvuotaStorico;
let btnOraIngresso, btnInizioPausa, btnFinePausa, btnOraUscita;

// --- INIZIALIZZAZIONE SICURA AL CARICAMENTO DELLA PAGINA ---
document.addEventListener('DOMContentLoaded', () => {
    // Recupero degli elementi DOM
    tabDashboard = document.getElementById('tab-btn-dashboard');
    tabArchivio = document.getElementById('tab-btn-archivio');
    viewDashboard = document.getElementById('view-dashboard');
    viewArchivio = document.getElementById('view-archivio');
    selectTipoGiornata = document.getElementById('selectTipoGiornata');
    divPermessoOrario = document.getElementById('divPermessoOrario');
    inputPermessoOrario = document.getElementById('inputPermessoOrario');
    inputIngresso = document.getElementById('inputIngresso');
    inputInizioPausa = document.getElementById('inputInizioPausa');
    inputFinePausa = document.getElementById('inputFinePausa');
    inputUscita = document.getElementById('inputUscita');
    pCircle = document.getElementById('pCircle');
    oraCentroWidget = document.getElementById('oraCentroWidget');
    testoContoRovescia = document.getElementById('testoContoRovescia');
    badgeStato = document.getElementById('badgeStato');
    toggleNotifica = document.getElementById('toggleNotifica');
    silenceAudio = document.getElementById('silenceAudio');
    btnSalvaGiornata = document.getElementById('btnSalvaGiornata');
    tabellaLogArchivio = document.getElementById('tabellaLogArchivio');
    totaleStoricoBancaOre = document.getElementById('totaleStoricoBancaOre');
    btnEsportaCSV = document.getElementById('btnEsportaCSV');
    btnSvuotaStorico = document.getElementById('btnSvuotaStorico');
    btnOraIngresso = document.getElementById('btnOraIngresso');
    btnInizioPausa = document.getElementById('btnInizioPausa');
    btnFinePausa = document.getElementById('btnFinePausa');
    btnOraUscita = document.getElementById('btnOraUscita');

    // Controllo di Sicurezza: Evita crash a catena se manca qualche ID nell'HTML
    const elementiRichiesti = [
        tabDashboard, tabArchivio, viewDashboard, viewArchivio, selectTipoGiornata,
        divPermessoOrario, inputPermessoOrario, inputIngresso, inputInizioPausa,
        inputFinePausa, inputUscita, pCircle, oraCentroWidget, testoContoRovescia,
        badgeStato, toggleNotifica, silenceAudio, btnSalvaGiornata, tabellaLogArchivio,
        totaleStoricoBancaOre, btnEsportaCSV, btnSvuotaStorico, btnOraIngresso,
        btnInizioPausa, btnFinePausa, btnOraUscita
    ];

    if (elementiRichiesti.some(el => el === null)) {
        console.error("❌ BANCA ORE PRO: Uno o più ID nel file HTML non corrispondono a quelli cercati dal JavaScript. Verifica l'HTML.");
        return; 
    }

    // Configura gli eventi e attiva le funzioni
    configuraEventiAscolto();
    inizializzaIndexedDB(() => { 
        caricaDatiDaIndexedDB(); 
    });

    // Avvia il ciclo continuo in modo sicuro
    setInterval(eseguiCicloMonitoraggioContinuo, 1000);
});

// --- ASSEGNAZIONE EVENTI ---
function configuraEventiAscolto() {
    tabDashboard.addEventListener('click', () => {
        tabDashboard.classList.add('active');
        tabArchivio.classList.remove('active');
        viewDashboard.classList.remove('hidden');
        viewArchivio.classList.add('hidden');
    });

    tabArchivio.addEventListener('click', () => {
        tabDashboard.classList.remove('active');
        tabArchivio.classList.add('active');
        viewDashboard.classList.add('hidden');
        viewArchivio.classList.remove('hidden');
        renderizzaTabellaArchivio();
    });

    selectTipoGiornata.addEventListener('change', () => aggiornaCalcoliInterfaccia());
    
    [inputIngresso, inputInizioPausa, inputFinePausa, inputUscita, inputPermessoOrario].forEach(field => {
        field.addEventListener('input', () => aggiornaCalcoliInterfaccia());
    });

    btnOraIngresso.addEventListener('click', () => timbraOraAttuale(inputIngresso));
    btnInizioPausa.addEventListener('click', () => timbraOraAttuale(inputInizioPausa));
    btnFinePausa.addEventListener('click', () => timbraOraAttuale(inputFinePausa));
    btnOraUscita.addEventListener('click', () => timbraOraAttuale(inputUscita));

    btnSalvaGiornata.addEventListener('click', () => archiviaGiornataCorrente());
    btnSvuotaStorico.addEventListener('click', () => svuotaTuttoArchivio());
    btnEsportaCSV.addEventListener('click', () => esportaInFileCSV());

    toggleNotifica.addEventListener('change', (e) => {
        if (e.target.checked) {
            silenceAudio.play().catch(() => console.log("Riproduzione audio iniziale silenziata dal browser"));
            if ('mediaSession' in navigator) {
                navigator.mediaSession.playbackState = "playing";
                navigator.mediaSession.setActionHandler('play', () => silenceAudio.play());
                navigator.mediaSession.setActionHandler('pause', () => silenceAudio.play());
            }
            aggiornaCalcoliInterfaccia();
        } else {
            silenceAudio.pause();
            if ('mediaSession' in navigator) navigator.mediaSession.playbackState = "none";
        }
    });
}

// --- GESTIONE COPERTA INDEXEDDB (ANTI-CRASH AMBIENTE LOCALE) ---
function inizializzaIndexedDB(callback) {
    try {
        if (!window.indexedDB) {
            console.warn("IndexedDB non supportato in questo ambiente. Lo storico non verrà salvato.");
            return;
        }
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = function(event) {
            const database = event.target.result;
            if (!database.objectStoreNames.contains(STORE_NAME)) {
                database.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
            }
        };
        request.onsuccess = function(event) {
            db = event.target.result;
            if (callback) callback();
        };
        request.onerror = function(event) {
            console.error("Errore IndexedDB:", event.target.error);
        };
    } catch(e) {
        console.error("IndexedDB bloccato dalle policy di sicurezza del browser (es. file:// locale o Incognito):", e);
    }
}

function caricaDatiDaIndexedDB() {
    if (!db) return;
    try {
        const transaction = db.transaction([STORE_NAME], "readonly");
        const objectStore = transaction.objectStore(STORE_NAME);
        const getAllRequest = objectStore.getAll();
        getAllRequest.onsuccess = function() {
            archivioBancaOre = getAllRequest.result || [];
            if (tabArchivio.classList.contains('active')) {
                renderizzaTabellaArchivio();
            } else {
                aggiornaCalcoliInterfaccia();
            }
        };
    } catch(e) {
        console.error("Impossibile leggere i dati salvati:", e);
    }
}

// --- FUNZIONI DI CALCOLO CORENTI E CORRETTE ---
function timbraOraAttuale(inputField) {
    if (!inputField) return;
    const ora = new Date();
    inputField.value = `${String(ora.getHours()).padStart(2, '0')}:${String(ora.getMinutes()).padStart(2, '0')}`;
    aggiornaCalcoliInterfaccia();
}

function stringaInMinuti(stringa) {
    if (!stringa || !stringa.includes(':')) return null;
    const [h, m] = stringa.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return null;
    return (h * 60) + m;
}

function minutiInStringaSegno(minutiTotali) {
    const preSegno = minutiTotali >= 0 ? "+" : "-";
    const ass = Math.abs(minutiTotali);
    const h = Math.floor(ass / 60);
    const m = ass % 60;
    return `${preSegno}${h}h ${String(m).padStart(2, '0')}m`;
}

function gestisciErroreUI(messaggio) {
    badgeStato.className = "status-badge state-red";
    badgeStato.innerText = messaggio;
    oraCentroWidget.innerText = "--:--";
    testoContoRovescia.innerText = "Non Valido";
    testoContoRovescia.style.color = "#ef4444";
    pCircle.style.stroke = "#ef4444";
    pCircle.style.strokeDashoffset = 534; 
    calcoliOggi.stdMins = 0;
}

function aggiornaCalcoliInterfaccia() {
    const tipo = selectTipoGiornata.value;

    if (tipo === 'permesso_orario') {
        divPermessoOrario.classList.remove('hidden');
    } else {
        divPermessoOrario.classList.add('hidden');
    }

    if (tipo === 'ferie' || tipo === 'malattia' || tipo === 'permesso_intero') {
        badgeStato.className = "status-badge state-green";
        badgeStato.innerText = `🌴 Assenza giustificata per ${tipo.toUpperCase()}. Il saldo odierno sarà congelato in parità (0h 00m).`;
        oraCentroWidget.innerText = "COPERTO";
        testoContoRovescia.innerText = "In Parità";
        testoContoRovescia.style.color = "#10b981";
        pCircle.style.stroke = "#10b981";
        pCircle.style.strokeDashoffset = 0;
        calcoliOggi.stdMins = -1; 
        return;
    }

    const minsIngresso = stringaInMinuti(inputIngresso.value);
    if (minsIngresso === null) return;

    const MIN_INGRESSO = (7 * 60) + 30; 
    const MAX_INGRESSO = (10 * 60) + 30; 
    if (minsIngresso < MIN_INGRESSO || minsIngresso > MAX_INGRESSO) {
        gestisciErroreUI("⚠️ ORARIO INGRESSO NON CONSENTITO: L'ingresso deve essere compreso tra le 07:30 e le 10:30.");
        return;
    }

    const minsInizio = stringaInMinuti(inputInizioPausa.value);
    const minsFine = stringaInMinuti(inputFinePausa.value);

    const MIN_PAUSA = (12 * 60) + 30; 
    const MAX_PAUSA = (15 * 60);      
    if (minsInizio !== null && minsInizio < MIN_PAUSA) {
        gestisciErroreUI("⚠️ PAUSA NON CONSENTITA: L'uscita in pausa pranzo non può avvenire prima delle 12:30.");
        return;
    }
    if (minsFine !== null && minsFine > MAX_PAUSA) {
        gestisciErroreUI("⚠️ PAUSA NON CONSENTITA: Il rientro dalla pausa pranzo non può avvenire dopo le 15:00.");
        return;
    }
    if (minsInizio !== null && minsFine !== null && minsFine < minsInizio) {
        gestisciErroreUI("⚠️ ERRORE PAUSA: L'orario di fine pausa non può essere antecedente all'inizio pausa.");
        return;
    }

    // LOGICA CORRETTA DELLA PAUSA: Di default assume la pausa minima obbligatoria di 30 minuti
    let calcoloPausa = 30; 
    if (minsInizio !== null && minsFine !== null && minsFine > minsInizio) {
        // Se la pausa viene registrata ed è superiore a 30 minuti, si applica la durata effettiva
        calcoloPausa = Math.max(30, minsFine - minsInizio);
    } else if (minsInizio !== null && minsFine === null) {
        // Se l'utente è attualmente in pausa, calcola il tempo trascorso in tempo reale
        const oraAttualeMins = (new Date().getHours() * 60) + new Date().getMinutes();
        calcoloPausa = Math.max(30, oraAttualeMins - minsInizio);
    }

    // LOGICA CORRETTA DELLE SOGLIE CONTRATTUALI (Tempo di lavoro puro senza pausa)
    // 7 ore e 12 minuti = 432 minuti
    // 6 ore e 12 minuti = 372 minuti
    const tempoLavoroStandardPuro = 432; 
    const tempoLavoroMinimoPuro = 372;   

    let minutiPermessoOrario = 0;
    if (tipo === 'permesso_orario' && inputPermessoOrario.value) {
        const minsP = stringaInMinuti(inputPermessoOrario.value);
        if (minsP !== null) minutiPermessoOrario = minsP;
    }

    // Il target orario finale unisce: Ingresso + Lavoro Puro + Pausa (Almeno 30m) - Eventuali Permessi
    calcoliOggi.stdMins = minsIngresso + (tempoLavoroStandardPuro - minutiPermessoOrario) + calcoloPausa;
    calcoliOggi.minMins = minsIngresso + (tempoLavoroMinimoPuro - minutiPermessoOrario) + calcoloPausa;
    calcoliOggi.pausaMins = calcoloPausa;

    const oreTarget = Math.floor(calcoliOggi.stdMins / 60) % 24;
    const minTarget = calcoliOggi.stdMins % 60;
    calcoliOggi.stringaStandard = `${String(oreTarget).padStart(2, '0')}:${String(minTarget).padStart(2, '0')}`;

    eseguiCicloMonitoraggioContinuo();
}

function eseguiCicloMonitoraggioContinuo() {
    if (calcoliOggi.stdMins === -1 || calcoliOggi.stdMins === 0) return;
    if (!inputIngresso.value) return;

    const ora = new Date();
    const minsUscitaConfigurata = stringaInMinuti(inputUscita.value);
    const minutiAttuali = (minsUscitaConfigurata !== null) ? minsUscitaConfigurata : (ora.getHours() * 60) + ora.getMinutes();

    const inizioMins = stringaInMinuti(inputIngresso.value);
    if (inizioMins === null) return;

    const tempoLavoratoFinoAdOra = minutiAttuali - inizioMins;
    const totaleMinsTraguardo = calcoliOggi.stdMins - inizioMins;

    let percentuale = 0;
    if (totaleMinsTraguardo > 0) {
        percentuale = Math.min(100, Math.max(0, (tempoLavoratoFinoAdOra / totaleMinsTraguardo) * 100));
    }

    pCircle.style.strokeDashoffset = 534 - (534 * percentuale / 100);
    oraCentroWidget.innerText = calcoliOggi.stringaStandard;

    let coloreHex = "";
    let titoloNotifica = "";
    let statoTesto = "";
    const diffStandard = calcoliOggi.stdMins - minutiAttuali;

    if (minutiAttuali < calcoliOggi.minMins) {
        coloreHex = "#ef4444";
        titoloNotifica = "Sotto soglia minima";
        const h = Math.floor(Math.abs(diffStandard) / 60);
        const m = Math.abs(diffStandard) % 60;
        statoTesto = `-${h}h ${String(m).padStart(2, '0')}m`;
        testoContoRovescia.innerText = statoTesto;
        testoContoRovescia.style.color = coloreHex;
        badgeStato.className = "status-badge state-red";
        badgeStato.innerText = `🔴 Soglia minima non raggiunta. Mancano ${h}h e ${m}m per completare il target odierno riproporzionato.`;
        pCircle.style.stroke = coloreHex;
        allarmeSuonato = false;
    } else if (minutiAttuali >= calcoliOggi.minMins && minutiAttuali < calcoliOggi.stdMins) {
        coloreHex = "#f59e0b";
        titoloNotifica = "Flessibilità attiva";
        statoTesto = `-${diffStandard} min`;
        testoContoRovescia.innerText = statoTesto;
        testoContoRovescia.style.color = coloreHex;
        badgeStato.className = "status-badge state-orange";
        badgeStato.innerText = `🟠 Flessibilità attiva. Puoi uscire, ma accumulerai un debito di ${diffStandard} minuti.`;
        pCircle.style.stroke = coloreHex;
        allarmeSuonato = false;
    } else {
        coloreHex = "#10b981";
        titoloNotifica = "Target completato";
        const surplus = minutiAttuali - calcoliOggi.stdMins;
        statoTesto = surplus === 0 ? "In parità" : `+${surplus} min`;
        testoContoRovescia.innerText = statoTesto;
        testoContoRovescia.style.color = coloreHex;
        badgeStato.className = "status-badge state-green";
        badgeStato.innerText = `🟢 Target completato! Tempo extra recuperato: ${minutiInStringaSegno(surplus)}.`;
        pCircle.style.stroke = coloreHex;

        if (!allarmeSuonato && minsUscitaConfigurata === null) {
            riproduciFeedbackAcustico();
            allarmeSuonato = true;
        }
    }

    if (toggleNotifica.checked) {
        aggiornaPlayerBloccoSchermo(percentuale, calcoliOggi.stringaStandard, statoTesto, titoloNotifica, coloreHex);
    }
}

// --- SALVATAGGIO ED ESPORTAZIONE ---
function archiviaGiornataCorrente() {
    if (!db) { alert("Database locale non pronto o bloccato dalle impostazioni del browser."); return; }
    const tipo = selectTipoGiornata.value;
    
    let saldoMinutiCalcolato = 0;
    let strIngresso = inputIngresso.value;
    let strUscita = inputUscita.value;
    let strPausa = `${calcoliOggi.pausaMins}m`;

    const oraAttualeObj = new Date();
    const opzioniData = { day: '2-digit', month: 'short' };
    const stringaDataOggi = oraAttualeObj.toLocaleDateString('it-IT', opzioniData);

    if (tipo === 'ferie' || tipo === 'malattia' || tipo === 'permesso_intero') {
        saldoMinutiCalcolato = 0;
        strIngresso = "--:--";
        strUscita = "--:--";
        strPausa = tipo.toUpperCase();
    } else {
        if (!inputIngresso.value || !inputUscita.value) {
            alert("⚠️ Per registrare una giornata lavorativa e accumulare saldo, compila sia l'orario di INGRESSO che quello di USCITA.");
            return;
        }

        const minsIngresso = stringaInMinuti(inputIngresso.value);
        const minsUscitaEffettiva = stringaInMinuti(inputUscita.value);
        if (minsIngresso === null || minsUscitaEffettiva === null) return;
        
        let minutiPermesso = 0;
        if (tipo === 'permesso_orario' && inputPermessoOrario.value) {
            const minsP = stringaInMinuti(inputPermessoOrario.value);
            if (minsP !== null) {
                minutiPermesso = minsP;
                strPausa += ` (+ Permesso ${minutiPermesso}m)`;
            }
        }

        const minutiLavoratiNetto = (minsUscitaEffettiva - minsIngresso) - calcoliOggi.pausaMins + minutiPermesso;
        const minutiDovereStandard = 432; // 7 ore e 12 minuti di dovere contrattuale puro
        saldoMinutiCalcolato = minutiLavoratiNetto - minutiDovereStandard;
    }

    const nuovaVoceRegistro = {
        data: stringaDataOggi,
        ingresso: strIngresso,
        pausa: strPausa,
        uscita: strUscita,
        saldo: saldoMinutiCalcolato
    };

    try {
        const transaction = db.transaction([STORE_NAME], "readwrite");
        const objectStore = transaction.objectStore(STORE_NAME);
        const addRequest = objectStore.add(nuovaVoceRegistro);

        addRequest.onsuccess = function() {
            caricaDatiDaIndexedDB();
            alert(`Giornata salvata con successo nell'archivio protetto. \nSaldo Registrato: ${minutiInStringaSegno(saldoMinutiCalcolato)}`);
            
            inputIngresso.value = ""; 
            inputInizioPausa.value = "";
            inputFinePausa.value = "";
            inputUscita.value = "";
            inputPermessoOrario.value = "";
            selectTipoGiornata.value = "standard";
            aggiornaCalcoliInterfaccia();
            localStorage.clear():
        };
    } catch(e) {
        console.error("Impossibile salvare su DB:", e);
        alert("Errore: il browser impedisce il salvataggio locale dei dati (IndexedDB disattivato).");
    }
}

function renderizzaTabellaArchivio() {
    tabellaLogArchivio.innerHTML = "";
    let totaleMinutiStorico = 0;

    for (let i = archivioBancaOre.length - 1; i >= 0; i--) {
        const item = archivioBancaOre[i];
        totaleMinutiStorico += item.saldo;

        const riga = document.createElement('tr');
        let classeColoreSaldo = "row-neutral";
        if (item.saldo > 0) classeColoreSaldo = "row-positive";
        if (item.saldo < 0) classeColoreSaldo = "row-negative";

        riga.innerHTML = `
            <td>${item.data}</td>
            <td>${item.ingresso}</td>
            <td>${item.pausa}</td>
            <td>${item.uscita}</td>
            <td class="${classeColoreSaldo}">${minutiInStringaSegno(item.saldo)}</td>
        `;
        tabellaLogArchivio.appendChild(riga);
    }

    totaleStoricoBancaOre.innerText = minutiInStringaSegno(totaleMinutiStorico);
    totaleStoricoBancaOre.className = "summary-value " + 
        (totaleMinutiStorico > 0 ? "balance-positive" : (totaleMinutiStorico < 0 ? "balance-negative" : "balance-neutral"));
}

function svuotaTuttoArchivio() {
    if (!db) return;
    if (confirm("Attenzione: sei sicuro di voler eliminare definitivamente tutto lo storico salvato? L'operazione non è reversibile.")) {
        try {
            const transaction = db.transaction([STORE_NAME], "readwrite");
            const objectStore = transaction.objectStore(STORE_NAME);
            objectStore.clear().onsuccess = function() {
                archivioBancaOre = [];
                renderizzaTabellaArchivio();
                alert("L'archivio della Banca Ore è stato azzerato.");
            };
        } catch(e) {
            console.error(e);
        }
    }
}

function esportaInFileCSV() {
    if (archivioBancaOre.length === 0) return;
    let csvContenuto = "DATA,INGRESSO,PAUSA,USCITA,SALDO (MINUTI)\n";
    archivioBancaOre.forEach(r => {
        csvContenuto += `${r.data},${r.ingresso},${r.pausa},${r.uscita},${r.saldo}\n`;
    });
    const blob = new Blob([csvContenuto], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", "estratto_banca_ore_pro.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// --- RENDERING SCHERMO BLOCCATO (WIDGET INTEGRATO) ---
function aggiornaPlayerBloccoSchermo(pct, oraTargetFissa, sottoTesto, etichettaStato, colHex) {
    if (!('mediaSession' in navigator) || !window.MediaMetadata) return;

    try {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = "#0f172a";
        ctx.fillRect(0, 0, 512, 512);

        const cX = 256;
        const cY = 230;
        const r = 140;

        ctx.beginPath();
        ctx.arc(cX, cY, r, 0, 2 * Math.PI);
        ctx.strokeStyle = "#334155";
        ctx.lineWidth = 18;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cX, cY, r, -0.5 * Math.PI, (-0.5 * Math.PI) + (2 * Math.PI * (pct / 100)));
        ctx.strokeStyle = colHex;
        ctx.lineWidth = 18;
        ctx.lineCap = "round";
        ctx.stroke();

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 78px system-ui, -apple-system, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(oraTargetFissa, cX, cY);

        ctx.fillStyle = colHex;
        ctx.font = "bold 38px system-ui, -apple-system, sans-serif";
        ctx.fillText(sottoTesto, cX, 410);

        ctx.fillStyle = "#64748b";
        ctx.font = "bold 22px system-ui, -apple-system, sans-serif";
        ctx.fillText(etichettaStato.toUpperCase(), cX, 465);

        navigator.mediaSession.metadata = new MediaMetadata({
            title: `Target Uscita: ${oraTargetFissa}`,
            artist: `${etichettaStato} (${sottoTesto})`,
            album: `Banca Ore Pro • Pausa: ${calcoliOggi.pausaMins}m`,
            artwork: [{ src: canvas.toDataURL('image/png'), sizes: '512x512', type: 'image/png' }]
        });
    } catch (e) {
        console.log("Errore nella generazione del Widget multimediale:", e);
    }
}

function riproduciFeedbackAcustico() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); 
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.12);
        
        setTimeout(() => {
            const osc2 = audioCtx.createOscillator();
            const gain2 = audioCtx.createGain();
            osc2.connect(gain2);
            gain2.connect(audioCtx.destination);
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(880, audioCtx.currentTime); 
            gain2.gain.setValueAtTime(0.15, audioCtx.currentTime);
            osc2.start();
            osc2.stop(audioCtx.currentTime + 0.25);
        }, 150);
    } catch (e) {
        console.log("Audio contestuale bloccato dalle impostazioni utente", e);
    }
}
