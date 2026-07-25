import { redirect } from 'next/navigation';

export default function NewTenantPage() {
  // Business creation is disabled — limited to 2 businesses
  redirect('/superadmin/tenants');
}
