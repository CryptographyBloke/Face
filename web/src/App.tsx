import { Layout } from './components/Layout'
import { I18nProvider } from './i18n'
import { Dashboard } from './pages/Dashboard'
import { Developers } from './pages/Developers'
import { Home } from './pages/Home'
import { Pricing } from './pages/Pricing'
import { Profile } from './pages/Profile'
import { useLocation } from './router'
import { WalletProvider } from './useWallet'

function Routes() {
  const { route, query } = useLocation()
  return (
    <Layout current={route.page === 'profile' ? 'home' : route.page}>
      {route.page === 'home' && <Home />}
      {route.page === 'profile' && <Profile key={route.id} id={route.id} />}
      {route.page === 'developers' && <Developers />}
      {route.page === 'pricing' && <Pricing query={query} />}
      {route.page === 'dashboard' && <Dashboard query={query} />}
    </Layout>
  )
}

export default function App() {
  return (
    <I18nProvider>
      <WalletProvider>
        <Routes />
      </WalletProvider>
    </I18nProvider>
  )
}
