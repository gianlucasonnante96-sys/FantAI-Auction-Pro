"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import ImportListone from "@/components/ImportListone";
import { PREZZI_STORICI } from "@/data/prezziStorici";
import { getTitolarita, getInfortunio } from "@/lib/giocatoriInfo";
import { normalizzaNome } from "@/lib/normalizza";

interface LegaConfig {
  partecipanti: number;
  budget: number;
  modalita: "classic" | "mantra";
  rosa: { P: number; D: number; C: number; A: number };
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
  prezzoConsigliato?: number;
}

interface ProfiloStorico {
  nome: string;
  distribuzione: { P: number; D: number; C: number; A: number };
  stile: string;
  topPagati: number;
  lowCost: number;
}

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

const configIniziale: LegaConfig = {
  partecipanti: 8,
  budget: 500,
  modalita: "classic",
  rosa: { P: 3, D: 8, C: 8, A: 6 },
  regole: { modificatoreDifesa: false, imbattibilita: false, portaInviolata: false, assist: true, rigori: true },
  ordineAsta: "random",
};

type RosaChiave = keyof typeof configIniziale.rosa;
const rosaLista: [RosaChiave, string][] = [
  ["P", "Portieri"], ["D", "Difensori"], ["C", "Centrocampisti"], ["A", "Attaccanti"],
];

type RegolaChiave = keyof typeof configIniziale.regole;
const regoleLista: [RegolaChiave, string][] = [
  ["modificatoreDifesa", "Modificatore difesa"], ["imbattibilita", "Imbattibilità"],
  ["portaInviolata", "Porta inviolata"], ["assist", "Assist"], ["rigori", "Rigori"],
];

type OrdineChiave = typeof configIniziale.ordineAsta;
const ordineLista: [OrdineChiave, string][] = [
  ["random", "Random per ruolo"], ["libera", "Libera"], ["manuale", "Manuale"],
];

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
  
  const [preferiti, setPreferiti] = useState<string[]>([]);
  const [miaSquadra, setMiaSquadra] = useState<string>("");
  const [soloPreferiti, setSoloPreferiti] = useState<boolean>(false);
  const [messaggioExport, setMessaggioExport] = useState<string>("");
  const [acquistoDaModificare, setAcquistoDaModificare] = useState<number | null>(null);
  const [nuovoPrezzo, setNuovoPrezzo] = useState("");
  const [nuovaSquadra, setNuovaSquadra] = useState("");

  const ruoliCompletatiRef = useRef<Set<string>>(new Set());

  const calcolaFMVProporzionato = (fvmOriginale: number | undefined): number => {
    if (!fvmOriginale) return 0;
    if (fvmOriginale === 1) return 1;
    const proporzionato = (fvmOriginale * config.budget) / 1000;
    return Math.max(1, Math.round(proporzionato));
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const cfg = localStorage.getItem("fantai-legaconfig");
      if (cfg) setConfig(JSON.parse(cfg));
      const ls = localStorage.getItem("fantai-lega-scandicci");
      if (ls) setLegaScandicci(JSON.parse(ls));
      const pl = localStorage.getItem("fantai-giocatori");
      if (pl) setGiocatori(JSON.parse(pl));
      const sq = localStorage.getItem("fantai-squadre");
      if (sq) {
        const parsed = JSON.parse(sq);
        setSquadre(parsed);
        if (parsed.length > 0) setSquadraAcquirente(parsed[0].nome);
      }
      const ac = localStorage.getItem("fantai-acquisti");
      if (ac) setAcquisti(JSON.parse(ac));
      const pref = localStorage.getItem("fantai-preferiti");
      if (pref) setPreferiti(JSON.parse(pref));
      const mia = localStorage.getItem("fantai-mia-squadra");
      if (mia) setMiaSquadra(mia);
    }
  }, []);

  const vaiAvanti = () => setPasso((p) => Math.min(p + 1, 7));
  const vaiIndietro = () => setPasso((p) => Math.max(p - 1, 1));
  const aggiornaConfig = (modifiche: Partial<LegaConfig>) => setConfig((prev) => ({ ...prev, ...modifiche }));

  const salvaConfigurazione = () => {
    localStorage.setItem("fantai-legaconfig", JSON.stringify(config));
    localStorage.setItem("fantai-lega-scandicci", JSON.stringify(legaScandicci));
    if (!localStorage.getItem("fantai-squadre")) {
      const squadreIniziali: Squadra[] = legaScandicci
        ? PROFILI_SCANDICCI.map((p) => ({ nome: p.nome, budget: config.budget, giocatori: [] }))
        : Array.from({ length: config.partecipanti }, (_, i) => ({ nome: `Squadra ${i + 1}`, budget: config.budget, giocatori: [] }));
      localStorage.setItem("fantai-squadre", JSON.stringify(squadreIniziali));
      localStorage.setItem("fantai-acquisti", JSON.stringify([]));
    }
    setView("import");
  };

  const handleImportComplete = (players: Player[]) => {
    setGiocatori(players);
    localStorage.setItem("fantai-giocatori", JSON.stringify(players));
    setView("dashboard");
  };

  const togglePreferito = (nome: string) => {
    setPreferiti((prev) => {
      const nuovi = prev.includes(nome) ? prev.filter((n) => n !== nome) : [...prev, nome];
      localStorage.setItem("fantai-preferiti", JSON.stringify(nuovi));
      return nuovi;
    });
  };

  const cambiaMiaSquadra = (nome: string) => {
    setMiaSquadra(nome);
    localStorage.setItem("fantai-mia-squadra", nome);
  };

  const esportaRosa = (formato: "testo" | "csv") => {
    if (!miaSquadra) {
      setMessaggioExport("⚠️ Seleziona prima la tua squadra.");
      setTimeout(() => setMessaggioExport(""), 3000);
      return;
    }
    const mia = squadre.find((s) => s.nome === miaSquadra);
    if (!mia || mia.giocatori.length === 0) {
      setMessaggioExport("⚠️ La tua rosa è ancora vuota.");
      setTimeout(() => setMessaggioExport(""), 3000);
      return;
    }

    if (formato === "testo") {
      const perRuolo: Record<string, string[]> = { P: [], D: [], C: [], A: [] };
      mia.giocatori.forEach((g) => {
        const r = g.ruolo || "VAR";
        if (perRuolo[r]) perRuolo[r].push(`${g.nome} (${g.squadra || "?"}) - ${g.prezzoPagato}cr`);
      });
      const testo = `🏆 ${miaSquadra}\n💰 Budget residuo: ${mia.budget}cr\n\n` +
        `🧤 PORTIERI:\n${perRuolo.P.join("\n") || "-"}\n\n` +
        `🛡️ DIFENSORI:\n${perRuolo.D.join("\n") || "-"}\n\n` +
        `⚽ CENTROCAMPISTI:\n${perRuolo.C.join("\n") || "-"}\n\n` +
        `🔥 ATTACCANTI:\n${perRuolo.A.join("\n") || "-"}`;
      navigator.clipboard.writeText(testo).then(() => {
        setMessaggioExport("✅ Rosa copiata negli appunti!");
        setTimeout(() => setMessaggioExport(""), 2500);
      });
    } else {
      const righe = ["Ruolo,Nome,Squadra,Prezzo"];
      mia.giocatori.forEach((g) => {
        righe.push(`${g.ruolo || ""},${g.nome},${g.squadra || ""},${g.prezzoPagato || 0}`);
      });
      const csv = righe.join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `rosa_${miaSquadra.replace(/\s+/g, "_")}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setMessaggioExport("✅ CSV scaricato!");
      setTimeout(() => setMessaggioExport(""), 2500);
    }
  };

  const giocatoriDisponibili = useMemo(() => {
    return giocatori.filter((g) => !squadre.some((s) => s.giocatori.some((sg) => sg.nome === g.nome)));
  }, [giocatori, squadre]);

  const giocatoriFiltrati = useMemo(() => {
    let lista = giocatoriDisponibili;
    if (soloPreferiti) lista = lista.filter((g) => preferiti.includes(g.nome));
    if (filtroRuolo !== "tutti") lista = lista.filter((g) => g.ruolo === filtroRuolo);
    if (ricerca.trim()) lista = lista.filter((g) => g.nome.toLowerCase().includes(ricerca.toLowerCase()));
    return [...lista].sort((a, b) => (b.fvm || 0) - (a.fvm || 0));
  }, [giocatoriDisponibili, filtroRuolo, ricerca, soloPreferiti, preferiti]);

  const preferitiConDati = useMemo(() => {
    return giocatori.filter((g) => preferiti.includes(g.nome)).sort((a, b) => (b.fvm || 0) - (a.fvm || 0));
  }, [giocatori, preferiti]);

  const preferitiPerRuolo = useMemo(() => {
    const gruppi: Record<string, Player[]> = { P: [], D: [], C: [], A: [] };
    preferitiConDati.forEach((g) => {
      const r = g.ruolo || "VAR";
      if (gruppi[r]) gruppi[r].push(g);
      else {
        if (!gruppi["VAR"]) gruppi["VAR"] = [];
        gruppi["VAR"].push(g);
      }
    });
    return gruppi;
  }, [preferitiConDati]);

  const statistichePreferiti = useMemo(() => {
    const totale = preferitiConDati.length;
    const fvmMedioProp = totale > 0 ? Math.round(preferitiConDati.reduce((sum, g) => sum + calcolaFMVProporzionato(g.fvm), 0) / totale) : 0;
    const prezzoMedioCons = totale > 0 ? Math.round(preferitiConDati.reduce((sum, g) => sum + calcolaPrezzoConsigliato(g), 0) / totale) : 0;
    const ancoraDisponibili = preferitiConDati.filter((g) => !squadre.some((s) => s.giocatori.some((sg) => sg.nome === g.nome))).length;
    return { totale, fvmMedioProp, prezzoMedioCons, ancoraDisponibili };
  }, [preferitiConDati, squadre]);

  const storicoPerRuolo = useMemo(() => {
    const storico: Record<string, { nome: string; prezzo: number; squadra: string }[]> = { P: [], D: [], C: [], A: [] };
    acquisti.slice().reverse().forEach((a) => {
      const giocatore = giocatori.find((g) => g.nome === a.giocatore);
      const ruolo = giocatore?.ruolo;
      if (ruolo && storico[ruolo] && storico[ruolo].length < 5) {
        storico[ruolo].push({ nome: a.giocatore, prezzo: a.prezzo, squadra: a.squadra });
      }
    });
    return storico;
  }, [acquisti, giocatori]);

  const datiMiaSquadra = useMemo(() => {
    if (!miaSquadra) return null;
    const sq = squadre.find((s) => s.nome === miaSquadra);
    if (!sq) return null;
    const perRuolo: Record<string, Player[]> = { P: [], D: [], C: [], A: [] };
    sq.giocatori.forEach((g) => {
      const r = g.ruolo || "VAR";
      if (perRuolo[r]) perRuolo[r].push(g);
    });
    return { squadra: sq, perRuolo };
  }, [miaSquadra, squadre]);

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

  // ==========================================
  // ALGORITMO PREZZO CONSIGLIATO AVANZATO
  // ==========================================
  const calcolaPrezzoConsigliato = (player: Player): number => {
    const fvmProp = calcolaFMVProporzionato(player.fvm);
    const base = fvmProp || player.quotazioneIniziale || 10;
    let prezzoBase = base * (config.budget / 1000);

    let inflazione = 1;
    if (acquisti.length >= 3) {
      const ultimi10 = acquisti.slice(-10);
      const mediaPagata = ultimi10.reduce((sum, a) => sum + a.prezzo, 0) / ultimi10.length;
      const mediaBase = ultimi10.reduce((sum, a) => {
        const g = giocatori.find((gioc) => gioc.nome === a.giocatore);
        return sum + (calcolaFMVProporzionato(g?.fvm) || g?.quotazioneIniziale || 10);
      }, 0) / ultimi10.length;
      if (mediaBase > 0) {
        inflazione = mediaPagata / mediaBase;
        inflazione = Math.max(0.75, Math.min(inflazione, 1.6));
      }
    }

    const ruolo = player.ruolo || "";
    const fabbisognoRuolo = config.rosa[ruolo as keyof typeof config.rosa] || 5;
    const giocatoriRuoloAcquistati = squadre.reduce((sum, s) => sum + s.giocatori.filter((g) => g.ruolo === ruolo).length, 0);
    const totaleNecessario = config.partecipanti * fabbisognoRuolo;
    const domanda = Math.max(1, totaleNecessario - giocatoriRuoloAcquistati);
    const fattoreDomanda = 1 + (domanda / totaleNecessario) * 0.5;

    const squadreCheDevonoCoprire = squadre.filter((s) => {
      const giocatoriRuoloSquadra = s.giocatori.filter((g) => g.ruolo === ruolo).length;
      return giocatoriRuoloSquadra < fabbisognoRuolo;
    }).length;
    const concorrenzaRatio = squadreCheDevonoCoprire / Math.max(1, squadre.length);
    const fattoreConcorrenza = 0.85 + (concorrenzaRatio * 0.45);

    const budgetResiduoMedio = squadre.length > 0 ? squadre.reduce((sum, s) => sum + s.budget, 0) / squadre.length : config.budget;
    const slotTotaliMancanti = squadre.reduce((sum, s) => {
      const giocatoriTotali = s.giocatori.length;
      const slotTotali = config.rosa.P + config.rosa.D + config.rosa.C + config.rosa.A;
      return sum + Math.max(0, slotTotali - giocatoriTotali);
    }, 0);
    const budgetPerSlot = slotTotaliMancanti > 0 ? budgetResiduoMedio / (slotTotaliMancanti / Math.max(1, squadre.length)) : budgetResiduoMedio;
    const budgetAttesoPerSlot = config.budget / (config.rosa.P + config.rosa.D + config.rosa.C + config.rosa.A);
    const fattoreBudget = Math.max(0.7, Math.min(1.2, budgetPerSlot / Math.max(1, budgetAttesoPerSlot)));

    const totaleGiocatoriDaVendere = giocatori.length;
    const giocatoriGiaVenduti = acquisti.length;
    const progressoAsta = totaleGiocatoriDaVendere > 0 ? giocatoriGiaVenduti / totaleGiocatoriDaVendere : 0;
    let fattoreFase: number;
    if (progressoAsta < 0.15) fattoreFase = 1.10;
    else if (progressoAsta < 0.40) fattoreFase = 1.0;
    else if (progressoAsta < 0.70) fattoreFase = 0.95;
    else fattoreFase = 0.85 + (1 - progressoAsta) * 0.15;

    const infoTitolarita = getTitolarita(player.nome, player.squadra);
    let fattoreTitolarita = 1.0;
    if (infoTitolarita) {
      const pct = infoTitolarita.percentuale;
      if (pct >= 90) fattoreTitolarita = 1.20;
      else if (pct >= 75) fattoreTitolarita = 1.10;
      else if (pct >= 50) fattoreTitolarita = 1.0;
      else if (pct >= 30) fattoreTitolarita = 0.85;
      else if (pct >= 15) fattoreTitolarita = 0.75;
      else fattoreTitolarita = 0.65;
    }

    const infoInfortunio = getInfortunio(player.nome);
    let fattoreInfortunio = 1.0;
    if (infoInfortunio) {
      const tipo = infoInfortunio.tipo.toLowerCase();
      if (tipo.includes("lungo") || tipo.includes("grave") || tipo.includes("crociato") || tipo.includes("rottura")) {
        fattoreInfortunio = 0.50;
      } else if (tipo.includes("medio") || tipo.includes("frattura") || tipo.includes("muscolare")) {
        fattoreInfortunio = 0.70;
      } else {
        fattoreInfortunio = 0.85;
      }
      if (infoInfortunio.fino_ca) {
        const rientro = new Date(infoInfortunio.fino_ca);
        const oggi = new Date();
        const giorniMancanti = Math.ceil((rientro.getTime() - oggi.getTime()) / (1000 * 60 * 60 * 24));
        if (giorniMancanti <= 14) fattoreInfortunio = Math.min(1.0, fattoreInfortunio + 0.15);
        else if (giorniMancanti <= 30) fattoreInfortunio = Math.min(1.0, fattoreInfortunio + 0.05);
      }
    }

    let fattoreProfilo = 1;
    if (legaScandicci && squadre.length > 0) {
      const profiliInteressati = PROFILI_SCANDICCI.filter((p) => p.distribuzione[ruolo as keyof typeof p.distribuzione] > 25);
      if (profiliInteressati.length > 0) {
        const mediaInteresse = profiliInteressati.reduce((sum, p) => sum + p.distribuzione[ruolo as keyof typeof p.distribuzione], 0) / profiliInteressati.length;
        fattoreProfilo = 1 + (mediaInteresse - 20) / 100;
      }
    }

    let prezzoAlgoritmo = prezzoBase * inflazione * fattoreDomanda * fattoreConcorrenza * fattoreBudget * fattoreFase * fattoreTitolarita * fattoreInfortunio * fattoreProfilo;

    const limiteMassimo = config.budget * 0.30;
    const limiteMinimo = 1;
    prezzoAlgoritmo = Math.min(prezzoAlgoritmo, limiteMassimo);
    prezzoAlgoritmo = Math.max(limiteMinimo, Math.round(prezzoAlgoritmo));

    const nomeNormalizzato = normalizzaNome(player.nome);
    const prezzoStorico = PREZZI_STORICI[nomeNormalizzato];
    let prezzoFinale: number;

    if (prezzoStorico !== undefined) {
      const pesoStorico = Math.max(0.40, 0.70 - (acquisti.length * 0.015));
      const pesoAlgoritmo = 1 - pesoStorico;
      prezzoFinale = Math.round(pesoStorico * prezzoStorico + pesoAlgoritmo * prezzoAlgoritmo);
    } else {
      prezzoFinale = prezzoAlgoritmo;
    }

    return Math.max(limiteMinimo, Math.min(prezzoFinale, limiteMassimo));
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
    if (squadraIndex === -1 || squadre[squadraIndex].budget < prezzoNum) {
      setMessaggio("Squadra non trovata o budget insufficiente.");
      return;
    }
    const nuoveSquadre = [...squadre];
    nuoveSquadre[squadraIndex] = {
      ...nuoveSquadre[squadraIndex],
      budget: nuoveSquadre[squadraIndex].budget - prezzoNum,
      giocatori: [...nuoveSquadre[squadraIndex].giocatori, { ...giocatoreSelezionato, prezzoPagato: prezzoNum }],
    };
    setSquadre(nuoveSquadre);
    const prezzoCons = calcolaPrezzoConsigliato(giocatoreSelezionato);
    const nuoviAcquisti = [...acquisti, { 
      giocatore: giocatoreSelezionato.nome, 
      squadra: squadraAcquirente, 
      prezzo: prezzoNum, 
      timestamp: new Date().toISOString(),
      prezzoConsigliato: prezzoCons
    }];
    setAcquisti(nuoviAcquisti);
    localStorage.setItem("fantai-squadre", JSON.stringify(nuoveSquadre));
    localStorage.setItem("fantai-acquisti", JSON.stringify(nuoviAcquisti));
    setGiocatoreSelezionato(null);
    setPrezzo("");
    setMessaggio(`Acquisto registrato: ${giocatoreSelezionato.nome} → ${squadraAcquirente} per ${prezzoNum} crediti.`);
  };

  const annullaAcquisto = (indice: number) => {
    if (!window.confirm("Sei sicuro di voler annullare questo acquisto? Il giocatore tornerà disponibile e il budget verrà ripristinato.")) return;
    const acquisto = acquisti[indice];
    const squadraIndex = squadre.findIndex((s) => s.nome === acquisto.squadra);
    if (squadraIndex === -1) return;
    const giocatore = giocatori.find((g) => g.nome === acquisto.giocatore);
    if (!giocatore) return;

    const nuoveSquadre = [...squadre];
    nuoveSquadre[squadraIndex] = {
      ...nuoveSquadre[squadraIndex],
      budget: nuoveSquadre[squadraIndex].budget + acquisto.prezzo,
      giocatori: nuoveSquadre[squadraIndex].giocatori.filter((g) => g.nome !== acquisto.giocatore),
    };
    const nuoviAcquisti = acquisti.filter((_, i) => i !== indice);
    setSquadre(nuoveSquadre);
    setAcquisti(nuoviAcquisti);
    localStorage.setItem("fantai-squadre", JSON.stringify(nuoveSquadre));
    localStorage.setItem("fantai-acquisti", JSON.stringify(nuoviAcquisti));
    setMessaggio(`✅ Acquisto annullato: ${acquisto.giocatore} è tornato disponibile.`);
  };

  const iniziaModificaAcquisto = (indice: number) => {
    const acquisto = acquisti[indice];
    setAcquistoDaModificare(indice);
    setNuovoPrezzo(acquisto.prezzo.toString());
    setNuovaSquadra(acquisto.squadra);
  };

  const confermaModificaAcquisto = () => {
    if (acquistoDaModificare === null) return;
    const prezzoNum = Number(nuovoPrezzo);
    if (isNaN(prezzoNum) || prezzoNum <= 0) {
      setMessaggio("Prezzo non valido.");
      return;
    }
    const acquistoOriginale = acquisti[acquistoDaModificare];
    const squadraOriginaleIndex = squadre.findIndex((s) => s.nome === acquistoOriginale.squadra);
    const squadraNuovaIndex = squadre.findIndex((s) => s.nome === nuovaSquadra);
    if (squadraOriginaleIndex === -1 || squadraNuovaIndex === -1) return;
    const giocatore = giocatori.find((g) => g.nome === acquistoOriginale.giocatore);
    if (!giocatore) return;

    if (squadraOriginaleIndex !== squadraNuovaIndex) {
      const nuoveSquadre = [...squadre];
      nuoveSquadre[squadraOriginaleIndex] = {
        ...nuoveSquadre[squadraOriginaleIndex],
        budget: nuoveSquadre[squadraOriginaleIndex].budget + acquistoOriginale.prezzo,
        giocatori: nuoveSquadre[squadraOriginaleIndex].giocatori.filter((g) => g.nome !== acquistoOriginale.giocatore),
      };
      if (nuoveSquadre[squadraNuovaIndex].budget < prezzoNum) {
        setMessaggio(`Budget insufficiente per ${nuovaSquadra}.`);
        return;
      }
      nuoveSquadre[squadraNuovaIndex] = {
        ...nuoveSquadre[squadraNuovaIndex],
        budget: nuoveSquadre[squadraNuovaIndex].budget - prezzoNum,
        giocatori: [...nuoveSquadre[squadraNuovaIndex].giocatori, { ...giocatore, prezzoPagato: prezzoNum }],
      };
      setSquadre(nuoveSquadre);
      localStorage.setItem("fantai-squadre", JSON.stringify(nuoveSquadre));
    } else {
      const nuoveSquadre = [...squadre];
      const budgetDisponibile = nuoveSquadre[squadraNuovaIndex].budget + acquistoOriginale.prezzo;
      if (budgetDisponibile < prezzoNum) {
        setMessaggio(`Budget insufficiente per ${nuovaSquadra}.`);
        return;
      }
      nuoveSquadre[squadraNuovaIndex] = {
        ...nuoveSquadre[squadraNuovaIndex],
        budget: budgetDisponibile - prezzoNum,
        giocatori: nuoveSquadre[squadraNuovaIndex].giocatori.map((g) => g.nome === acquistoOriginale.giocatore ? { ...g, prezzoPagato: prezzoNum } : g),
      };
      setSquadre(nuoveSquadre);
      localStorage.setItem("fantai-squadre", JSON.stringify(nuoveSquadre));
    }

    const nuoviAcquisti = [...acquisti];
    nuoviAcquisti[acquistoDaModificare] = { ...acquistoOriginale, squadra: nuovaSquadra, prezzo: prezzoNum, prezzoConsigliato: calcolaPrezzoConsigliato(giocatore) };
    setAcquisti(nuoviAcquisti);
    localStorage.setItem("fantai-acquisti", JSON.stringify(nuoviAcquisti));
    setMessaggio(`✅ Acquisto modificato: ${acquistoOriginale.giocatore} → ${nuovaSquadra} per ${prezzoNum} crediti.`);
    setAcquistoDaModificare(null);
    setNuovoPrezzo("");
    setNuovaSquadra("");
  };

  const resetAsta = () => {
    if (!window.confirm("Vuoi azzerare tutta l'asta?")) return;
    const iniziali: Squadra[] = legaScandicci
      ? PROFILI_SCANDICCI.map((p) => ({ nome: p.nome, budget: config.budget, giocatori: [] }))
      : Array.from({ length: config.partecipanti }, (_, i) => ({ nome: `Squadra ${i + 1}`, budget: config.budget, giocatori: [] }));
    setSquadre(iniziali);
    setAcquisti([]);
    setGiocatoreSelezionato(null);
    setPrezzo("");
    setMessaggio("");
    ruoliCompletatiRef.current = new Set();
    localStorage.setItem("fantai-squadre", JSON.stringify(iniziali));
    localStorage.setItem("fantai-acquisti", JSON.stringify([]));
    setSquadraAcquirente(iniziali[0]?.nome || "");
  };

  const cambiaNomeSquadra = (indice: number, nuovoNome: string) => {
    const nuoveSquadre = [...squadre];
    const vecchioNome = nuoveSquadre[indice].nome;
    nuoveSquadre[indice] = { ...nuoveSquadre[indice], nome: nuovoNome };
    setSquadre(nuoveSquadre);
    localStorage.setItem("fantai-squadre", JSON.stringify(nuoveSquadre));
    if (squadraAcquirente === vecchioNome) setSquadraAcquirente(nuovoNome);
    if (miaSquadra === vecchioNome) cambiaMiaSquadra(nuovoNome);
  };

  const generaAnalisiRuolo = (ruolo: string, squadreList: Squadra[], giocatoriList: Player[]): string => {
    const ruoliMap: Record<string, string> = { P: "Portieri", D: "Difensori", C: "Centrocampisti", A: "Attaccanti" };
    const nomeRuolo = ruoliMap[ruolo] || ruolo;
    let analisi = `Analisi ${nomeRuolo}:\n`;
    for (const squadra of squadreList) {
      const giocatoriRuolo = squadra.giocatori.filter((g) => g.ruolo === ruolo);
      if (giocatoriRuolo.length === 0) {
        analisi += `• ${squadra.nome}: nessun ${nomeRuolo.toLowerCase()} acquistato (molto rischioso).\n`;
        continue;
      }
      const fvmMedio = giocatoriRuolo.reduce((sum, g) => sum + (calcolaFMVProporzionato(g.fvm) || 0), 0) / giocatoriRuolo.length;
      const nomi = giocatoriRuolo.map((g) => g.nome).join(", ");
      const giudizio = fvmMedio > 40 ? "ottimo reparto" : fvmMedio > 25 ? "reparto solido" : "reparto debole";
      analisi += `• ${squadra.nome}: ${nomi} (FVM medio: ${fvmMedio.toFixed(1)}). ${giudizio}.\n`;
    }
    return analisi;
  };

  const PannelloMiaSquadra = () => {
    if (!miaSquadra || !datiMiaSquadra) {
      return (
        <div className="rounded-2xl border border-yellow-700 bg-yellow-950/30 p-4 mb-4">
          <p className="text-sm text-yellow-300 mb-2">⚙️ Seleziona la tua squadra:</p>
          {squadre.length === 0 ? (
            <p className="text-xs text-gray-400">Nessuna squadra disponibile.</p>
          ) : (
            <select value="" onChange={(e) => { if (e.target.value) cambiaMiaSquadra(e.target.value); }} className="w-full rounded-lg border border-yellow-700 bg-gray-800 p-2 text-white text-sm appearance-none">
              <option value="">-- Scegli la tua squadra --</option>
              {squadre.map((s) => (<option key={s.nome} value={s.nome} className="text-gray-900 bg-white">{s.nome}</option>))}
            </select>
          )}
        </div>
      );
    }
    const { squadra, perRuolo } = datiMiaSquadra;
    const ruoliOrd: ("P" | "D" | "C" | "A")[] = ["P", "D", "C", "A"];
    const icone: Record<string, string> = { P: "🧤", D: "🛡️", C: "⚽", A: "🔥" };
    return (
      <div className="rounded-2xl border-2 border-green-600 bg-gradient-to-br from-green-950/40 to-gray-900 p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs text-green-400 font-semibold tracking-wider">LA MIA SQUADRA</p>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-white">{miaSquadra}</h3>
              <button onClick={() => cambiaMiaSquadra("")} className="text-xs text-gray-400 hover:text-yellow-400 underline transition-colors">(Cambia)</button>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400">Budget</p>
            <p className="text-2xl font-bold text-green-400">{squadra.budget}<span className="text-sm">cr</span></p>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2 mb-3">
          {ruoliOrd.map((r) => {
            const max = config.rosa[r];
            const attuale = perRuolo[r].length;
            const disponibili = giocatoriDisponibili.filter((g) => g.ruolo === r).length;
            const allarme = attuale < max && disponibili <= 3;
            return (
              <div key={r} className={`rounded-lg p-2 text-center ${allarme ? "bg-red-950 border border-red-700" : "bg-gray-800/60"}`}>
                <div className="text-lg">{icone[r]}</div>
                <div className={`text-xs font-bold ${allarme ? "text-red-400" : "text-white"}`}>{attuale}/{max}</div>
                {allarme && <div className="text-[10px] text-red-400 mt-1">⚠️ {disponibili} rimasti</div>}
              </div>
            );
          })}
        </div>
        <div className="max-h-32 overflow-y-auto space-y-1">
          {ruoliOrd.map((r) => perRuolo[r].map((g, i) => (
            <div key={`${r}-${i}`} className="flex justify-between text-xs bg-gray-800/40 rounded px-2 py-1">
              <span className="text-gray-300">{icone[r]} {g.nome}</span>
              <span className="text-green-400 font-semibold">{g.prezzoPagato}cr</span>
            </div>
          )))}
          {squadra.giocatori.length === 0 && <p className="text-xs text-gray-500 text-center py-2">Nessun giocatore acquistato</p>}
        </div>
        <div className="flex gap-2 mt-3">
          <button onClick={() => esportaRosa("testo")} className="flex-1 rounded-lg bg-blue-700 hover:bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition-colors">📋 Copia Rosa</button>
          <button onClick={() => esportaRosa("csv")} className="flex-1 rounded-lg bg-purple-700 hover:bg-purple-600 px-3 py-2 text-xs font-semibold text-white transition-colors">📥 Scarica CSV</button>
        </div>
        {messaggioExport && <p className="mt-2 text-xs text-center text-green-400 font-semibold">{messaggioExport}</p>}
      </div>
    );
  };

  const GraficoAndamentoPrezzi = () => {
    const ultimi20 = acquisti.slice(-20);
    if (ultimi20.length === 0) {
      return (
        <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 mb-4">
          <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">📈 Andamento Prezzi</h3>
          <p className="text-xs text-gray-500 text-center py-4">Nessun acquisto registrato</p>
        </div>
      );
    }
    const maxPrezzo = Math.max(...ultimi20.map((a) => Math.max(a.prezzo, a.prezzoConsigliato || 0)));
    const mediaPagata = Math.round(ultimi20.reduce((s, a) => s + a.prezzo, 0) / ultimi20.length);
    const mediaConsigliata = Math.round(ultimi20.reduce((s, a) => s + (a.prezzoConsigliato || 0), 0) / ultimi20.length);
    const affari = ultimi20.filter((a) => a.prezzo < (a.prezzoConsigliato || 0)).length;

    return (
      <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 mb-4">
        <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">📈 Andamento Prezzi (ultimi {ultimi20.length})</h3>
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="rounded-lg bg-gray-800/50 p-2 text-center">
            <p className="text-[10px] text-gray-400">Media pagata</p>
            <p className="text-sm font-bold text-orange-400">{mediaPagata}cr</p>
          </div>
          <div className="rounded-lg bg-gray-800/50 p-2 text-center">
            <p className="text-[10px] text-gray-400">Media consigliata</p>
            <p className="text-sm font-bold text-green-400">{mediaConsigliata}cr</p>
          </div>
          <div className="rounded-lg bg-gray-800/50 p-2 text-center">
            <p className="text-[10px] text-gray-400">Affari</p>
            <p className="text-sm font-bold text-blue-400">{affari}/{ultimi20.length}</p>
          </div>
        </div>
        <div className="relative h-32 bg-gray-800/30 rounded-lg p-2 overflow-x-auto">
          <div className="flex items-end gap-1 h-full min-w-max">
            {ultimi20.map((a, i) => {
              const altezzaPagata = (a.prezzo / maxPrezzo) * 100;
              const altezzaCons = ((a.prezzoConsigliato || 0) / maxPrezzo) * 100;
              const isAffare = a.prezzo < (a.prezzoConsigliato || 0);
              return (
                <div key={i} className="flex flex-col items-center gap-1 flex-1 min-w-[20px]">
                  <div className="relative w-full h-full flex items-end justify-center">
                    <div className="absolute w-full border-t-2 border-dashed border-yellow-500/50" style={{ bottom: `${altezzaCons}%` }} />
                    <div className={`w-full ${isAffare ? "bg-green-500" : "bg-red-500"} rounded-t transition-all hover:opacity-80`} style={{ height: `${altezzaPagata}%` }} title={`${a.giocatore}: ${a.prezzo}cr (cons: ${a.prezzoConsigliato}cr)`} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="flex items-center justify-center gap-4 mt-2 text-[10px] text-gray-400">
          <div className="flex items-center gap-1"><div className="w-3 h-3 bg-green-500 rounded" /><span>Affare</span></div>
          <div className="flex items-center gap-1"><div className="w-3 h-3 bg-red-500 rounded" /><span>Sovraprezzo</span></div>
          <div className="flex items-center gap-1"><div className="w-3 h-0.5 bg-yellow-500 border-dashed" /><span>Consigliato</span></div>
        </div>
      </div>
    );
  };

  const StoricoPrezzi = () => {
    const ruoliOrd: ("P" | "D" | "C" | "A")[] = ["P", "D", "C", "A"];
    const icone: Record<string, string> = { P: "🧤", D: "🛡️", C: "⚽", A: "🔥" };
    const nomiRuolo: Record<string, string> = { P: "Portieri", D: "Difensori", C: "Centrocampisti", A: "Attaccanti" };
    return (
      <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 mb-4">
        <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">📊 Storico per Ruolo (ultimi 5)</h3>
        <div className="grid grid-cols-2 gap-3">
          {ruoliOrd.map((r) => {
            const lista = storicoPerRuolo[r];
            const media = lista.length > 0 ? Math.round(lista.reduce((s, x) => s + x.prezzo, 0) / lista.length) : 0;
            return (
              <div key={r} className="rounded-lg bg-gray-800/50 p-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-white">{icone[r]} {nomiRuolo[r]}</span>
                  {media > 0 && <span className="text-xs text-yellow-400 font-bold">μ {media}</span>}
                </div>
                {lista.length === 0 ? (
                  <p className="text-[10px] text-gray-500">Nessun acquisto</p>
                ) : (
                  <div className="space-y-0.5">
                    {lista.map((x, i) => (
                      <div key={i} className="flex justify-between text-[10px]">
                        <span className="text-gray-400 truncate max-w-[70%]">{x.nome}</span>
                        <span className="text-green-400 font-semibold">{x.prezzo}cr</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ==========================================
  // RENDER: VISTA ASTA
  // ==========================================
  if (view === "asta") {
    return (
      <main className="min-h-screen bg-black text-white px-5 py-8">
        <div className="mx-auto w-full max-w-md">
          <button onClick={() => setView("dashboard")} className="mb-4 text-gray-400 underline flex items-center gap-2 hover:text-white transition-colors">← Torna alla Dashboard</button>
          <PannelloMiaSquadra />
          <GraficoAndamentoPrezzi />
          <StoricoPrezzi />
          {legaScandicci && (
            <div className="rounded-2xl border border-blue-800 bg-blue-950/30 p-4 mb-4">
              <h3 className="text-sm font-bold text-blue-300 mb-2">Profili Avversari (Scandicci League)</h3>
              <div className="max-h-32 overflow-y-auto text-xs space-y-1">
                {PROFILI_SCANDICCI.map((p) => (<div key={p.nome} className="flex justify-between"><span className="font-semibold">{p.nome}</span><span className="text-gray-400">{p.stile}</span></div>))}
              </div>
            </div>
          )}
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 mb-4">
            <h2 className="text-sm font-bold text-white mb-2">Squadre e Budget</h2>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {squadre.map((s) => (
                <div key={s.nome} className="flex items-center justify-between text-xs">
                  <span className={`font-semibold ${s.nome === miaSquadra ? "text-green-400" : "text-white"}`}>{s.nome === miaSquadra && "⭐ "}{s.nome}</span>
                  <span className="text-gray-300">{s.budget}cr</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 mb-4">
            <h2 className="text-sm font-bold text-white mb-2">Cerca giocatore</h2>
            <button onClick={() => setSoloPreferiti(!soloPreferiti)} className={`w-full mb-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${soloPreferiti ? "bg-yellow-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}>
              ⭐ {soloPreferiti ? `Solo Preferiti (${preferiti.length})` : "Mostra solo preferiti"}
            </button>
            <div className="flex gap-2 mb-2">
              <select value={filtroRuolo} onChange={(e) => setFiltroRuolo(e.target.value)} className="flex-1 rounded-lg border border-gray-700 bg-gray-800 p-2 text-white text-sm">
                <option value="tutti">Tutti i ruoli</option>
                <option value="P">Portieri</option>
                <option value="D">Difensori</option>
                <option value="C">Centrocampisti</option>
                <option value="A">Attaccanti</option>
              </select>
              <input type="text" placeholder="Nome..." value={ricerca} onChange={(e) => setRicerca(e.target.value)} className="flex-1 rounded-lg border border-gray-700 bg-gray-800 p-2 text-white text-sm" />
            </div>
            <div className="mt-2 max-h-72 overflow-y-auto">
              {giocatoriFiltrati.map((g, i) => {
                const isPreferito = preferiti.includes(g.nome);
                const fvmProporzionato = calcolaFMVProporzionato(g.fvm);
                return (
                  <div key={`${g.nome}-${i}`} className="flex items-center gap-2 mb-1">
                    <button onClick={() => setGiocatoreSelezionato(g)} className={`flex-1 text-left px-3 py-2 rounded-lg text-sm ${giocatoreSelezionato?.nome === g.nome ? "bg-green-600 text-white" : "bg-gray-800 text-gray-300 hover:bg-gray-700"}`}>
                      <div className="flex justify-between items-center">
                        <span>{g.nome} {g.squadra && <span className="text-xs text-gray-400">({g.squadra})</span>}</span>
                        {fvmProporzionato > 0 && <span className="text-xs text-blue-300">FVM:{fvmProporzionato}</span>}
                      </div>
                    </button>
                    <button onClick={() => togglePreferito(g.nome)} className={`p-2 rounded-lg text-lg transition-colors ${isPreferito ? "bg-yellow-600" : "bg-gray-800 hover:bg-gray-700"}`} title={isPreferito ? "Rimuovi dai preferiti" : "Aggiungi ai preferiti"}>
                      {isPreferito ? "⭐" : "☆"}
                    </button>
                  </div>
                );
              })}
              {giocatoriFiltrati.length === 0 && <p className="text-gray-500 text-xs text-center py-4">Nessun giocatore trovato.</p>}
            </div>
          </div>
          {giocatoreSelezionato && (
            <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 mb-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h2 className="text-lg font-bold text-white">{giocatoreSelezionato.nome}</h2>
                  <p className="text-xs text-gray-400">{giocatoreSelezionato.ruolo} • {giocatoreSelezionato.squadra} {calcolaFMVProporzionato(giocatoreSelezionato.fvm) > 0 && `• FVM: ${calcolaFMVProporzionato(giocatoreSelezionato.fvm)}`}</p>
                </div>
                <button onClick={() => togglePreferito(giocatoreSelezionato.nome)} className={`p-2 rounded-lg text-xl ${preferiti.includes(giocatoreSelezionato.nome) ? "bg-yellow-600" : "bg-gray-800"}`}>
                  {preferiti.includes(giocatoreSelezionato.nome) ? "⭐" : "☆"}
                </button>
              </div>
              <div className="mb-3 grid grid-cols-3 gap-2">
                <div className="rounded-lg bg-green-950 p-2 text-center"><p className="text-[10px] text-green-400">Consigliato</p><p className="text-lg font-bold">{prezzoConsigliato}</p></div>
                <div className="rounded-lg bg-orange-950 p-2 text-center"><p className="text-[10px] text-orange-400">Aggressivo</p><p className="text-lg font-bold">{Math.round(prezzoConsigliato * 1.1)}</p></div>
                <div className="rounded-lg bg-red-950 p-2 text-center"><p className="text-[10px] text-red-400">Massimo</p><p className="text-lg font-bold">{Math.round(prezzoConsigliato * 1.2)}</p></div>
              </div>
              {(() => {
                const infoTitolarita = getTitolarita(giocatoreSelezionato.nome, giocatoreSelezionato.squadra);
                const infoInfortunio = getInfortunio(giocatoreSelezionato.nome);
                return (
                  <div className="mb-3 space-y-2">
                    {infoTitolarita && (
                      <div className="rounded-lg bg-gray-800/50 p-2">
                        <p className="text-xs font-semibold text-blue-300">Titolarità: {infoTitolarita.percentuale}% {infoTitolarita.posizione && `(${infoTitolarita.posizione})`}</p>
                        {infoTitolarita.nota && <p className="text-[10px] text-gray-400">{infoTitolarita.nota}</p>}
                      </div>
                    )}
                    {infoInfortunio && (
                      <div className="rounded-lg bg-red-950/40 border border-red-800 p-2">
                        <p className="text-xs font-semibold text-red-400">⚠️ Infortunato: {infoInfortunio.tipo}</p>
                        {infoInfortunio.fino_ca && <p className="text-[10px] text-red-300">Rientro: {infoInfortunio.fino_ca}</p>}
                      </div>
                    )}
                  </div>
                );
              })()}
              <div className="space-y-2">
                <input type="number" placeholder="Prezzo pagato" value={prezzo} onChange={(e) => setPrezzo(e.target.value)} className="w-full rounded-lg border border-gray-700 bg-gray-800 p-2 text-white text-sm" />
                <select value={squadraAcquirente} onChange={(e) => setSquadraAcquirente(e.target.value)} className="w-full rounded-lg border border-gray-700 bg-gray-800 p-2 text-white text-sm">
                  {squadre.map((s) => (<option key={s.nome} value={s.nome} className="text-gray-900 bg-white">{s.nome} ({s.budget}cr)</option>))}
                </select>
                <button onClick={registraAcquisto} className="w-full rounded-lg bg-orange-600 hover:bg-orange-500 px-4 py-3 font-bold text-white transition-colors">Registra Acquisto</button>
              </div>
            </div>
          )}
          {messaggio && <div className="rounded-2xl border border-gray-800 bg-gray-900 p-3 whitespace-pre-wrap mb-4"><p className="text-xs text-gray-300">{messaggio}</p></div>}
          {acquisti.length > 0 && (
            <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 mb-4">
              <h3 className="text-sm font-bold text-white mb-3">Cronologia Acquisti ({acquisti.length})</h3>
              <ul className="space-y-2 text-xs text-gray-300 max-h-96 overflow-y-auto">
                {acquisti.slice().reverse().map((a, i) => {
                  const indiceReale = acquisti.length - 1 - i;
                  const isAffare = a.prezzoConsigliato && a.prezzo < a.prezzoConsigliato;
                  const isModifica = acquistoDaModificare === indiceReale;
                  return (
                    <li key={i} className="rounded-lg bg-gray-800/50 p-2">
                      <div className="flex justify-between items-start mb-1">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-white">{a.giocatore}</span>
                            {isAffare && <span className="text-[10px] bg-green-900/50 text-green-400 px-1.5 py-0.5 rounded">AFFARE</span>}
                          </div>
                          <div className="text-[10px] text-gray-400">{a.squadra} • {a.prezzo}cr{a.prezzoConsigliato && <span className="text-gray-500"> (cons: {a.prezzoConsigliato}cr)</span>}</div>
                        </div>
                        {!isModifica && (
                          <button onClick={() => iniziaModificaAcquisto(indiceReale)} className="ml-2 p-1 rounded bg-gray-700 hover:bg-blue-700 transition-colors" title="Modifica acquisto"><span className="text-xs">⚙️</span></button>
                        )}
                      </div>
                      {isModifica && (
                        <div className="mt-2 space-y-2 border-t border-gray-700 pt-2">
                          <input type="number" value={nuovoPrezzo} onChange={(e) => setNuovoPrezzo(e.target.value)} placeholder="Nuovo prezzo" className="w-full rounded border border-gray-600 bg-gray-800 p-1.5 text-white text-xs" />
                          <select value={nuovaSquadra} onChange={(e) => setNuovaSquadra(e.target.value)} className="w-full rounded border border-gray-600 bg-gray-800 p-1.5 text-white text-xs">
                            {squadre.map((s) => (<option key={s.nome} value={s.nome} className="text-gray-900 bg-white">{s.nome}</option>))}
                          </select>
                          <div className="flex gap-2">
                            <button onClick={confermaModificaAcquisto} className="flex-1 rounded bg-green-600 hover:bg-green-500 px-2 py-1 text-xs font-semibold text-white">✓ Conferma</button>
                            <button onClick={() => setAcquistoDaModificare(null)} className="flex-1 rounded bg-gray-700 hover:bg-gray-600 px-2 py-1 text-xs font-semibold text-white">✕ Annulla</button>
                          </div>
                          <button onClick={() => annullaAcquisto(indiceReale)} className="w-full rounded bg-red-700 hover:bg-red-600 px-2 py-1 text-xs font-semibold text-white">🗑️ Elimina acquisto</button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={() => setView("rimasti")} className="flex-1 rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-3 text-sm font-bold text-white transition-colors">👥 Rimasti</button>
            <button onClick={resetAsta} className="flex-1 rounded-lg border border-gray-700 bg-gray-800 hover:bg-gray-700 px-4 py-3 text-sm font-semibold text-white transition-colors">Azzera</button>
          </div>
        </div>
      </main>
    );
  }

  // ==========================================
  // RENDER: VISTA RIMASTI
  // ==========================================
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
    chiaviRuoli.forEach((r) => { gruppi[r].sort((a, b) => (b.fvm || 0) - (a.fvm || 0)); });

    return (
      <main className="min-h-screen bg-black text-white px-5 py-8">
        <div className="mx-auto w-full max-w-md">
          <button onClick={() => setView("asta")} className="mb-4 text-gray-400 underline flex items-center gap-2 hover:text-white transition-colors">← Torna all'Asta</button>
          <h2 className="text-2xl font-bold text-green-400 mb-4">Calciatori Rimasti</h2>
          <button onClick={() => setSoloPreferiti(!soloPreferiti)} className={`w-full mb-4 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${soloPreferiti ? "bg-yellow-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}>
            ⭐ {soloPreferiti ? `Mostra tutti (${giocatoriDisponibili.length})` : `Solo preferiti (${preferiti.filter(n => giocatoriDisponibili.some(g => g.nome === n)).length})`}
          </button>
          {giocatoriDisponibili.length === 0 ? (
            <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6 text-center"><p className="text-gray-400">Tutti i calciatori sono stati acquistati!</p></div>
          ) : (
            <div className="space-y-4">
              {chiaviRuoli.map((ruolo) => {
                let lista = gruppi[ruolo];
                if (soloPreferiti) lista = lista.filter((g) => preferiti.includes(g.nome));
                if (lista.length === 0) return null;
                const nomeRuolo = ruolo === "P" ? "Portieri" : ruolo === "D" ? "Difensori" : ruolo === "C" ? "Centrocampisti" : ruolo === "A" ? "Attaccanti" : ruolo;
                return (
                  <div key={ruolo} className="rounded-2xl border border-gray-800 bg-gray-900 p-4">
                    <h3 className="text-sm font-bold text-orange-400 mb-2 flex items-center gap-2">
                      <span className="bg-gray-800 px-2 py-0.5 rounded text-white text-xs">{ruolo}</span>{nomeRuolo} ({lista.length})
                    </h3>
                    <ul className="space-y-2 max-h-96 overflow-y-auto pr-1">
                      {lista.map((g, i) => {
                        const prezzoCons = calcolaPrezzoConsigliato(g);
                        const titolarita = getTitolarita(g.nome, g.squadra);
                        const pctTitolarita = titolarita?.percentuale ?? 0;
                        const isPreferito = preferiti.includes(g.nome);
                        const fvmProporzionato = calcolaFMVProporzionato(g.fvm);
                        let coloreTitolarita = "text-red-400";
                        if (pctTitolarita >= 80) coloreTitolarita = "text-green-400";
                        else if (pctTitolarita >= 50) coloreTitolarita = "text-yellow-400";
                        return (
                          <li key={`${g.nome}-${i}`} className="flex items-start gap-2 border-b border-gray-800 pb-2 last:border-0 last:pb-0">
                            <button onClick={() => togglePreferito(g.nome)} className={`p-1 rounded text-sm mt-1 ${isPreferito ? "bg-yellow-600" : "bg-gray-800"}`}>{isPreferito ? "⭐" : "☆"}</button>
                            <div className="flex-1">
                              <div className="flex justify-between items-start">
                                <div><p className="font-semibold text-white text-sm">{g.nome}</p><p className="text-[10px] text-gray-400">{g.squadra || "Svincolato"}</p></div>
                                <p className="text-xs font-bold text-blue-300">FMV: {fvmProporzionato || "-"}</p>
                              </div>
                              <div className="flex justify-between items-center bg-gray-800/50 rounded-lg p-2 mt-1">
                                <div><span className="text-[10px] text-gray-400">Prezzo</span><p className="text-sm font-bold text-green-400">{prezzoCons}cr</p></div>
                                <div className="text-right"><span className="text-[10px] text-gray-400">Titolarità</span><p className={`text-sm font-bold ${coloreTitolarita}`}>{pctTitolarita}%</p></div>
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

  // ==========================================
  // RENDER: DASHBOARD
  // ==========================================
  if (view === "dashboard") {
    const iconeRuolo: Record<string, string> = { P: "🧤", D: "🛡️", C: "⚽", A: "🔥" };
    const nomiRuolo: Record<string, string> = { P: "Portieri", D: "Difensori", C: "Centrocampisti", A: "Attaccanti" };
    const ruoliOrd: ("P" | "D" | "C" | "A")[] = ["P", "D", "C", "A"];
    return (
      <main className="min-h-screen bg-black text-white px-5 py-8">
        <div className="mx-auto w-full max-w-md">
          <div className="rounded-2xl border border-gray-800 bg-gradient-to-br from-gray-900 to-gray-950 p-6 mb-4">
            <div className="flex items-center justify-between mb-4">
              <div><p className="text-xs font-semibold tracking-widest text-orange-500">FANTAI AUCTION PRO</p><h2 className="text-2xl font-bold text-green-400 mt-1">Dashboard</h2></div>
              <div className="text-4xl">📊</div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-gray-800/60 p-3"><p className="text-[10px] text-gray-400 uppercase tracking-wider">Partecipanti</p><p className="text-xl font-bold text-white">{config.partecipanti}</p></div>
              <div className="rounded-xl bg-gray-800/60 p-3"><p className="text-[10px] text-gray-400 uppercase tracking-wider">Budget</p><p className="text-xl font-bold text-white">{config.budget}<span className="text-xs text-gray-400">cr</span></p></div>
              <div className="rounded-xl bg-gray-800/60 p-3"><p className="text-[10px] text-gray-400 uppercase tracking-wider">Giocatori</p><p className="text-xl font-bold text-white">{giocatori.length}</p></div>
              <div className="rounded-xl bg-gray-800/60 p-3"><p className="text-[10px] text-gray-400 uppercase tracking-wider">Disponibili</p><p className="text-xl font-bold text-green-400">{giocatoriDisponibili.length}</p></div>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
              <span>Modalità: <span className="text-white font-semibold">{config.modalita === "classic" ? "Classic" : "Mantra"}</span></span>
              <span>Acquisti: <span className="text-white font-semibold">{acquisti.length}</span></span>
            </div>
          </div>
          <div className="rounded-2xl border border-yellow-700/50 bg-gradient-to-br from-yellow-950/20 to-gray-900 p-5 mb-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold text-yellow-400 flex items-center gap-2">⭐ I Miei Preferiti</h3>
              <span className="text-xs bg-yellow-600/30 text-yellow-300 px-2 py-1 rounded-full font-semibold">{preferiti.length} {preferiti.length === 1 ? "giocatore" : "giocatori"}</span>
            </div>
            {preferiti.length === 0 ? (
              <div className="text-center py-6"><div className="text-4xl mb-2">🌟</div><p className="text-sm text-gray-400 mb-1">Nessun preferito selezionato</p><p className="text-xs text-gray-500">Vai in "Modalità Asta" e premi ⭐ accanto ai giocatori che vuoi puntare!</p></div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="rounded-lg bg-gray-800/50 p-2 text-center"><p className="text-[10px] text-gray-400">Disponibili</p><p className="text-sm font-bold text-green-400">{statistichePreferiti.ancoraDisponibili}/{statistichePreferiti.totale}</p></div>
                  <div className="rounded-lg bg-gray-800/50 p-2 text-center"><p className="text-[10px] text-gray-400">FVM medio</p><p className="text-sm font-bold text-blue-400">{statistichePreferiti.fvmMedioProp}</p></div>
                  <div className="rounded-lg bg-gray-800/50 p-2 text-center"><p className="text-[10px] text-gray-400">Prezzo medio</p><p className="text-sm font-bold text-orange-400">{statistichePreferiti.prezzoMedioCons}cr</p></div>
                </div>
                <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                  {ruoliOrd.map((r) => {
                    const lista = preferitiPerRuolo[r] || [];
                    if (lista.length === 0) return null;
                    return (
                      <div key={r}>
                        <div className="flex items-center gap-2 mb-2"><span className="text-lg">{iconeRuolo[r]}</span><span className="text-sm font-bold text-white">{nomiRuolo[r]}</span><span className="text-xs text-gray-400">({lista.length})</span></div>
                        <div className="space-y-1">
                          {lista.map((g, i) => {
                            const fvmProp = calcolaFMVProporzionato(g.fvm);
                            const prezzoCons = calcolaPrezzoConsigliato(g);
                            const ancoraDisponibile = !squadre.some((s) => s.giocatori.some((sg) => sg.nome === g.nome));
                            return (
                              <div key={`${g.nome}-${i}`} className={`flex items-center justify-between rounded-lg px-3 py-2 ${ancoraDisponibile ? "bg-gray-800/60" : "bg-gray-800/20 opacity-50"}`}>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className={`text-sm font-semibold truncate ${ancoraDisponibile ? "text-white" : "text-gray-500 line-through"}`}>{g.nome}</p>
                                    {!ancoraDisponibile && <span className="text-[10px] bg-red-900/50 text-red-400 px-1.5 py-0.5 rounded">VENDUTO</span>}
                                  </div>
                                  <p className="text-[10px] text-gray-400">{g.squadra || "Svincolato"} • FVM: {fvmProp} • Prezzo: {prezzoCons}cr</p>
                                </div>
                                <button onClick={() => togglePreferito(g.nome)} className="ml-2 p-1.5 rounded-lg bg-gray-700 hover:bg-red-700 transition-colors" title="Rimuovi dai preferiti"><span className="text-sm">✕</span></button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <button onClick={() => setView("asta")} className="rounded-xl bg-gradient-to-br from-orange-600 to-orange-700 hover:from-orange-500 hover:to-orange-600 px-4 py-4 font-bold text-white transition-all active:scale-95"><div className="text-2xl mb-1">🎯</div><div className="text-sm">Asta</div></button>
            <button onClick={() => setView("rimasti")} className="rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 px-4 py-4 font-bold text-white transition-all active:scale-95"><div className="text-2xl mb-1">👥</div><div className="text-sm">Rimasti</div></button>
          </div>
          <button onClick={() => { if (!window.confirm("Vuoi davvero reimpostare tutto? Perderai tutti i dati.")) return; localStorage.removeItem("fantai-legaconfig"); localStorage.removeItem("fantai-giocatori"); localStorage.removeItem("fantai-squadre"); localStorage.removeItem("fantai-acquisti"); localStorage.removeItem("fantai-lega-scandicci"); localStorage.removeItem("fantai-preferiti"); localStorage.removeItem("fantai-mia-squadra"); setGiocatori([]); setSquadre([]); setAcquisti([]); setPreferiti([]); setMiaSquadra(""); window.location.reload(); }} className="w-full rounded-xl bg-gray-800 border border-gray-700 hover:bg-gray-700 px-6 py-3 text-sm font-semibold text-gray-300 transition-colors">🔄 Reimposta tutto</button>
        </div>
      </main>
    );
  }

  // ==========================================
  // RENDER: IMPORT
  // ==========================================
  if (view === "import") {
    return (
      <main className="min-h-screen bg-black text-white px-5 py-8">
        <div className="mx-auto w-full max-w-md">
          <ImportListone onComplete={handleImportComplete} />
          <button onClick={() => { setView("wizard"); setPasso(7); }} className="mt-6 w-full rounded-xl border border-gray-700 bg-gray-800 px-5 py-3 font-semibold text-white active:scale-[0.98]">Modifica configurazione</button>
        </div>
      </main>
    );
  }

  // ==========================================
  // RENDER: WIZARD (Default)
  // ==========================================
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
                <button onClick={() => { setLegaScandicci(false); setConfig({ ...configIniziale, partecipanti: 8 }); vaiAvanti(); }} className="w-full rounded-xl bg-orange-600 px-6 py-4 text-lg font-bold active:scale-95">Nuova Lega</button>
                <button onClick={() => { setLegaScandicci(true); setConfig({ ...configIniziale, partecipanti: 10 }); vaiAvanti(); }} className="w-full rounded-xl bg-blue-600 px-6 py-4 text-lg font-bold active:scale-95">Scandicci League</button>
              </div>
            </div>
          </section>
        )}
        {passo === 2 && (
          <section>
            <h2 className="text-2xl font-bold">Numero partecipanti</h2>
            <p className="mt-2 text-gray-400">Quante squadre partecipano?</p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              {[6, 8, 10, 12].map((numero) => (<button key={numero} onClick={() => aggiornaConfig({ partecipanti: numero })} className={`rounded-xl border p-5 text-xl font-bold ${config.partecipanti === numero ? "border-green-500 bg-green-600" : "border-gray-700 bg-gray-900"}`}>{numero}</button>))}
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
            <input type="number" min={1} inputMode="numeric" value={config.budget} onChange={(e) => aggiornaConfig({ budget: Number(e.target.value) })} className="mt-6 w-full rounded-xl border border-gray-700 bg-gray-900 p-4 text-2xl font-bold text-white" />
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
              <button onClick={() => aggiornaConfig({ modalita: "classic" })} className={`w-full rounded-xl border p-5 text-left ${config.modalita === "classic" ? "border-green-500 bg-green-600" : "border-gray-700 bg-gray-900"}`}><p className="font-bold">Classic</p></button>
              <button onClick={() => aggiornaConfig({ modalita: "mantra" })} className={`w-full rounded-xl border p-5 text-left ${config.modalita === "mantra" ? "border-green-500 bg-green-600" : "border-gray-700 bg-gray-900"}`}><p className="font-bold">Mantra</p></button>
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
              {rosaLista.map(([chiave, nome]) => (
                <div key={chiave} className="flex items-center justify-between rounded-xl border border-gray-800 bg-gray-900 p-4">
                  <span className="text-gray-300">{nome}</span>
                  <input type="number" min={0} inputMode="numeric" value={config.rosa[chiave]} onChange={(e) => setConfig((prev) => ({ ...prev, rosa: { ...prev.rosa, [chiave]: Number(e.target.value) } }))} className="w-20 rounded-lg border border-gray-700 bg-gray-800 p-2 text-center font-bold" />
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
              {regoleLista.map(([chiave, nome]) => {
                const attiva = config.regole[chiave];
                return (
                  <button key={chiave} onClick={() => setConfig((prev) => ({ ...prev, regole: { ...prev.regole, [chiave]: !attiva } }))} className="flex w-full items-center justify-between rounded-xl border border-gray-800 bg-gray-900 p-4">
                    <span className="text-gray-300">{nome}</span>
                    <span className={`h-7 w-12 rounded-full p-1 ${attiva ? "bg-green-600" : "bg-gray-700"}`}><span className={`block h-5 w-5 rounded-full bg-white transition-transform ${attiva ? "translate-x-5" : ""}`} /></span>
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
              {ordineLista.map(([valore, nome]) => (<button key={valore} onClick={() => aggiornaConfig({ ordineAsta: valore })} className={`w-full rounded-xl border p-5 text-left ${config.ordineAsta === valore ? "border-green-500 bg-green-600" : "border-gray-700 bg-gray-900"}`}><p className="font-bold">{nome}</p></button>))}
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
