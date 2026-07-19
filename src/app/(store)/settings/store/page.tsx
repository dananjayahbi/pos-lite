import { redirect } from 'next/navigation';

export const metadata = { title: 'Store Profile | VelvetPOS' };

export default function StoreProfileSettingsPage() {
  // Store profile settings are now managed by the super admin
  redirect('/dashboard');
}
