// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// ============================================================================
// USER & AUTH TYPES
// ============================================================================

export interface User {
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  distributor_id?: string;
  phone?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type UserRole = 'super_admin' | 'admin' | 'finance' | 'inventory' | 'driver' | 'customer';

export interface UserProfile {
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  distributor_id?: string;
  phone?: string;
  is_active: boolean;
}

export interface CreateUserRequest {
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  distributor_id?: string;
  phone?: string;
  password?: string;
}

export interface UpdateUserRequest {
  first_name?: string;
  last_name?: string;
  role?: UserRole;
  distributor_id?: string;
  phone?: string;
  is_active?: boolean;
}

// ============================================================================
// CUSTOMER TYPES
// ============================================================================

export interface CustomerContact {
  contact_id?: string;
  customer_id?: string;
  name: string;
  phone: string; // always present
  email: string; // always present
  is_primary: boolean;
  created_at?: string;
}

export interface CustomerCylinderDiscount {
  discount_id?: string;
  customer_id?: string;
  cylinder_type_id: string;
  per_kg_discount: number;
  effective_from: string; // always present
  cylinder_type_name?: string;
  weight_kg?: number;
  capacity_kg?: number; // add for frontend compatibility
}

export interface Customer {
  customer_id: string;
  customer_code?: string;
  business_name: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state: string;
  postal_code?: string;
  country?: string;
  credit_limit?: string;
  credit_period_days?: string;
  payment_terms?: string;
  discount?: string;
  billing_address_line1?: string;
  billing_address_line2?: string;
  billing_city?: string;
  billing_state?: string;
  billing_pincode?: string;
  billing_state_code?: string;
  gstin?: string;
  trade_name?: string;
  state_code?: string;
  preferred_driver_id?: string;
  enable_grace_cylinder_recovery?: boolean;
  grace_period_cylinder_recovery_days?: number;
  contacts?: CustomerContact[];
  cylinder_discounts?: CustomerCylinderDiscount[];
  status?: string;
  created_at?: string;
}

export interface CreateCustomerRequest extends Omit<Customer, 'customer_id' | 'contacts' | 'cylinder_discounts'> {
  contacts: CustomerContact[];
  cylinder_discounts: CustomerCylinderDiscount[];
}

export interface UpdateCustomerRequest extends Partial<Omit<Customer, 'customer_id' | 'contacts' | 'cylinder_discounts'>> {
  contacts?: CustomerContact[];
  cylinder_discounts?: CustomerCylinderDiscount[];
}

export interface CustomerModificationRequest {
  request_id: string;
  customer_id: string;
  field_name: string;
  old_value: string;
  new_value: string;
  requested_by: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  customer: Customer;
  // Legacy field for backward compatibility
  field?: string;
}

// ============================================================================
// CYLINDER TYPES
// ============================================================================

export interface CylinderType {
  cylinder_type_id: string;
  name: string;
  weight_kg?: number;
  capacity: number;
  unit_price: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Legacy field for backward compatibility
  capacity_kg?: number;
}

export interface CylinderPrice {
  price_id: string;
  cylinder_type_id: string;
  unit_price: number;
  effective_from: string;
  effective_to?: string;
  created_by: string;
  created_at: string;
  cylinder_type_name?: string;
}

export interface CreateCylinderPriceRequest {
  cylinder_type_id: string;
  unit_price: number;
  effective_from: string;
}

// ============================================================================
// ORDER TYPES
// ============================================================================

export interface OrderItem {
  order_item_id?: string;
  cylinder_type_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  cylinder_type_name?: string;
  // Delivery tracking fields
  delivered_quantity?: number;
  empties_collected?: number;
}

export interface Order {
  order_id: string;
  customer_id: string;
  distributor_id: string;
  order_number: string;
  order_date: string;
  delivery_date: string;
  status: OrderStatus;
  total_amount: number;
  notes?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  items: OrderItem[];
  // Additional fields from joins
  customer_name?: string;
  customer_phone?: string;
  customer_address?: string;
  distributor_name?: string;
}

export type OrderStatus = 'pending' | 'confirmed' | 'in_transit' | 'delivered' | 'cancelled' | 'returned' | 'processing' | 'modified delivered';

export interface CreateOrderRequest {
  customer_id: string;
  distributor_id: string;
  delivery_date: string;
  notes?: string;
  items: Array<{
    cylinder_type_id: string;
    quantity: number;
  }>;
}

export interface UpdateOrderRequest {
  delivery_date?: string;
  notes?: string;
  items?: Array<{
    cylinder_type_id: string;
    quantity: number;
  }>;
}

export interface OrderStatusChangeRequest {
  status: OrderStatus;
  delivered_quantities?: Record<string, number>;
  empties_collected?: Record<string, number>;
  notes?: string;
}

// ============================================================================
// INVENTORY TYPES
// ============================================================================

export interface InventorySummary {
  cylinder_type: string;
  opening_fulls: number;
  opening_empties: number;
  ac4_qty: number;
  erv_qty: number;
  soft_blocked_qty: number;
  delivered_qty: number;
  collected_empties_qty: number;
  customer_unaccounted: number;
  inventory_unaccounted: number;
  closing_fulls: number;
  closing_empties: number;
  threshold?: number; // Add this line
}

export interface InventoryAdjustment {
  adjustment_id: string;
  summary_id: string;
  cylinder_type_id: string;
  adjustment_type: 'lost' | 'found' | 'damaged' | 'correction';
  quantity: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  requested_by: string;
  approved_by?: string;
  created_at: string;
  updated_at: string;
  cylinder_type_name?: string;
  requester_name?: string;
  approver_name?: string;
}

export interface InventoryReplenishment {
  replenishment_id: string;
  distributor_id: string;
  cylinder_type_id: string;
  quantity: number;
  status: 'pending' | 'approved' | 'rejected' | 'received';
  requested_by: string;
  approved_by?: string;
  received_at?: string;
  created_at: string;
  updated_at: string;
  cylinder_type_name?: string;
  requester_name?: string;
  approver_name?: string;
}

export interface CustomerInventorySummary {
  customer_id: string;
  cylinder_type_id: string;
  cylinder_type_name: string;
  with_customer_qty: number;
  pending_returns: number;
  missing_qty: number;
  last_updated: string;
}

export interface AdminOverrideBalanceRequest {
  customer_id: string;
  cylinder_type_id: string;
  with_customer_qty: number;
  pending_returns: number;
  missing_qty: number;
  reason: string;
}

export interface InventoryUpdateFromDeliveryRequest {
  order_id: string;
  delivered_quantities: Record<string, number>;
  empties_collected: Record<string, number>;
}

export interface ConfirmReturnRequest {
  returns: Array<{
    customer_id: string;
    cylinder_type_id: string;
    quantity: number;
  }>;
}

// ============================================================================
// INVOICE TYPES
// ============================================================================

export interface InvoiceItem {
  invoice_item_id: string;
  cylinder_type_id: string;
  quantity: number;
  unit_price: number;
  discount_per_unit: number;
  total_price: number;
  cylinder_type_name: string;
}

export interface Invoice {
  invoice_id: string;
  distributor_id: string;
  customer_id: string;
  order_id: string;
  invoice_number: string;
  issue_date: string;
  due_date: string;
  total_amount: number;
  status: InvoiceStatus;
  issued_by?: string;
  due_date_overridden: boolean;
  credit_period_overridden: boolean;
  overridden_by?: string;
  overridden_at?: string;
  created_at: string;
  updated_at: string;
  items: InvoiceItem[];
  // Additional fields from joins
  business_name?: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  address_line1?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  total_credits?: number;
  outstanding_amount?: number;
  // GST e-invoice fields
  einvoice_status?: string;
  irn?: string;
  ack_no?: string;
  ack_date?: string;
  gst_invoice_json?: any;
  signed_qr_code?: string;
  cgst_value?: number;
  sgst_value?: number;
  igst_value?: number;
}

export type InvoiceStatus = 'draft' | 'issued' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled';

export interface InvoiceListResponse {
  invoices: Invoice[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface DisputeRequest {
  reason: string;
  dispute_type?: 'amount' | 'quantity';
  disputed_amount?: number;
  disputed_quantities?: Record<string, number>;
  description?: string;
}

export interface CreditNoteRequest {
  amount: number;
  reason: string;
}

export interface Dispute {
  dispute_id: string;
  invoice_id: string;
  reason: string;
  dispute_type: 'amount' | 'quantity';
  disputed_amount?: number;
  disputed_quantities?: Record<string, number>;
  description?: string;
  status: 'pending' | 'resolved' | 'rejected';
  created_by: string;
  created_at: string;
  resolved_at?: string;
}

export interface CreditNote {
  credit_note_id: string;
  invoice_id: string;
  amount: number;
  reason: string;
  created_by: string;
  created_at: string;
}

export interface InvoiceGenerationCheck {
  can_generate: boolean;
  order_status: string;
  existing_invoice: string | null;
  message: string;
}

export interface AC4ERVInvoice {
  invoice_id: string;
  invoice_number: string;
  issue_date: string;
  total_amount: number;
  status: string;
  pdf_url?: string;
  extracted_data?: Record<string, unknown>;
  created_at: string;
  confirmed?: boolean;
}

export interface OutgoingERV {
  erv_id: string;
  erv_number: string;
  issue_date: string;
  total_amount: number;
  status: string;
  pdf_url?: string;
  extracted_data?: Record<string, unknown>;
  confirmed_data?: Record<string, unknown>;
  confirmed?: boolean;
  created_at: string;
}

// ============================================================================
// PAYMENT TYPES
// ============================================================================

export interface Payment {
  payment_id: string;
  customer_id: string;
  distributor_id: string;
  customer_name: string;
  phone: string;
  distributor_name: string;
  amount: number;
  payment_method: string;
  payment_reference?: string;
  allocation_mode: 'auto' | 'manual';
  received_by_name: string;
  received_at: string;
  notes?: string;
  created_at: string;
  allocations?: PaymentAllocation[];
}

export interface PaymentAllocation {
  allocation_id: string;
  invoice_id: string;
  invoice_number: string;
  total_amount: number;
  allocated_amount: number;
  invoice_status: string;
}

export interface CreatePaymentRequest {
  customer_id: string;
  distributor_id: string;
  amount: number;
  payment_method: string;
  payment_reference?: string;
  allocation_mode: 'auto' | 'manual';
  notes?: string;
  allocations?: Array<{ invoice_id: string; allocated_amount: number }>;
}

export interface OutstandingInvoice {
  invoice_id: string;
  invoice_number: string;
  total_amount: number;
  allocated_amount: number;
  outstanding_amount: number;
  status: string;
  created_at: string;
}

export interface PaymentSummary {
  total_payments: number;
  total_amount: number;
  payment_method: string;
  allocation_mode: string;
}

// ============================================================================
// DASHBOARD TYPES
// ============================================================================

export interface DashboardStats {
  orders_today: number;
  cylinders_in_stock: Record<string, number>;
  overdue_invoices: number;
  revenue_this_week: number;
  cylinder_health: Array<{
    cylinder_type: string;
    in_stock: number;
    threshold: number;
    request_sent: boolean;
    triggered_at: string | null;
  }>;
}

export interface RecentOrder {
  order_id: string;
  order_number: string;
  customer_name: string;
  total_amount: number;
  status: OrderStatus;
  created_at: string;
}

export interface PendingAction {
  action_id: string;
  action_type: 'credit_note' | 'invoice_dispute' | 'customer_modification' | 'manual_inventory_adjustment' | 'missing_cylinder_log' | 'unreconciled_order' | 'stock_replenishment' | 'unallocated_payment' | 'gst_sync_failure';
  title: string;
  description: string;
  status: string;
  created_at: string;
  due_date?: string;
  related_id?: string;
  reference_number?: string;
}

export interface PendingActionsResponse {
  credit_notes?: PendingAction[];
  invoice_disputes?: PendingAction[];
  customer_modification_requests?: PendingAction[];
  manual_inventory_adjustments?: PendingAction[];
  accountability_logs?: PendingAction[];
  unreconciled_orders?: PendingAction[];
  stock_replenishment_requests?: PendingAction[];
  unallocated_payments?: PendingAction[];
  gst_sync_failures?: PendingAction[];
  summary?: {
    inventory_team_count?: number;
    finance_team_count?: number;
  };
  // Dashboard combined data
  inventory_actions?: PendingActionsResponse;
  finance_actions?: PendingActionsResponse;
}

// ============================================================================
// FORM TYPES
// ============================================================================

export interface FormField {
  name: string;
  label: string;
  type: 'text' | 'email' | 'password' | 'number' | 'select' | 'textarea' | 'date' | 'checkbox';
  required?: boolean;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    message?: string;
  };
}

export interface FormState<T = Record<string, unknown>> {
  values: T;
  errors: Partial<Record<keyof T, string>>;
  touched: Partial<Record<keyof T, boolean>>;
  isSubmitting: boolean;
  isValid: boolean;
}

// ============================================================================
// COMMON TYPES
// ============================================================================

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface TableColumn<T = unknown> {
  key: keyof T;
  label: string;
  sortable?: boolean;
  render?: (value: T[keyof T], row: T) => React.ReactNode;
  width?: string;
  align?: 'left' | 'center' | 'right';
}

export interface SortConfig {
  key: string;
  direction: 'asc' | 'desc';
}

export interface FilterConfig {
  key: string;
  value: string | number | boolean;
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'in' | 'not_in';
}

export interface PaginationConfig {
  page: number;
  limit: number;
  total: number;
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export interface ApiError {
  message: string;
  code?: string;
  status?: number;
  details?: Record<string, unknown>;
}

export interface ValidationError {
  field: string;
  message: string;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type NonNullable<T> = {
  [P in keyof T]: NonNullable<T[P]>;
};

// ============================================================================
// VEHICLE TYPES
// ============================================================================

export interface VehicleCancelledStock {
  vehicle_number: string;
  driver_name: string;
  cylinder_type: string;
  cancelled_quantity: number;
  vehicle_id: string;
  cylinder_type_id: string;
}

export interface VehicleInventorySummary {
  vehicle_number: string;
  driver_name: string;
  cylinder_type: string;
  available_quantity: number;
  soft_blocked_quantity: number;
  cancelled_order_quantity: number;
  updated_at: string;
} 