/**
 * domainGuard.ts
 * Strict Fail-Closed Deterministic Domain Guard for Physiosis Rehabilitation Assistant.
 *
 * Core Mandate:
 * - The assistant must STRICTLY answer ONLY questions related to:
 *   physiotherapy, physical rehabilitation, therapeutic exercise, exercise technique,
 *   mobility, range of motion (ROM), posture, movement analysis, joint kinematics,
 *   recovery trends, and Physiosis session/report metrics.
 * - EVERYTHING ELSE MUST BE BLOCKED BEFORE OLLAMA IS CALLED.
 * - FAIL CLOSED: If intent is ambiguous or uncertain -> BLOCK (allowed = false, reason = 'AMBIGUOUS_BLOCKED').
 * - Blocks jailbreaks, prompt injections, mixed out-of-domain requests, programming,
 *   entertainment, trivia, cooking, finance, and general conversations.
 * - Returns deterministic localized refusal messages without calling any LLM.
 */

import type {
  AssistantLanguage,
  PhysioAssistantContext,
  PhysioAssistantSessionContext,
} from '../../types/assistant';

export type DomainGuardReason = 'PHYSIO' | 'OUT_OF_DOMAIN' | 'AMBIGUOUS_BLOCKED';

export interface DomainGuardResult {
  allowed: boolean;
  isAllowed: boolean; // Backward compatibility alias
  reason: DomainGuardReason;
  confidence?: number;
  refusalMessage?: string;
  category?: string;
}

export const OUT_OF_DOMAIN_REFUSALS: Record<string, string> = {
  en: 'I can only help with physiotherapy, rehabilitation exercises, movement analysis, and Physiosis session information.',
  hi: 'मैं केवल फिजियोथेरेपी, पुनर्वास अभ्यास, मूवमेंट विश्लेषण और Physiosis सत्र से जुड़ी जानकारी में मदद कर सकता हूँ।',
  te: 'నేను ఫిజియోథెరపీ, పునరావాస వ్యాయామాలు, కదలిక విశ్లేషణ మరియు Physiosis సెషన్ సమాచారానికి మాత్రమే సహాయం చేయగలను.',
  ta: 'நான் பிசியோதெரபி, மறுவாழ்வு பயிற்சிகள், இயக்க பகுப்பாய்வு மற்றும் பிசியோசிஸ் அமர்வு தகவல்களுக்கு மட்டுமே உதவ முடியும்.',
  kn: 'ನಾನು ಫಿಸಿಯೋಥೆರಪಿ, ಪುನರ್ವಸತಿ ವ್ಯಾಯಾಮಗಳು, ಚಲನೆಯ ವಿಶ್ಲೇಷಣೆ ಮತ್ತು ಫಿಸಿಯೋಸಿಸ್ ಸೆಷನ್ ಮಾಹಿತಿಯೊಂದಿಗೆ ಮಾತ್ರ ಸಹಾಯ ಮಾಡಬಲ್ಲೆ.',
  ml: 'ഫിസിയോതെറാപ്പി, പുനരധിവാസ വ്യായാമങ്ങൾ, ചലന വിശകലനം, ഫിസിയോസിസ് സെഷൻ വിവരങ്ങൾ എന്നിവയിൽ മാത്രമേ എനിക്ക് സഹായിക്കാനാകൂ.',
  bn: 'আমি শুধুমাত্র ফিজিওথেরাপি, পুনর্বাসন ব্যায়াম, গতি বিশ্লেষণ এবং ফিজিওসিস সেশন তথ্যে সাহায্য করতে পারি।',
  mr: 'मी फक्त फिजिओथेरपी, पुनर्वसन व्यायाम, हालचालींचे विश्लेषण आणि फिजिओसिस सत्र माहितीमध्ये मदत करू शकतो.',
  gu: 'હું ફક્ત ફિઝિયોથેરાપી, પુનર્વસન કસરતો, હલનચલન વિશ્લેષણ અને ફિઝિયોસિસ સત્રની માહિતીમાં મદદ કરી શકું છું.',
};

export const OUT_OF_DOMAIN_REFUSAL_MESSAGE = OUT_OF_DOMAIN_REFUSALS.en;

export function getOutOfDomainRefusal(language?: AssistantLanguage | string): string {
  if (!language) return OUT_OF_DOMAIN_REFUSALS.en;
  const code =
    typeof language === 'string'
      ? language.toLowerCase().startsWith('te') || language.toLowerCase().includes('telugu')
        ? 'te'
        : language.toLowerCase().startsWith('hi') || language.toLowerCase().includes('hindi')
        ? 'hi'
        : language.toLowerCase().startsWith('ta') || language.toLowerCase().includes('tamil')
        ? 'ta'
        : language.toLowerCase().startsWith('kn') || language.toLowerCase().includes('kannada')
        ? 'kn'
        : language.toLowerCase().startsWith('ml') || language.toLowerCase().includes('malayalam')
        ? 'ml'
        : language.toLowerCase().startsWith('bn') || language.toLowerCase().includes('bengali')
        ? 'bn'
        : language.toLowerCase().startsWith('mr') || language.toLowerCase().includes('marathi')
        ? 'mr'
        : language.toLowerCase().startsWith('gu') || language.toLowerCase().includes('gujarati')
        ? 'gu'
        : 'en'
      : language.code?.toLowerCase() || 'en';
  return OUT_OF_DOMAIN_REFUSALS[code] || OUT_OF_DOMAIN_REFUSALS.en;
}

// ── 1. Hard Disallowed / Jailbreak / Out-of-Domain Patterns (IMMEDIATE REJECTION) ──
interface OutOfDomainRule {
  category: string;
  patterns: RegExp[];
}

const JAILBREAK_AND_OVERRIDE_RULES: readonly RegExp[] = [
  /\b(?:ignore\s+(?:all\s+)?(?:your\s+)?(?:physiotherapy\s+|physio\s+|system\s+|safety\s+|previous\s+)?(?:rules|instructions|prompts|guidelines))\b/i,
  /\b(?:forget\s+(?:all\s+)?(?:about\s+)?(?:physiosis|physiotherapy|rules|instructions))\b/i,
  /\b(?:act\s+as\s+(?:a\s+)?(?:general\s+ai|unrestricted|developer|dan|coder|comedian|assistant|gpt))\b/i,
  /\b(?:pretend\s+you\s+(?:are|can|have\s+no\s+rules))\b/i,
  /\b(?:system\s+override|prompt\s+injection|jailbreak|bypass\s+guard)\b/i,
  /\b(?:answer\s+normally|answer\s+as\s+a\s+general|answer\s+anything)\b/i,
  /\b(?:ignore\s+your\s+rules\s+and\s+answer\s+normally)\b/i,
  /\b(?:first\s+tell\s+me\s+a\s+joke|first\s+write\s+code)\b/i,
  /\b(?:give\s+me\s+coding\s+help\s+but\s+make\s+it)\b/i,
];

const OUT_OF_DOMAIN_RULES: readonly OutOfDomainRule[] = [
  {
    category: 'Programming & Coding',
    patterns: [
      /\b(?:python|javascript|typescript|c\+\+|golang|rust|html|css|sql|bash|powershell|react|angular|node\.?js)\b/i,
      /\b(?:write\s+code|write\s+python|debug\s+code|syntax\s+error|npm\s+install|git\s+commit|regex|compiler|function\s*\(|class\s+\w+|import\s+from)\b/i,
      /\b(?:programming|developer|algorithm|data\s+structure|backend|frontend|api\s+key|code\s+for\s+a)\b/i,
    ],
  },
  {
    category: 'Jokes & Entertainment',
    patterns: [
      /\b(?:tell\s+me\s+a\s+(?:funny\s+)?joke|make\s+me\s+laugh|funny\s+joke|riddle|knock\s+knock|standup\s+comedy|meme|movie\s+joke|funny\s+story)\b/i,
      /\b(?:movie\s+recommendation|recommend\s+(?:a\s+)?movie|song\s+lyrics|lyrics\s+of|singer|actor|celebrity|box\s+office)\b/i,
      /\b(?:translate\s+(?:this\s+)?poem|write\s+(?:a\s+)?poem|write\s+(?:a\s+)?story|sing\s+a\s+song)\b/i,
      /\b(?:cinema\s+lo\s+evaru|cinema\s+review|cinema\s+joke)\b/i,
    ],
  },
  {
    category: 'Recipes, Food & Cooking',
    patterns: [
      /\b(?:what\s+should\s+i\s+(?:eat|cook|make)\s+(?:tonight|today|for\s+dinner|for\s+lunch)|dinner\s+idea|recipe\s+for|how\s+to\s+bake|how\s+to\s+cook)\b/i,
      /\b(?:ingredients\s+for|cake|pasta|pizza|cocktail|baking|curry\s+recipe|cook\s+tonight)\b/i,
    ],
  },
  {
    category: 'General Trivia, Geography, History, Science',
    patterns: [
      /\b(?:what\s+is\s+the\s+capital\s+of|capital\s+of\s+[a-z]+|who\s+is\s+the\s+(?:prime\s+minister|president|ceo|king|queen)|president\s+of\s+[a-z]+)\b/i,
      /\b(?:who\s+won\s+(?:the\s+|yesterday(?:'s)?\s+)?(?:cricket|match|world\s+cup|ipl|football|game|super\s+bowl)|cricket\s+match)\b/i,
      /\b(?:explain\s+quantum\s+physics|quantum\s+mechanics|general\s+relativity|speed\s+of\s+light|tallest\s+mountain|distance\s+to|population\s+of)\b/i,
      /\b(?:who\s+invented|who\s+was\s+[a-z]+|history\s+of\s+[a-z]+)\b/i,
    ],
  },
  {
    category: 'Politics & Elections',
    patterns: [
      /\b(?:election|democrat|republican|senate|parliament|voting\s+poll|political\s+party|who\s+is\s+the\s+minister)\b/i,
    ],
  },
  {
    category: 'Finance, Crypto & Shopping',
    patterns: [
      /\b(?:stock\s+price|bitcoin|crypto|ethereum|forex|invest\s+in|buy\s+discount|coupon\s+code|shopping\s+deal|hotel\s+booking|book\s+(?:me\s+)?a\s+hotel)\b/i,
    ],
  },
  {
    category: 'Career, Resumes & Homework',
    patterns: [
      /\b(?:write\s+(?:my\s+)?resume|cv\s+builder|job\s+interview\s+tips|solve\s+for\s+x|derivative\s+of|integral\s+of|calculus\s+problem|math\s+homework)\b/i,
    ],
  },
  {
    category: 'Casual Non-Physio Conversation',
    patterns: [
      /\b(?:how\s+are\s+you(?:\s+doing)?\b|what\s+is\s+your\s+name\b|who\s+made\s+you\b|tell\s+me\s+about\s+yourself\b)/i,
      /\b(?:what\s+is\s+the\s+weather|weather\s+forecast|will\s+it\s+rain)\b/i,
    ],
  },
];

// ── 2. Allowlisted Physiotherapy Patterns & Vocabulary ───────────────────────
const PHYSIO_INTENT_PATTERNS: readonly RegExp[] = [
  // Core definition & concepts
  /\b(?:what\s+is|explain|define|meaning\s+of)\s+(?:shoulder\s+flexion|knee\s+extension|straight\s*leg\s*raise|rom|range\s+of\s+motion|abduction|adduction|mobility|kinesiology|biomechanics|posture|deviation|asymmetry)\b/i,
  /\b(?:what\s+does\s+(?:limited\s+)?(?:shoulder\s+)?(?:rom|range\s+of\s+motion|angle|score|deviation)\s+mean)\b/i,
  /\b(?:what\s+does\s+this\s+exercise\s+target)\b/i,
  
  // Exercise technique, instructions, form & cues
  /\b(?:how\s+(?:should|do|can)\s+i\s+(?:perform|do|execute|practice)\s+(?:a\s+)?(?:shoulder|knee|hip|elbow|ankle|spine|mobility|rehabilitation|rehab|therapeutic|physiotherapy|stretching)\s+(?:exercise|movement|stretch|drill))\b/i,
  /\b(?:how\s+(?:do|can)\s+i\s+(?:improve|increase|progress)\s+(?:my\s+)?(?:movement\s+quality|rom|range\s+of\s+motion|mobility|posture|flexibility|strength))\b/i,
  /\b(?:how\s+do\s+i\s+perform\s+(?:this\s+)?(?:rehabilitation\s+exercise|knee\s+extension|shoulder\s+flexion))\b/i,
  /\b(?:how\s+should\s+i\s+perform\s+a\s+shoulder\s+mobility\s+exercise)\b/i,
  /\b(?:is\s+my\s+(?:form|posture|alignment|angle|movement)\s+(?:correct|good|safe|right))\b/i,

  // Biomechanics & limitation analysis
  /\b(?:why\s+was\s+(?:my\s+)?(?:shoulder|knee|hip|elbow|joint)?\s*(?:range|rom|angle|extension|flexion)\s+(?:low|limited|below\s+target|small|restricted))\b/i,
  /\b(?:why\s+was\s+my\s+knee\s+extension\s+limited)\b/i,
  /\b(?:why\s+was\s+my\s+shoulder\s+range\s+low)\b/i,
  /\b(?:why\s+was\s+this\s+rep\s+limited)\b/i,

  // Session metrics & telemetry queries
  /\b(?:what\s+happened\s+in\s+my\s+(?:last\s+)?(?:physiosis\s+)?session)\b/i,
  /\b(?:what\s+was\s+my\s+last\s+session\s+(?:like|about|summary))\b/i,
  /\b(?:how\s+was\s+my\s+(?:last\s+)?(?:session|progress|performance))\b/i,
  /\b(?:how\s+many\s+repetitions\s+did\s+i\s+(?:complete|do|finish))\b/i,
  /\b(?:what\s+does\s+my\s+(?:session\s+)?report\s+mean)\b/i,
  /\b(?:what\s+was\s+my\s+best\s+rom)\b/i,
  /\b(?:how\s+did\s+my\s+movement\s+change)\b/i,

  // Native Telugu Physiotherapy Intent Patterns
  /(?:నా\s+చివరి\s+సెషన్\s+ఎలా\s+ఉంది|నా\s+సెషన్\s+ఎలా\s+ఉంది|నా\s+ప్రోగ్రెస్\s+ఎలా\s+ఉంది)/,
  /(?:చేతిలో\s+నొప్పి|భుజం\s+నొప్పి|మోకాలు\s+నొప్పి|వెన్ను\s+నొప్పి|కీళ్ల\s+నొప్పి)/,
  /(?:భుజం\s+వ్యాయామం|మోకాలు\s+వ్యాయామం|పునరావాస\s+వ్యాయామాలు|కదలిక\s+విశ్లేషణ|కదలికలు)/,
  /(?:వ్యాయామం\s+ఎలా\s+చేయాలి|భుజం\s+కదలిక|రేంజ్\s+ఆఫ్\s+మోషన్)/,

  // Transliterated Telugu Physiotherapy Intent Patterns
  /\b(?:na\s+(?:last\s+)?session\s+ela\s+und[hi]+|na\s+progress\s+ela\s+und[hi]+)\b/i,
  /\b(?:naaku\s+(?:cheyi|bhujam|kaalu|mokalu|vennu)\s+(?:pain|noppi)\s+und[hi]+)\b/i,
  /\b(?:(?:shoulder|cheyi|bhujaalu|mokalu)\s+(?:ni\s+)?ela\s+move\s+cheyali)\b/i,
  /\b(?:(?:bhujam|cheyi|mokalu)\s+vyayamam\s+ela\s+cheyali)\b/i,

  // Native Hindi Physiotherapy Intent Patterns
  /(?:मेरी\s+आखिरी\s+session\s+कैसी\s+थी|मेरा\s+सत्र\s+कैसा\s+था|मेरी\s+प्रगति\s+कैसी\s+है)/,
  /(?:कंधे\s+की\s+गति\s+कम\s+है|कंधे\s+में\s+दर्द|घुटने\s+में\s+दर्द|पीठ\s+में\s+दर्द)/,
  /(?:कंधे\s+का\s+व्यायाम\s+कैसे\s+करें|पुनर्वास\s+अभ्यास|कसरत\s+कैसे\s+करें|मूवमेंट\s+विश्लेषण)/,

  // Transliterated Hindi Physiotherapy Intent Patterns
  /\b(?:meri\s+(?:last\s+)?session\s+kaisi\s+thi|meri\s+pragati\s+kaisi\s+hai)\b/i,
  /\b(?:(?:meri\s+)?(?:kandhe|ghutne|peeth)\s+ki\s+gati\s+kam\s+hai)\b/i,
  /\b(?:kandhe\s+ka\s+vyayam\s+kaise\s+kare[in]?|ghutne\s+ki\s+exercise\s+kaise\s+kare[in]?)\b/i,
];

// Standalone clinical / rehabilitation keywords (Exact term matches)
const CORE_PHYSIO_TERMS: readonly string[] = [
  'physiotherapy',
  'physical therapy',
  'rehabilitation',
  'rehab',
  'therapeutic exercise',
  'shoulder flexion',
  'knee extension',
  'straight leg raise',
  'range of motion',
  'rom',
  'joint angle',
  'posture',
  'alignment',
  'movement quality',
  'repetition count',
  'movement control',
  'kinesiology',
  'biomechanics',
  'kinematics',
  'rotator cuff',
  'scapula',
  'deltoid',
  'hamstring',
  'quadriceps',
  'tendonitis',
  'tendinopathy',
  'impingement',
  'bursitis',
  // Telugu native terms
  'ఫిజియోథెరపీ',
  'పునరావాసం',
  'వ్యాయామం',
  'వ్యాయామాలు',
  'కదలిక',
  'కదలికలు',
  'భుజం',
  'మోకాలు',
  'నొప్పి',
  // Hindi native terms
  'फिजियोथेरेपी',
  'पुनर्वास',
  'व्यायाम',
  'कसरत',
  'कंधा',
  'घुटना',
  'दर्द',
];

/**
 * Strictly evaluate whether a query is exclusively in the Physiotherapy & Rehabilitation domain.
 * FAIL CLOSED: Returns allowed: false if not confidently classified as physiotherapy.
 */
export function checkDomainGate(
  query: string,
  sessionContext?: PhysioAssistantSessionContext,
  language?: AssistantLanguage | string
): DomainGuardResult {
  const trimmed = (query || '').trim();
  const refusalMessage = getOutOfDomainRefusal(language);

  // 1. Empty / Whitespace query check
  if (!trimmed) {
    return {
      allowed: false,
      isAllowed: false,
      reason: 'AMBIGUOUS_BLOCKED',
      confidence: 0,
      refusalMessage,
      category: 'Empty Query',
    };
  }

  const normalized = trimmed.toLowerCase();

  // 2. Strict Jailbreak / Prompt Injection Check (HIGHEST PRIORITY)
  for (const pattern of JAILBREAK_AND_OVERRIDE_RULES) {
    if (pattern.test(normalized)) {
      return {
        allowed: false,
        isAllowed: false,
        reason: 'OUT_OF_DOMAIN',
        confidence: 1.0,
        refusalMessage,
        category: 'Jailbreak / System Override Attempt',
      };
    }
  }

  // 3. Strict Out-Of-Domain Categories Check (Programming, Trivia, Jokes, Cooking, etc.)
  for (const rule of OUT_OF_DOMAIN_RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(normalized)) {
        return {
          allowed: false,
          isAllowed: false,
          reason: 'OUT_OF_DOMAIN',
          confidence: 0.95,
          refusalMessage,
          category: rule.category,
        };
      }
    }
  }

  // 4. Intent Matcher: Structured Physiotherapy & Rehabilitation Patterns
  for (const pattern of PHYSIO_INTENT_PATTERNS) {
    if (pattern.test(normalized) || pattern.test(trimmed)) {
      return {
        allowed: true,
        isAllowed: true,
        reason: 'PHYSIO',
        confidence: 0.95,
        category: 'Verified Physiotherapy Intent',
      };
    }
  }

  // 5. Explicit In-Domain Technical Terms Matcher
  const hasCorePhysioTerm = CORE_PHYSIO_TERMS.some((term) => {
    const isUnicode = /[^\u0000-\u007F]/.test(term);
    if (isUnicode) {
      return trimmed.includes(term) || normalized.includes(term.toLowerCase());
    }
    const wordBoundary = new RegExp(`\\b${term.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i');
    return wordBoundary.test(normalized);
  });

  if (hasCorePhysioTerm) {
    return {
      allowed: true,
      isAllowed: true,
      reason: 'PHYSIO',
      confidence: 0.9,
      category: 'Core Physiotherapy Terminology',
    };
  }

  // 6. Active Session Context Matcher (For telemetry & rep questions with live session)
  if (
    sessionContext &&
    (sessionContext.exercise ||
      sessionContext.hasActiveSession ||
      typeof sessionContext.repetitions === 'number' ||
      sessionContext.previousSessionsSummary)
  ) {
    const isSessionTelemetryQuery = /\b(?:session|rep|reps|repetitions|angle|target|peak|quality|score|form|deviation|speed|hold|rest|progress|report|last\s+session|previous\s+session)\b/i.test(
      normalized
    );
    if (isSessionTelemetryQuery) {
      return {
        allowed: true,
        isAllowed: true,
        reason: 'PHYSIO',
        confidence: 0.85,
        category: 'Physiosis Live Session Grounding',
      };
    }
  }

  // 7. FAIL CLOSED: If intent is ambiguous or unverified, BLOCK deterministically
  return {
    allowed: false,
    isAllowed: false,
    reason: 'AMBIGUOUS_BLOCKED',
    confidence: 0.2,
    refusalMessage,
    category: 'Ambiguous / Non-Physiotherapy Query',
  };
}

/**
 * Boolean helper for domain gating.
 */
export function isPhysioDomain(
  query: string,
  sessionContext?: PhysioAssistantContext,
  language?: AssistantLanguage | string
): boolean {
  return checkDomainGate(query, sessionContext, language).allowed;
}
