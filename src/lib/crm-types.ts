/* ─── Teacher Management Types ─── */

export type TeacherStatus = 'active' | 'on_leave' | 'terminated';
export type EmploymentType = 'full_time' | 'part_time' | 'contract';
export type SalaryFrequency = 'monthly' | 'weekly' | 'hourly';
export type TeacherLeaveType = 'sick' | 'vacation' | 'unpaid' | 'other';
export type SalaryPaymentMethod = 'cash' | 'bank_transfer' | 'cheque' | 'other';

export interface Teacher {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  date_of_birth: string | null;
  department: string | null;
  subject: string | null;
  join_date: string | null;
  employment_type: EmploymentType;
  status: TeacherStatus;
  base_salary: number | null;
  salary_frequency: SalaryFrequency;
  notes: string | null;
}

export interface TeacherSalaryPayment {
  id: string;
  teacher_id: string;
  created_at: string;
  date: string;
  amount: number;
  method: SalaryPaymentMethod;
  notes: string | null;
}

export interface TeacherLeave {
  id: string;
  teacher_id: string;
  created_at: string;
  date: string;
  leave_type: TeacherLeaveType;
  notes: string | null;
}

export const TEACHER_STATUS_META: Record<TeacherStatus, { label: string; color: string; bg: string }> = {
  active:     { label: 'Active',      color: '#10b981', bg: '#ecfdf5' },
  on_leave:   { label: 'On Leave',    color: '#f59e0b', bg: '#fffbeb' },
  terminated: { label: 'Terminated',  color: '#ef4444', bg: '#fef2f2' },
};

export const EMPLOYMENT_TYPES: { value: EmploymentType; label: string }[] = [
  { value: 'full_time', label: 'Full-time' },
  { value: 'part_time', label: 'Part-time' },
  { value: 'contract',  label: 'Contract' },
];

export const SALARY_FREQUENCIES: { value: SalaryFrequency; label: string }[] = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'weekly',  label: 'Weekly' },
  { value: 'hourly',  label: 'Hourly' },
];

export const TEACHER_LEAVE_TYPES: { value: TeacherLeaveType; label: string; color: string; bg: string }[] = [
  { value: 'sick',     label: 'Sick',     color: '#ef4444', bg: '#fef2f2' },
  { value: 'vacation', label: 'Vacation', color: '#3b82f6', bg: '#eff6ff' },
  { value: 'unpaid',   label: 'Unpaid',   color: '#f59e0b', bg: '#fffbeb' },
  { value: 'other',    label: 'Other',    color: '#6b7280', bg: '#f3f4f6' },
];

export const SALARY_PAYMENT_METHODS: { value: SalaryPaymentMethod; label: string }[] = [
  { value: 'cash',          label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cheque',        label: 'Cheque' },
  { value: 'other',         label: 'Other' },
];

/* ─── CRM Student Management Types ─── */

export type DataSource = 'hubspot_import' | 'crm_native' | 'google_ads' | 'meta_ads' | 'whatsapp' | 'walk_in';
export type RetargetChannel = 'google_ads' | 'meta_ads' | 'whatsapp' | 'email' | 'phone' | 'sms';
export type PipelineStatus =
  | 'New'
  | 'Attempted to student'
  | 'Appointment'
  | 'Hot'
  | 'Warm'
  | 'Cold'
  | 'Bad timing'
  | 'In pipeline'
  | 'Enrolled'
  | 'Inservice'
  | 'Too far to attend'
  | 'No legal status'
  | 'Opted out'
  | 'Dead';
export type ReferralType = 'alumni' | 'current_student' | 'partner_org' | 'staff' | 'other' | 'none';
export type ActivityChannel = 'google_ads' | 'meta_ads' | 'whatsapp' | 'email' | 'phone' | 'sms' | 'in_person' | 'other';
export type DocumentType = 'application' | 'transcript' | 'ID' | 'enrollment_agreement' | 'financial_aid' | 'other';
export type DocumentStatus = 'pending' | 'received' | 'approved' | 'rejected' | 'N/A';
export type PaymentStatus = 'current' | 'overdue' | 'paid_in_full' | 'N/A';
export type PaymentMethod = 'cash' | 'check' | 'credit_card' | 'debit_card' | 'bank_transfer' | 'financial_aid' | 'other';
export type LeadType = 'form' | 'landing_page' | 'phone_call' | 'walk_in' | 'import' | 'manual';

export interface Student {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  standard: string | null; // Represents standard/class
  language: string;
  data_source: DataSource;
  retarget_count: number;
  retarget_channel: RetargetChannel | null;
  last_retarget_date: string | null;
  upsell_flag: boolean;
  upsell_product: string | null;
  touch_count: number;
  notes: string | null;
  referral_type: ReferralType;
  referrer_name: string | null;
  referrer_student_id: string | null;
  import_batch_id: string | null;
  hubspot_original_data: Record<string, unknown> | null;

  // Ad & campaign tracking
  campaign_id: string | null;
  campaign_name: string | null;
  ad_group_id: string | null;
  ad_group_name: string | null;
  keyword: string | null;
  device: string | null;
  gclid: string | null;
  google_lead_id: string | null;
  lead_type: LeadType | null;

  // UTM tracking
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_keyword: string | null;

  // Call tracking
  call_duration: number | null;
  call_timestamp: string | null;

  // Messaging
  last_message_at: string | null;

  // First outbound student attribution
  first_contacted_by: number | null;
  first_contacted_at: string | null;

  // Sales pipeline
  pipeline_status: PipelineStatus;

  // Preferred class shift
  shift: 'AM' | 'PM' | null;

  // Email broadcast opt-out
  email_opt_out?: boolean;
  unsubscribe_token?: string | null;

  // SendGrid sync + suppression signals
  sendgrid_student_id?: string | null;
  email_bounced?: boolean;
  email_bounce_reason?: string | null;
  email_bounce_at?: string | null;
  email_spam_reported?: boolean;
  email_last_delivered_at?: string | null;
  email_last_opened_at?: string | null;
  email_last_clicked_at?: string | null;
}

export interface ActivityLog {
  id: string;
  student_id: string;
  created_at: string;
  date: string;
  channel: ActivityChannel;
  message_type: string | null;
  response: string | null;
  outcome: string | null;
  notes: string | null;
}

export interface StudentDocument {
  id: string;
  student_id: string;
  created_at: string;
  document_type: DocumentType;
  document_status: DocumentStatus;
  upload_date: string | null;
  file_url: string | null;
  file_name: string | null;
  notes: string | null;
}

export interface StudentPayment {
  id: string;
  student_id: string;
  created_at: string;
  total_tuition: number | null;
  payment_plan: boolean;
  amount_paid: number;
  outstanding_balance: number | null;
  scholarship_discount: number;
  payment_status: PaymentStatus;
  notes: string | null;
}

export interface PaymentHistoryEntry {
  id: string;
  payment_id: string;
  student_id: string;
  created_at: string;
  date: string;
  amount: number;
  method: PaymentMethod | null;
  notes: string | null;
}

/* ─── Messages ─── */

export type MessageDirection = 'inbound' | 'outbound';
export type MessageChannel = 'whatsapp' | 'sms' | 'email';
export type MessageStatus = 'queued' | 'sent' | 'delivered' | 'read' | 'failed' | 'undelivered';

export interface Message {
  id: string;
  student_id: string;
  created_at: string;
  direction: MessageDirection;
  channel: MessageChannel;
  body: string;
  template_name: string | null;
  status: MessageStatus;
  twilio_sid: string | null;
  from_number: string | null;
  to_number: string | null;
}

/* ─── Lead Classification ─── */

export type LeadClassification = 'ready_to_sign_up' | 'ready_to_book' | 'interested_follow_up' | 'not_interested';

export const LEAD_CLASSIFICATIONS: { value: LeadClassification; label: string; color: string; bg: string }[] = [
  { value: 'ready_to_sign_up', label: 'Ready to Sign Up', color: '#10b981', bg: '#ecfdf5' },
  { value: 'ready_to_book', label: 'Ready to Book Appt', color: '#3b82f6', bg: '#eff6ff' },
  { value: 'interested_follow_up', label: 'Interested — Follow Up', color: '#f59e0b', bg: '#fffbeb' },
  { value: 'not_interested', label: 'Not Interested', color: '#ef4444', bg: '#fef2f2' },
];

/* ─── Constants ─── */

// Brand-colored source pills. Each entry includes a foreground `color` and a
// light `bg` so the source badge in the students list matches the channel's
// real-world brand. `walk_in` is intentionally omitted — we no longer accept
// walk-in leads. The DataSource type still includes 'walk_in' so any legacy
// rows render with a neutral fallback instead of crashing.
export const DATA_SOURCES: { value: DataSource; label: string; color: string; bg: string }[] = [
  { value: 'hubspot_import', label: 'Old Business', color: '#64748b', bg: '#f1f5f9' },
  { value: 'crm_native',     label: 'CRM Native',   color: '#6366f1', bg: '#eef2ff' },
  { value: 'google_ads',     label: 'Google Ads',   color: '#EA4335', bg: '#fde8e6' },
  { value: 'meta_ads',       label: 'Meta Ads',     color: '#1877F2', bg: '#e7f0fd' },
  { value: 'whatsapp',       label: 'WhatsApp',     color: '#25D366', bg: '#e6f8ed' },
];

export const PIPELINE_STATUSES: { value: PipelineStatus; label: string; color: string; bg: string }[] = [
  { value: 'New',                  label: 'New',                  color: '#0170B9', bg: '#e8f4fb' },
  { value: 'Attempted to student', label: 'Attempted to student', color: '#3b82f6', bg: '#eff6ff' },
  { value: 'Appointment',          label: 'Appointment',          color: '#8b5cf6', bg: '#f5f3ff' },
  { value: 'Hot',                  label: 'Hot',                  color: '#ef4444', bg: '#fef2f2' },
  { value: 'Warm',                 label: 'Warm',                 color: '#f97316', bg: '#fff7ed' },
  { value: 'Cold',                 label: 'Cold',                 color: '#64748b', bg: '#f1f5f9' },
  { value: 'Bad timing',           label: 'Bad timing',           color: '#eab308', bg: '#fefce8' },
  { value: 'In pipeline',          label: 'In pipeline',          color: '#6366f1', bg: '#eef2ff' },
  { value: 'Enrolled',             label: 'Enrolled',             color: '#10b981', bg: '#ecfdf5' },
  { value: 'Inservice',            label: 'Inservice',            color: '#14b8a6', bg: '#f0fdfa' },
  { value: 'Too far to attend',    label: 'Too far to attend',    color: '#9ca3af', bg: '#f3f4f6' },
  { value: 'No legal status',      label: 'No legal status',      color: '#f59e0b', bg: '#fffbeb' },
  { value: 'Opted out',            label: 'Opted out',            color: '#78716c', bg: '#f5f5f4' },
  { value: 'Dead',                 label: 'Dead',                 color: '#dc2626', bg: '#fee2e2' },
];

/** Lead statuses considered "active" leads (used by Inbox/Appointments/Students "Leads" filter). */
export const ACTIVE_LEAD_STATUSES: PipelineStatus[] = [
  'New',
  'Attempted to student',
  'Appointment',
  'Hot',
  'Warm',
  'Cold',
  'Bad timing',
  'In pipeline',
  'Too far to attend',
  'No legal status',
];

export const ACTIVITY_CHANNELS: { value: ActivityChannel; label: string }[] = [
  { value: 'phone', label: 'Phone' },
  { value: 'email', label: 'Email' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'sms', label: 'SMS' },
  { value: 'in_person', label: 'In Person' },
  { value: 'google_ads', label: 'Google Ads' },
  { value: 'meta_ads', label: 'Meta Ads' },
  { value: 'other', label: 'Other' },
];

export const DOCUMENT_TYPES: { value: DocumentType; label: string }[] = [
  { value: 'application', label: 'Application' },
  { value: 'transcript', label: 'Transcript' },
  { value: 'ID', label: 'ID' },
  { value: 'enrollment_agreement', label: 'Enrollment Agreement' },
  { value: 'financial_aid', label: 'Financial Aid' },
  { value: 'other', label: 'Other' },
];

export const DOCUMENT_STATUSES: { value: DocumentStatus; label: string; color: string; bg: string }[] = [
  { value: 'pending', label: 'Pending', color: '#f59e0b', bg: '#fffbeb' },
  { value: 'received', label: 'Received', color: '#3b82f6', bg: '#eff6ff' },
  { value: 'approved', label: 'Approved', color: '#10b981', bg: '#ecfdf5' },
  { value: 'rejected', label: 'Rejected', color: '#ef4444', bg: '#fef2f2' },
  { value: 'N/A', label: 'N/A', color: '#6b7280', bg: '#f3f4f6' },
];

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'check', label: 'Check' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'debit_card', label: 'Debit Card' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'financial_aid', label: 'Financial Aid' },
  { value: 'other', label: 'Other' },
];

