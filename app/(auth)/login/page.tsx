import { isCurrentDeviceTrusted } from '@/lib/auth/session';
import LoginForm from './LoginForm';

export const metadata = {
  title: 'Sign In | PocketLog',
  description: 'Sign in to your PocketLog account',
};

export default async function LoginPage() {
  let isTrusted = false;
  try {
    isTrusted = await isCurrentDeviceTrusted();
  } catch {
    isTrusted = false;
  }

  return <LoginForm isTrustedInitial={isTrusted} />;
}
