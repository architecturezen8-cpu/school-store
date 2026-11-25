import type { Metadata } from "next";
import { isAdmin } from "@/lib/admin/auth";
import AdminShell from "@/components/admin/AdminShell";

/**
 * The admin is its own app.
 *
 * It sits under its own layout, so none of the storefront chrome — navbar,
 * footer, bag, search overlay, the ambient glow — is rendered here. That is
 * what makes it feel like a separate place rather than a page of the shop, and
 * it also means nothing on this screen can open a cart drawer by accident.
 *
 * The storefront's root layout still wraps this (there is one <html>), so
 * SiteChrome is told to stay out of the way — see components/SiteChrome.tsx.
 */

export const metadata: Metadata = {
  title: { default: "Store admin", template: "%s · Admin" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // The sign-in screen lives at /admin and must render while signed out; every
  // other admin route does its own check and redirects. The shell only decides
  // whether to draw the sidebar.
  const signedIn = await isAdmin();
  return <AdminShell signedIn={signedIn}>{children}</AdminShell>;
}
