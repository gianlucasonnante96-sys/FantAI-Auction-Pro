"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import ImportListone from "@/components/ImportListone";
import { PREZZI_STORICI } from "@/data/prezziStorici";
import { getTitolarita, getInfortunio } from "@/lib/giocatoriInfo";
import { normalizzaNome } from "@/lib/normalizza";

// -------- TIPI ----------
interface LegaConfig {
  partecipanti: number;
  budget: number;
  modalita: "classic" | "mantra";
  rosa: {
    P: number;
    D: number;
    C: number;
    A: number;
  };
  regole: {
    modificatoreDifesa: boolean;
    imbattibilita: boolean;
    portaInviolata: boolean;
    assist: boolean;
    rigori: boolean;
  };
  ordineAsta: "random" | "libera" | "manuale";
}

interface Player {
  nome: string;
  ruolo?: string;
  squadra?: string;
  quotazioneIniziale?: number;
  quotazioneAttuale?: number;
  fvm?: number;
  prezzoPagato?: number;
  [key: string]: unknown;
}

interface Squadra {
  nome: string;
  budget: number;
  giocatori: Player[];
}

interface Acquisto {
  giocatore: string;
  squadra: string;
  prezzo: number;
  timestamp: string;
}

interface ProfiloStorico {
  nome: string;
  distribuzione: { P: number; D: number; C: number; A: number };
  stile: string;
  topPagati: number;
  lowCost: number;
}

// -------- PROFILI SCANDICCI ----------
const PROFILI_SCANDICCI: ProfiloStorico[] = [
  { nome: "Jonny", distribuzione: { P: 10, D: 11, C: 5, A: 71 }, stile: "Cacciatore di top", topPagati: 4, lowCost: 10 },
  { nome: "Sina", distribuzione: { P: 9, D: 3, C: 15, A: 72 }, stile: "Attacco pesante", topPagati: 3, lowCost: 8 },
  { nome: "Tofa", distribuzione: { P: 2, D: 8, C: 32, A: 58 }, stile: "Azzardatore", topPagati: 3, lowCost: 6 },
  { nome: "Auri", distribuzione: { P: 10, D: 10, C: 29, A: 42 }, stile: "Scout paziente", topPagati: 3, lowCost: 9 },
  { nome: "Gabb", distribuzione: { P: 10, D: 10, C: 20, A: 51 }, stile: "Power player", topPagati: 3, lowCost: 7 },
  { nome: "Lollo", distribuzione: { P: 10, D: 12, C: 20, A: 56 }, stile: "Contrasto", topPagati: 3, lowCost: 7 },
  { nome: "Rub+Gian", distribuzione: { P: 7, D: 9, C: 33, A: 51 }, stile: "Costruttore di giovani", topPagati: 3, lowCost: 5 },
  { nome: "Nicco", distribuzione: { P: 6, D: 14, C: 36, A: 44 }, stile: "Centrocampista", topPagati: 3, lowCost: 6 },
  { nome: "Faila+Papu", distribuzione: { P: 6, D: 7, C: 35, A: 46 }, stile: "Duello interno", topPagati: 3, lowCost: 9 },
  { nome: "Toniesi", distribuzione: { P: 6, D: 8, C: 21, A: 63 }, stile: "Tradizionalista", topPagati: 3, lowCost: 7 },
];

// -------- CONFIGURAZIONE INIZIALE ----------
const configIniziale: LegaConfig = {
  partecipanti: 8,
  budget: 500,
  modalita: "classic",
  rosa: { P: 3, D: 8, C: 8, A: 6 },
  regole: {
    modificatoreDifesa: false,
    imbattibilita: false,
    portaInviolata: false,
    assist: true,
    rigori: true,
  },
  ordineAsta: "random",
};

export default function Home() {
  const [view, setView] = useState<"wizard" | "import" | "dashboard" | "asta" | "rimasti">("wizard");
  const [passo, setPasso] = useState(1);
  const [config, setConfig] = useState<LegaConfig>(configIniziale);
  const [giocatori, setGiocatori] = useState<Player[]>([]);
  const [squadre, setSquadre] = useState<Squadra[]>([]);
  const [acquisti, setAcquisti] = useState<Acquisto[]>([]);
  const [ricerca, setRicerca] = useState("");
  const [giocatoreSelezionato, setGiocatoreSelezionato] = useState<Player | null>(null);
  const [prezzo, setPrezzo] = useState("");
  const [squadraAcquirente, setSquadraAcquirente] = useState("");
  const [messaggio, setMessaggio] = useState("");
  const [filtroRuolo, setFiltroRuolo] = useState<string>("tutti");
  const [legaScandicci, setLegaScandicci] = useState<boolean>(false);

  const ruoliCompletatiRef = useRef<Set<string>>(new Set());

  // Inizializza squadre quando si entra in asta
  useEffect(() => {
    if (view === "asta") {
      const squadreSalvate = localStorage.getItem("fantai-squadre");
      if (squadreSalvate) {
        const parsed = JSON.parse(squadreSalvate);
        setSquadre(parsed);
        if (parsed.length > 0) setSquadraAcquirente(parsed[0].nome);
      } else {
        const iniziali: Squadra[] = legaScandicci
          ? PROFILI_SCANDICCI.map((p) => ({
              nome: p.nome,
              budget: config.budget,
              giocatori: [],
            }))
          : Array.from({ length: config.partecipanti }, (_, i) => ({
              nome: `Squadra ${i + 1}`,
              budget: config.budget,
              giocatori: [],
            }));
        setSquadre(iniziali);
        setSquadraAcquirente(iniziali[0]?.nome || "");
      }

      const giocatoriSalvati = localStorage.getItem("fantai-giocatori");
      if (giocatoriSalvati) {
        setGiocatori(JSON.parse(giocatoriSalvati));
      }

      const acquistiSalvati = localStorage.getItem("fantai-acquisti");
      if (acquistiSalvati) {
        setAcquisti(JSON.parse(acquistiSalvati));
      }
    }
  }, [view, config, legaScandicci]);

  const vaiAvanti = () => setPasso((p) => Math.min(p + 1, 7));
  const vaiIndietro = () => setPasso((p) => Math.max(p - 1, 1));

  const aggiornaConfig = (modifiche: Partial<LegaConfig>) => {
    setConfig((prev) => ({ ...prev, ...modifiche }));
  };

  const salvaConfigurazione = () => {
    localStorage.setItem("fantai-legaconfig", JSON.stringify(config));
    localStorage.setItem("fantai-lega-scandicci", JSON.stringify(legaScandicci));
    setView("import");
  };

  const handleImportComplete = (players: Player[]) => {
    setGiocatori(players);
    localStorage.setItem("fantai-giocatori", JSON.stringify(players));
    setView("dashboard");
  };

  // -------- FUNZIONI PER L'ASTA ----------
  const giocatoriDisponibili = useMemo(() => {
    return giocatori.filter(
      (g) => !squadre.some((s) => s.giocatori.some((sg) => sg.nome === g.nome))
    );
  }, [giocatori, squadre]);

  const giocatoriFiltrati = useMemo(() => {
    let lista = giocatoriDisponibili;
    if (filtroRuolo !== "tutti") {
      lista = lista.filter((g) => g.ruolo === filtroRuolo);
    }
    if (ricerca.trim()) {
      lista = lista.filter((g) => g.nome.toLowerCase().includes(ricerca.toLowerCase()));
    }
    return [...lista].sort((a, b) => (b.fvm || 0) - (a.fvm || 0));
  }, [giocatoriDisponibili, filtroRuolo, ricerca]);

  // Controlla se un ruolo è esaurito e genera analisi
  useEffect(() => {
    const ruoli = ["P", "D", "C", "A"];
    const nuoviCompletati = new Set(ruoliCompletatiRef.current);
    let analisiAggiornata = false;

    for (const ruolo of ruoli) {
      const disponibili = giocatoriDisponibili.filter((g) => g.ruolo === ruolo);
      if (disponibili.length === 0 && !nuoviCompletati.has(ruolo)) {
        nuoviCompletati.add(ruolo);
        analisiAggiornata = true;
      }
    }

    if (analisiAggiornata) {
      ruoliCompletatiRef.current = nuoviCompletati;
      const ultimoRuolo = Array.from(nuoviCompletati).pop() || "";
      if (ultimoRuolo) {
        setMessaggio(`*** ${ultimoRuolo} FINITI ***\n\n${generaAnalisiRuolo(ultimoRuolo, squadre, giocatori)}`);
      }
    }
  }, [giocatoriDisponibili, squadre, giocatori]);

  // Algoritmo prezzo consigliato con dati storici
  const calcolaPrezzoConsigliato = (player: Player): number => {
    const base = player.fvm || player.quotazioneIniziale || 10;
    const fattoreScala = config.budget / 1000;
    let prezzoBase = base * fattoreScala;
    let inflazione = 1;

    if (acquisti.length > 0) {
      const mediaPagata = acquisti.reduce((sum, a) => sum + a.prezzo, 0) / acquisti.length;
      const mediaBase = acquisti.reduce((sum, a) => {
        const giocatore = giocatori.find((g) => g.nome === a.giocatore);
        return sum + (giocatore?.fvm || giocatore?.quotazioneIniziale || 10);
      }, 0) / acquisti.length;
      if (mediaBase > 0) {
        inflazione = mediaPagata / mediaBase;
        inflazione = Math.max(0.8, Math.min(inflazione, 1.5));
      }
    }

    const ruolo = player.ruolo || "";
    const fabbisognoRuolo = config.rosa[ruolo as keyof typeof config.rosa] || 5;
    const giocatoriRuoloAcquistati = squadre.reduce(
      (sum, s) => sum + s.giocatori.filter((g) => g.ruolo === ruolo).length,
      0
    );
    const totaleNecessario = config.partecipanti * fabbisognoRuolo;
    const domanda = Math.max(1, totaleNecessario - giocatoriRuoloAcquistati);
    const fattoreDomanda = 1 + (domanda / totaleNecessario) * 0.5;

    const budgetResiduoMedio = squadre.length > 0 ? squadre.reduce((sum, s) => sum + s.budget, 0) / squadre.length : config.budget;
    const fattoreBudget = budgetResiduoMedio / config.budget;

    let fattoreProfilo = 1;
    if (legaScandicci && squadre.length > 0) {
      const profiliInteressati = PROFILI_SCANDICCI.filter(
        (p) => p.distribuzione[ruolo as keyof typeof p.distribuzione] > 25
      );
      if (profiliInteressati.length > 0) {
        const mediaInteresse = profiliInteressati.reduce(
          (sum, p) => sum + p.distribuzione[ruolo as keyof typeof p.distribuzione],
          0
        ) / profiliInteressati.length;
        fattoreProfilo = 1 + (mediaInteresse - 20) / 100;
      }
    }

    let prezzoAlgoritmo = prezzoBase * inflazione * fattoreDomanda * fattoreBudget * fattoreProfilo;
    const limiteMassimo = config.budget * 0.3;
    prezzoAlgoritmo = Math.min(prezzoAlgoritmo, limiteMassimo);
    prezzoAlgoritmo = Math.max(1, Math.round(prezzoAlgoritmo));

    const nomeNormalizzato = normalizzaNome(player.nome);
    const prezzoStorico = PREZZI_STORICI[nomeNormalizzato];
    let prezzoFinale: number;

    if (prezzoStorico !== undefined) {
      prezzoFinale = Math.round(0.6 * prezzoStorico + 0.4 * prezzoAlgoritmo);
    } else {
      prezzoFinale = prezzoAlgoritmo;
    }

    prezzoFinale = Math.min(prezzoFinale, limiteMassimo);
    prezzoFinale = Math.max(1, prezzoFinale);

    return prezzoFinale;
  };

  const prezzoConsigliato = useMemo(() => {
    return giocatoreSelezionato ? calcolaPrezzoConsigliato(giocatoreSelezionato) : 0;
  }, [giocatoreSelezionato, acquisti, squadre, config, legaScandicci, giocatori]);

  const registraAcquisto = () => {
    if (!giocatoreSelezionato || !prezzo || !squadraAcquirente) {
      setMessaggio("Seleziona giocatore, inserisci prezzo e scegli squadra.");
      return;
    }

    const prezzoNum = Number(prezzo);
    if (isNaN(prezzoNum) || prezzoNum <= 0) {
      setMessaggio("Prezzo non valido.");
      return;
    }

    const squadraIndex = squadre.findIndex((s) => s.nome === squadraAcquirente);
    if (squadraIndex === -1) {
      setMessaggio("Squadra non trovata.");
      return;
    }

    if (squadre[squadraIndex].budget < prezzoNum) {
      setMessaggio(`Budget insufficiente per ${squadre[squadraIndex].nome}.`);
      return;
    }

    const nuoveSquadre = [...squadre];
    nuoveSquadre[squadraIndex] = {
      ...nuoveSquadre[squadraIndex],
      budget: nuoveSquadre[squadraIndex].budget - prezzoNum,
      giocatori: [...nuoveSquadre[squadraIndex].giocatori, { ...giocatoreSelezionato, prezzoPagato: prezzoNum }],
    };

    setSquadre(nuoveSquadre);

    const nuovoAcquisto: Acquisto = {
      giocatore: giocatoreSelezionato.nome,
      squadra: squadraAcquirente,
      prezzo: prezzoNum,
      timestamp: new Date().toISOString(),
    };

    const nuoviAcquisti = [...acquisti, nuovoAcquisto];
    setAcquisti(nuoviAcquisti);

    localStorage.setItem("fantai-squadre", JSON.stringify(nuoveSquadre));
    localStorage.setItem("fantai-acquisti", JSON.stringify(nuoviAcquisti));

    setGiocatoreSelezionato(null);
    setPrezzo("");
    setMessaggio(`Acquisto registrato: ${giocatoreSelezionato.nome} → ${squadraAcquirente} per ${prezzoNum} crediti.`);
  };

  const resetAsta = () => {
    const conferma = window.confirm("Vuoi azzerare tutta l'asta?");
    if (!conferma) return;

    const iniziali: Squadra[] = legaScandicci
      ? PROFILI_SCANDICCI.map((p) => ({
          nome: p.nome,
          budget: config.budget,
          giocatori: [],
        }))
      : Array.from({ length: config.partecipanti }, (_, i) => ({
          nome: `Squadra ${i + 1}`,
          budget: config.budget,
          giocatori: [],
        }));

    setSquadre(iniziali);
    setAcquisti([]);
    setGiocatoreSelezionato(null);
    setPrezzo("");
    setMessaggio("");
    ruoliCompletatiRef.current = new Set();

    localStorage.removeItem("fantai-squadre");
    localStorage.removeItem("fantai-acquisti");
    setSquadraAcquirente(iniziali[0]?.nome || "");
  };

  const cambiaNomeSquadra = (indice: number, nuovoNome: string) => {
    const nuoveSquadre = [...squadre];
    nuoveSquadre[indice] = { ...nuoveSquadre[indice], nome: nuovoNome };
    setSquadre(nuoveSquadre);
    localStorage.setItem("fantai-squadre", JSON.stringify(nuoveSquadre));
    if (squadraAcquirente === squadre[indice]?.nome) {
      setSquadraAcquirente(nuovoNome);
    }
  };

  const generaAnalisiRuolo = (ruolo: string, squadre: Squadra[], giocatori: Player[]): string => {
    const ruoliMap: Record<string, string> = { P: "Portieri", D: "Difensori", C: "Centrocampisti", A: "Attaccanti" };
    const nomeRuolo = ruoliMap[ruolo] || ruolo;
    let analisi = `Analisi ${nomeRuolo}:\n`;

    for (const squadra of squadre) {
      const giocatoriRuolo = squadra.giocatori.filter((g) => g.ruolo === ruolo);
      if (giocatoriRuolo.length === 0) {
        analisi += `• ${squadra.nome}: nessun ${nomeRuolo.toLowerCase()} acquistato (molto rischioso).\n`;
        continue;
      }

      const fvmMedio = giocatoriRuolo.reduce((sum, g) => sum + (g.fvm || 0), 0) / giocatoriRuolo.length;
      const nomi = giocatoriRuolo.map((g) => g.nome).join(", ");
      let giudizio = "";

      if (fvmMedio > 40) giudizio = "ottimo reparto";
      else if (fvmMedio > 25) giudizio = "reparto solido";
      else giudizio = "reparto debole";

      analisi += `• ${squadra.nome}: ${nomi} (FVM medio: ${fvmMedio.toFixed(1)}). ${giudizio}.\n`;
    }
    return analisi;
  };

  // -------- RENDER: VISTA CALCATORI RIMASTI ----------
  if (view === "rimasti") {
    const ruoliOrdinati = ["P", "D", "C", "A"];
    const gruppi = giocatoriDisponibili.reduce((acc, g) => {
      const r = g.ruolo || "VAR";
      if (!acc[r]) acc[r] = [];
      acc[r].push(g);
      return acc;
    }, {} as Record<string, Player[]>);

    const chiaviRuoli = Object.keys(gruppi).sort((a, b) => {
      const idxA = ruoliOrdinati.indexOf(a);
      const idxB = ruoliOrdinati.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });

    chiaviRuoli.forEach((r) => {
      gruppi[r].sort((a, b) => (b.fvm || 0) - (a.fvm || 0));
    });

    return (
      <main className="min-h-screen bg-black text-white px-5 py-8">
        <div className="mx-auto w-full max-w-md">
          <button
            onClick={() => setView("dashboard")}
            className="mb-6 text-gray-400 underline flex items-center gap-2 hover:text-white transition-colors"
          >
            ← Torna alla Dashboard
          </button>

          <h2 className="text-2xl font-bold text-green-400 mb-6">Calciatori Rimasti</h2>

          {giocatoriDisponibili.length === 0 ? (
            <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6 text-center">
              <p className="text-gray-400">Tutti i calciatori sono stati acquistati!</p>
            </div>
          ) : (
            <div className="space-y-6">
              {chiaviRuoli.map((ruolo) => {
                const lista = gruppi[ruolo];
                const nomeRuolo =
                  ruolo === "P" ? "Portieri" : ruolo === "D" ? "Difensori" : ruolo === "C" ? "Centrocampisti" : ruolo === "A" ? "Attaccanti" : ruolo;

                return (
                  <div key={ruolo} className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
                    <h3 className="text-lg font-bold text-orange-400 mb-3 flex items-center gap-2">
                      <span className="bg-gray-800 px-2 py-1 rounded text-white text-sm">{ruolo}</span>
                      {nomeRuolo} ({lista.length})
                    </h3>
                    <ul className="space-y-3 max-h-96 overflow-y-auto pr-2">
                      {lista.map((g, i) => {
                        const prezzoConsigliato = calcolaPrezzoConsigliato(g);
                        const titolarita = getTitolarita(g.nome, g.squadra);
                        const pctTitolarita = titolarita?.percentuale ?? 0;

                        let coloreTitolarita = "text-red-400";
                        if (pctTitolarita >= 80) coloreTitolarita = "text-green-400";
                        else if (pctTitolarita >= 50) coloreTitolarita = "text-yellow-400";

                        return (
                          <li key={`${g.nome}-${i}`} className="flex flex-col gap-2 border-b border-gray-800 pb-3 last:border-0 last:pb-0">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-semibold text-white">{g.nome}</p>
                                <p className="text-xs text-gray-400">{g.squadra || "Svincolato"}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-bold text-blue-300">FMV: {g.fvm || "-"}</p>
                              </div>
                            </div>

                            <div className="flex justify-between items-center bg-gray-800/50 rounded-lg p-3">
                              <div className="flex flex-col">
                                <span className="text-xs text-gray-400">Prezzo Consigliato</span>
                                <span className="text-lg font-bold text-green-400">{prezzoConsigliato} cr</span>
                              </div>
                              <div className="flex flex-col items-end">
                                <span className="text-xs text-gray-400">Titolarità</span>
                                <span className={`text-lg font-bold ${coloreTitolarita}`}>{pctTitolarita}%</span>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    );
  }

  // -------- RENDER: DASHBOARD ----------
  if (view === "dashboard") {
    return (
      <main className="min-h-screen bg-black text-white px-5 py-8">
        <div className="mx-auto w-full max-w-md">
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
            <h2 className="text-2xl font-bold text-green-400">Dashboard</h2>
            <div className="mt-4 space-y-2 text-sm text-gray-300">
              <p><span className="font-semibold">Partecipanti:</span> {config.partecipanti}</p>
              <p><span className="font-semibold">Budget:</span> {config.budget} crediti</p>
              <p><span className="font-semibold">Modalità:</span> {config.modalita === "classic" ? "Classic" : "Mantra"}</p>
              <p><span className="font-semibold">Giocatori importati:</span> {giocatori.length}</p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-gray-800 bg-gray-900 p-5">
            <h3 className="text-lg font-bold mb-3">Primi 20 giocatori</h3>
            <ul className="space-y-2 max-h-96 overflow-y-auto">
              {giocatori.slice(0, 20).map((g, i) => (
                <li key={i} className="flex justify-between text-sm text-gray-300">
                  <span>{g.nome}</span>
                  <span>{g.squadra || "-"}</span>
                </li>
              ))}
            </ul>
          </div>

          <button
            onClick={() => setView("asta")}
            className="mt-6 w-full rounded-xl bg-orange-600 px-6 py-4 font-bold text-white hover:bg-orange-500 transition-colors"
          >
            Modalità Asta
          </button>

          <button
            onClick={() => setView("rimasti")}
            className="mt-3 w-full rounded-xl bg-blue-600 px-6 py-4 font-bold text-white hover:bg-blue-500 transition-colors"
          >
            👥 Calciatori Rimasti
          </button>

          <button
            onClick={() => {
              localStorage.removeItem("fantai-legaconfig");
              localStorage.removeItem("fantai-giocatori");
              localStorage.removeItem("fantai-squadre");
              localStorage.removeItem("fantai-acquisti");
              localStorage.removeItem("fantai-lega-scandicci");
              setGiocatori([]);
              setSquadre([]);
              setAcquisti([]);
              window.location.reload();
            }}
            className="mt-3 w-full rounded-xl bg-gray-700 px-6 py-3 font-semibold text-white hover:bg-gray-600 transition-colors"
          >
            Reimposta tutto
          </button>
        </div>
      </main>
    );
  }

  // -------- RENDER: IMPORT ----------
  if (view === "import") {
    return (
      <main className="min-h-screen bg-black text-white px-5 py-8">
        <div className="mx-auto w-full max-w-md">
          <ImportListone onComplete={handleImportComplete} />
          <button
            onClick={() => {
              setView("wizard");
              setPasso(7);
            }}
            className="mt-6 w-full rounded-xl border border-gray-700 bg-gray-800 px-5 py-3 font-semibold text-white active:scale-[0.98]"
          >
            Modifica configurazione
          </button>
        </div>
      </main>
    );
  }

  // -------- RENDER: WIZARD ----------
  return (
    <main className="min-h-screen bg-black text-white px-5 py-8">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold tracking-widest text-orange-500">FANTAI AUCTION PRO</p>
          <h1 className="mt-2 text-3xl font-bold">Configura la tua lega</h1>
          <p className="mt-2 text-sm text-gray-400">Passo {passo} di 7</p>
        </div>

        <div className="mb-8 h-2 rounded-full bg-gray-800">
          <div className="h-2 rounded-full bg-orange-600 transition-all" style={{ width: `${(passo / 7) * 100}%` }} />
        </div>

        {passo === 1 && (
          <section className="text-center">
            <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
              <div className="mb-5 text-5xl">⚽</div>
              <h2 className="text-2xl font-bold">Benvenuto in FantAI</h2>
              <p className="mt-4 text-gray-400">Scegli il tipo di lega per iniziare.</p>
              <div className="mt-8 space-y-3">
                <button
                  onClick={() => {
                    setLegaScandicci(false);
                    setConfig({ ...configIniziale, partecipanti: 8 });
                    vaiAvanti();
                  }}
                  className="w-full rounded-xl bg-orange-600 px-6 py-4 text-lg font-bold active:scale-95"
                >
                  Nuova Lega
                </button>
                <button
                  onClick={() => {
                    setLegaScandicci(true);
                    setConfig({ ...configIniziale, partecipanti: 10 });
                    vaiAvanti();
                  }}
                  className="w-full rounded-xl bg-blue-600 px-6 py-4 text-lg font-bold active:scale-95"
                >
                  Scandicci League
                </button>
              </div>
            </div>
          </section>
        )}

        {passo === 2 && (
          <section>
            <h2 className="text-2xl font-bold">Numero partecipanti</h2>
            <p className="mt-2 text-gray-400">Quante squadre partecipano?</p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              {[6, 8, 10, 12].map((numero) => (
                <button
                  key={numero}
                  onClick={() => aggiornaConfig({ partecipanti: numero })}
                  className={`rounded-xl border p-5 text-xl font-bold ${
                    config.partecipanti === numero ? "border-green-500 bg-green-600" : "border-gray-700 bg-gray-900"
                  }`}
                >
                  {numero}
                </button>
              ))}
            </div>
            <div className="mt-8 flex justify-between">
              <button onClick={vaiIndietro} className="text-gray-400 underline">Indietro</button>
              <button onClick={vaiAvanti} className="rounded-xl bg-orange-600 px-7 py-3 font-bold">Avanti</button>
            </div>
          </section>
        )}

        {passo === 3 && (
          <section>
            <h2 className="text-2xl font-bold">Budget iniziale</h2>
            <p className="mt-2 text-gray-400">Quanti crediti avrà ogni squadra?</p>
            <input
              type="number"
              min={1}
              inputMode="numeric"
              value={config.budget}
              onChange={(e) => aggiornaConfig({ budget: Number(e.target.value) })}
              className="mt-6 w-full rounded-xl border border-gray-700 bg-gray-900 p-4 text-2xl font-bold text-white"
            />
            <div className="mt-8 flex justify-between">
              <button onClick={vaiIndietro} className="text-gray-400 underline">Indietro</button>
              <button onClick={vaiAvanti} className="rounded-xl bg-orange-600 px-7 py-3 font-bold">Avanti</button>
            </div>
          </section>
        )}

        {passo === 4 && (
          <section>
            <h2 className="text-2xl font-bold">Modalità</h2>
            <p className="mt-2 text-gray-400">Scegli la modalità della lega.</p>
            <div className="mt-6 space-y-3">
              <button
                onClick={() => aggiornaConfig({ modalita: "classic" })}
                className={`w-full rounded-xl border p-5 text-left ${
                  config.modalita === "classic" ? "border-green-500 bg-green-600" : "border-gray-700 bg-gray-900"
                }`}
              >
                <p className="font-bold">Classic</p>
              </button>
              <button
                onClick={() => aggiornaConfig({ modalita: "mantra" })}
                className={`w-full rounded-xl border p-5 text-left ${
                  config.modalita === "mantra" ? "border-green-500 bg-green-600" : "border-gray-700 bg-gray-900"
                }`}
              >
                <p className="font-bold">Mantra</p>
              </button>
            </div>
            <div className="mt-8 flex justify-between">
              <button onClick={vaiIndietro} className="text-gray-400 underline">Indietro</button>
              <button onClick={vaiAvanti} className="rounded-xl bg-orange-600 px-7 py-3 font-bold">Avanti</button>
            </div>
          </section>
        )}

        {passo === 5 && (
          <section>
            <h2 className="text-2xl font-bold">Composizione rosa</h2>
            <p className="mt-2 text-gray-400">Imposta i giocatori per ruolo.</p>
            <div className="mt-6 space-y-3">
              {(["P", "D", "C", "A"] as const).map(([chiave, nome]) => (
                <div key={chiave} className="flex items-center justify-between rounded-xl border border-gray-800 bg-gray-900 p-4">
                  <span className="text-gray-300">{nome}</span>
                  <input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={config.rosa[chiave]}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        rosa: { ...prev.rosa, [chiave]: Number(e.target.value) },
                      }))
                    }
                    className="w-20 rounded-lg border border-gray-700 bg-gray-800 p-2 text-center font-bold"
                  />
                </div>
              ))}
            </div>
            <div className="mt-8 flex justify-between">
              <button onClick={vaiIndietro} className="text-gray-400 underline">Indietro</button>
              <button onClick={vaiAvanti} className="rounded-xl bg-orange-600 px-7 py-3 font-bold">Avanti</button>
            </div>
          </section>
        )}

        {passo === 6 && (
          <section>
            <h2 className="text-2xl font-bold">Regole</h2>
            <p className="mt-2 text-gray-400">Seleziona le regole della lega.</p>
            <div className="mt-6 space-y-3">
              {(["modificatoreDifesa", "imbattibilita", "portaInviolata", "assist", "rigori"] as const).map(([chiave, nome]) => {
                const attiva = config.regole[chiave];
                return (
                  <button
                    key={chiave}
                    onClick={() =>
                      setConfig((prev) => ({
                        ...prev,
                        regole: { ...prev.regole, [chiave]: !attiva },
                      }))
                    }
                    className="flex w-full items-center justify-between rounded-xl border border-gray-800 bg-gray-900 p-4"
                  >
                    <span className="text-gray-300">{nome}</span>
                    <span className={`h-7 w-12 rounded-full p-1 ${attiva ? "bg-green-600" : "bg-gray-700"}`}>
                      <span className={`block h-5 w-5 rounded-full bg-white transition-transform ${attiva ? "translate-x-5" : ""}`} />
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="mt-8 flex justify-between">
              <button onClick={vaiIndietro} className="text-gray-400 underline">Indietro</button>
              <button onClick={vaiAvanti} className="rounded-xl bg-orange-600 px-7 py-3 font-bold">Avanti</button>
            </div>
          </section>
        )}

        {passo === 7 && (
          <section>
            <h2 className="text-2xl font-bold">Ordine asta</h2>
            <p className="mt-2 text-gray-400">Scegli come gestire l'ordine.</p>
            <div className="mt-6 space-y-3">
              {(["random", "libera", "manuale"] as const).map(([valore, nome]) => (
                <button
                  key={valore}
                  onClick={() => aggiornaConfig({ ordineAsta: valore as LegaConfig["ordineAsta"] })}
                  className={`w-full rounded-xl border p-5 text-left ${
                    config.ordineAsta === valore ? "border-green-500 bg-green-600" : "border-gray-700 bg-gray-900"
                  }`}
                >
                  <p className="font-bold">{nome}</p>
                </button>
              ))}
            </div>
            <div className="mt-8 flex justify-between">
              <button onClick={vaiIndietro} className="text-gray-400 underline">Indietro</button>
              <button onClick={salvaConfigurazione} className="rounded-xl bg-orange-600 px-7 py-3 font-bold">Completa</button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
