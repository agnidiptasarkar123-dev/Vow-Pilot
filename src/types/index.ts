/**
 * VowPilot Core Domain Types
 * Strict typing for financial calculations, dependency graphs, vendor coordination,
 * planning assistant actions, and state persistence.
 */

export type CurrencyCode = 'INR' | 'USD' | 'EUR' | 'GBP';

export type EventType = 'wedding' | 'birthday' | 'anniversary' | 'corporate' | 'other';

export type EventStatus = 'planning' | 'confirmed' | 'archived';

export interface EventPreferences {
  style: string;
  cateringType: string;
  dietaryRequirements: string[];
  photographyTier: string;
  venuePreference: string;
  decorationPreference: string;
  accessibilityNeeds: string[];
  planningPriorities: string[]; // Ordered list of category IDs (e.g. ['venue', 'catering', ...])
  specialConstraints: string[];
  optionalNotes: string;
}

export interface EventDetails {
  id: string;
  name: string;
  eventType: EventType;
  date: string; // ISO string 'YYYY-MM-DD'
  location: string;
  guestCount: number;
  totalBudget: number; // In minor units (e.g. paise / cents)
  currency: CurrencyCode;
  status: EventStatus;
  preferences: EventPreferences;
  createdAt: string;
  updatedAt: string;
}

export type CostStatus = 'estimated' | 'quoted' | 'confirmed' | 'actual';

export interface BudgetCategory {
  id: string;
  name: string;
  allocatedAmount: number; // In minor units
  userDefined: boolean;
  priorityRank: number; // 1 = highest priority
  perGuestCost?: number; // In minor units (optional variable cost per guest)
  fixedBaseCost?: number; // In minor units (fixed venue or base cost)
  maxCapacity?: number; // Max guest limit (e.g. for venue constraint checking)
  notes?: string;
}

export interface Expense {
  id: string;
  categoryId: string;
  title: string;
  amount: number; // In minor units
  status: CostStatus;
  vendorId?: string;
  quoteId?: string;
  paidAmount: number; // In minor units
  dueDate?: string; // ISO string
  notes?: string;
  createdAt: string;
}

export interface BudgetScenario {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  modifiedGuestCount: number;
  categoryAllocations: Record<string, number>; // categoryId -> allocatedAmount in minor units
  notes: string;
  isBaseline: boolean;
}

export type TaskStatus = 'not_started' | 'in_progress' | 'completed' | 'blocked';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

export interface Task {
  id: string;
  title: string;
  description: string;
  categoryId: string;
  priority: TaskPriority;
  priorityReason: string;
  dueDate: string; // ISO string 'YYYY-MM-DD'
  status: TaskStatus;
  dependencies: string[]; // List of task IDs that MUST be 'completed' before this task can be completed/started
  assignedTo?: string;
  estimatedHours?: number;
  notes?: string;
  completedAt?: string;
  updatedAt?: string;
}

export type VendorQuoteStatus = 'draft' | 'under_review' | 'selected' | 'rejected' | 'expired';

export interface VendorQuote {
  id: string;
  vendorId: string;
  quoteDate: string; // ISO string
  validityDate?: string; // ISO string
  quotedAmount: number; // In minor units
  currency: CurrencyCode;
  status: VendorQuoteStatus;
  includedServices: string[];
  exclusions: string[];
  paymentTerms: string;
  notes?: string;
  isSample: boolean;
}

export interface Vendor {
  id: string;
  name: string;
  categoryId: string;
  contactName: string;
  email: string;
  phone: string;
  website?: string;
  address?: string;
  rating?: number; // e.g. 4.8
  ratingSource?: string; // e.g. 'Verified WeddingWire Review'
  notes?: string;
  isSample: boolean; // Must be true for demo records
  createdAt: string;
}

export type AssistantIntent =
  | 'explain_budget'
  | 'reduce_budget'
  | 'change_guest_count'
  | 'protect_priority'
  | 'find_overdue_tasks'
  | 'explain_blocked_tasks'
  | 'compare_vendor_quotes'
  | 'identify_missing_vendor_info'
  | 'suggest_expense_reductions'
  | 'create_budget_scenario'
  | 'summarize_plan'
  | 'query_event_schedule'
  | 'query_category_budget'
  | 'detect_schedule_conflicts'
  | 'interpret_quote_terms'
  | 'clarify_ambiguous_request'
  | 'refuse_unsupported_request'
  | 'detect_conflicting_constraints'
  | 'unsupported';

export interface FinancialImpact {
  currentEstimatedTotal: number;
  proposedEstimatedTotal: number;
  difference: number;
  remainingBudget: number;
  affectedCategories: string[];
  budgetViolations: string[];
}

export interface ProposedAction {
  id: string;
  type:
    | 'adjust_guest_count'
    | 'rebalance_budget'
    | 'apply_scenario'
    | 'cut_category_budget'
    | 'create_scenario';
  summary: string;
  payload: Record<string, unknown>;
  impact: FinancialImpact;
  affectedTaskIds?: string[];
}

export interface PlanningMessage {
  id: string;
  timestamp: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  intent?: AssistantIntent;
  proposedAction?: ProposedAction;
  requiresConfirmation?: boolean;
  actionStatus?: 'pending' | 'applied' | 'rejected';
  rationale?: string;
  dataGrounding?:
    | 'verified_application_data'
    | 'derived_estimate'
    | 'missing_information'
    | 'unsupported_request'
    | 'ambiguous_clarification';
  languageDetected?: 'en' | 'bn' | 'benglish';
}

export interface ChangeRecord {
  id: string;
  timestamp: string;
  changeType: 'budget' | 'task' | 'vendor' | 'guest_count' | 'scenario' | 'setup' | 'invitation' | 'guest' | 'timeline' | 'seating';
  description: string;
  deltaSummary?: string;
}

// ==========================================
// V2 INVITATION STUDIO TYPES
// ==========================================

export type InvitationTemplateId =
  | 'botanical-embroidery'
  | 'embossed-botanical'
  | 'forest-sage'
  | 'minimal-editorial'
  | 'celebration-classic';

export type PrintSize = 'a5' | 'a6' | '5x7' | 'a4-sheet';

export type PaperPalette =
  | 'cream-terracotta'
  | 'forest-gold'
  | 'sage-blush'
  | 'pearl-charcoal'
  | 'terracotta-sand';

export interface InvitationDesign {
  id: string;
  eventId: string;
  name: string;
  templateId: InvitationTemplateId;
  printSize: PrintSize;
  palette: PaperPalette;
  title: string;
  hostNames: string;
  invitationHeading: string;
  bodyText: string;
  eventDate: string;
  startTime: string;
  venueName: string;
  venueAddress: string;
  rsvpDeadline: string;
  contactInfo: string;
  dressCode?: string;
  additionalDetails?: string;
  isBilingual?: boolean;
  bilingualLanguage?: 'bn' | 'hi' | 'es' | 'fr';
  bilingualTitle?: string;
  bilingualHeading?: string;
  bilingualBody?: string;
  bilingualDate?: string;
  bilingualVenue?: string;
  bilingualFooter?: string;
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// V2 GUEST LIST & RSVP TYPES
// ==========================================

export type RsvpStatus = 'pending' | 'accepted' | 'declined';

export interface GuestRecord {
  id: string;
  eventId: string;
  name: string;
  email?: string;
  phone?: string;
  householdGroup?: string;
  partySize: number;
  confirmedCount: number;
  rsvpStatus: RsvpStatus;
  dietaryNotes?: string;
  accessibilityRequirements?: string;
  invitationToken: string;
  tokenRevoked?: boolean;
  tokenExpiresAt?: string;
  tableId?: string;
  notes?: string;
  respondedAt?: string;
  updatedAt: string;
}

// ==========================================
// V2 EVENT-DAY TIMELINE & RUN SHEET TYPES
// ==========================================

export interface TimelineItem {
  id: string;
  eventId: string;
  time: string; // e.g. "16:00" or "04:00 PM"
  endTime?: string;
  activity: string;
  durationMinutes: number;
  assignedPerson?: string;
  vendorId?: string;
  location?: string;
  notes?: string;
  orderIndex: number;
}

// ==========================================
// V2 SEATING & TABLE PLANNER TYPES
// ==========================================

export interface SeatingTable {
  id: string;
  eventId: string;
  name: string;
  capacity: number;
  shape: 'round' | 'rectangular' | 'oval';
  assignedGuestIds: string[];
  notes?: string;
}

export interface AppState {
  event: EventDetails;
  categories: BudgetCategory[];
  expenses: Expense[];
  scenarios: BudgetScenario[];
  activeScenarioId?: string;
  tasks: Task[];
  vendors: Vendor[];
  quotes: VendorQuote[];
  messages: PlanningMessage[];
  changeLog: ChangeRecord[];
  schemaVersion: number;
  // V2 Slices (Backward compatible and optional)
  invitations?: InvitationDesign[];
  guests?: GuestRecord[];
  timeline?: TimelineItem[];
  tables?: SeatingTable[];
}

// ==========================================
// REMOTE COLLABORATION & EMAIL AUDIT TYPES
// ==========================================

export interface RemoteEventSummary {
  id: string;
  name: string;
  role: 'owner' | 'editor' | 'viewer';
  version: number;
  updatedAt: string;
}

export interface RemoteEventRecord {
  id: string;
  ownerId: string;
  version: number;
  state: AppState;
  members: Array<{
    userId: string;
    userName: string;
    userEmail: string;
    role: 'owner' | 'editor' | 'viewer';
    joinedAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
  lastModifiedBy: string;
  role?: 'owner' | 'editor' | 'viewer';
  success?: boolean;
}

export type EmailDeliveryStatus =
  | 'queued'
  | 'sent'
  | 'simulated'
  | 'delivered'
  | 'failed'
  | 'rejected';

export interface EmailDeliveryRecord {
  id: string;
  eventId: string;
  vendorId: string;
  recipientEmail: string;
  subject: string;
  status: EmailDeliveryStatus;
  provider: string;
  providerMessageId?: string;
  previewUrl?: string;
  dispatchedAt: string;
  dispatchedBy: string;
  idempotencyKey?: string;
  attempts: number;
  replyTo?: string;
  htmlBody?: string;
  error?: string;
}

