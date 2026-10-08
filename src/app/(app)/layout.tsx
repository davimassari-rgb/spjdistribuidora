import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth/current-user";
import { getCurrentSegment } from "@/lib/segment-server";
import { logout } from "../login/actions";
import { setSegmentAction } from "./segment-actions";

// Todas as rotas deste grupo exigem login da equipe.
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const segment = await getCurrentSegment();
  return (
    <AppShell
      user={{ name: user.name, email: user.email }}
      segment={segment}
      setSegment={setSegmentAction}
      logout={logout}
    >
      {children}
    </AppShell>
  );
}
