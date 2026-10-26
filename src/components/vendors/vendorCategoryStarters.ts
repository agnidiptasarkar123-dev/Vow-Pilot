export interface CategoryStarterInfo {
  categoryKey: string;
  scopeTitle: string;
  scopeDescription: string;
  scopeChecklist: string[];
  suggestedQuestions: string[];
  sampleInclusions: string[];
  sampleExclusions: string[];
}

export const CATEGORY_STARTERS: Record<string, CategoryStarterInfo> = {
  decor: {
    categoryKey: 'decor',
    scopeTitle: 'Decor & Production Scope Checklist',
    scopeDescription: 'Ensure stage geometry, lighting lux, floral freshness, and venue teardown hours are formally specified.',
    scopeChecklist: [
      'Floral and botanical installation (fresh vs preserved florals specified)',
      'Stage, ceremonial backdrop, or altar styling with dimensions',
      'Ambient lighting, walkway fairy lights, and focal spotlights',
      'Dining table linens, runners, crockery charger plates, and centerpieces',
      'Lounge furniture, seating rentals, and podium/stage risers',
      'Pre-event load-in schedule and strict post-event teardown deadline',
    ],
    suggestedQuestions: [
      'Is on-site rigging equipment, ladder access, and generator backup power included in the quote?',
      'Are fresh flowers guaranteed on morning delivery, and what is the contingency for unseasonal wilting?',
      'What are the teardown curfew hours and deposit refund conditions after venue inspection?',
    ],
    sampleInclusions: [
      'Ceremony floral backdrop setup with seasonal botanicals',
      'Warm ambient fairy lights across banquet hall',
      'Table runners and floral centerpieces for up to 20 tables',
      'Delivery, installation crew, and same-night teardown',
    ],
    sampleExclusions: [
      'Heavy structural truss rigging',
      'Venue generator fuel surcharge',
      'Custom fabricated neon signages',
    ],
  },
  entertainment: {
    categoryKey: 'entertainment',
    scopeTitle: 'Music & Entertainment Scope Checklist',
    scopeDescription: 'Specify acoustic gear, artist duration, performance setbreaks, and sound pressure level (SPL) permits.',
    scopeChecklist: [
      'DJ performance console, software license, and playlist briefing',
      'Live band, vocal ensemble, or traditional acoustic musicians',
      'Solo instrumentalist (violinist, harpist, saxophonist, flautist)',
      'PA sound system, subwoofers, foldback monitors, and wireless microphones',
      'Dedicated on-site sound engineer and stage AV technician',
      'Performance timing windows, interval durations, and local noise curfew compliance',
    ],
    suggestedQuestions: [
      'Does the quoted price include sound testing / acoustic soundcheck prior to guest arrival?',
      'What are the exact hourly overtime rates if the dance floor extends beyond midnight?',
      'Does the artist provide their own audio mixer and instrument cables, or does the venue supply backline?',
    ],
    sampleInclusions: [
      'Live music performance (3 hours total with 15-minute intermission)',
      'Full PA sound system with 2 subwoofers and 4 wireless handheld mics',
      'On-site sound engineer for duration of performance',
    ],
    sampleExclusions: [
      'Local municipality sound permit fees',
      'Artist hospitality rider and travel lodging',
      'Overtime beyond agreed event schedule',
    ],
  },
  catering: {
    categoryKey: 'catering',
    scopeTitle: 'Catering & Dining Scope Checklist',
    scopeDescription: 'Clarify per-head prices, menu courses, allergy precautions, live cooking counters, and service staff ratios.',
    scopeChecklist: [
      'Welcome drinks, artisanal mocktail bar, and sparkling beverage service',
      'Passed hors d’oeuvres and canapés during reception',
      'Multi-course dinner buffet or formal plated service',
      'Live chef interactive counters and dessert station',
      'Full tableware: porcelain plates, silverware, crystal glassware, and cloth napkins',
      'Certified food handler staff at a minimum 1:12 server-to-guest ratio',
      'Dietary tagging: vegetarian, vegan, gluten-free, halal, kosher, and nut-safe options',
    ],
    suggestedQuestions: [
      'What is the cutoff deadline for final confirmed guest headcounts (e.g., 7 or 14 days prior)?',
      'Is complimentary menu tasting included prior to finalizing the culinary contract?',
      'How are leftovers, compostable disposables, and kitchen waste cleanup handled after service?',
    ],
    sampleInclusions: [
      '4-course dinner service with dessert bar',
      'Welcome mocktail bar and infused water stations',
      'All chinaware, flatware, and linen napkins',
      'Dedicated kitchen prep staff and table captains',
    ],
    sampleExclusions: [
      'Alcoholic beverages and liquor licensing permits',
      'Wedding cake cutting or plating surcharge',
      'Kitchen refrigeration rental if venue lacks cold storage',
    ],
  },
  photography: {
    categoryKey: 'photography',
    scopeTitle: 'Photography & Cinema Scope Checklist',
    scopeDescription: 'Define lead shooter counts, cinematic drone coverage, turnaround dates, and raw file ownership.',
    scopeChecklist: [
      'Lead candid photographer and traditional family portrait photographer',
      'Cinematic videographer with 4K camera and 3-axis gimbal stabilizer',
      'Drone aerial videography for outdoor arrivals and venue landscape',
      'Same-day highlight reel / 60-second social media teaser',
      'Full edited photo gallery delivery via private online portal within 30 days',
      'High-resolution archival master files and uncompressed RAW footage delivery',
      'Handcrafted premium hardcover album specifications (page count and paper stock)',
    ],
    suggestedQuestions: [
      'What is the turnaround timeline for the preliminary proof gallery versus final album prints?',
      'Are travel, parking, and crew meal accommodations included or invoiced separately?',
      'Does the client receive unrestricted personal printing and social sharing rights?',
    ],
    sampleInclusions: [
      '2 lead photographers + 1 cinematic videographer for up to 8 hours',
      'Same-day 60-second teaser video',
      'Minimum 500 hand-color-corrected high-resolution photographs',
      'Online digital gallery with high-speed download rights for 1 year',
    ],
    sampleExclusions: [
      'Physical fine-art album printing (quoted as optional add-on)',
      'Drone flight permits in restricted airspace zones',
      'Extended hours beyond 8 hours scheduled coverage',
    ],
  },
  venue: {
    categoryKey: 'venue',
    scopeTitle: 'Venue & Facilities Scope Checklist',
    scopeDescription: 'Clarify access hours, bridal prep suites, sound curfews, vendor loading docks, and cleaning fees.',
    scopeChecklist: [
      'Exclusive access to ceremony lawn, courtyard, and indoor banquet hall',
      'Air-conditioned bridal dressing suites with private vanity and restroom',
      'Guest parking capacity, drop-off concourse, and valet staging area',
      'Electrical load allowance and dedicated high-voltage generator backup',
      'Restroom attendants and continuous sanitization throughout the celebration',
      'Strict sound curfew hours and decibel thresholds',
    ],
    suggestedQuestions: [
      'What is the exact amplified sound curfew hour (e.g. 10:00 PM indoors / 9:00 PM outdoors)?',
      'Does the venue impose an exclusive vendor list or royalty surcharge on outside decorators/caterers?',
      'What is the security deposit amount and refund turnaround schedule after post-event walkthrough?',
    ],
    sampleInclusions: [
      'Venue hire for 12 continuous hours including 3-hour setup and 2-hour teardown window',
      'Full electrical supply with automatic generator switchover',
      'Two climate-controlled green rooms for VIP preparation',
      'Complimentary self-parking for up to 80 guest vehicles',
    ],
    sampleExclusions: [
      'Overtime venue usage fee (charged per 30 minutes)',
      'Valet driver personnel',
      'Mandatory municipal fire safety permit fee',
    ],
  },
  logistics: {
    categoryKey: 'logistics',
    scopeTitle: 'Logistics & Guest Transport Scope Checklist',
    scopeDescription: 'Coordinate airport pickups, inter-venue shuttles, designated driver contact cards, and luggage storage.',
    scopeChecklist: [
      'Airport & railway arrival transfer schedule with flight tracking',
      'Hotel to celebration venue guest shuttles on fixed interval rotations',
      'Dedicated bridal party luxury vehicle with professional chauffeur',
      'Luggage handling and secure bellhop storage at the venue',
      'Driver contact directory distributed to wedding party coordinators',
      'Fuel, highway toll passes, parking taxes, and interstate permits included',
    ],
    suggestedQuestions: [
      'Are highway tolls, parking access fees, and driver meals included in the base quote?',
      'What is the vehicle breakdown replacement guarantee window (e.g., replacement within 30 minutes)?',
      'Can shuttle departure intervals be dynamically adjusted if events run behind schedule?',
    ],
    sampleInclusions: [
      '2 AC mini-coaches (25 passengers each) for 6 hours of continuous shuttle service',
      'All fuel, interstate permits, and driver allowances',
      'Real-time GPS tracking link for coordinator phone',
    ],
    sampleExclusions: [
      'Extra airport transfer runs beyond booked schedule',
      'Driver overtime beyond agreed booking window',
      'Damage cleanup fees caused by passengers',
    ],
  },
};

export function getCategoryStarter(categoryId: string, categoryName: string): CategoryStarterInfo {
  const normalizedId = categoryId.toLowerCase();
  const normalizedName = categoryName.toLowerCase();

  for (const [key, info] of Object.entries(CATEGORY_STARTERS)) {
    if (normalizedId.includes(key) || normalizedName.includes(key)) {
      return info;
    }
  }

  // Fallback generic category starter
  return {
    categoryKey: categoryId,
    scopeTitle: `${categoryName} Scope Checklist`,
    scopeDescription: `Review standard service specifications, contractual deliverables, and recommended quotation checks for ${categoryName}.`,
    scopeChecklist: [
      `Detailed itemized scope of work and service deliverables for ${categoryName}`,
      'Equipment supply, technician support, and operational maintenance',
      'Arrival time, load-in setup schedule, and post-event departure',
      'Insurance coverage, worker liability, and venue damage deposit protection',
      'Emergency contingency procedure and replacement staff guarantee',
    ],
    suggestedQuestions: [
      'What are the payment milestones (e.g., advance booking deposit vs final post-delivery balance)?',
      'What is the cancellation and rescheduling policy in case of unforeseen date changes?',
      'Are all applicable taxes, transportation, and incidental surcharges included in the quoted price?',
    ],
    sampleInclusions: [
      `Primary service delivery for ${categoryName} on scheduled date`,
      'On-site supervisor and necessary operational materials',
    ],
    sampleExclusions: [
      'Overtime fees beyond agreed schedule',
      'Unscheduled last-minute additions',
    ],
  };
}
