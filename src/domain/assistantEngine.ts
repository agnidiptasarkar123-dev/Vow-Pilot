import {
  AppState,
  AssistantIntent,
  PlanningMessage,
  ProposedAction,
  VendorQuote,
} from '../types';
import {
  calculateBudgetOverview,
  calculateGuestCountImpact,
  generatePriorityAwareRecommendations,
} from './budgetEngine';
import { formatCurrency } from './currency';
import { detectDependencyCycles, evaluateTasks } from './taskEngine';
import { compareCategoryVendors, identifyMissingQuoteDetails } from './vendorEngine';
import {
  analyzeInputSecurity,
  isAmbiguousOrLowConfidence,
} from './assistantValidation';

export interface IntentParseResult {
  intent: AssistantIntent;
  extractedParameters?: {
    guestCount?: number;
    categoryId?: string;
    categoryKeyword?: string;
    percentage?: number;
    unsupportedReason?: string;
    clarificationPrompt?: string;
  };
}

/**
 * Converts Bengali numerals (০-৯) to standard ASCII Arabic digits (0-9).
 */
export function convertBengaliDigitsToAscii(input: string): string {
  if (!input) return '';
  const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  let res = input;
  for (let i = 0; i < 10; i++) {
    res = res.split(bengaliDigits[i]).join(String(i));
  }
  return res;
}

/**
 * Detects whether the input is English, Bengali script, or Romanized Benglish.
 */
export function detectInputLanguage(raw: string): 'en' | 'bn' | 'benglish' {
  if (!raw) return 'en';
  // Bengali Unicode block U+0980 to U+09FF
  if (/[\u0980-\u09FF]/.test(raw)) {
    return 'bn';
  }
  const text = raw.toLowerCase();
  const benglishMarkers = [
    /\b(komate|komanor|khoroch|khorocher|korbo|koro|kore|dao|chai|hobe|achhe|ache|nei|bolo|dekhao)\b/,
    /\b(amar|amader|apnar|ektu|beshi|shob|gulo|gulor|ta|te|jon|shomoy|kaj|kajer)\b/,
    /\b(bariye|banchao|tulona|dam|hishab|porikolpona|biye|biyer|kothay|kobe|kotodin|baki)\b/,
    /\b(otithi|mehman|taka|poisha|somossa|dorkar|dekhi|janaw|kono|sesh|hoyeche|hoyni)\b/,
  ];
  if (benglishMarkers.some((p) => p.test(text))) {
    return 'benglish';
  }
  return 'en';
}

/**
 * Normalizes user input for deterministic intent classification:
 * - Trims whitespace
 * - Converts Bengali digits to ASCII
 * - Converts to lowercase
 * - Replaces typographic apostrophes/quotes
 * - Expands common contractions
 * - Strips trailing punctuation (? ! . , ; : Bengali Danda । ॥)
 * - Collapses consecutive whitespace
 */
export function normalizeAssistantInput(raw: string): string {
  if (!raw) return '';
  const converted = convertBengaliDigitsToAscii(raw);
  return converted
    .trim()
    .toLowerCase()
    .replace(/[\u2018\u2019`]/g, "'")
    .replace(/\bcan['']t\b/g, 'cannot')
    .replace(/\bwon['']t\b/g, 'will not')
    .replace(/\bwe['']ll\b/g, 'we will')
    .replace(/\bwe['']d\b/g, 'we would')
    .replace(/\bwe['']re\b/g, 'we are')
    .replace(/\bwhat['']s\b/g, 'what is')
    .replace(/\bwhere['']s\b/g, 'where is')
    .replace(/\bhow['']s\b/g, 'how is')
    .replace(/\blet['']s\b/g, 'let us')
    .replace(/[?!.,;:।॥]+$/g, '')
    .replace(/[?!.,;:।॥]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parses user text deterministically into one of the documented intents.
 * Fully supports English, Bengali script, Romanized Benglish code-switching,
 * prompt-injection rejection, and ambiguous input detection.
 */
export function parseUserIntent(input: string): IntentParseResult {
  const text = normalizeAssistantInput(input);
  if (!text) {
    return { intent: 'unsupported' };
  }

  const security = analyzeInputSecurity(input);
  if (security.isHostile) {
    return {
      intent: 'unsupported',
      extractedParameters: {
        unsupportedReason: `Security policy violation: ${security.riskCategory || 'adversarial_input'}`,
      },
    };
  }

  const ambiguity = isAmbiguousOrLowConfidence(input);
  if (ambiguity.isAmbiguous) {
    return {
      intent: 'clarify_ambiguous_request',
      extractedParameters: {
        clarificationPrompt: 'Please clarify your planning request with a specific question or command.',
      },
    };
  }

  // 1. Explicitly Unsupported Requests (External integrations, payments, telephony, scraping, art)
  const isExternalBooking = /\b(book|reserve|hire|sign\s+contract\s+with)\b.*?\b(venue|photographer|caterer|hall|ballroom|band|dj|decorator)\b/i.test(text) ||
    text.includes('বুক করে দাও') || text.includes('হায়ার করো') || text.includes('book kore dao');

  const isLivePayment = /\b(charge|pay|transfer|send\s+money|credit\s+card|debit\s+card|stripe|upi|paypal|bank\s+transfer)\b/i.test(text) &&
    /\b(card|payment|deposit|money|dollar|taka|amount|vendor)\b/i.test(text);

  const isWebScraping = /\b(scrape|search\s+google|search\s+instagram|search\s+web|browse\s+the\s+internet|fetch\s+online)\b/i.test(text);

  const isTelephony = /\b(call|phone|ring|dial|send\s+sms|text\s+all\s+guests|whatsapp\s+blast)\b/i.test(text);

  const isGenerativeArt = /\b(draw|generate\s+image|design\s+dress|sketch\s+layout|render\s+3d)\b/i.test(text);

  if (isExternalBooking || isLivePayment || isWebScraping || isTelephony || isGenerativeArt) {
    let reason = 'External integration unsupported';
    if (isExternalBooking) reason = 'Direct external vendor booking/contracting is not supported';
    else if (isLivePayment) reason = 'Direct live financial transactions or card processing are not supported';
    else if (isWebScraping) reason = 'External web scraping and internet searching are not supported';
    else if (isTelephony) reason = 'Automated telephony and mass SMS broadcasting are not supported';
    else if (isGenerativeArt) reason = 'Generative image creation is outside planning scope';

    return {
      intent: 'unsupported',
      extractedParameters: { unsupportedReason: reason },
    };
  }

  // 2. Schedule conflicts detection
  if (
    (text.includes('conflict') || text.includes('overlap') || text.includes('সংঘাত') || text.includes('দ্বন্দ্ব') || text.includes('somossa')) &&
    (text.includes('schedule') || text.includes('task') || text.includes('time') || text.includes('date') || text.includes('shomoy') || text.includes('কাজ') || text.includes('সময়'))
  ) {
    return { intent: 'detect_schedule_conflicts' };
  }

  // 3. Event schedule & countdown queries
  if (
    (/\b(when\s+is|what\s+is\s+the\s+date|how\s+many\s+days\s+(left|remaining)|days\s+until|event\s+timeline|wedding\s+date|event\s+date)\b/i.test(text)) ||
    text.includes('kobe biye') ||
    text.includes('biyer date') ||
    text.includes('kotodin baki') ||
    text.includes('event date kobe') ||
    text.includes('বিয়ে কবে') ||
    text.includes('অনুষ্ঠান কবে') ||
    text.includes('কত দিন বাকি') ||
    text.includes('ইভেন্টের তারিখ') ||
    (text.includes('where is') && (text.includes('event') || text.includes('wedding') || text.includes('venue'))) ||
    text.includes('biye kothay') ||
    text.includes('অনুষ্ঠান কোথায়')
  ) {
    return { intent: 'query_event_schedule' };
  }

  // 4. Quote interpretation & expiration terms
  if (
    ((text.includes('quote') || text.includes('quotation') || text.includes('কোটেশন')) &&
      (text.includes('term') || text.includes('validity') || text.includes('expir') || text.includes('payment') || text.includes('মেয়াদ') || text.includes('শর্ত') || text.includes('shortho') || text.includes('meyad'))) ||
    text.includes('quotes expiring') ||
    text.includes('are any quotes expired') ||
    text.includes('quote payment terms')
  ) {
    return { intent: 'interpret_quote_terms' };
  }

  // 5. Category-specific budget inquiry with regex word boundaries
  const categoryWordPatterns: Record<string, RegExp> = {
    catering: /\b(catering|caterer|food|meal|খাবার|কেটারিং|খাবারের)\b/i,
    photography: /\b(photography|photographer|photo|camera|ছবি|ফটোগ্রাফি|ফটোগ্রাফার)\b/i,
    venue: /\b(venue|venues|hall|halls|ballroom|ballrooms|ভেন্যু|ভেন্যুর|হল)\b/i,
    decor: /\b(decor|decoration|decorations|flowers|floral|সাজসজ্জা|ডেকোরেশন|ডেকোর)\b/i,
    music: /\b(music|entertainment|band|dj|গান|সঙ্গীত|মিউজিক)\b/i,
    attire: /\b(attire|dress|clothing|পোশাক|শাড়ি|শেরওয়ani)\b/i,
    invitations: /\b(invitation|invitations|cards|নিমন্ত্রণ|কার্ড)\b/i,
  };

  let matchedCategoryKeyword: string | undefined;
  for (const [key, pattern] of Object.entries(categoryWordPatterns)) {
    if (pattern.test(text)) {
      matchedCategoryKeyword = key;
      break;
    }
  }

  const isGeneralBudgetQuery =
    text.startsWith('explain budget') ||
    text.startsWith('reduce budget') ||
    text.startsWith('suggest budget') ||
    text === 'explain my current budget';

  const isBudgetInquiry =
    text.includes('budget') ||
    text.includes('cost') ||
    text.includes('spend') ||
    text.includes('allocated') ||
    text.includes('allocation') ||
    text.includes('khoroch') ||
    text.includes('টাকা') ||
    text.includes('খরচ') ||
    text.includes('বাজেট') ||
    text.includes('how much');

  if (!matchedCategoryKeyword && isBudgetInquiry && !isGeneralBudgetQuery && !text.includes('compare') && !text.includes('তুলনা')) {
    const budgetForMatch = text.match(/(?:budget|cost|spend|allocation|khoroch)\s+(?:for|on|in|of|er)\s+([a-z\s]+)/i);
    if (budgetForMatch) {
      const candidate = budgetForMatch[1].trim();
      if (candidate.length > 2 && candidate.length < 40 && !candidate.startsWith('details') && !candidate.startsWith('option')) {
        matchedCategoryKeyword = candidate;
      }
    }
  }

  if (!isGeneralBudgetQuery && matchedCategoryKeyword && isBudgetInquiry && !text.includes('compare') && !text.includes('তুলনা')) {
    return {
      intent: 'query_category_budget',
      extractedParameters: { categoryKeyword: matchedCategoryKeyword },
    };
  }

  // 6. Guest count change (English, Bengali script, Romanized Benglish)
  const guestMatch =
    text.match(/(?:guest|people|attendee|headcount|manush|lok|shongkha)\s*(?:count|shongkha)?\s*(?:to|by|is|=|kore|koro|dao|hobe)?\s*(\d+)/i) ||
    text.match(/(?:increase|decrease|change|set|update|kore dao|koro|komiye|bariye)\s*(?:guests?|guest count|otiti|lok|shongkha)\s*(?:to|by|kore)?\s*(\d+)/i) ||
    text.match(/(?:অতিথি|অতিথির|মেহমান|লোক|মাথা|জন)\s*(?:সংখ্যা)?\s*(?:হলো|হবে|=|to|is)?\s*(\d+)\s*(?:জন|করে dao|kore dao|করে দাও|করো|দাও)?/) ||
    text.match(/(?:পরিবর্তন|সেট|আপডেট)\s*(?:অতিথি|লোক|সংখ্যা)\s*(\d+)/) ||
    text.match(/\b(\d+)\s*(?:jon|jon guest|guests?|people)\b/i);

  if (text.includes('-') && /\b(?:guest|guests|headcount)\b/i.test(text)) {
    return { intent: 'unsupported' };
  }

  if (guestMatch) {
    const count = parseInt(guestMatch[1], 10);
    if (!isNaN(count) && count > 0) {
      return {
        intent: 'change_guest_count',
        extractedParameters: { guestCount: count },
      };
    }
    return { intent: 'unsupported' };
  }

  // Handle guest count change query missing numeric parameter
  if (
    /^(?:change|update|set|adjust|modify)\s+(?:the\s+)?(?:guest\s+count|headcount|number\s+of\s+guests|guests)$/i.test(text) ||
    text === 'change guest count' ||
    text === 'update guest count' ||
    text === 'অতিথির সংখ্যা পরিবর্তন'
  ) {
    return { intent: 'change_guest_count' };
  }

  // 7. Protect priority
  if (
    text.includes('protect') ||
    text.includes('shield') ||
    text.includes('bachao') ||
    text.includes('bachiye') ||
    text.includes('surakha') ||
    text.includes('রক্ষা') ||
    text.includes('বাঁচাও') ||
    text.includes('সুরক্ষা') ||
    (text.includes('priorit') && (text.includes('category') || text.includes('venue') || text.includes('catering') || text.includes('decor') || text.includes('top'))) ||
    ((text.includes('অগ্রাধিকার') || text.includes('গুরুত্বপূর্ণ') || text.includes('শীর্ষ')) && (text.includes('রক্ষা') || text.includes('ক্যাটাগরি') || text.includes('বাঁচাও') || text.includes('protect')))
  ) {
    return { intent: 'protect_priority' };
  }

  // 8. Compare vendor quotes (General or Category-Specific)
  if (
    ((text.includes('compare') || text.includes('comparison') || text.includes('tulona') || text.includes('তুলনা')) &&
      (text.includes('vendor') || text.includes('quote') || text.includes('quotation') || text.includes('supplier') || text.includes('price') || text.includes('ভেন্ডর') || text.includes('দর') || text.includes('দাম') || text.includes('কোটেশন') || matchedCategoryKeyword)) ||
    text.includes('vendor quotations compare') ||
    text.includes('ভেন্ডর কোটেশন তুলনা')
  ) {
    return {
      intent: 'compare_vendor_quotes',
      extractedParameters: matchedCategoryKeyword ? { categoryKeyword: matchedCategoryKeyword } : undefined,
    };
  }

  // 9. Missing vendor info
  if (
    ((text.includes('missing') || text.includes('incomplete') || text.includes('baki') || text.includes('অসম্পূর্ণ') || text.includes('বাকি')) &&
      (text.includes('vendor') || text.includes('quote') || text.includes('quotation') || text.includes('supplier') || text.includes('price') || text.includes('ভেন্ডর') || text.includes('কোটেশন') || text.includes('তথ্য') || text.includes('বিবরণ'))) ||
    text.includes('তথ্য বাকি') ||
    text.includes('কোন তথ্য বাকি')
  ) {
    return { intent: 'identify_missing_vendor_info' };
  }

  // 10. Overdue tasks
  if (
    text.includes('overdue') ||
    text.includes('late task') ||
    text.includes('missed deadline') ||
    text.includes('shomoy paar') ||
    text.includes('shomoy periye') ||
    text.includes('সময় পার') ||
    text.includes('দেরি হওয়া') ||
    text.includes('মেয়াদ উত্তীর্ণ') ||
    text.includes('মেয়াদ শেষ') ||
    (text.includes('deri') && text.includes('task'))
  ) {
    return { intent: 'find_overdue_tasks' };
  }

  // 11. Blocked tasks
  if (
    text.includes('blocked') ||
    text.includes('prerequisite') ||
    text.includes('dependency') ||
    text.includes('blocker') ||
    text.includes('atke ache') ||
    text.includes('atke geche') ||
    text.includes('আটকে') ||
    text.includes('স্থগিত') ||
    text.includes('পূর্বশর্ত') ||
    text.includes('বাধা')
  ) {
    return { intent: 'explain_blocked_tasks' };
  }

  // 12. Create scenario
  if (
    text.includes('scenario') ||
    text.includes('what if') ||
    text.includes('model alternative') ||
    text.includes('দৃশ্যপট') ||
    text.includes('বিকল্প') ||
    text.includes('যদি এমন হয়')
  ) {
    return { intent: 'create_budget_scenario' };
  }

  // 13. Summarize plan
  if (
    text.includes('summar') ||
    text.includes('overview') ||
    text.includes('plan status') ||
    text.includes('readiness') ||
    text.includes('how are we doing') ||
    text.includes('সারসংক্ষেপ') ||
    text.includes('সারাংশ') ||
    text.includes('সংক্ষেপ') ||
    text.includes('পরিকল্পনা কেমন') ||
    text.includes('plan kemon')
  ) {
    return { intent: 'summarize_plan' };
  }

  // 14. Negative guard for budget increase:
  const isBudgetIncreaseQuery =
    (/\b(increase|raise|expand|boost|grow|add to|more budget|bariye|barate|taka barao)\b/i.test(text) &&
      /\b(budget|funds?|spend|spending|money|allowance|taka)\b/i.test(text)) ||
    text.includes('বাড়াও') ||
    text.includes('বৃদ্ধি') ||
    text.includes('যোগ করো');

  // 15. Budget reduction intent detection
  if (!isBudgetIncreaseQuery) {
    const hasCutOrTrimWord =
      /\b(cut|cuts|cutting|trim|trims|trimming|lower|lowers|lowering)\b/i.test(text) &&
      /\b(budget|budgets|cost|costs|expense|expenses|spending|spend|allocation|allocations|funds?)\b/i.test(text);

    const hasReduceWord =
      /\b(reduce|reduces|reducing|reduction|reductions)\b/i.test(text) &&
      /\b(budget|budgets|cost|costs|expense|expenses|spending|spend|allocation|allocations|funds?)\b/i.test(text);

    const hasSaveWord =
      /\b(save|saves|saving|savings)\b/i.test(text) &&
      /\b(money|budget|budgets|cost|costs|expense|expenses|funds?|spending)\b/i.test(text);

    const hasSpendLess = /\b(spend|spending)\s+less\b/i.test(text);
    const hasUnnecessaryExpenses = /\b(unnecessary|unneeded)\s+(?:budget|cost|costs|expense|expenses|spending)\b/i.test(text);
    const hasCheaper = /\b(cheaper|less\s+expensive)\b/i.test(text);
    const hasSavingOpportunities = /\b(budget[- ]saving|saving[- ]opportunities|ways to save)\b/i.test(text);

    const hasInquiryAndSavingVerb =
      /\b(suggest|how can|how do|how to|where can|help me|what can|can i|can we|we need to|ways to|show me)\b/i.test(text) &&
      /\b(reduce|reduces|reducing|reduction|reductions|cut|cuts|save|saving|savings|trim|trimming|lower|cheaper|economize|spend less)\b/i.test(text);

    // Bengali & Benglish budget reduction indicators
    const hasBengaliBudgetReduction =
      text.includes('budget ta komate') ||
      text.includes('komate hole') ||
      text.includes('khoroch komanor') ||
      text.includes('khoroch komate') ||
      text.includes('kom budget e') ||
      text.includes('save kora jabe') ||
      text.includes('save korbo') ||
      text.includes('taka bachate') ||
      text.includes('বাজেট কমাতে') ||
      text.includes('খরচ কমানোর') ||
      text.includes('খরচ কমাতে') ||
      text.includes('সাশ্রয়') ||
      text.includes('টাকা বাঁচাও') ||
      text.includes('বাঁচানোর') ||
      text.includes('কম খরচে') ||
      text.includes('কমানোর উপায়');

    const isBudgetReduction =
      hasCutOrTrimWord ||
      hasReduceWord ||
      hasSaveWord ||
      hasSpendLess ||
      hasUnnecessaryExpenses ||
      hasCheaper ||
      hasSavingOpportunities ||
      hasInquiryAndSavingVerb ||
      hasBengaliBudgetReduction;

    if (isBudgetReduction) {
      const isDirectImperative = /^reduce\s+(?:budget\s+allocations?|expenses?|total\s+cost)$/i.test(text);
      return { intent: isDirectImperative ? 'reduce_budget' : 'suggest_expense_reductions' };
    }
  }

  // 16. Explain budget (English, Bengali script, Romanized Benglish)
  if (
    !isBudgetIncreaseQuery &&
    (
      (text.includes('explain') && (text.includes('budget') || text.includes('spend') || text.includes('cost'))) ||
      text.includes('how much') ||
      text.includes('budget status') ||
      text.includes('breakdown') ||
      text.includes('budget ta explain') ||
      text.includes('hishab dekhao') ||
      text.includes('বাজেট ব্যাখ্যা') ||
      text.includes('খরচের হিসাব') ||
      (text.includes('বাজেট') && text.includes('অবস্থা')) ||
      text.includes('কত খরচ') ||
      text.includes('হিসেব দাও')
    )
  ) {
    return { intent: 'explain_budget' };
  }

  return { intent: 'unsupported' };
}

/**
 * Generates an honest, deterministic, context-aware assistant response
 * based on live application state.
 */
export function generateAssistantResponse(
  input: string,
  state: AppState
): PlanningMessage {
  const parse = parseUserIntent(input);
  const now = new Date().toISOString();
  const currency = state.event.currency;
  const lang = detectInputLanguage(input);
  const isBengali = lang === 'bn' || lang === 'benglish';

  switch (parse.intent) {
    case 'refuse_unsupported_request': {
      const reason = parse.extractedParameters?.unsupportedReason || 'The requested action is not supported';
      const content = isBengali
        ? `⚠️ **সীমাবদ্ধতা বিজ্ঞপ্তি (Platform Boundary Notice):**\n\n` +
          `${reason}। VowPilot একটি নির্ভরযোগ্য অভ্যন্তরীণ পরিকল্পনা সমন্বয়কারী (in-app deterministic planning coordinator)। এটি কোনো বহিরাগত পেমেন্ট গেটওয়ে, টেলিফোনি বা ওয়েব স্ক্র্যাপিং সিস্টেমের সাথে সংযুক্ত নয়।\n\n` +
          `**আপনি VowPilot-এ কী করতে পারেন:**\n` +
          `* **ভেন্ডর যোগাযোগ:** ভেন্ডরদের সাথে যোগাযোগ ও ইমেইল ড্রাফট করতে **Vendors** ট্যাবে যান।\n` +
          `* **বাজেট ও খরচ:** নিশ্চিত হওয়া পেমেন্ট ও ডিপোজিট ট্র্যাক করতে **Budget Planner** ব্যবহার করুন।\n` +
          `* **দৃশ্যপট যাচাই:** বিকল্প পরিকল্পনা পরীক্ষা করতে **Simulator** ব্যবহার করুন।`
        : `⚠️ **Platform Boundary & Unsupported Capability Notice:**\n\n` +
          `${reason}. VowPilot is a deterministic in-app planning coordinator. It does not integrate with external payment gateways, live telephony systems, or external web scraping engines.\n\n` +
          `**Available In-App Actions:**\n` +
          `* **Vendor Outreach:** Review quotes, compare providers, and compose email drafts directly in the **Vendors** view.\n` +
          `* **Financial Tracking:** Log verified payments and deposits in the **Budget Planner**.\n` +
          `* **Decision Modeling:** Test alternative allocations and guest headcounts safely in the **Simulator**.`;

      return {
        id: `msg-${Date.now()}`,
        timestamp: now,
        role: 'assistant',
        content,
        intent: 'refuse_unsupported_request',
        requiresConfirmation: false,
        dataGrounding: 'unsupported_request',
        languageDetected: lang,
        rationale: 'Security & platform boundary enforcement: transparently explains unsupported external integration.',
      };
    }

    case 'clarify_ambiguous_request': {
      const content = isBengali
        ? `❓ **স্পষ্টীকরণ প্রয়োজন (Clarification Needed):**\n\n` +
          `আপনার অনুরোধটি সংক্ষিপ্ত বা অস্পষ্ট। আপনি ঠিক কোন বিষয়টি আপডেট বা পর্যালোচনা করতে চান?\n\n` +
          `* **"বাজেট ব্যাখ্যা করো"** — মোট বরাদ্দ ও খরচের বিবরণ দেখতে\n` +
          `* **"অতিথির সংখ্যা [সংখ্যা] করো"** — মেহমান সংখ্যা পরিবর্তন ও প্রভাব যাচাই করতে\n` +
          `* **"খরচ কমানোর উপায় বলো"** — সাশ্রয়ের সুযোগ ও অগ্রাধিকার দেখতে\n` +
          `* **"কাজের সময়সূচি দেখাও"** — তারিখ ও সময়সীমা জানতে`
        : `❓ **Clarification Needed:**\n\n` +
          `Your request was underspecified. Could you clarify what you would like to analyze or adjust?\n\n` +
          `* **"Explain my current budget"** — Review total allocations and committed expenses\n` +
          `* **"Change guest count to [number]"** — Model headcount impact on catering and venue\n` +
          `* **"Suggest ways to reduce expenses"** — Identify priority-aware savings opportunities\n` +
          `* **"When is the event?"** — Check wedding countdown and schedule milestones`;

      return {
        id: `msg-${Date.now()}`,
        timestamp: now,
        role: 'assistant',
        content,
        intent: 'clarify_ambiguous_request',
        requiresConfirmation: false,
        dataGrounding: 'ambiguous_clarification',
        languageDetected: lang,
        rationale: 'Polite clarification asked instead of silently guessing ambiguous or low-confidence input.',
      };
    }

    case 'query_event_schedule': {
      const eventDate = state.event.date;
      const eventName = state.event.name;
      const location = state.event.location;

      const eventTime = new Date(eventDate).getTime();
      const todayTime = new Date().getTime();
      const diffDays = Math.ceil((eventTime - todayTime) / (1000 * 60 * 60 * 24));

      const evaluations = evaluateTasks(state.tasks, eventDate);
      const completedCount = evaluations.filter((e) => e.task.status === 'completed').length;
      const overdueCount = evaluations.filter((e) => e.risks.isOverdue).length;

      const title = isBengali
        ? `### ইভেন্ট সময়সূচি ও কাউন্টডাউন (Event Schedule & Timeline)\n\n`
        : `### Event Schedule & Milestone Timeline\n\n`;

      const content = title +
        `* **Event:** ${eventName}\n` +
        `* **Confirmed Date:** ${eventDate} (${diffDays >= 0 ? `${diffDays} days remaining` : `${Math.abs(diffDays)} days ago`})\n` +
        `* **Location:** ${location}\n` +
        `* **Guest Headcount:** ${state.event.guestCount} confirmed guests\n` +
        `* **Task Milestones:** ${completedCount} of ${state.tasks.length} tasks completed ` +
        (overdueCount > 0 ? `(⚠️ **${overdueCount} overdue**)` : `(✅ all deadlines on track)`) + `.\n\n` +
        `All timeline metrics are derived directly from your confirmed event calendar.`;

      return {
        id: `msg-${Date.now()}`,
        timestamp: now,
        role: 'assistant',
        content,
        intent: 'query_event_schedule',
        requiresConfirmation: false,
        dataGrounding: 'verified_application_data',
        languageDetected: lang,
        rationale: 'Derived factually from active event date, location, and task milestones.',
      };
    }

    case 'detect_schedule_conflicts': {
      const evaluations = evaluateTasks(state.tasks, state.event.date);
      const cycles = detectDependencyCycles(state.tasks);
      const postEventTasks = state.tasks.filter((t) => t.dueDate > state.event.date);
      const blockedHighPriority = evaluations.filter((e) => e.risks.isBlocked && (e.task.priority === 'high' || e.task.priority === 'critical'));

      const hasConflicts = cycles.hasCycle || postEventTasks.length > 0 || blockedHighPriority.length > 0;

      if (!hasConflicts) {
        return {
          id: `msg-${Date.now()}`,
          timestamp: now,
          role: 'assistant',
          content: isBengali
            ? `✅ **সময়সূচিতে কোনো সংঘাত নেই (No Schedule Conflicts Detected):**\n\n` +
              `* সমস্ত টাস্কের নির্ধারিত তারিখ ইভেন্টের তারিখের (${state.event.date}) পূর্বে বা সমান।\n` +
              `* কোনো সাইক্লিক ডিপেনডেন্সি (circular dependency) নেই।\n` +
              `* কোনো জরুরি কাজ ব্লক অবস্থায় নেই।`
            : `✅ **No Schedule Conflicts Detected:**\n\n` +
              `* All task deadlines are scheduled on or before the event date (${state.event.date}).\n` +
              `* Dependency graph is acyclic (no circular blocking paths).\n` +
              `* All critical milestones have unblocked prerequisites or are on schedule.`,
          intent: 'detect_schedule_conflicts',
          requiresConfirmation: false,
          dataGrounding: 'verified_application_data',
          languageDetected: lang,
          rationale: 'Topological analysis of task dependency graph and event calendar.',
        };
      }

      let content = isBengali
        ? `⚠️ **সময়সূচি সংঘাত সনাক্ত হয়েছে (Schedule Conflicts Identified):**\n\n`
        : `⚠️ **Schedule Conflicts Identified:**\n\n`;

      if (cycles.hasCycle) {
        content += `* 🚨 **Circular Dependency Cycle:** Tasks (${cycles.cyclePath.join(' ➔ ')}) block each other in a loop.\n`;
      }
      if (postEventTasks.length > 0) {
        content += `* ⚠️ **Deadlines Scheduled After Event Date (${state.event.date}):**\n` +
          postEventTasks.map((t) => `  - "${t.title}" is due on ${t.dueDate}`).join('\n') + '\n';
      }
      if (blockedHighPriority.length > 0) {
        content += `* 🔒 **Blocked Critical Milestones:**\n` +
          blockedHighPriority.map((e) => `  - "${e.task.title}" (Awaiting: ${e.risks.missingPrerequisites.join(', ')})`).join('\n') + '\n';
      }

      content += `\nYou can reschedule or adjust dependencies in the **Tasks** tab.`;

      return {
        id: `msg-${Date.now()}`,
        timestamp: now,
        role: 'assistant',
        content,
        intent: 'detect_schedule_conflicts',
        requiresConfirmation: false,
        dataGrounding: 'verified_application_data',
        languageDetected: lang,
        rationale: 'Evaluated dependency cycles, post-event dates, and blocked critical tasks.',
      };
    }

    case 'query_category_budget': {
      const keyword = parse.extractedParameters?.categoryKeyword || '';
      const cat = state.categories.find(
        (c) => c.name.toLowerCase().includes(keyword) || c.id.toLowerCase().includes(keyword)
      );

      if (!cat) {
        return {
          id: `msg-${Date.now()}`,
          timestamp: now,
          role: 'assistant',
          content: `No budget category matching "${keyword}" was found in your plan. You can view all configured categories in the **Budget Planner**.`,
          intent: 'query_category_budget',
          requiresConfirmation: false,
          dataGrounding: 'missing_information',
          languageDetected: lang,
        };
      }

      const categoryExpenses = state.expenses.filter((e) => e.categoryId === cat.id);
      const committedSpend = categoryExpenses
        .filter((e) => e.status === 'confirmed' || e.status === 'actual')
        .reduce((sum, e) => sum + e.amount, 0);
      const pendingSpend = categoryExpenses
        .filter((e) => e.status === 'estimated' || e.status === 'quoted')
        .reduce((sum, e) => sum + e.amount, 0);
      const totalSpend = committedSpend + pendingSpend;
      const headroom = cat.allocatedAmount - totalSpend;

      const content = `### Category Budget Breakdown: "${cat.name}"\n\n` +
        `* **Configured Cap:** ${formatCurrency(cat.allocatedAmount, currency)}\n` +
        `* **Committed Spend (Confirmed Vendors/Receipts):** ${formatCurrency(committedSpend, currency)}\n` +
        `* **Pending Estimates:** ${formatCurrency(pendingSpend, currency)}\n` +
        `* **Total Projected Spend:** ${formatCurrency(totalSpend, currency)}\n` +
        `* **Remaining Headroom:** ${headroom >= 0 ? formatCurrency(headroom, currency) : `⚠️ Overrun of ${formatCurrency(Math.abs(headroom), currency)}`}\n` +
        `* **Recorded Expense Items:** ${categoryExpenses.length} entries tracked\n\n` +
        (cat.perGuestCost ? `*Note: This category scales dynamically based on headcount (${formatCurrency(cat.perGuestCost, currency)} per guest).*` : '*Note: Fixed allocation category.*');

      return {
        id: `msg-${Date.now()}`,
        timestamp: now,
        role: 'assistant',
        content,
        intent: 'query_category_budget',
        requiresConfirmation: false,
        dataGrounding: 'verified_application_data',
        languageDetected: lang,
        rationale: 'Calculated deterministically from category allocation and verified expenses.',
      };
    }

    case 'interpret_quote_terms': {
      if (state.quotes.length === 0) {
        return {
          id: `msg-${Date.now()}`,
          timestamp: now,
          role: 'assistant',
          content: 'No vendor quotations have been recorded yet. Add quotes in the **Vendors** view to inspect contractual terms and validity dates.',
          intent: 'interpret_quote_terms',
          requiresConfirmation: false,
          dataGrounding: 'missing_information',
          languageDetected: lang,
        };
      }

      const todayStr = new Date().toISOString().split('T')[0];
      const expired: Array<{ vendor: string; quote: VendorQuote }> = [];
      const valid: Array<{ vendor: string; quote: VendorQuote }> = [];

      for (const q of state.quotes) {
        const vendor = state.vendors.find((v) => v.id === q.vendorId);
        const vName = vendor?.name || 'Vendor';
        if (q.validityDate && q.validityDate < todayStr) {
          expired.push({ vendor: vName, quote: q });
        } else {
          valid.push({ vendor: vName, quote: q });
        }
      }

      let content = `### Contractual Terms & Quote Validity Audit\n\n`;

      if (expired.length > 0) {
        content += `#### ⚠️ Expired Quotations (${expired.length})\n` +
          `These prices are no longer contractually guaranteed by the providers:\n` +
          expired.map((e) => `* **${e.vendor}**: Expired on ${e.quote.validityDate} (${formatCurrency(e.quote.quotedAmount, e.quote.currency)})`).join('\n') + '\n\n';
      }

      content += `#### 📋 Active Quotes & Payment Terms (${valid.length})\n`;
      for (const v of valid) {
        content += `* **${v.vendor}** (${formatCurrency(v.quote.quotedAmount, v.quote.currency)}, Status: [${v.quote.status.toUpperCase()}]):\n` +
          `  - *Validity:* Guaranteed through ${v.quote.validityDate || 'Not specified'}\n` +
          `  - *Payment Terms:* ${v.quote.paymentTerms || 'Terms pending agreement'}\n` +
          `  - *Inclusions:* ${v.quote.includedServices.join(', ') || 'None specified'}\n` +
          `  - *Exclusions:* ${v.quote.exclusions.join(', ') || 'None specified'}\n`;
      }

      return {
        id: `msg-${Date.now()}`,
        timestamp: now,
        role: 'assistant',
        content,
        intent: 'interpret_quote_terms',
        requiresConfirmation: false,
        dataGrounding: 'verified_application_data',
        languageDetected: lang,
        rationale: 'Extracted factually from quotation validity dates and contractual terms.',
      };
    }

    case 'explain_budget': {
      if (!state.categories || state.categories.length === 0) {
        return {
          id: `msg-${Date.now()}`,
          timestamp: now,
          role: 'assistant',
          content: 'No budget categories have been configured yet. Open the **Budget Planner** to establish initial allocations.',
          intent: 'explain_budget',
          requiresConfirmation: false,
          dataGrounding: 'missing_information',
          languageDetected: lang,
        };
      }

      const overview = calculateBudgetOverview(state.event.totalBudget, state.categories, state.expenses);
      const title = isBengali
        ? `### বর্তমান বাজেট বিবরণী (Current Budget Breakdown)\n\n`
        : `### Current Budget Breakdown\n\n`;
      const content = title +
        `* **Total Event Budget:** ${formatCurrency(overview.totalBudget, currency)}\n` +
        `* **Allocated Across Categories:** ${formatCurrency(overview.totalAllocated, currency)}\n` +
        `* **Committed Spend (Confirmed + Actual):** ${formatCurrency(overview.committedTotal, currency)}\n` +
        `* **Effective Projected Spend:** ${formatCurrency(overview.effectiveProjectedTotal, currency)}\n` +
        `* **Remaining Runway:** ${formatCurrency(overview.remainingBudget, currency)}\n` +
        `* **Utilization Rate:** ${overview.utilizationPercentage}%\n\n` +
        (overview.isOverrun
          ? `⚠️ **Warning:** The plan is currently over budget by ${formatCurrency(overview.overrunAmount, currency)}.`
          : `✅ Current projections are within the configured total budget.`);

      return {
        id: `msg-${Date.now()}`,
        timestamp: now,
        role: 'assistant',
        content,
        intent: 'explain_budget',
        requiresConfirmation: false,
        dataGrounding: 'verified_application_data',
        languageDetected: lang,
        rationale: 'Derived directly from current budget categories and confirmed expenses.',
      };
    }

    case 'change_guest_count': {
      const targetCount = parse.extractedParameters?.guestCount;
      if (!targetCount) {
        return {
          id: `msg-${Date.now()}`,
          timestamp: now,
          role: 'assistant',
          content: 'Please specify the target guest count number (e.g., "Change guest count to 150").',
          intent: 'change_guest_count',
          requiresConfirmation: false,
          dataGrounding: 'missing_information',
          languageDetected: lang,
        };
      }

      // Explicit capacity check
      const venueCategory = state.categories.find((c) => c.name.toLowerCase().includes('venue'));
      const capacityConstraint = venueCategory?.notes?.match(/capacity[:\s]+(\d+)/i);
      const maxCapacity = capacityConstraint ? parseInt(capacityConstraint[1], 10) : 250;

      const impactResult = calculateGuestCountImpact(state, targetCount);
      const impact = impactResult.impact;

      let content = `### Impact Analysis: Guest Count Adjustment (${state.event.guestCount} ➔ ${targetCount} Guests)\n\n` +
        `* **Current Projected Spend:** ${formatCurrency(impact.currentEstimatedTotal, currency)}\n` +
        `* **Proposed Projected Spend:** ${formatCurrency(impact.proposedEstimatedTotal, currency)}\n` +
        `* **Net Cost Difference:** ${impact.difference >= 0 ? '+' : ''}${formatCurrency(impact.difference, currency)}\n` +
        `* **Revised Remaining Budget:** ${formatCurrency(impact.remainingBudget, currency)}\n\n` +
        `**Affected Categories:** ${impact.affectedCategories.join(', ') || 'None (no variable per-guest costs configured)'}.\n\n`;

      if (targetCount > maxCapacity) {
        content += `🚨 **Capacity Constraint Alert:** Target headcount (${targetCount}) exceeds venue capacity constraint (${maxCapacity} guests). You may need to select a larger venue or reduce the invite list.\n\n`;
      } else if (impactResult.capacityViolation) {
        content += `🚨 **Capacity Constraint Alert:** ${impactResult.capacityViolation}\n\n`;
      }

      if (impact.budgetViolations.length > 0) {
        content += `⚠️ **Budget Overrun Alert:** Projected spend exceeds the total budget by ${formatCurrency(impact.proposedEstimatedTotal - state.event.totalBudget, currency)}.\n\n`;
      }
      if (impactResult.missingDataWarnings.length > 0) {
        content += `ℹ️ **Notice:** ${impactResult.missingDataWarnings.join(' ')}\n\n`;
      }

      content += `Would you like me to apply this update to your active event plan?`;

      const proposedAction: ProposedAction = {
        id: `act-${Date.now()}`,
        type: 'adjust_guest_count',
        summary: `Update guest count to ${targetCount}`,
        payload: { guestCount: targetCount },
        impact,
      };

      return {
        id: `msg-${Date.now()}`,
        timestamp: now,
        role: 'assistant',
        content,
        intent: 'change_guest_count',
        proposedAction,
        requiresConfirmation: true,
        actionStatus: 'pending',
        dataGrounding: 'derived_estimate',
        languageDetected: lang,
        rationale: `Calculated from configured per-guest rules for variable categories.`,
      };
    }

    case 'reduce_budget':
    case 'suggest_expense_reductions': {
      if (!state.categories || state.categories.length === 0) {
        return {
          id: `msg-${Date.now()}`,
          timestamp: now,
          role: 'assistant',
          content: 'Current data is insufficient: No budget categories have been configured yet. Add categories and allocations in the **Budget Planner** to receive tailored savings opportunities.',
          intent: parse.intent === 'reduce_budget' ? 'reduce_budget' : 'suggest_expense_reductions',
          requiresConfirmation: false,
          dataGrounding: 'missing_information',
          languageDetected: lang,
          rationale: 'Cannot calculate savings without configured budget categories.',
        };
      }

      const overview = calculateBudgetOverview(state.event.totalBudget, state.categories, state.expenses);
      const priorities = state.event.preferences.planningPriorities;

      const totalFlexible = overview.categories.reduce(
        (sum, c) => sum + Math.max(0, c.allocatedAmount - c.committedTotal),
        0
      );

      if (totalFlexible <= 0) {
        return {
          id: `msg-${Date.now()}`,
          timestamp: now,
          role: 'assistant',
          content: `All category allocations (${formatCurrency(overview.totalAllocated, currency)}) are already committed to confirmed vendor expenses or deposits (${formatCurrency(overview.committedTotal, currency)}). There is no flexible, uncommitted headroom available to trim without renegotiating confirmed vendor contracts or canceling bookings.`,
          intent: parse.intent === 'reduce_budget' ? 'reduce_budget' : 'suggest_expense_reductions',
          requiresConfirmation: false,
          dataGrounding: 'verified_application_data',
          languageDetected: lang,
          rationale: 'All budget allocations are locked in confirmed vendor commitments.',
        };
      }

      const targetReduction = overview.isOverrun
        ? overview.overrunAmount
        : Math.min(Math.round(state.event.totalBudget * 0.10), totalFlexible);

      const recs = generatePriorityAwareRecommendations(overview, priorities, targetReduction);

      if (recs.recommendations.length === 0) {
        return {
          id: `msg-${Date.now()}`,
          timestamp: now,
          role: 'assistant',
          content: overview.isOverrun
            ? `Your budget has an overrun of ${formatCurrency(overview.overrunAmount, currency)}, but all category allocations are already tied to confirmed vendor commitments. You may need to renegotiate quotes or increase the total budget.`
            : `Your budget is currently within the total limit of ${formatCurrency(state.event.totalBudget, currency)}, and existing category headroom is already optimized. To explore deeper custom cuts, open the **Decision Simulator**.`,
          intent: parse.intent === 'reduce_budget' ? 'reduce_budget' : 'suggest_expense_reductions',
          requiresConfirmation: false,
          dataGrounding: 'verified_application_data',
          languageDetected: lang,
          rationale: 'Evaluated category allocations against priority rankings.',
        };
      }

      const totalSavings = recs.recommendations.reduce((sum, r) => sum + r.suggestedReduction, 0);
      const proposedTotal = overview.effectiveProjectedTotal - totalSavings;
      const revisedRunway = overview.remainingBudget + totalSavings;

      const cutCategoryIds = new Set(recs.recommendations.map((r) => r.categoryId));
      const protectedCategoryNames = state.categories
        .filter((c) => !cutCategoryIds.has(c.id))
        .map((c) => c.name);

      let content = overview.isOverrun
        ? `### Priority-Aware Budget Reduction Proposals (Overrun Correction)\n\n` +
          `Your plan currently projects an overrun of **${formatCurrency(overview.overrunAmount, currency)}**. ` +
          `The recommendations below eliminate the overrun while safeguarding your highest priorities (${protectedCategoryNames.slice(0, 2).join(', ') || 'top-ranked categories'}):\n\n`
        : `### Priority-Aware Budget Reduction Opportunities\n\n` +
          `Based on your active plan (${formatCurrency(overview.effectiveProjectedTotal, currency)} projected of ${formatCurrency(overview.totalBudget, currency)} total budget), here are concrete, data-grounded savings opportunities:\n\n` +
          `* **Committed vs Flexible Spend:** ${formatCurrency(overview.committedTotal, currency)} is locked in confirmed commitments, leaving ${formatCurrency(totalFlexible, currency)} in flexible uncommitted allocations.\n` +
          `* **Protected Categories:** Your top priorities (${protectedCategoryNames.slice(0, 3).join(', ') || 'top-ranked categories'}) are fully shielded from cuts.\n` +
          `* **Identified Savings Potential:** Up to **${formatCurrency(totalSavings, currency)}** can be trimmed across lower-priority items without affecting confirmed bookings:\n\n`;

      for (const rec of recs.recommendations) {
        let tradeOffNote = '';
        const lowerCat = rec.categoryName.toLowerCase();
        if (lowerCat.includes('decor')) {
          tradeOffNote = ' *Trade-off:* Opt for standard seasonal florals or ambient warm lanterns over custom fabrication.';
        } else if (lowerCat.includes('entertainment') || lowerCat.includes('music')) {
          tradeOffNote = ' *Trade-off:* Rely on curated DJ sound arrangements rather than a multi-piece live ensemble.';
        } else if (lowerCat.includes('logistics') || lowerCat.includes('transport')) {
          tradeOffNote = ' *Trade-off:* Consolidate airport transfers into scheduled group shuttles.';
        } else if (lowerCat.includes('contingency') || lowerCat.includes('buffer')) {
          tradeOffNote = ' *Trade-off:* Retains a leaner emergency reserve for last-minute additions.';
        }

        content += `* **${rec.categoryName}** (Rank #${rec.priorityRank}): Reduce allocation by **${formatCurrency(rec.suggestedReduction, currency)}** ` +
          `(${formatCurrency(rec.currentAllocated, currency)} ➔ ${formatCurrency(rec.newAllocated, currency)}).\n` +
          `  *Rationale:* ${rec.rationale}${tradeOffNote}\n`;
      }

      content += `\n**Projected Financial Outcome:**\n` +
        `* **Current Projected Spend:** ${formatCurrency(overview.effectiveProjectedTotal, currency)}\n` +
        `* **Proposed Projected Spend:** ${formatCurrency(proposedTotal, currency)}\n` +
        `* **Net Savings Difference:** -${formatCurrency(totalSavings, currency)}\n` +
        `* **Revised Runway:** ${formatCurrency(revisedRunway, currency)}\n\n` +
        `*Note: These recommendations have not modified your active event data.* Would you like to generate an alternative Budget Scenario in the Decision Simulator incorporating these reductions?`;

      const proposedAction: ProposedAction = {
        id: `act-${Date.now()}`,
        type: 'create_scenario',
        summary: overview.isOverrun
          ? 'Rebalance Budget to Clear Overrun'
          : `Create ${formatCurrency(totalSavings, currency)} Savings Scenario`,
        payload: {
          scenarioName: overview.isOverrun ? 'Overrun Correction Scenario' : 'Lean Savings Scenario',
          adjustments: recs.recommendations,
        },
        impact: {
          currentEstimatedTotal: overview.effectiveProjectedTotal,
          proposedEstimatedTotal: proposedTotal,
          difference: -totalSavings,
          remainingBudget: revisedRunway,
          affectedCategories: recs.recommendations.map((r) => r.categoryName),
          budgetViolations: [],
        },
      };

      return {
        id: `msg-${Date.now()}`,
        timestamp: now,
        role: 'assistant',
        content,
        intent: parse.intent === 'reduce_budget' ? 'reduce_budget' : 'suggest_expense_reductions',
        proposedAction,
        requiresConfirmation: true,
        actionStatus: 'pending',
        dataGrounding: 'derived_estimate',
        languageDetected: lang,
        rationale: 'Follows priority ranking order strictly, preserving committed actuals and safeguarding top categories.',
      };
    }

    case 'protect_priority': {
      const topPriorityId = state.event.preferences.planningPriorities[0];
      const topCat = state.categories.find((c) => c.id === topPriorityId) || state.categories[0];

      const content = `### Priority Protection: ${topCat?.name || 'Top Priority'}\n\n` +
        `* **Category Status:** Currently allocated ${formatCurrency(topCat?.allocatedAmount || 0, currency)}.\n` +
        `* **Priority Order:** Designated as Priority #1 in your event preferences.\n\n` +
        `The budget engine automatically shields this category from automatic cuts. If you require additional funds for ${topCat?.name}, you can reallocate uncommitted headroom from lower-priority categories in the Budget Planner.`;

      return {
        id: `msg-${Date.now()}`,
        timestamp: now,
        role: 'assistant',
        content,
        intent: 'protect_priority',
        requiresConfirmation: false,
        dataGrounding: 'verified_application_data',
        languageDetected: lang,
      };
    }

    case 'find_overdue_tasks': {
      const evaluations = evaluateTasks(state.tasks, state.event.date);
      const overdue = evaluations.filter((e) => e.risks.isOverdue);

      if (overdue.length === 0) {
        return {
          id: `msg-${Date.now()}`,
          timestamp: now,
          role: 'assistant',
          content: '✅ **No overdue tasks!** All task deadlines are currently on schedule relative to today.',
          intent: 'find_overdue_tasks',
          requiresConfirmation: false,
          dataGrounding: 'verified_application_data',
          languageDetected: lang,
        };
      }

      let content = `### ⚠️ Overdue Tasks Requiring Attention (${overdue.length})\n\nThe following tasks in your schedule are currently overdue:\n\n`;
      for (const item of overdue) {
        content += `* **${item.task.title}** (Due: ${item.task.dueDate}, Priority: ${item.task.priority.toUpperCase()})\n` +
          `  *Risk:* ${item.risks.putsDownstreamAtRisk ? `Blocks downstream tasks (${item.risks.downstreamTaskTitles.join(', ')})` : 'Individual deadline passed.'}\n`;
      }
      content += `\nYou can navigate to the **Tasks** screen to reschedule or mark them complete.`;

      return {
        id: `msg-${Date.now()}`,
        timestamp: now,
        role: 'assistant',
        content,
        intent: 'find_overdue_tasks',
        requiresConfirmation: false,
        dataGrounding: 'verified_application_data',
        languageDetected: lang,
      };
    }

    case 'explain_blocked_tasks': {
      const evaluations = evaluateTasks(state.tasks, state.event.date);
      const blocked = evaluations.filter((e) => e.risks.isBlocked);

      if (blocked.length === 0) {
        return {
          id: `msg-${Date.now()}`,
          timestamp: now,
          role: 'assistant',
          content: '✅ **No tasks are currently blocked.** All remaining tasks have their prerequisites completed or have no dependencies.',
          intent: 'explain_blocked_tasks',
          requiresConfirmation: false,
          dataGrounding: 'verified_application_data',
          languageDetected: lang,
        };
      }

      let content = `### 🔒 Blocked Tasks (${blocked.length})\n\n` +
        `The following tasks cannot be marked complete because their prerequisite tasks are still pending:\n\n`;

      for (const item of blocked) {
        content += `* **${item.task.title}**\n` +
          `  *Awaiting Completion Of:* ${item.risks.missingPrerequisites.join(', ')}\n`;
      }

      return {
        id: `msg-${Date.now()}`,
        timestamp: now,
        role: 'assistant',
        content,
        intent: 'explain_blocked_tasks',
        requiresConfirmation: false,
        dataGrounding: 'verified_application_data',
        languageDetected: lang,
      };
    }

    case 'compare_vendor_quotes': {
      if (state.vendors.length === 0) {
        return {
          id: `msg-${Date.now()}`,
          timestamp: now,
          role: 'assistant',
          content: 'No vendor records have been added to compare yet. Add vendors in the **Vendors** tab to see side-by-side quotation matrices.',
          intent: 'compare_vendor_quotes',
          requiresConfirmation: false,
          dataGrounding: 'missing_information',
          languageDetected: lang,
        };
      }

      const categoryFilter = parse.extractedParameters?.categoryKeyword;
      const targetCategories = categoryFilter
        ? state.categories.filter((c) => c.name.toLowerCase().includes(categoryFilter) || c.id.toLowerCase().includes(categoryFilter))
        : state.categories;

      const categoriesToScan = targetCategories.length > 0 ? targetCategories : state.categories;

      let content = `### Vendor Quotation Comparison Summary\n\n`;
      let renderedRows = 0;

      for (const cat of categoriesToScan) {
        const comp = compareCategoryVendors(cat.id, cat.name, state.vendors, state.quotes);
        if (comp.rows.length > 0) {
          renderedRows += comp.rows.length;
          content += `#### ${cat.name} (${comp.rows.length} ${comp.rows.length === 1 ? 'vendor' : 'vendors'})\n`;
          for (const row of comp.rows) {
            const price = row.quote ? formatCurrency(row.quote.quotedAmount, row.quote.currency) : 'No quote submitted';
            const status = row.quote ? `[${row.quote.status.toUpperCase()}]` : '';
            const rating = row.vendor.rating ? `(Rating: ${row.vendor.rating}★)` : '';
            content += `* **${row.vendor.name}**: ${price} ${status} ${rating} ${row.isExpired ? '⚠️ (Quote Expired)' : ''}\n`;
          }
          content += '\n';
        }
      }

      if (renderedRows === 0) {
        content += `No vendor quotes recorded for ${categoryFilter || 'any category'}. You can request and enter quotes in the **Vendors** tab.`;
      }

      return {
        id: `msg-${Date.now()}`,
        timestamp: now,
        role: 'assistant',
        content,
        intent: 'compare_vendor_quotes',
        requiresConfirmation: false,
        dataGrounding: 'verified_application_data',
        languageDetected: lang,
      };
    }

    case 'identify_missing_vendor_info': {
      const missingDetails: string[] = [];
      for (const q of state.quotes) {
        const vendor = state.vendors.find((v) => v.id === q.vendorId);
        const name = vendor?.name || 'Unknown Vendor';
        const missing = identifyMissingQuoteDetails(q, name);
        if (missing.length > 0) {
          missingDetails.push(`* **${name}**:\n` + missing.map((m) => `  - ${m}`).join('\n'));
        }
      }

      if (missingDetails.length === 0) {
        return {
          id: `msg-${Date.now()}`,
          timestamp: now,
          role: 'assistant',
          content: '✅ All submitted quotations currently include itemized inclusions, exclusions, validity dates, and payment terms.',
          intent: 'identify_missing_vendor_info',
          requiresConfirmation: false,
          dataGrounding: 'verified_application_data',
          languageDetected: lang,
        };
      }

      const content = `### 📋 Incomplete Quotation Details Detected\n\n` +
        `The following quotations lack critical contractual specifications:\n\n` +
        missingDetails.join('\n\n') +
        `\n\nYou can use the **Draft Clarification** button in the Vendors tab to send inquiries to these providers.`;

      return {
        id: `msg-${Date.now()}`,
        timestamp: now,
        role: 'assistant',
        content,
        intent: 'identify_missing_vendor_info',
        requiresConfirmation: false,
        dataGrounding: 'verified_application_data',
        languageDetected: lang,
      };
    }

    case 'create_budget_scenario': {
      const content = `### Decision Impact Modeling\n\n` +
        `To explore alternative budget scenarios without modifying your confirmed plan, navigate to the **Simulator** tab. ` +
        `There you can:\n\n` +
        `1. Adjust guest count to stress-test catering and venue capacity.\n` +
        `2. Reallocate budget across photography, decor, and catering.\n` +
        `3. Compare side-by-side variances against baseline before committing.`;

      return {
        id: `msg-${Date.now()}`,
        timestamp: now,
        role: 'assistant',
        content,
        intent: 'create_budget_scenario',
        requiresConfirmation: false,
        dataGrounding: 'verified_application_data',
        languageDetected: lang,
      };
    }

    case 'summarize_plan': {
      const overview = calculateBudgetOverview(state.event.totalBudget, state.categories, state.expenses);
      const evaluations = evaluateTasks(state.tasks, state.event.date);
      const completedTasks = evaluations.filter((e) => e.task.status === 'completed').length;
      const overdueTasks = evaluations.filter((e) => e.risks.isOverdue).length;
      const selectedQuotes = state.quotes.filter((q) => q.status === 'selected').length;

      const content = `### Event Executive Summary: "${state.event.name}"\n\n` +
        `* **Date:** ${state.event.date} (${state.event.location})\n` +
        `* **Headcount:** ${state.event.guestCount} confirmed guests\n` +
        `* **Budget Health:** ${formatCurrency(overview.effectiveProjectedTotal, currency)} projected of ${formatCurrency(overview.totalBudget, currency)} total (${overview.remainingBudget >= 0 ? `${formatCurrency(overview.remainingBudget, currency)} remaining` : `⚠️ Overrun of ${formatCurrency(overview.overrunAmount, currency)}`})\n` +
        `* **Milestone Progress:** ${completedTasks} of ${state.tasks.length} tasks completed (${overdueTasks > 0 ? `⚠️ ${overdueTasks} overdue` : 'all deadlines on schedule'})\n` +
        `* **Vendor Coordination:** ${selectedQuotes} selected of ${state.vendors.length} vendors tracked\n\n` +
        `All metrics are derived in real-time from your confirmed plan.`;

      return {
        id: `msg-${Date.now()}`,
        timestamp: now,
        role: 'assistant',
        content,
        intent: 'summarize_plan',
        requiresConfirmation: false,
        dataGrounding: 'verified_application_data',
        languageDetected: lang,
      };
    }

    case 'unsupported':
    default: {
      const content = isBengali
        ? `আমি VowPilot-এর সুনির্দিষ্ট পরিকল্পনা ইঞ্জিন (deterministic planning engine)। আমি বাজেট হিসাব, টাস্ক ডিপেনডেন্সি এবং ভেন্ডর সমন্বয় পরিচালনা করি।\n\n` +
          `আপনার বার্তায় কোনো সমর্থিত পরিকল্পনা নির্দেশ সনাক্ত করা যায়নি। আপনি নিম্নলিখিত বিষয়গুলি সম্পর্কে জিজ্ঞাসা করতে পারেন:\n\n` +
          `* **"আমার বাজেট ব্যাখ্যা করো" / "Amar budget ta explain koro"** — বাজেট বরাদ্দ ও খরচের বিবরণ\n` +
          `* **"অতিথির সংখ্যা ১৭৫ করে দাও" / "Guest count 175 kore dao"** — কেটারিং ও ভেন্যু সক্ষমতার প্রভাব বিশ্লেষণ\n` +
          `* **"খরচ কমানোর উপায় বলো" / "Khoroch komanor upay bolo"** — অগ্রাধিকার অনুযায়ী সাশ্রয়ের সুযোগ\n` +
          `* **"দেরি হওয়া কাজগুলো দেখাও" / "Overdue task gulo dekhao"** — সময় পার হওয়া কাজগুলোর তালিকা\n` +
          `* **"কোন কাজগুলো আটকে আছে?" / "Blocked task dekhao"** — পূর্বশর্ত ও বাধার বিশ্লেষণ\n` +
          `* **"ইভেন্টের তারিখ কবে?" / "Kobe biye?"** — অনুষ্ঠানের দিন ও কাউন্টডাউন\n` +
          `* **"ভেন্ডর কোটেশন তুলনা করো" / "Vendor quotations compare koro"** — পাশাপাশি ভেন্ডর দর যাচাই\n` +
          `* **"কোন ভেন্ডরের তথ্য বাকি?" / "Missing vendor info"** — অসম্পূর্ণ কোটেশন যাচাই\n` +
          `* **"পরিকল্পনার সারসংক্ষেপ দেখাও" / "Plan summary dekhao"** — সামগ্রিক ইভেন্ট প্রস্তুতি`
        : `I am VowPilot's deterministic planning engine. I specialize in constraint validation, budget calculations, task dependency tracking, and vendor coordination.\n\n` +
          `I did not recognize a supported planning command in your message. Here are specific things you can ask me:\n\n` +
          `* **"Explain my current budget"** — Detailed breakdown of allocations and committed spend\n` +
          `* **"When is the event?"** — Event date, venue location, and remaining days countdown\n` +
          `* **"Change guest count to 150"** — Impact analysis on catering and venue constraints\n` +
          `* **"Suggest ways to reduce expenses"** — Priority-aware trimming of non-committed allocations\n` +
          `* **"Find tasks that are overdue"** — List overdue deadlines and blocked items\n` +
          `* **"Explain which tasks are blocked"** — Show upstream prerequisite requirements\n` +
          `* **"Compare vendor quotations"** — Side-by-side category vendor review\n` +
          `* **"Are any quotes expired?"** — Inspect quotation expiration and contractual terms\n` +
          `* **"Summarize the current event plan"** — Executive readiness overview`;

      const isSecurityOrUnsupported = Boolean(parse.extractedParameters?.unsupportedReason);
      const dataGrounding = isSecurityOrUnsupported ? 'unsupported_request' : 'missing_information';

      return {
        id: `msg-${Date.now()}`,
        timestamp: now,
        role: 'assistant',
        content,
        intent: 'unsupported',
        requiresConfirmation: false,
        dataGrounding,
        languageDetected: lang,
        rationale: 'Honest response: intent was not matched to any deterministic planning action.',
      };
    }
  }
}
