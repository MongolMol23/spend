import { createRoot } from 'react-dom/client'
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router'
import { App } from './app/App'
import { AppHeader } from './app/AppHeader'
import { Landing } from './features/landing/Landing'
import { Account } from './features/accounts/Account'
import { AdminAccounts } from './features/accounts/AdminAccounts'
import { Connections } from './features/connections/Connections'
import { Purchases } from './features/purchases/Purchases'
import { PrivateDebts } from './features/debts/PrivateDebts'
import { Savings } from './features/savings/Savings'
import { Installments } from './features/installments/Installments'
import { Analytics } from './features/analytics/Analytics'
import { resources } from './i18n/locales'
import './styles.css'

const language = localStorage.getItem('spend-language') === 'ar' ? 'ar' : 'en'
void i18n.use(initReactI18next).init({
  resources, lng: language, fallbackLng: 'en', interpolation: { escapeValue: false }
}).then(() => {
  const root = document.getElementById('root')
  if (!root) throw new Error('Missing application root')
  function applyLanguage(language: string) {
    document.documentElement.lang = language
    document.documentElement.dir = i18n.dir(language)
    localStorage.setItem('spend-language', language)
  }
  applyLanguage(i18n.language)
  i18n.on('languageChanged', applyLanguage)
  createRoot(root).render(
    <BrowserRouter>
      <div id="toast-region" />
      <Routes>
        <Route path="/account/:mode?" element={<Account />} />
        <Route path="/admin" element={<><AppHeader admin /><AdminAccounts /></>} />
        <Route element={<><AppHeader /><Outlet /></>}>
          <Route path="/connections" element={<Connections />} />
          <Route path="/purchases" element={<Purchases />} />
          <Route path="/debts" element={<PrivateDebts />} />
          <Route path="/savings" element={<Savings />} />
          <Route path="/installments" element={<Installments />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/overview" element={<App />} />
        </Route>
        <Route path="/" element={<Landing />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>,
  )
})
