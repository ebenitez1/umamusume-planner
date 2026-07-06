import type { ReactNode } from 'react';
import { NavBar } from './NavBar';
import { Toaster } from './Toaster';

/** Global chrome: top nav + content area + toast layer. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <NavBar />
      <main className="app-main">{children}</main>
      <Toaster />
    </div>
  );
}
