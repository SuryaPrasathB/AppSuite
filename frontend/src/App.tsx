import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth, UserRole } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { DialogProvider } from './context/DialogContext';
import { ToastProvider } from './context/ToastContext';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Login } from './modules/store/pages/Login';
import { Dashboard } from './modules/store/pages/Dashboard';
import { StoreLayout } from './modules/store/pages/StoreLayout';
import { Products } from './modules/store/pages/Products';
import { ProjectsDashboard } from './modules/projects/ProjectsDashboard';
import { Projects } from './modules/projects/Projects';
import { ProjectWorkspace } from './modules/projects/ProjectWorkspace';
import { MyTasks } from './modules/projects/MyTasks';
import { GlobalTimeline } from './modules/projects/GlobalTimeline';
import { Inventory } from './modules/store/pages/Inventory';
import { Vendors } from './modules/store/pages/Vendors';
import { PurchasePlanning } from './modules/store/pages/PurchasePlanning';
import { Reports } from './modules/store/pages/Reports';
import { Requests } from './modules/store/pages/Requests';
import { StockIn } from './modules/store/pages/StockIn';
import { IssueMaterial } from './modules/store/pages/IssueMaterial';
import { ReturnMaterial } from './modules/store/pages/ReturnMaterial';
import { Employees } from './modules/store/pages/Employees';
import { Portal } from './modules/portal/Portal';
import { UsersManagement } from './modules/portal/UsersManagement';
import { BOM } from './modules/bom/BOM';
import { CreateBOMPage } from './modules/bom/CreateBOMPage';
import { Profile } from './modules/profile/Profile';


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

const ProtectedRoute = ({ children, allowedRoles }: { children: React.ReactNode, allowedRoles: UserRole[] }) => {
  const { hasRole } = useAuth();
  
  if (!hasRole(allowedRoles)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

const AppContent: React.FC = () => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

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

  // If visiting root lobby, render Portal without sidebar/header layout
  if (location.pathname === '/') {
    return <Portal />;
  }

  if (location.pathname === '/users') {
    return <UsersManagement />;
  }

  // If logged in, render the main layout with sidebar and header
  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 font-sans">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto px-6 py-6 print:px-0 print:py-0">
          <Routes>
            <Route path="/store" element={<ProtectedRoute allowedRoles={['Administrator', 'Store Operator', 'Store Manager']}><Dashboard /></ProtectedRoute>} />
            <Route path="/layout" element={<ProtectedRoute allowedRoles={['Administrator', 'Store Operator', 'Store Manager']}><StoreLayout /></ProtectedRoute>} />
            <Route path="/products" element={<ProtectedRoute allowedRoles={['Administrator', 'Store Operator', 'Store Manager']}><Products /></ProtectedRoute>} />
            <Route path="/stock-in" element={<ProtectedRoute allowedRoles={['Administrator', 'Store Operator', 'Store Manager']}><StockIn /></ProtectedRoute>} />
            <Route path="/issue-material" element={<ProtectedRoute allowedRoles={['Administrator', 'Store Operator', 'Store Manager']}><IssueMaterial /></ProtectedRoute>} />
            <Route path="/return-material" element={<ProtectedRoute allowedRoles={['Administrator', 'Store Operator', 'Store Manager']}><ReturnMaterial /></ProtectedRoute>} />
            <Route path="/inventory" element={<ProtectedRoute allowedRoles={['Administrator', 'Store Operator', 'Store Manager']}><Inventory /></ProtectedRoute>} />
            <Route path="/vendors" element={<ProtectedRoute allowedRoles={['Administrator', 'Store Operator', 'Store Manager']}><Vendors /></ProtectedRoute>} />
            <Route path="/employees" element={<ProtectedRoute allowedRoles={['Administrator', 'Store Operator', 'Store Manager']}><Employees /></ProtectedRoute>} />
            <Route path="/purchase" element={<ProtectedRoute allowedRoles={['Administrator', 'Store Operator', 'Store Manager']}><PurchasePlanning /></ProtectedRoute>} />
            <Route path="/requests" element={<ProtectedRoute allowedRoles={['Administrator', 'Store Operator', 'Store Manager']}><Requests /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute allowedRoles={['Administrator', 'Store Operator', 'Store Manager']}><Reports /></ProtectedRoute>} />

            <Route path="/projects/dashboard" element={<ProtectedRoute allowedRoles={['Administrator', 'Employee']}><ProjectsDashboard /></ProtectedRoute>} />
            <Route path="/projects" element={<ProtectedRoute allowedRoles={['Administrator', 'Employee']}><Projects /></ProtectedRoute>} />
            <Route path="/projects/:id" element={<ProtectedRoute allowedRoles={['Administrator', 'Employee']}><ProjectWorkspace /></ProtectedRoute>} />
            <Route path="/projects/my-tasks" element={<ProtectedRoute allowedRoles={['Administrator', 'Employee']}><MyTasks /></ProtectedRoute>} />
            <Route path="/projects/timeline" element={<ProtectedRoute allowedRoles={['Administrator', 'Employee']}><GlobalTimeline /></ProtectedRoute>} />

            <Route path="/bom" element={<ProtectedRoute allowedRoles={['Administrator', 'Employee', 'Store Operator', 'Store Manager']}><BOM /></ProtectedRoute>} />
            <Route path="/bom/create" element={<ProtectedRoute allowedRoles={['Administrator', 'Employee', 'Store Operator', 'Store Manager']}><CreateBOMPage /></ProtectedRoute>} />
            
            <Route path="/profile" element={<Profile />} />
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
    <ToastProvider>
      <AuthProvider>
        <DialogProvider>
          <CartProvider>
            <Router>
              <AppContent />
            </Router>
          </CartProvider>
        </DialogProvider>
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;
