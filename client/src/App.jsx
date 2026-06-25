import { useState } from 'react';
import { Routes, Route, Navigate, NavLink } from 'react-router-dom';
import { ItemList } from './pages/Items/ItemList';
import { ItemDetail } from './pages/Items/ItemDetail';
import { CustomerList } from './pages/Customers/CustomerList';
import { CustomerDetail } from './pages/Customers/CustomerDetail';
import { InventorySearch } from './pages/Inventory/InventorySearch';
import { InventoryDetail } from './pages/Inventory/InventoryDetail';
import { SaleScreen } from './pages/Sale/SaleScreen';

export default function App() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="app">
      <aside className={`sidebar${collapsed ? ' col' : ''}`}>
        <div className="sb-top">
          <span className="brand-mark">◆</span>
          <span className="brand-text">NovaPOS</span>
          <button
            className="toggle-btn"
            onClick={() => setCollapsed(c => !c)}
            title="Toggle sidebar"
          >
            <svg viewBox="0 0 24 24" width="17" height="17" stroke="currentColor" fill="none" strokeWidth="2" strokeLinecap="round">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>

        <nav className="sb-nav">
          <NavLink to="/sale" className={({ isActive }) => `nav-btn${isActive ? ' active' : ''}`} data-tip="POS">
            <span className="nav-icon">
              <svg viewBox="0 0 24 24">
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <path d="M8 21h8M12 17v4" />
                <path d="M7 8h.01M12 8h.01M17 8h.01M7 12h.01M12 12h.01M17 12h.01" />
              </svg>
            </span>
            <span className="nav-label">Point of Sale</span>
          </NavLink>

          <div className="nav-sep" />

          <NavLink to="/customers" className={({ isActive }) => `nav-btn${isActive ? ' active' : ''}`} data-tip="Customers">
            <span className="nav-icon">
              <svg viewBox="0 0 24 24">
                <path d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
              </svg>
            </span>
            <span className="nav-label">Customers</span>
          </NavLink>

          <NavLink to="/items" className={({ isActive }) => `nav-btn${isActive ? ' active' : ''}`} data-tip="Items">
            <span className="nav-icon">
              <svg viewBox="0 0 24 24">
                <path d="M6 3l6 2 6-2 3 7-9 11L3 10l3-7z" />
                <path d="M6 3l6 8 6-8" />
                <path d="M3 10h18" />
              </svg>
            </span>
            <span className="nav-label">Items</span>
          </NavLink>

          <NavLink to="/inventory" className={({ isActive }) => `nav-btn${isActive ? ' active' : ''}`} data-tip="Inventory">
            <span className="nav-icon">
              <svg viewBox="0 0 24 24">
                <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" />
                <path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" />
              </svg>
            </span>
            <span className="nav-label">Inventory</span>
          </NavLink>

          <NavLink to="/suppliers" className={({ isActive }) => `nav-btn${isActive ? ' active' : ''}`} data-tip="Suppliers">
            <span className="nav-icon">
              <svg viewBox="0 0 24 24">
                <path d="M3 21h18M5 21V8l7-5 7 5v13" />
                <path d="M9 21v-8h6v8M9 10h.01M15 10h.01M9 13h.01M15 13h.01" />
              </svg>
            </span>
            <span className="nav-label">Suppliers</span>
          </NavLink>
        </nav>

        <div className="sb-foot">
          <span className="store-dot" />
          <span className="store-name">City Store</span>
        </div>
      </aside>

      <main className="main">
        <Routes>
          <Route path="/" element={<Navigate to="/items" replace />} />
          <Route path="/items" element={<ItemList />}>
            <Route path="new" element={<ItemDetail />} />
            <Route path=":id" element={<ItemDetail />} />
          </Route>
          <Route path="/customers" element={<CustomerList />}>
            <Route path="new" element={<CustomerDetail />} />
            <Route path=":id" element={<CustomerDetail />} />
          </Route>
          <Route path="/inventory" element={<InventorySearch />}>
            <Route path="new" element={<InventoryDetail />} />
            <Route path=":id" element={<InventoryDetail />} />
          </Route>
          <Route path="/sale" element={<SaleScreen />} />
          <Route path="/sales/:id" element={<SaleScreen />} />
        </Routes>
      </main>
    </div>
  );
}
