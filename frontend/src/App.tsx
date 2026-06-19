import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { StoreLayout } from './pages/StoreLayout';
import { Products } from './pages/Products';
import { Projects } from './pages/Projects';
import { Inventory } from './pages/Inventory';
import { Vendors } from './pages/Vendors';
import { PurchasePlanning } from './pages/PurchasePlanning';
import { Reports } from './pages/Reports';
import { Requests } from './pages/Requests';
import { StockIn } from './pages/StockIn';
import { IssueMaterial } from './pages/IssueMaterial';
import { ReturnMaterial } from './pages/ReturnMaterial';

const Footer: React.FC = () => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1050);
    return () => clearInterval(timer);
  }, []);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      weekday: 'long',
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  return (
    <footer className="h-10 border-t border-slate-200 bg-white px-8 flex items-center justify-between text-[11px] text-slate-400 font-medium shrink-0">
      <div className="flex items-center gap-6">
        <span>{formatDate(time)}</span>
        <span>{formatTime(time)}</span>
      </div>
      <div className="flex items-center gap-4">
        <span>v1.0.0</span>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
          <span className="text-slate-500 font-bold">System Online</span>
        </div>
      </div>
    </footer>
  );
};

const AppContent: React.FC = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  // If not logged in, render the login view
  if (!user) {
    return <Login />;
  }

  // If logged in, render the main layout with sidebar and header
  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 font-sans">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto px-6 py-6 print:px-0 print:py-0">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/layout" element={<StoreLayout />} />
            <Route path="/products" element={<Products />} />
            <Route path="/stock-in" element={<StockIn />} />
            <Route path="/issue-material" element={<IssueMaterial />} />
            <Route path="/return-material" element={<ReturnMaterial />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/vendors" element={<Vendors />} />
            <Route path="/purchase" element={<PurchasePlanning />} />
            <Route path="/requests" element={<Requests />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <Router>
          <AppContent />
        </Router>
      </CartProvider>
    </AuthProvider>
  );
}

export default App;
