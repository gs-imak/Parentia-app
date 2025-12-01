import { getProfile } from './profile.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const QUOTE_STATE_FILE = path.join(__dirname, '..', 'data', 'quote-state.json');

export type QuoteType = 'morning' | 'evening';
export type QuoteCategory = 'parent' | 'adult' | 'special';

export const MORNING_QUOTES: string[] = [
  'Tu vas y arriver — tu l’as déjà prouvé hier.',
  'Être parent, c’est être fatigué… mais rempli d’un amour qui recharge tout.',
  'Chaque petit geste compte. Même ceux que personne ne voit.',
  'Tu n’as pas besoin d’être parfait pour être un parent incroyable.',
  'Tu ne réalises pas à quel point tu es fort, parce que tu continues malgré tout.',
  'L’amour que tu donnes aujourd’hui crée le monde de demain.',
  'Ce que tu fais est important, même quand ça ne semble pas l’être.',
  'Parfois, la plus grande preuve d’amour est de continuer, même fatigué.',
  'Ce n’est pas la facilité qui crée les bons parents, c’est la constance.',
  'Ton courage est silencieux, mais il change des vies.',
  'Tu ne peux pas tout faire, mais tu fais déjà l’essentiel.',
  'Tes enfants ne veulent pas un parent parfait. Ils veulent toi.',
  'Tu fais de ton mieux, et c’est déjà immense.',
  'Tu es la preuve vivante qu’on peut être épuisé et extraordinaire en même temps.',
  'Tu avances, même quand tu as l’impression de stagner. Et ça suffit.',
  'Tu es plus patient, plus résilient, plus aimant que tu ne le crois.',
  'Les moments difficiles ne définissent pas ta parentalité. Ta présence, si.',
  'Tu es suffisant. Plus que tu ne l\'imagines.',
  'Même les parents épuisés créent de la magie sans le savoir.',
  'Tu construis des souvenirs, pas un musée. Le désordre est normal.',
  'Rien n\'est parfait, mais tout est précieux : c\'est ça, une famille.',
  'Tes enfants ne verront pas tes tâches inachevées, mais ton amour sans limite.',
  'Chaque jour, même imparfait, est une victoire.',
  'Ce que tu fais aujourd’hui comptera plus que tu ne le crois.',
  'Aujourd’hui, avance d’un pas, même petit. C’est déjà une victoire.',
  'Tu te relèves chaque matin : c’est ça, la vraie force.',
  'Commence doucement. L’important, c’est de commencer.',
  'Tu n’as pas besoin de réussir la journée entière — juste la prochaine heure.',
  'Tu vas y arriver parce que tu es déjà en train d’y arriver.',
];

// Adult morning quotes (24) - Client specified
export const ADULT_MORNING_QUOTES: string[] = [
  'Fais de ta vie un rêve, et de ce rêve une réalité.',
  'Tes rêves n\'attendent pas que tu sois prêt.',
  'Le monde appartient à ceux qui osent.',
  'Tu écris ton histoire, une matinée à la fois.',
  'Sois fier de ce que tu t\'apprêtes à construire.',
  'Tu es plus capable que tu ne le crois.',
  'Tes objectifs t\'attendent : rejoins-les.',
  'Tout commence maintenant.',
  'Ce que tu fais aujourd\'hui compte plus que tu ne l\'imagines.',
  'N\'attends pas la motivation, crée-la.',
  'Commence petit, pense grand.',
  'Aujourd\'hui, prouve-toi que tu peux.',
  'Ton matin décide ton avenir. Sois audacieux.',
  'Tu as le droit de rêver grand. Toujours.',
  'La discipline gagne toujours à la fin.',
  'Va là où tu n\'es jamais allé.',
  'Le succès ne vient pas à toi : tu vas vers lui.',
  'Tes rêves méritent que tu te battes.',
  'Le meilleur moment pour commencer, c\'est toujours maintenant.',
  'Tu n\'as pas besoin d\'être prêt pour être ambitieux.',
  'Sois constant, pas parfait.',
  'Vise plus haut que ce qui semble raisonnable.',
  'Ta volonté est ton meilleur talent.',
  'Le futur appartient à ceux qui n\'abandonnent jamais.',
];

// Adult evening quotes (10) - Client specified
export const ADULT_EVENING_QUOTES: string[] = [
  'Les jours difficiles construisent les meilleurs futurs.',
  'Tes efforts silencieux te mèneront loin.',
  'Tu n\'as pas échoué : tu as appris.',
  'Chaque soir, tu deviens un peu plus toi-même.',
  'Le repos fait partie du plan.',
  'Laisse la peur dormir, garde les rêves éveillés.',
  'Ferme les yeux sur la fatigue, pas sur ton ambition.',
  'Accepte les jours moyens : ils construisent les grands.',
  'Le repos d\'un soir = la victoire de demain.',
  'Tu vas réussir — continue.',
];

// Special date quotes (7)
export interface SpecialDateQuote {
  date: string; // Format: MM-DD
  text: string;
}

export const SPECIAL_DATE_QUOTES: SpecialDateQuote[] = [
  { date: '01-01', text: '365 jours : assez pour réinventer une vie.' },
  { date: '05-08', text: 'Hommage à ceux qui ont rendu la liberté à l\'Europe meurtrie.' },
  { date: '07-14', text: 'Le peuple fit surgir la liberté, et la France devint sa voix.' },
  { date: '09-11', text: 'Cette date demeure : témoin d\'une tragédie, et d\'un courage sans mesure.' },
  { date: '11-11', text: 'À ceux qui ont donné leur jeunesse pour que survive un pays.' },
  { date: '11-13', text: 'Le 13 novembre a brisé une nuit, mais pas la nation.' },
  { date: '12-25', text: 'Le 25 décembre est cette parenthèse où l\'humanité se souvient de sa douceur possible.' },
];

export const EVENING_QUOTES: string[] = [
  'Les journées difficiles ne définissent rien. Les gestes d’amour, si.',
  'Ce n’est pas la liste des choses faites qui compte, mais la paix que tu construis.',
  'Tu t’es battu pour ta famille aujourd’hui. Repose-toi.',
  'Pardonne-toi pour ce qui n’a pas été fait. Tu es humain.',
  'Tu as survécu à 100 % de tes pires journées. Tu vas continuer.',
  'Tes enfants ne verront pas tes tâches inachevées, mais ton amour sans limite.',
  'Chaque jour, même imparfait, est une victoire.',
  'Les moments difficiles ne définissent pas ta parentalité. Ta présence, si.',
  'Les journées sont longues, mais les années filent : respire, tu fais du bon travail.',
  'Tu tiens debout pour tout le monde. N’oublie pas d’être fier de toi.',
  'Tu construis des souvenirs, pas un musée. Le désordre est normal.',
  'Même les parents épuisés créent de la magie sans le savoir.',
  'Les enfants ne se souviendront pas du linge plié, mais des bras qui les serraient.',
  'Tu as le droit d’être épuisé. Tu n’as pas besoin d’être parfait.',
  'Tu as le droit de faire des erreurs : c’est aussi comme ça que grandissent les familles.',
  'Le chaos d’aujourd’hui sera un souvenir tendre demain.',
  'Tu avances, même quand tu as l’impression de stagner. Et ça suffit.',
  'Rien n’est parfait, mais tout est précieux : c’est ça, une famille.',
  'Tu fais de ton mieux, même quand tu en doutes.',
  'Tu peux poser les armes maintenant : la journée est terminée.',
  'Tu as donné de l’amour aujourd’hui. C’est tout ce qui compte.',
  'Ferme les yeux : tu as fait ta part.',
  'Tu peux être fier d’avoir tenu, même si c’était lourd.',
  'Ce soir, offre-toi la gentillesse que tu donnes aux autres.',
  'Le calme du soir est aussi une victoire.',
  'Tu peux relâcher la pression : tout n’a pas besoin d’être réglé maintenant.',
  'Il n’y a pas de mauvaise journée quand elle finit par de la tendresse.',
  'Les petites choses d’aujourd’hui deviendront les souvenirs de demain.',
  'Dors avec la certitude d’avoir fait de ton mieux.',
  'Demain ne demande rien pour l’instant. Ce soir, repose ton cœur.',
];

// Persisted state for quote indices
interface QuoteState {
  lastMorningIndex: number | null;
  lastEveningIndex: number | null;
  lastMorningDate: string | null;
  lastEveningDate: string | null;
}

async function readQuoteState(): Promise<QuoteState> {
  try {
    const content = await fs.readFile(QUOTE_STATE_FILE, 'utf-8');
    return JSON.parse(content) as QuoteState;
  } catch {
    return { lastMorningIndex: null, lastEveningIndex: null, lastMorningDate: null, lastEveningDate: null };
  }
}

async function writeQuoteState(state: QuoteState): Promise<void> {
  await fs.writeFile(QUOTE_STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
}

export interface QuoteResult {
  type: QuoteType;
  text: string;
}

// Helper: Check if user has young children (<=15 years old)
async function hasYoungChildren(): Promise<boolean> {
  try {
    const profile = await getProfile();
    if (profile.children.length === 0) return false;
    
    const now = new Date();
    return profile.children.some(child => {
      const birthDate = new Date(child.birthDate);
      const ageYears = (now.getTime() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
      return ageYears <= 15;
    });
  } catch (error) {
    // If profile loading fails, default to parent quotes
    return true;
  }
}

export async function getRandomQuote(now: Date = new Date()): Promise<QuoteResult> {
  // Check for special date first (highest priority)
  // Special date quotes are displayed for the entire day (00:00-23:59)
  // This check happens BEFORE time-based morning/evening split to ensure
  // the special quote is shown all day long
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const currentDate = `${month}-${day}`;
  
  const specialQuote = SPECIAL_DATE_QUOTES.find(q => q.date === currentDate);
  if (specialQuote) {
    // For special dates, return as morning type (displayed all day 00:00-23:59)
    return { type: 'morning', text: specialQuote.text };
  }
  
  // Determine time period
  const hour = now.getHours();
  const type: QuoteType = hour < 17 ? 'morning' : 'evening';
  
  // Check if user has young children to determine quote pool
  const useParentQuotes = await hasYoungChildren();
  
  let pool: string[];
  if (type === 'morning') {
    pool = useParentQuotes 
      ? [...MORNING_QUOTES, ...ADULT_MORNING_QUOTES] // Mix parent + adult
      : ADULT_MORNING_QUOTES; // Adult only
  } else {
    pool = useParentQuotes
      ? [...EVENING_QUOTES, ...ADULT_EVENING_QUOTES] // Mix parent + adult
      : ADULT_EVENING_QUOTES; // Adult only
  }
  
  // Read persisted state
  const state = await readQuoteState();
  const todayStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
  
  // Determine last index based on type and date
  let lastIndex: number | null = null;
  if (type === 'morning' && state.lastMorningDate === todayStr) {
    lastIndex = state.lastMorningIndex;
  } else if (type === 'evening' && state.lastEveningDate === todayStr) {
    lastIndex = state.lastEveningIndex;
  }

  if (pool.length === 0) {
    throw new Error('Aucune citation définie');
  }

  let index = Math.floor(Math.random() * pool.length);
  if (pool.length > 1 && lastIndex !== null && index === lastIndex) {
    index = (index + 1) % pool.length;
  }

  // Persist the new state
  if (type === 'morning') {
    state.lastMorningIndex = index;
    state.lastMorningDate = todayStr;
  } else {
    state.lastEveningIndex = index;
    state.lastEveningDate = todayStr;
  }
  await writeQuoteState(state);

  return { type, text: pool[index] };
}
