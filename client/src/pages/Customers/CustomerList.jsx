import { useState, useEffect } from 'react';
import { useNavigate, useOutlet } from 'react-router-dom';
import { apiFetch } from '../../api';

export function CustomerList() {
  const [search, setSearch] = useState('');
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const navigate = useNavigate();
  const outlet = useOutlet();

  useEffect(() => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (search) params.set('search', search);

    const delay = search ? 300 : 0;
    const timer = setTimeout(() => {
      apiFetch(`/customers?${params}`)
        .then(data => {
          setCustomers(data.results ?? []);
          setLoading(false);
        })
        .catch(err => {
          setError(err.message || 'Failed to load customers');
          setLoading(false);
        });
    }, delay);

    return () => clearTimeout(timer);
  }, [search]);

  const drawerOpen = !!outlet;

  return (
    <div className="page-content">
      <div className="toolbar">
        <h1 className="toolbar-title">Customers</h1>
        <div className="flex1" />

        <div className="search-wrap" style={{ width: 260 }}>
          <svg className="si" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="search"
            aria-label="Search customers"
            className="search-input"
            placeholder="Search by name or contact…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <button
          className="btn btn-gold"
          onClick={() => navigate('/customers/new')}
        >
          <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
          Add Customer
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

        {!loading && !error && customers.length === 0 && (
          <p style={{ textAlign: 'center', color: 'var(--muted)', padding: 30, fontSize: 13 }}>
            No customers found
          </p>
        )}

        {!loading && !error && customers.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Email</th>
                <th style={{ width: 80 }} />
              </tr>
            </thead>
            <tbody>
              {customers.map(c => (
                <tr
                  key={c.customerId}
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/customers/${c.customerId}`)}
                >
                  <td><strong>{c.firstName} {c.lastName}</strong></td>
                  <td className="td2">{c.primaryPhone}</td>
                  <td className="td2">{c.primaryEmail}</td>
                  <td>
                    <div className="td-act">
                      <button
                        className="btn btn-ghost btn-icon btn-sm"
                        title="Edit"
                        onClick={e => { e.stopPropagation(); navigate(`/customers/${c.customerId}`); }}
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
          <div
            className="overlay open"
            onClick={() => navigate('/customers')}
          />
          <div className="drawer open">
            {outlet}
          </div>
        </>
      )}
    </div>
  );
}
