import { AppShell } from "@/components/app-shell";
import { FarmScopeProvider } from "@/components/farm-scope-context";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <FarmScopeProvider>
      <AppShell>{children}</AppShell>
    </FarmScopeProvider>
  );
}
