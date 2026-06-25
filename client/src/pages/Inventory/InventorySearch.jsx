import { useState, useEffect } from 'react';
import { useNavigate, useOutlet } from 'react-router-dom';
import { apiFetch } from '../../api';

function fmt(n) {
  return Number(n).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function InventorySearch() {
  const [search, setSearch] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const navigate = useNavigate();
  const outlet = useOutlet();

  useEffect(() => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (search) params.set('description', search);

    const delay = search ? 300 : 0;
    const timer = setTimeout(() => {
      apiFetch(`/inventory?${params}`)
        .then(data => {
          setItems(data.results ?? []);
          setLoading(false);
        })
        .catch(err => {
          setError(err.message || 'Failed to load inventory');
          setLoading(false);
        });
    }, delay);

    return () => clearTimeout(timer);
  }, [search]);

  const drawerOpen = !!outlet;

  return (
    <div className="page-content">
      <div className="toolbar">
        <h1 className="toolbar-title">Inventory</h1>
        <div className="flex1" />

        <div className="search-wrap" style={{ width: 280 }}>
          <svg className="si" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="search"
            aria-label="Search inventory"
            className="search-input"
            placeholder="Search by description…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <button
          className="btn btn-gold"
          onClick={() => navigate('/inventory/new')}
        >
          <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
          Add to Stock
        </button>
      </div>

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
          <p style={{ textAlign: 'center', color: 'var(--muted)', padding: 30, fontSize: 13 }}>
            No inventory found
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
                <th style={{ textAlign: 'right' }}>Price</th>
                <th>Status</th>
                <th>Acquired</th>
                <th style={{ width: 80 }} />
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr
                  key={item.inventoryItemId}
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/inventory/${item.inventoryItemId}`)}
                >
                  <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--gold-dim)' }}>
                    {item.designNo}
                  </td>
                  <td><strong>{item.description}</strong></td>
                  <td className="td2">{item.categoryName}</td>
                  <td className="td2">{item.supplierName}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>${fmt(item.effectiveRetailPrice)}</td>
                  <td>
                    <span className={`badge ${item.statusName === 'Active' ? 'badge-ok' : 'badge-err'}`}>
                      {item.statusName}
                    </span>
                  </td>
                  <td className="td2" style={{ fontSize: 12 }}>{fmtDate(item.acquisitionDate)}</td>
                  <td>
                    <div className="td-act">
                      <button
                        className="btn btn-ghost btn-icon btn-sm"
                        title="Edit"
                        onClick={e => { e.stopPropagation(); navigate(`/inventory/${item.inventoryItemId}`); }}
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

      {drawerOpen && (
        <>
          <div className="overlay open" onClick={() => navigate('/inventory')} />
          <div className="drawer open">{outlet}</div>
        </>
      )}
    </div>
  );
}
