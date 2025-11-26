export type QuoteType = 'morning' | 'evening';

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

export function getRandomQuote(now: Date = new Date()): QuoteResult {
  const hour = now.getHours();
  const type: QuoteType = hour < 17 ? 'morning' : 'evening';
  const pool = type === 'morning' ? MORNING_QUOTES : EVENING_QUOTES;
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
