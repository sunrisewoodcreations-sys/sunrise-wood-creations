type NotifiableCustomer = {
  has_real_email?: boolean;
  notify_order_updates?: boolean;
  notify_invoices?: boolean;
  notify_proofs?: boolean;
  notify_messages?: boolean;
};

export type NotificationCategory = "order_updates" | "invoices" | "proofs" | "messages";

// Checks whether this customer should actually receive a given category
// of email — false if they have no real email on file, or if they've
// specifically opted out of that category.
export function shouldNotify(customer: NotifiableCustomer, category: NotificationCategory): boolean {
  if (customer.has_real_email === false) return false;

  switch (category) {
    case "order_updates": return customer.notify_order_updates !== false;
    case "invoices": return customer.notify_invoices !== false;
    case "proofs": return customer.notify_proofs !== false;
    case "messages": return customer.notify_messages !== false;
    default: return true;
  }
}
