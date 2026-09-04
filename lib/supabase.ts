import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Card = {
  id: string;
  name: string;
  handle: string;
  title: string | null;
  company: string | null;
  phone: string | null;
  email: string | null;
  whatsapp: string | null;
  website: string | null;
  photo_url: string | null;
  logo_url: string | null;
  video_url: string | null;
  upi_id: string | null;
  bio: string | null;
  views: number;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
};

export type Contact = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  job_title: string | null;
  tags: string[];
  notes: string | null;
  card_id: string | null;
  created_at: string;
};

export type Lead = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  source: 'qr' | 'website' | 'manual' | 'referral';
  status: 'new' | 'contacted' | 'converted' | 'lost';
  card_id: string | null;
  notes: string | null;
  created_at: string;
};

export type Review = {
  id: string;
  reviewer_name: string;
  rating: number;
  comment: string | null;
  card_id: string | null;
  source: 'google' | 'facebook' | 'justdial' | 'whatsapp' | 'direct' | 'campaign' | 'other';
  status: 'public' | 'need_attention' | 'hidden' | 'resolved';
  tags: string[];
  ai_reply: string | null;
  ai_reply_at: string | null;
  business_reply: string | null;
  reply_at: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  campaign_id: string | null;
  routed_to: string | null;
  google_redirect_clicked: boolean;
  follow_up_status: 'none' | 'pending' | 'contacted' | 'resolved';
  follow_up_notes: string | null;
  follow_up_at: string | null;
  company_id: string | null;
  created_at: string;
};

export type Payment = {
  id: string;
  amount: number;
  plan: string;
  status: 'paid' | 'pending' | 'refunded';
  method: string;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  razorpay_signature: string | null;
  created_at: string;
};

export type BusinessProfile = {
  id: string;
  business_name: string;
  tagline: string | null;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  owner_name: string | null;
  owner_title: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  about: string | null;
  facebook: string | null;
  instagram: string | null;
  twitter: string | null;
  linkedin: string | null;
  youtube: string | null;
  google_business: string | null;
  review_slug: string | null;
  review_heading: string | null;
  review_subheading: string | null;
  review_background_color: string | null;
  review_thank_you_message: string | null;
  company_id: string | null;
  created_at: string;
  updated_at: string;
};

export type Poster = {
  id: string;
  title: string;
  template: string;
  headline: string | null;
  subheadline: string | null;
  offer_text: string | null;
  cta_text: string;
  background_color: string;
  text_color: string;
  image_prompt: string | null;
  image_url: string | null;
  status: 'draft' | 'published';
  created_at: string;
  updated_at: string;
};

export type Website = {
  id: string;
  site_name: string;
  domain: string | null;
  slug: string | null;
  template: string;
  is_published: boolean;
  sections: string[];
  hero_title: string | null;
  hero_subtitle: string | null;
  hero_image: string | null;
  services: string | null;
  gallery: string | null;
  company_id: string | null;
  created_at: string;
  updated_at: string;
};

export type MarketplaceListing = {
  id: string;
  title: string;
  category: 'template' | 'service' | 'addon' | 'theme';
  description: string | null;
  price: number;
  image_url: string | null;
  creator: string | null;
  rating: number;
  downloads: number;
  status: 'active' | 'inactive';
  created_at: string;
};

export type Product = {
  id: string;
  card_id: string | null;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  category: string | null;
  is_available: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type ReviewRequest = {
  id: string;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  channel: 'whatsapp' | 'sms' | 'email' | 'qr' | 'link';
  status: 'pending' | 'sent' | 'opened' | 'completed' | 'failed';
  rating: number | null;
  review_id: string | null;
  company_id: string | null;
  created_at: string;
  updated_at: string;
};

export type ReviewTemplate = {
  id: string;
  name: string;
  channel: 'whatsapp' | 'sms' | 'email';
  subject: string | null;
  body: string;
  is_default: boolean;
  company_id: string | null;
  created_at: string;
  updated_at: string;
};

export type PlanConfig = {
  id: string;
  name: string;
  price: number;
  original_price: number | null;
  period: string;
  features: string[];
  badge: string | null;
  highlight: boolean;
  trial_note: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type AdminSettings = {
  id: string;
  admin_email: string;
  admin_password_hash?: string;
  allow_registrations: boolean;
  auto_approve_cards: boolean;
  maintenance_mode: boolean;
  platform_version: string;
  created_at: string;
  updated_at: string;
};

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: 'Owner' | 'Admin' | 'Editor' | 'Viewer';
  status: 'active' | 'invited' | 'suspended';
  created_at: string;
  updated_at: string;
};

export type UserSettings = {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  bio: string;
  email_alerts: boolean;
  lead_alerts: boolean;
  review_alerts: boolean;
  weekly_report: boolean;
  dark_mode: boolean;
  language: string;
  timezone: string;
  created_at: string;
  updated_at: string;
};

export type QRCode = {
  id: string;
  card_id: string;
  label: string;
  scans: number;
  qr_type: 'card' | 'review';
  company_id: string | null;
  created_at: string;
};

export type BrandKit = {
  id: string;
  company_id: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  font_family: string;
  preferred_style: string;
  preferred_language: string;
  created_at: string;
  updated_at: string;
};

export type AiTemplate = {
  id: string;
  name: string;
  category: string;
  industry: string | null;
  occasion: string | null;
  aspect_ratio: string;
  is_system: boolean;
  template_def: Record<string, any>;
  thumbnail_url: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type AiProject = {
  id: string;
  company_id: string;
  created_by: string | null;
  title: string;
  prompt: string | null;
  creative_brief: Record<string, any> | null;
  template_id: string | null;
  status: string;
  language: string;
  aspect_ratio: string;
  final_image_url: string | null;
  final_composition: Record<string, any> | null;
  created_at: string;
  updated_at: string;
};

export type AiAsset = {
  id: string;
  project_id: string;
  company_id: string;
  type: string;
  source: string;
  image_url: string;
  prompt: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
};

export type AiCreation = {
  id: string;
  company_id: string;
  project_id: string | null;
  created_by: string | null;
  title: string;
  type: string;
  image_url: string;
  composition_data: Record<string, any> | null;
  aspect_ratio: string;
  language: string;
  created_at: string;
};

export type CreativeBrief = {
  occasion: string;
  industry: string;
  purpose: string;
  tone: string;
  visual_subject: string;
  style: string;
  composition: string;
  aspect_ratio: string;
  text_space: string;
};

export type ReviewCampaign = {
  id: string;
  company_id: string | null;
  name: string;
  description: string | null;
  question: string | null;
  is_active: boolean;
  slug: string | null;
  google_review_url: string | null;
  created_at: string;
  updated_at: string;
};

export type AiPlannerResponse = {
  creative_brief: CreativeBrief;
  image_prompt: string;
  copy: {
    headline: string;
    subheadline: string;
    offer_text: string;
    cta_text: string;
  };
  recommended_templates: string[];
  concepts: { name: string; style: string; image_prompt: string }[];
};
