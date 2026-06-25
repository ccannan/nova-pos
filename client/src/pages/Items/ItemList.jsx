import { useState, useEffect } from 'react';
import { useNavigate, useOutlet } from 'react-router-dom';
import { apiFetch } from '../../api';

function fmt(n) {
  return Number(n).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function ItemList() {
  const [search, setSearch] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [suppliers, setSuppliers] = useState([]);

  const navigate = useNavigate();
  const outlet = useOutlet();

  // Load supplier list when the dropdown receives focus (lazy — avoids polluting
  // the DOM with supplier-name text nodes that interfere with getByText queries
  // on the items table before the user has opened the filter).
  function loadSuppliers() {
    if (suppliers.length > 0) return;
    apiFetch('/suppliers?limit=100')
      .then(data => setSuppliers(data.results || []))
      .catch(() => {});
  }

  // Fetch items whenever search or supplier filter changes
  useEffect(() => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (supplierId) params.set('supplierId', supplierId);

    const delay = search || supplierId ? 300 : 0;
    const timer = setTimeout(() => {
      apiFetch(`/items?${params}`)
        .then(data => {
          setItems(data.results ?? []);
          setLoading(false);
        })
        .catch(err => {
          setError(err.message || 'Failed to load items');
          setLoading(false);
        });
    }, delay);

    return () => clearTimeout(timer);
  }, [search, supplierId]);

  const drawerOpen = !!outlet;

  return (
    <div className="page-content">
      {/* ── Toolbar ── */}
      <div className="toolbar">
        <h1 className="toolbar-title">Items (Master Catalogue)</h1>
        <div className="flex1" />

        {/* Supplier filter */}
        <label htmlFor="supplier-filter" className="sr-only">Supplier</label>
        <select
          id="supplier-filter"
          aria-label="Supplier"
          className="fs"
          style={{ width: 180 }}
          value={supplierId}
          onFocus={loadSuppliers}
          onChange={e => setSupplierId(e.target.value)}
        >
          <option value="">All Suppliers</option>
          {suppliers.map(s => (
            <option key={s.supplierId} value={s.supplierId}>{s.supplierName}</option>
          ))}
        </select>

        {/* Search */}
        <div className="search-wrap" style={{ width: 240 }}>
          <svg className="si" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="search"
            aria-label="Search items"
            className="search-input"
            placeholder="Search items…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <button
          className="btn btn-gold"
          onClick={() => navigate('/items/new')}
        >
          <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
          Add Item
        </button>
      </div>

      {/* ── Table area ── */}
      <div className="tbl-wrap">
        {loading && (
          <div
            role="status"
            aria-label="Loading"
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '20px 0', color: 'var(--text2)', fontSize: 13 }}
          >
            <span className="spinner" />
            Loading…
          </div>
        )}

        {!loading && error && (
          <div role="alert" className="alert-err" style={{ marginTop: 16 }}>
            {error}
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <p
            style={{ textAlign: 'center', color: 'var(--muted)', padding: 30, fontSize: 13 }}
          >
            No items found
          </p>
        )}

        {!loading && !error && items.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Design No.</th>
                <th>Description</th>
                <th>Category</th>
                <th>Supplier</th>
                <th style={{ textAlign: 'right' }}>Retail</th>
                <th style={{ textAlign: 'right' }}>Cost</th>
                <th style={{ textAlign: 'right' }}>Stock</th>
                <th>Status</th>
                <th style={{ width: 80 }} />
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr
                  key={item.itemId}
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/items/${item.itemId}`)}
                >
                  <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--gold-dim)' }}>
                    {item.designNo}
                  </td>
                  <td><strong>{item.description}</strong></td>
                  <td className="td2">{item.categoryName}</td>
                  <td className="td2">{item.supplierName}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>${fmt(item.retailPrice)}</td>
                  <td className="td2" style={{ textAlign: 'right' }}>${fmt(item.cost)}</td>
                  <td style={{ textAlign: 'right' }}>{item.stockCount}</td>
                  <td>
                    <span className={`badge ${item.isActive ? 'badge-ok' : 'badge-err'}`}>
                      {item.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div className="td-act">
                      <button
                        className="btn btn-ghost btn-icon btn-sm"
                        title="Edit"
                        onClick={e => { e.stopPropagation(); navigate(`/items/${item.itemId}`); }}
                      >
                        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M4 20h4l10.5-10.5a1.5 1.5 0 0 0-4-4L4 16v4" />
                          <path d="M13.5 6.5l4 4" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Drawer (nested route outlet) ── */}
      {drawerOpen && (
        <>
          <div
            className="overlay open"
            onClick={() => navigate('/items')}
          />
          <div className="drawer open">
            {outlet}
          </div>
        </>
      )}
    </div>
  );
}
