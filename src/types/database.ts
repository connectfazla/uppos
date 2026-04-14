export type UserRole = "admin" | "team" | "client";
export type ClientStatus = "lead" | "active" | "paused" | "inactive";
export type RetainerStatus = "active" | "paused" | "cancelled";
export type InvoiceStatus = "paid" | "unpaid" | "overdue";

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: UserRole;
  client_id: string | null;
  created_at: string;
  updated_at: string;
};

export type Client = {
  id: string;
  company_name: string;
  status: ClientStatus;
  assigned_manager: string | null;
  created_at: string;
  archived_at: string | null;
};

export type Contact = {
  id: string;
  client_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  created_at: string;
};

export type Retainer = {
  id: string;
  client_id: string;
  name: string;
  monthly_fee: number;
  start_date: string;
  renewal_date: string;
  billing_cycle: string;
  status: RetainerStatus;
  created_at: string;
  updated_at: string;
};

export type RetainerDeliverable = {
  id: string;
  retainer_id: string;
  platform: string;
  number_of_posts: number;
  campaigns: number;
  notes: string | null;
  created_at: string;
};

export type Contract = {
  id: string;
  client_id: string;
  retainer_id: string | null;
  contract_url: string | null;
  storage_path: string | null;
  signed_status: string;
  signed_date: string | null;
  created_at: string;
};

export type Invoice = {
  id: string;
  client_id: string;
  retainer_id: string | null;
  amount: number;
  due_date: string;
  status: InvoiceStatus;
  invoice_link: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Payment = {
  id: string;
  invoice_id: string;
  amount_paid: number;
  payment_date: string;
  method: string;
  reference_note: string | null;
  created_at: string;
};
