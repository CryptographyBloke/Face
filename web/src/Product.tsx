import { PlatformSession } from "./platform/client";
import { lazy, Suspense, type ReactNode } from "react";
import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useParams,
} from "react-router-dom";
import { PreferencesProvider, usePreferences } from "./app/Preferences";
import { WalletProvider } from "./app/WalletProvider";
import { SpacesProvider } from "./app/SpacesProvider";
import { AppShell } from "./app/AppShell";
import { EmptyState, LoadingSkeleton, ToastProvider } from "./ui/primitives";
import "./product.css";
const MyAgents = lazy(() => import("./platform/PersonalAgents"));
const ConnectAgent = lazy(() =>
  import("./platform/PersonalAgents").then((m) => ({
    default: m.ConnectAgent,
  })),
);
const AgentLinkPage = lazy(() =>
  import("./platform/PersonalAgents").then((m) => ({
    default: m.AgentLinkPage,
  })),
);
const Agents = lazy(() => import("./platform/Agents"));
const AgentProfile = lazy(() =>
  import("./platform/Agents").then((m) => ({ default: m.AgentProfile })),
);
const AgentEditor = lazy(() =>
  import("./platform/Agents").then((m) => ({ default: m.AgentEditor })),
);
const Workspace = lazy(() => import("./platform/Workspace"));
const ReportEditor = lazy(() =>
  import("./platform/Workspace").then((m) => ({ default: m.ReportEditor })),
);
const ReportPage = lazy(() =>
  import("./platform/Workspace").then((m) => ({ default: m.ReportPage })),
);
const ActionEditor = lazy(() =>
  import("./platform/Workspace").then((m) => ({ default: m.ActionEditor })),
);
const ActionPage = lazy(() =>
  import("./platform/Workspace").then((m) => ({ default: m.ActionPage })),
);
const OrganizationPage = lazy(() =>
  import("./platform/Workspace").then((m) => ({ default: m.OrganizationPage })),
);
const Analytics = lazy(() => import("./platform/Analytics"));
const Copilot = lazy(() => import("./product/Copilot"));
const Proposal = lazy(() => import("./product/ProposalPage"));
const Home = lazy(() => import("./product/Home"));
const Publisher = lazy(() => import("./App"));
const Explore = lazy(() => import("./product/Explore"));
const Space = lazy(() => import("./product/SpacePage"));
const Profile = lazy(() => import("./product/ProfilePage"));
const Manage = lazy(() => import("./product/Manage"));
const Developers = lazy(() => import("./product/Developers"));
const Examples = lazy(() => import("./product/Examples"));
const Communities = lazy(() => import("./product/Communities"));
const Privacy = lazy(() => import("./product/Privacy"));
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <PreferencesProvider>
      <WalletProvider>
        <SpacesProvider>
          <ToastProvider>
            <PlatformSession>{children}</PlatformSession>
          </ToastProvider>
        </SpacesProvider>
      </WalletProvider>
    </PreferencesProvider>
  );
}
function Layout() {
  return (
    <AppShell>
      <Suspense fallback={<LoadingSkeleton rows={5} />}>
        <Outlet />
      </Suspense>
    </AppShell>
  );
}
function LegacyProfile() {
  const { address } = useParams();
  return <Navigate replace to={`/u/${encodeURIComponent(address || "")}`} />;
}
function NotFound() {
  const { t } = usePreferences();
  return (
    <EmptyState
      title={t("页面未找到", "Page not found")}
      description={t(
        "从导航继续探索。",
        "Use the navigation to continue exploring.",
      )}
    />
  );
}
export function ProductRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="ai" element={<Copilot />} />
        <Route path="agents" element={<Agents />} />
        <Route path="my-agents" element={<MyAgents />} />
        <Route path="my-agents/connect" element={<ConnectAgent />} />
        <Route path="my-agents/links/:id" element={<AgentLinkPage />} />
        <Route path="agents/new" element={<AgentEditor />} />
        <Route path="agents/:id" element={<AgentProfile />} />
        <Route path="agents/:id/edit" element={<AgentEditor />} />
        <Route path="workspaces" element={<Workspace />} />
        <Route path="reports/new" element={<ReportEditor />} />
        <Route path="reports/:id" element={<ReportPage />} />
        <Route path="actions/new" element={<ActionEditor />} />
        <Route path="actions/:id" element={<ActionPage />} />
        <Route path="organizations" element={<OrganizationPage />} />
        <Route path="analytics" element={<Analytics />} />
        <Route
          path="spaces/:spaceId/proposals/:proposalId"
          element={<Proposal />}
        />
        <Route path="avatar" element={<Publisher />} />
        <Route path="spaces" element={<Explore />} />
        <Route path="followed" element={<Explore collection="followed" />} />
        <Route path="spaces/:spaceId" element={<Space />} />
        <Route path="spaces/:spaceId/:section" element={<Space />} />
        <Route path="spaces/:spaceId/manage" element={<Manage />} />
        <Route path="u/:address" element={<Profile />} />
        <Route path="profile" element={<Profile />} />
        <Route path="profile/1/:address" element={<LegacyProfile />} />
        <Route path="developers" element={<Developers />} />
        <Route path="examples/:kind" element={<Examples />} />
        <Route path="communities" element={<Communities />} />
        <Route path="privacy" element={<Privacy />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
export default function Product() {
  return (
    <BrowserRouter>
      <AppProviders>
        <ProductRoutes />
      </AppProviders>
    </BrowserRouter>
  );
}
