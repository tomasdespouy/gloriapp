export interface PressItem {
  source: string;
  title: string;
  excerpt: string;
  url: string;
  date: string;
  highlight: boolean;
}

export const PRESS_ITEMS: PressItem[] = [
  {
    source: "Cooperativa Ciencia",
    title: "GlorIA: La IA chilena que act\u00faa como paciente para entrenar a futuros psic\u00f3logos",
    excerpt: "Un equipo interdisciplinario cre\u00f3 identidades complejas de pacientes con historias de vida ricas, basadas en la distribuci\u00f3n de patolog\u00edas de salud mental m\u00e1s prevalentes en la poblaci\u00f3n chilena.",
    url: "https://www.cooperativaciencia.cl/radiociencia/2026/01/27/gloria-la-ia-chilena-que-actua-como-paciente-para-entrenar-a-futuros-psicologos/",
    date: "27 enero 2026",
    highlight: true,
  },
  {
    source: "La Tercera",
    title: "Sergio Mena, rector de la U. Gabriela Mistral: \"Estamos en medio de la revoluci\u00f3n del aprendizaje\"",
    excerpt: "El rector de la UGM discute c\u00f3mo la universidad est\u00e1 incorporando IA en sus programas y desarrollando recursos educativos basados en inteligencia artificial.",
    url: "https://www.latercera.com/educacion/noticia/sergio-mena-rector-de-la-u-gabriela-mistral-estamos-en-medio-de-la-revolucion-del-aprendizaje/",
    date: "30 junio 2025",
    highlight: false,
  },
  {
    source: "Portal Innova",
    title: "100% de los docentes de la UGM se certifican en Inteligencia Artificial usando Google Cloud",
    excerpt: "Todos los docentes de la Universidad Gabriela Mistral completaron el programa de certificaci\u00f3n en IA generativa de Google Cloud para educadores.",
    url: "https://portalinnova.cl/100-de-los-docentes-de-la-universidad-gabriela-mistral-se-certifican-en-inteligencia-artificial-usando-google-cloud/",
    date: "Agosto 2024",
    highlight: false,
  },
  {
    source: "G5 Noticias",
    title: "Psic\u00f3loga de la UGM advierte sobre la \u00e9tica de la IA en salud mental",
    excerpt: "Fernanda Orrego, directora de la Escuela de Psicolog\u00eda de la UGM, analiza los desaf\u00edos \u00e9ticos de la inteligencia artificial y su impacto en las relaciones interpersonales.",
    url: "https://g5noticias.cl/2025/10/11/psicologa-de-la-universidad-gabriela-mistral-advierte-que-la-ia-no-tiene-etica-y-no-le-interesa-el-bien-de-la-persona/",
    date: "11 octubre 2025",
    highlight: false,
  },
];
