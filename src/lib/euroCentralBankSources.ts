export type EuroCentralBankSource = {
  key: string;
  countryCode: string;
  country: string;
  sourceAgency: string;
  seriesKey: string;
  archiveUrl: string;
  officialUrl: string;
  additionalArchiveUrls?: string[];
};

export const EURO_CENTRAL_BANK_SOURCE_NAMES = [
  "Deutsche Bundesbank",
  "Banque de France",
  "Banca d’Italia",
  "Banco de España",
] as const;

// ECB speech titles identify the speaker before the first colon. Keep the
// country mapping explicit so country labels are based on the speaker's
// national central-bank affiliation, while institution-wide ECB releases can
// still use "Euro Area".
const ECB_SPEAKER_COUNTRY_BY_NAME: Record<string, string> = {
  "boris vujcic": "Croatia",
  "christine lagarde": "France",
  "claes knott": "Netherlands",
  "fabio panetta": "Italy",
  "frank elderson": "Netherlands",
  "francois villeroy de galhau": "France",
  "gabriel makhlouf": "Ireland",
  "gediminas simkus": "Lithuania",
  "ignazio visco": "Italy",
  "isabel schnabel": "Germany",
  "joachim nagel": "Germany",
  "klaas knot": "Netherlands",
  "luis de guindos": "Spain",
  "mario centeno": "Portugal",
  "martins kazaks": "Latvia",
  "olli rehn": "Finland",
  "pablo hernandez de cos": "Spain",
  "piero cipollone": "Italy",
  "philip r. lane": "Ireland",
  "philip lane": "Ireland",
  "pierre wunsch": "Belgium",
  "robert holzmann": "Austria",
  "yannis stournaras": "Greece",
  "yves mersch": "Luxembourg",
};

function normalizeSpeakerName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function euroCentralBankSpeechSpeaker(title: string): string | null {
  const separator = title.indexOf(":");
  if (separator <= 0) return null;
  const speaker = title.slice(0, separator).trim();
  return speaker && speaker.length >= 3 && speaker.length <= 100 ? speaker : null;
}

export function euroCentralBankSpeechCountry(title: string): string {
  const speaker = euroCentralBankSpeechSpeaker(title);
  if (!speaker) return "Euro Area";
  return ECB_SPEAKER_COUNTRY_BY_NAME[normalizeSpeakerName(speaker)] || "Euro Area";
}

export const EURO_CENTRAL_BANK_SOURCES: EuroCentralBankSource[] = [
  {
    key: "bundesbank",
    countryCode: "DE",
    country: "Germany",
    sourceAgency: "Deutsche Bundesbank",
    seriesKey: "eur-national-cb-de-speech",
    archiveUrl: "https://www.bundesbank.de/en/press/speeches",
    officialUrl: "https://www.bundesbank.de/en/press/speeches",
  },
  {
    key: "banque-france",
    countryCode: "FR",
    country: "France",
    sourceAgency: "Banque de France",
    seriesKey: "eur-national-cb-fr-speech",
    archiveUrl: "https://www.banque-france.fr/en/governor-interventions",
    officialUrl: "https://www.banque-france.fr/en/governor-interventions",
  },
  {
    key: "banca-italia",
    countryCode: "IT",
    country: "Italy",
    sourceAgency: "Banca d’Italia",
    seriesKey: "eur-national-cb-it-speech",
    archiveUrl:
      "https://www.bancaditalia.it/pubblicazioni/menu/interventi-memorie.html?com.dotmarketing.htmlpage.language=1",
    officialUrl:
      "https://www.bancaditalia.it/pubblicazioni/menu/interventi-memorie.html?com.dotmarketing.htmlpage.language=1",
    additionalArchiveUrls: [
      "https://www.bancaditalia.it/pubblicazioni/interventi-governatore/index.html",
      "https://www.bancaditalia.it/pubblicazioni/interventi-direttorio/index.html",
      "https://www.bancaditalia.it/pubblicazioni/interventi-vari/index.html",
    ],
  },
  {
    key: "banco-espana",
    countryCode: "ES",
    country: "Spain",
    sourceAgency: "Banco de España",
    seriesKey: "eur-national-cb-es-speech",
    archiveUrl:
      "https://www.bde.es/wbe/en/noticias-eventos/actualidad-banco-espana/intervenciones-publicas/",
    officialUrl:
      "https://www.bde.es/wbe/en/noticias-eventos/actualidad-banco-espana/intervenciones-publicas/",
  },
];

export function euroCentralBankSourceNames(): string[] {
  return [...EURO_CENTRAL_BANK_SOURCE_NAMES];
}
