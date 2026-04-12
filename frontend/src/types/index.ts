export interface User {
  id: string;
  email: string;
  name: string | null;
  onboarding_completed: boolean;
  onboarding_step: number;
  nylas_grant_id: string | null;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface UserProfile {
  id: string;
  parsed_skills: { technical: string[]; soft: string[] } | null;
  parsed_experience: Experience[] | null;
  parsed_projects: Project[] | null;
  parsed_education: Education[] | null;
  proof_points: ProofPoint[] | null;
  soft_profile: SoftProfile | null;
  what_they_bring: string | null;
  preferred_roles: string[] | null;
  preferred_stages: string[] | null;
  preferred_sectors: string[] | null;
  location: string | null;
  open_to_relocation: boolean;
  visa_status: string | null;
  tone_formal: number;
  tone_technical: number;
  interview_completed: boolean;
  interview_turns: number;
}

export interface Experience {
  company: string;
  role: string;
  duration_months: number;
  start_date: string;
  end_date: string;
  description: string;
  tech_used: string[];
}

export interface Project {
  name: string;
  description: string;
  tech: string[];
  url: string;
  context: string;
}

export interface Education {
  institution: string;
  degree: string;
  field: string;
  year: string;
}

export interface ProofPoint {
  title: string;
  project: string;
  problem: string;
  impact: string;
  tech: string[];
  context: string;
  highlight: boolean;
}

export interface SoftProfile {
  personality: string;
  communication_style: string;
  core_motivations: string[];
  ambitions: { short_term: string; long_term: string };
  differentiators: string[];
}

export interface Company {
  id: string;
  name: string;
  website: string | null;
  linkedin_url: string | null;
  stage: string | null;
  funding_amount_usd: number | null;
  funding_date: string | null;
  investors: string[] | null;
  sector: string[] | null;
  hq_location: string | null;
  headcount: number | null;
  tech_stack: string[] | null;
  hiring_score: number;
  research_summary: string | null;
  source: string | null;
  source_batch: string | null;
  contact_count: number;
  created_at: string | null;
}

export interface CompanyResearch {
  recent_news: NewsItem[] | null;
  blog_posts: BlogPost[] | null;
  founder_posts: FounderPost[] | null;
  product_updates: ProductUpdate[] | null;
  job_postings: JobPosting[] | null;
}

export interface NewsItem { headline: string; url: string; date: string; summary: string; }
export interface BlogPost { title: string; url: string; date: string; summary: string; }
export interface FounderPost { author: string; content: string; date: string; }
export interface ProductUpdate { title: string; date: string; summary: string; }
export interface JobPosting { title: string; url: string; department?: string; date: string; }

export interface Contact {
  id: string;
  name: string;
  role: string | null;
  seniority: string | null;
  linkedin_url: string | null;
  professional_email: string | null;
  personal_email: string | null;
  email_confidence_score: number | null;
  is_new_recruit: boolean;
  tenure_months: number | null;
  is_founder: boolean;
  recent_posts: unknown[] | null;
}

export interface CompanyDetail {
  company: Company;
  research: CompanyResearch | null;
  contacts: Contact[];
}

export interface Campaign {
  id: string;
  company_id: string;
  company_name: string | null;
  status: string;
  tone_settings: { formal: number; technical: number } | null;
  created_at: string | null;
  last_activity_at: string | null;
  next_followup_at: string | null;
  email_count: number;
  draft_count: number;
  sent_count: number;
  opened_count: number;
  replied_count: number;
}

export interface OutreachEmail {
  id: string;
  campaign_id: string;
  contact_id: string;
  contact_name: string | null;
  contact_role: string | null;
  contact_email: string | null;
  contact_is_founder: boolean;
  contact_is_new_recruit: boolean;
  subject: string | null;
  body: string | null;
  subject_options: string[] | null;
  tone_settings: { formal: number; technical: number } | null;
  relevance_score: number | null;
  relevant_projects: ProofPoint[] | null;
  hook_used: string | null;
  status: string;
  followup_number: number;
  sent_at: string | null;
  opened_at: string | null;
  replied_at: string | null;
  created_at: string | null;
}

export interface CampaignDetail {
  campaign: Campaign;
  emails: OutreachEmail[];
  company: Company | null;
}

export interface Signal {
  id: string;
  post_url: string | null;
  post_content: string | null;
  author_name: string | null;
  author_linkedin: string | null;
  signal_type: string | null;
  company_name: string | null;
  company_id: string | null;
  resolved: boolean;
  detected_at: string | null;
}

export interface JobListingItem {
  id: string;
  title: string;
  url: string;
  description: string | null;
  location: string | null;
  employment_type: string | null;
  remote_ok: boolean | null;
  source: string | null;
  posted_at: string | null;
  company_name: string | null;
}

export interface PipelineColumn {
  status: string;
  label: string;
  cards: PipelineCard[];
}

export interface PipelineCard {
  email_id: string;
  campaign_id: string;
  company_name: string;
  contact_name: string;
  contact_role: string | null;
  status: string;
  last_activity: string | null;
  next_followup: string | null;
  followup_number: number;
}

export interface Analytics {
  total_sent: number;
  total_opened: number;
  total_replied: number;
  total_bounced: number;
  total_draft: number;
  open_rate: number;
  reply_rate: number;
  active_campaigns: number;
  companies_discovered: number;
  signals_detected: number;
  profile_completeness: number;
  daily_sends: { date: string; count: number }[];
  top_campaigns: { campaign_id: string; company_name: string; sent: number; opened: number; replied: number; reply_rate: number }[];
}

export interface ActivityLog {
  id: string;
  actor: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
}

export interface ConversationTurn {
  role: string;
  content: string;
  created_at: string;
}

export interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  last_message: string | null;
}

export interface ChatMessage {
  id: string;
  role: string;
  content: string;
  created_at: string;
}

export interface InterviewTranscript {
  id: string;
  session_type: string;
  raw_transcript: string;
  analyzed_qa: InterviewQA[] | null;
  analysis_summary: Record<string, unknown> | null;
  duration_seconds: number | null;
  created_at: string;
}

export interface InterviewQA {
  question: string;
  answer: string;
  key_insights: string[];
}

export interface OnboardingStatus {
  onboarding_completed: boolean;
  onboarding_step: number;
  has_cv: boolean;
  has_linkedin: boolean;
  has_interview: boolean;
}

export interface ProcessingEvent {
  step: string;
  status: "in_progress" | "done" | "error" | "skipped";
  message: string;
  data?: Record<string, unknown>;
  timestamp?: string;
}

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  message: string | null;
  metadata_json: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string | null;
}

export interface SearchJob {
  id: string;
  status: "pending" | "running" | "completed" | "failed";
  parameters: DeepSearchParams | null;
  result_summary: string | null;
  companies_found: number;
  error_message: string | null;
  created_at: string | null;
  completed_at: string | null;
}

export interface DeepSearchParams {
  company_count: number;
  location: string;
  recency: string;
  sector: string;
}
