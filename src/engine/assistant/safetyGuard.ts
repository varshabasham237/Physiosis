/**
 * safetyGuard.ts
 * Clinical Red-Flag & High-Risk Safety Classifier for the Physiosis Assistant.
 *
 * Architecture:
 * - Deterministic safety filter intercepting acute clinical red flags.
 * - This is a safety classifier, NOT a diagnostic engine.
 * - Under no circumstances diagnoses injuries, pathologies, or diseases.
 * - When triggered, immediately halts exercise progression and directs the patient
 *   to seek prompt professional medical evaluation.
 */

export interface SafetyCheckResult {
  isRedFlag: boolean;
  reason?: string;
  safetyMessage?: string;
  category?: string;
}

export const RED_FLAG_SAFETY_RESPONSE =
  'That symptom may require prompt professional assessment. Please seek appropriate medical care rather than relying on Physiosis for advice. Contact your physiotherapist or appropriate medical service.';

interface RedFlagRule {
  category: string;
  patterns: RegExp[];
}

export const RED_FLAG_RULES: RedFlagRule[] = [
  // 1. Chest Pain, Cardiac & Acute Respiratory Distress
  {
    category: 'cardiorespiratory',
    patterns: [
      /\b(?:chest\s*pain|pain\s*in\s*(?:my\s*)?chest|pressure\s*in\s*(?:my\s*)?chest|chest\s*tightness|tight\s*chest)\b/i,
      /\b(?:difficulty\s*breathing|trouble\s*breathing|cannot\s*breathe|can't\s*breathe|short(?:ness)?\s*of\s*breath|gasping\s*for\s*air)\b/i,
      /\b(?:heart\s*palpitations|irregular\s*heartbeat|racing\s*heart\s*with\s*dizziness)\b/i,
      /(?:सीने\s*में\s*दर्द|सांस\s*लेने\s*में\s*तकलीफ|सांस\s*फूल\s*रही)/i,
      /\b(?:seene\s*me(?:in)?\s*dard|saans\s*(?:nahi\s*aarahi|fool\s*rahi))\b/i,
    ],
  },

  // 2. Severe, Acute, or Sudden Intense Pain
  {
    category: 'severe_acute_pain',
    patterns: [
      /\b(?:sudden\s*severe\s*pain|excruciating\s*pain|unbearable\s*pain|worst\s*pain\s*of\s*my\s*life|agonizing\s*pain)\b/i,
      /\b(?:10\/10\s*pain|pain\s*is\s*a\s*10|intense\s*stabbing\s*pain\s*suddenly)\b/i,
      /(?:अचानक\s*तेज\s*दर्द|असहनीय\s*दर्द|बहुत\s*ज्यादा\s*दर्द)/i,
      /\b(?:achanak\s*tez\s*dard|asahaniya\s*dard|bahut\s*jyada\s*dard)\b/i,
    ],
  },

  // 3. Syncope, Fainting & Loss of Consciousness
  {
    category: 'syncope_consciousness',
    patterns: [
      /\b(?:fainted|passed\s*out|blacked\s*out|lost\s*consciousness|feel\s*like\s*passing\s*out|collapsed)\b/i,
      /(?:बेहोश\s*हो\s*गया|चक्कर\s*खाकर\s*गिर\s*गया)/i,
      /\b(?:behosh\s*ho\s*gaya|chakkar\s*aake\s*gir\s*gaya)\b/i,
    ],
  },

  // 4. Sudden Loss of Movement, Acute Paralysis & Motor Deficit
  {
    category: 'acute_motor_loss',
    patterns: [
      /\b(?:can't\s*move\s*(?:my\s*)?(?:arm|leg|hand|foot|shoulder|body)\s*at\s*all|cannot\s*move\s*(?:my\s*)?(?:arm|leg|hand|foot|shoulder))\b/i,
      /\b(?:sudden\s*(?:paralysis|weakness|loss\s*of\s*movement)|limb\s*went\s*limp|arm\s*went\s*completely\s*limp)\b/i,
      /\b(?:sudden\s*foot\s*drop|cannot\s*lift\s*(?:my\s*)?foot\s*at\s*all)\b/i,
      /(?:हाथ\s*हिल\s*नहीं\s*रहा|पैर\s*हिल\s*नहीं\s*रहा|अचानक\s*सुन्न\s*और\s*कमजोर)/i,
      /\b(?:haath\s*hil\s*nahi\s*raha|pair\s*hil\s*nahi\s*raha)\b/i,
    ],
  },

  // 5. Severe Neurological & Cauda Equina Red Flags
  {
    category: 'neurological_emergency',
    patterns: [
      /\b(?:loss\s*of\s*bladder\s*(?:or\s*bowel)?\s*control|loss\s*of\s*bowel\s*control|incontinence\s*since\s*exercise)\b/i,
      /\b(?:numbness\s*in\s*(?:my\s*)?(?:groin|genitals|buttocks|saddle\s*area)|saddle\s*anesthesia)\b/i,
      /\b(?:facial\s*droop(?:ing)?|slurred\s*speech|sudden\s*confusion|vision\s*loss\s*in\s*one\s*eye)\b/i,
      /\b(?:severe\s*numbness\s*spreading\s*down\s*both\s*legs)\b/i,
      /(?:पेशाब\s*पर\s*नियंत्रण\s*खो\s*गया|दोनों\s*पैर\s*सुन्न)/i,
    ],
  },

  // 6. Major Acute Trauma, Suspected Fracture or Dislocation
  {
    category: 'acute_trauma_fracture',
    patterns: [
      /\b(?:heard\s*a\s*(?:loud\s*)?(?:crack|snap|pop)\s*and\s*(?:cannot|can't)\s*bear\s*weight)\b/i,
      /\b(?:bone\s*(?:is\s*)?sticking\s*out|open\s*fracture|deformed\s*joint|visible\s*deformity)\b/i,
      /\b(?:shoulder\s*popped\s*out\s*of\s*socket|dislocated\s*(?:my\s*)?(?:shoulder|knee|hip|elbow))\b/i,
      /\b(?:major\s*car\s*accident|fell\s*down\s*(?:a\s*flight\s*of\s*)?stairs\s*and\s*cannot\s*move)\b/i,
      /(?:हड्डी\s*टूट\s*गई|कंधा\s*उतर\s*गया|हड्डी\s*बाहर\s*आ\s*गई)/i,
      /\b(?:haddi\s*toot\s*gayi|kandha\s*utar\s*gaya)\b/i,
    ],
  },

  // 7. Rapidly Escalating Acute Systemic Inflammation or Infection
  {
    category: 'acute_infection_escalation',
    patterns: [
      /\b(?:high\s*fever\s*with\s*(?:hot|swollen|red)\s*joint|joint\s*is\s*hot\s*to\s*touch\s*with\s*fever)\b/i,
      /\b(?:rapidly\s*spreading\s*redness\s*and\s*swelling\s*over\s*hours)\b/i,
      /(?:जोड़\s*में\s*बहुत\s*गरमी\s*और\s*तेज\s*बुखार)/i,
    ],
  },
];

/**
 * Deterministically check if user input contains any clinical red flags.
 * Returns a safety alert result with non-diagnostic referral advice.
 */
export function checkSafetyGuard(query: string): SafetyCheckResult {
  const trimmed = (query || '').trim();
  if (!trimmed) {
    return { isRedFlag: false };
  }

  const normalized = trimmed.toLowerCase();

  for (const rule of RED_FLAG_RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(normalized) || pattern.test(trimmed)) {
        return {
          isRedFlag: true,
          category: rule.category,
          reason: `High-risk clinical red flag detected: ${rule.category}`,
          safetyMessage: RED_FLAG_SAFETY_RESPONSE,
        };
      }
    }
  }

  return { isRedFlag: false };
}
