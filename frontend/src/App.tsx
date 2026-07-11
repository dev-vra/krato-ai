import { AppShell } from "@/components/layout/AppShell";
import { UIProvider } from "@/store/ui";

export default function App() {
  return (
    <UIProvider>
      <AppShell />
    </UIProvider>
  );
}
