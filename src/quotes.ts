import { getProfile } from './profile.js';

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
  'Tu es suffisant. Plus que tu ne l’imagines.',
  'Même les parents épuisés créent de la magie sans le savoir.',
  'Tu construis des souvenirs, pas un musée. Le désordre est normal.',
  'Tu as le droit de faire des erreurs : c’est aussi comme ça que grandissent les familles.',
  'Rien n’est parfait, mais tout est précieux : c’est ça, une famille.',
  'Tes enfants ne verront pas tes tâches inachevées, mais ton amour sans limite.',
  'Chaque jour, même imparfait, est une victoire.',
  'Ce que tu fais aujourd’hui comptera plus que tu ne le crois.',
  'Aujourd’hui, avance d’un pas, même petit. C’est déjà une victoire.',
  'Tu te relèves chaque matin : c’est ça, la vraie force.',
  'Commence doucement. L’important, c’est de commencer.',
  'Tu n’as pas besoin de réussir la journée entière — juste la prochaine heure.',
  'Tu vas y arriver parce que tu es déjà en train d’y arriver.',
];

// Adult morning quotes (24)
export const ADULT_MORNING_QUOTES: string[] = [
  'La vie est faite de petits bonheurs. Prends le temps de les voir.',
  'Aujourd\'hui est un nouveau départ. Fais-en ce que tu veux.',
  'Commence ta journée en étant fier de qui tu es.',
  'Chaque matin est une nouvelle chance d\'avancer.',
  'Tu as déjà survécu à 100 % de tes pires journées.',
  'La simplicité est une forme de sagesse.',
  'Ce que tu fais aujourd’hui peut changer demain.',
  'Avance à ton rythme. Il n’y a pas de course.',
  'Tu es plus fort que tu ne le crois.',
  'L’important n’est pas d’être parfait, mais d’être présent.',
  'Les petites victoires comptent autant que les grandes.',
  'Prends soin de toi aujourd’hui.',
  'Tu as le droit de prendre ton temps.',
  'Chaque pas en avant compte, même le plus petit.',
  'Sois patient avec toi-même.',
  'La journée t’appartient. Fais-en quelque chose de beau.',
  'Tu n’as pas besoin de tout régler aujourd’hui.',
  'Respire. Tu vas y arriver.',
  'L’essentiel, c’est de continuer.',
  'Fais de ton mieux, c’est déjà énorme.',
  'Aujourd’hui, choisis la bienveillance envers toi-même.',
  'Tu mérites de la douceur.',
  'Le courage, c’est avancer même quand c’est difficile.',
  'Tu es capable de plus que tu ne l’imagines.',
];

// Adult evening quotes (10)
export const ADULT_EVENING_QUOTES: string[] = [
  'La journée est terminée. Tu peux souffler maintenant.',
  'Tu as fait de ton mieux aujourd’hui, et c’est suffisant.',
  'Repose-toi. Tu l’as mérité.',
  'Demain est un autre jour. Ce soir, relâche la pression.',
  'Tu n’as pas besoin de tout réussir pour être fier de toi.',
  'Le calme du soir est un cadeau. Savoure-le.',
  'Ce soir, accorde-toi de la bienveillance.',
  'Tu as traversé cette journée. C’est déjà une victoire.',
  'Dors bien. Demain sera une nouvelle opportunité.',
  'Tu peux être fier de ce que tu as accompli aujourd’hui.',
];

// Special date quotes (7)
export interface SpecialDateQuote {
  date: string; // Format: MM-DD
  text: string;
}

export const SPECIAL_DATE_QUOTES: SpecialDateQuote[] = [
  { date: '01-01', text: 'Bonne année ! Que cette nouvelle année t’apporte joie, santé et sérénité.' },
  { date: '02-14', text: 'Joyeuse Saint-Valentin ! Célèbre l’amour sous toutes ses formes aujourd’hui.' },
  { date: '05-01', text: 'Joyeuse fête du travail ! Prends le temps de te reposer et d’apprécier tes efforts.' },
  { date: '07-14', text: 'Joyeux 14 juillet ! Profite de cette journée de célébration et de liberté.' },
  { date: '12-24', text: 'Joyeux réveillon de Noël ! Que cette soirée soit remplie de magie et de chaleur.' },
  { date: '12-25', text: 'Joyeux Noël ! Profite de ces moments précieux avec tes proches.' },
  { date: '12-31', text: 'Bonne fin d’année ! Que cette soirée soit remplie d’espoir et de joie.' },
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

let lastMorningIndex: number | null = null;
let lastEveningIndex: number | null = null;

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
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const currentDate = `${month}-${day}`;
  
  const specialQuote = SPECIAL_DATE_QUOTES.find(q => q.date === currentDate);
  if (specialQuote) {
    // For special dates, return as morning type (displayed all day)
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
  
  const lastIndex = type === 'morning' ? lastMorningIndex : lastEveningIndex;

  if (pool.length === 0) {
    throw new Error('Aucune citation définie');
  }

  let index = Math.floor(Math.random() * pool.length);
  if (pool.length > 1 && lastIndex !== null && index === lastIndex) {
    index = (index + 1) % pool.length;
  }

  if (type === 'morning') {
    lastMorningIndex = index;
  } else {
    lastEveningIndex = index;
  }

  return { type, text: pool[index] };
}
