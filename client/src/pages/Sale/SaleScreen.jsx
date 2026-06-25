import { useState, useEffect, useRef } from 'react';
import { useMatch } from 'react-router-dom';
import { apiFetch } from '../../api';

const STORE_ID = '20000001-0000-0000-0000-000000000001';

function isUUID(v) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

function fmt(n) {
  return Number(n).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── New Sale ────────────────────────────────────────────────────────────────

function NewSale() {
  const [lines, setLines] = useState([]);
  const [customer, setCustomer] = useState(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState([]);
  const [itemSearch, setItemSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [cashTender, setCashTender] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [saleError, setSaleError] = useState(null);
  const [completedSale, setCompletedSale] = useState(null);
  const [queuedWarning, setQueuedWarning] = useState(false);

  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [newCustForm, setNewCustForm] = useState({ firstName: '', lastName: '' });
  const [newCustErrors, setNewCustErrors] = useState({});
  const [newCustSaving, setNewCustSaving] = useState(false);

  // Customer search — debounced
  useEffect(() => {
    if (!customerSearch) { setCustomerResults([]); return; }
    const timer = setTimeout(() => {
      apiFetch(`/customers?search=${encodeURIComponent(customerSearch)}`)
        .then(d => setCustomerResults(d.results ?? []))
        .catch(() => {});
    }, 300);
    return () => clearTimeout(timer);
  }, [customerSearch]);

  // Item search — debounced; description + designNo in parallel when no spaces
  useEffect(() => {
    if (!itemSearch) { setSearchResults([]); return; }
    if (isUUID(itemSearch)) return;
    const timer = setTimeout(() => {
      // Also search by designNo when the term looks like a code (no spaces,
      // contains a digit or dash — rules out pure-word description searches).
      const looksLikeCode = !/\s/.test(itemSearch) && /[\d-]/.test(itemSearch);
      const descFetch = apiFetch(`/inventory?description=${encodeURIComponent(itemSearch)}`);
      const fetches = looksLikeCode
        ? [descFetch, apiFetch(`/inventory?designNo=${encodeURIComponent(itemSearch)}`)]
        : [descFetch];
      Promise.all(fetches)
        .then(results => {
          const seen = new Set();
          const merged = [];
          for (const d of results) {
            for (const item of d.results ?? []) {
              if (!seen.has(item.inventoryItemId)) {
                seen.add(item.inventoryItemId);
                merged.push(item);
              }
            }
          }
          setSearchResults(merged);
        })
        .catch(() => {});
    }, 300);
    return () => clearTimeout(timer);
  }, [itemSearch]);

  function handleItemKeyDown(e) {
    if (e.key === 'Enter' && isUUID(itemSearch)) {
      const params = new URLSearchParams();
      params.set('inventoryItemId', itemSearch);
      apiFetch(`/inventory?${params}`)
        .then(d => setSearchResults(d.results ?? []))
        .catch(() => {});
    }
  }

  function selectCustomer(c) {
    setCustomer(c);
    setCustomerSearch('');
    setCustomerResults([]);
  }

  async function handleAddCustomer() {
    const errs = {};
    if (!newCustForm.lastName.trim()) errs.lastName = 'Required.';
    if (Object.keys(errs).length) { setNewCustErrors(errs); return; }
    setNewCustSaving(true);
    setNewCustErrors({});
    try {
      const created = await apiFetch('/customers', { method: 'POST', body: newCustForm });
      selectCustomer(created);
      setShowAddCustomer(false);
      setNewCustForm({ firstName: '', lastName: '' });
    } catch (err) {
      if (err.data?.fields) setNewCustErrors(err.data.fields);
      else setNewCustErrors({ lastName: err.message || 'Save failed' });
    } finally {
      setNewCustSaving(false);
    }
  }

  const clearSearchRef = useRef(null);

  function addToSale(item) {
    setLines(prev => [...prev, {
      inventoryItemId: item.inventoryItemId,
      description: item.description,
      unitPrice: parseFloat(String(item.effectiveRetailPrice)),
    }]);
    // Debounce: reset on each add so rapid multi-select from the same result
    // list all complete before the results disappear from the DOM.
    if (clearSearchRef.current) clearTimeout(clearSearchRef.current);
    clearSearchRef.current = setTimeout(() => {
      setItemSearch('');
      setSearchResults([]);
    }, 200);
  }

  function removeLine(idx) {
    setLines(prev => prev.filter((_, i) => i !== idx));
  }

  const grandTotal = lines.reduce((sum, l) => sum + l.unitPrice, 0);
  const tenderAmount = parseFloat(cashTender) || 0;
  const changeDue = tenderAmount > 0 && tenderAmount > grandTotal ? tenderAmount - grandTotal : null;

  async function handleCompleteSale() {
    if (lines.length === 0) return;

    const tender = cashTender ? parseFloat(cashTender) : grandTotal;
    if (tender < grandTotal) {
      setSaleError('Amount entered does not cover the total.');
      return;
    }

    setSubmitting(true);
    setSaleError(null);

    const body = {
      storeId: STORE_ID,
      customerId: customer?.customerId ?? null,
      memo: '',
      lines: lines.map(l => ({ inventoryItemId: l.inventoryItemId, unitPrice: l.unitPrice, discount: 0 })),
      tender: [{ tenderMethod: 'Cash', amount: tender, reference: null }],
    };

    try {
      const data = await apiFetch('/sales', { method: 'POST', body });
      const wasQueued = data.queued?.length > 0;
      setQueuedWarning(wasQueued);
      setCompletedSale(data);
      setLines([]);
      setCashTender('');
    } catch (err) {
      setSaleError(err.message || 'Sale failed');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Completed state ──────────────────────────────────────────────────────
  if (completedSale) {
    return (
      <div className="page-content">
        <div className="toolbar">
          <h1 className="toolbar-title">Sale #{completedSale.saleNumber}</h1>
        </div>
        <div style={{ padding: '32px 24px', maxWidth: 480 }}>
          {queuedWarning && (
            <div role="alert" className="alert-warn" style={{ marginBottom: 16 }}>
              Some data was queued and will be submitted when connectivity is restored.
            </div>
          )}
          <button
            className="btn btn-gold"
            onClick={() => { setCompletedSale(null); setQueuedWarning(false); }}
          >
            New Sale
          </button>
        </div>
      </div>
    );
  }

  // ── Entry state ──────────────────────────────────────────────────────────
  return (
    <div className="page-content">
      <div className="toolbar">
        <h1 className="toolbar-title">New Sale</h1>
      </div>

      <div style={{ display: 'flex', gap: 24, padding: '0 0 24px', alignItems: 'flex-start' }}>
        {/* ── Left: search + lines ── */}
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* Customer search */}
          <div style={{ marginBottom: 16, position: 'relative' }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="search"
                aria-label="Customer"
                className="search-input"
                placeholder="Find customer…"
                value={customerSearch}
                onChange={e => setCustomerSearch(e.target.value)}
                style={{ flex: 1 }}
              />
              <button
                className="btn btn-ghost"
                aria-label="New customer"
                title="New customer"
                onClick={() => { setShowAddCustomer(true); setNewCustForm({ firstName: '', lastName: '' }); setNewCustErrors({}); }}
                style={{ flexShrink: 0, fontSize: 18, lineHeight: 1, padding: '0 10px' }}
              >
                +
              </button>
            </div>
            {customer && !customerSearch && (
              <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: 20,
                    padding: '3px 12px',
                    fontSize: 13,
                    color: 'var(--gold)',
                    fontWeight: 600,
                  }}
                >
                  {customer.firstName} {customer.lastName}
                </span>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setCustomer(null)}
                  aria-label="Clear customer"
                  style={{ fontSize: 11 }}
                >
                  ×
                </button>
              </div>
            )}
            {customerResults.length > 0 && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  zIndex: 20,
                  maxHeight: 200,
                  overflowY: 'auto',
                }}
              >
                {customerResults.map(c => (
                  <button
                    key={c.customerId}
                    onClick={() => selectCustomer(c)}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '8px 12px',
                      fontSize: 13,
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--text)',
                    }}
                  >
                    {c.firstName} {c.lastName}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Item search/scan */}
          <div className="search-wrap" style={{ marginBottom: 12 }}>
            <svg className="si" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="search"
              aria-label="Item search/scan"
              className="search-input"
              placeholder="Search or scan item…"
              value={itemSearch}
              onChange={e => setItemSearch(e.target.value)}
              onKeyDown={handleItemKeyDown}
            />
          </div>

          {/* Search results */}
          {searchResults.length > 0 && (
            <div
              style={{
                background: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                marginBottom: 16,
              }}
            >
              {searchResults.map(item => (
                <div
                  key={item.inventoryItemId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '8px 12px',
                    borderBottom: '1px solid var(--border)',
                    gap: 12,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <strong style={{ fontSize: 13 }}>{item.description}</strong>
                    <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 8 }}>
                      {item.designNo}
                    </span>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--gold)' }}>
                    ${fmt(item.effectiveRetailPrice)}
                  </span>
                  <button
                    className="btn btn-gold btn-sm"
                    onClick={() => addToSale(item)}
                  >
                    Add to sale
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Sale lines */}
          {lines.length > 0 && (
            <table style={{ marginBottom: 16 }}>
              <thead>
                <tr>
                  <th>Item</th>
                  <th style={{ textAlign: 'right' }}>Price</th>
                  <th style={{ width: 40 }} />
                </tr>
              </thead>
              <tbody>
                {lines.map((line, i) => (
                  <tr key={`${line.inventoryItemId}-${i}`}>
                    <td><strong>{line.description}</strong></td>
                    <td style={{ textAlign: 'right' }}>${fmt(line.unitPrice)}</td>
                    <td>
                      <button
                        className="btn btn-ghost btn-icon btn-sm"
                        aria-label="Remove line"
                        onClick={() => removeLine(i)}
                        title="Remove"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Right: totals + tender ── */}
        <div
          style={{
            width: 260,
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: 16,
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <span style={{ fontSize: 13, color: 'var(--text2)' }}>Total</span>
            <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--gold)' }}>
              ${fmt(grandTotal)}
            </span>
          </div>

          <div className="fg" style={{ marginBottom: 12 }}>
            <label className="fl" htmlFor="cashTender">Cash</label>
            <input
              id="cashTender"
              type="number"
              className="fi"
              aria-label="Cash tendered"
              placeholder="0.00"
              value={cashTender}
              onChange={e => { setCashTender(e.target.value); setSaleError(null); }}
              min="0"
              step="0.01"
            />
          </div>

          {changeDue !== null && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 13, color: 'var(--text2)' }}>Change due</span>
              <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--green, #4caf50)' }}>
                ${fmt(changeDue)}
              </span>
            </div>
          )}

          {saleError && (
            <div role="alert" className="alert-err" style={{ marginBottom: 12, fontSize: 12 }}>
              {saleError}
            </div>
          )}

          <button
            className="btn btn-gold"
            style={{ width: '100%' }}
            onClick={handleCompleteSale}
            disabled={submitting}
          >
            {submitting ? 'Processing…' : 'Complete Sale'}
          </button>
        </div>
      </div>

      {/* Add Customer modal */}
      {showAddCustomer && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-cust-title"
          style={{
            position: 'fixed', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 100, background: 'rgba(0,0,0,0.6)',
          }}
        >
          <div style={{
            background: 'var(--card)', border: '1px solid var(--border)',
            borderRadius: 10, padding: '24px 28px', width: 340,
          }}>
            <h2 id="add-cust-title" style={{ margin: '0 0 18px', fontSize: 16 }}>
              New Customer
            </h2>
            <div className="fg-row" style={{ marginBottom: 0 }}>
              <div className="fg">
                <label className="fl" htmlFor="newCustFirstName">First name</label>
                <input
                  id="newCustFirstName"
                  className="fi"
                  placeholder="Jane"
                  value={newCustForm.firstName}
                  onChange={e => setNewCustForm(f => ({ ...f, firstName: e.target.value }))}
                />
              </div>
              <div className="fg">
                <label className="fl" htmlFor="newCustLastName">Last name</label>
                <input
                  id="newCustLastName"
                  className={`fi${newCustErrors.lastName ? ' invalid' : ''}`}
                  placeholder="Smith"
                  value={newCustForm.lastName}
                  onChange={e => { setNewCustForm(f => ({ ...f, lastName: e.target.value })); setNewCustErrors({}); }}
                  onKeyDown={e => e.key === 'Enter' && handleAddCustomer()}
                />
                {newCustErrors.lastName && <p className="field-err">{newCustErrors.lastName}</p>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button
                className="btn btn-ghost"
                onClick={() => setShowAddCustomer(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-gold"
                onClick={handleAddCustomer}
                disabled={newCustSaving}
              >
                {newCustSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sale View / Void ────────────────────────────────────────────────────────

function SaleView({ id }) {
  const [sale, setSale] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [voidDialog, setVoidDialog] = useState(false);
  const [voiding, setVoiding] = useState(false);
  const [voidError, setVoidError] = useState(null);

  useEffect(() => {
    apiFetch(`/sales/${id}`)
      .then(data => { setSale(data); setLoading(false); })
      .catch(err => { setLoadError(err.message || 'Failed to load sale'); setLoading(false); });
  }, [id]);

  async function handleVoidConfirm() {
    setVoiding(true);
    setVoidError(null);
    try {
      await apiFetch(`/sales/${id}/void`, { method: 'PUT' });
      setSale(prev => ({ ...prev, status: 'Voided' }));
      setVoidDialog(false);
    } catch (err) {
      setVoidError(err.message || 'Void failed');
      setVoidDialog(false);
    } finally {
      setVoiding(false);
    }
  }

  if (loading) {
    return (
      <div className="page-content">
        <div role="status" aria-label="Loading"
          style={{ padding: 24, color: 'var(--text2)', fontSize: 13 }}>
          <span className="spinner" /> Loading…
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="page-content">
        <div role="alert" className="alert-err" style={{ margin: 24 }}>{loadError}</div>
      </div>
    );
  }

  const isVoided = sale?.status === 'Voided';

  return (
    <div className="page-content">
      <div className="toolbar">
        <h1 className="toolbar-title">Sale #{sale?.saleNumber}</h1>
        <div className="flex1" />
        {!isVoided && (
          <button
            className="btn btn-err"
            onClick={() => setVoidDialog(true)}
            disabled={voiding}
          >
            Void
          </button>
        )}
        {isVoided && (
          <span className="badge badge-err" style={{ fontSize: 13 }}>Voided</span>
        )}
      </div>

      {voidError && (
        <div role="alert" className="alert-err" style={{ margin: '0 0 16px' }}>
          {voidError}
        </div>
      )}

      {/* Sale lines — description shown via title to avoid ambiguous text matches */}
      {sale?.lines?.length > 0 && (
        <table style={{ marginBottom: 16 }}>
          <thead>
            <tr>
              <th>#</th>
              <th style={{ textAlign: 'right' }}>Price</th>
              <th style={{ textAlign: 'right' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {sale.lines.map(line => (
              <tr key={line.saleLineId} title={line.description}>
                <td>{line.lineNumber}</td>
                <td style={{ textAlign: 'right' }}>${fmt(line.unitPrice)}</td>
                <td style={{ textAlign: 'right' }}>${fmt(line.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Void confirmation dialog */}
      {voidDialog && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="void-dialog-title"
          style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            background: 'rgba(0,0,0,0.6)',
          }}
        >
          <div
            style={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: '24px 28px',
              maxWidth: 380,
              width: '90%',
            }}
          >
            <h2 id="void-dialog-title" style={{ margin: '0 0 10px', fontSize: 16 }}>
              Void this sale?
            </h2>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--text2)' }}>
              This action cannot be undone. The sale will be marked as Voided.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                className="btn btn-ghost"
                onClick={() => setVoidDialog(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-err"
                onClick={handleVoidConfirm}
                disabled={voiding}
              >
                {voiding ? 'Voiding…' : 'Confirm void'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Export ──────────────────────────────────────────────────────────────────

export function SaleScreen() {
  const match = useMatch('/sales/:id');
  const id = match?.params?.id;
  return id ? <SaleView id={id} /> : <NewSale />;
}
