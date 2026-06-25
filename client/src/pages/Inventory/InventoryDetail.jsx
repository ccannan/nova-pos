import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiFetch } from '../../api';

const DEFAULT_STORE = '20000001-0000-0000-0000-000000000001';

const EMPTY_FORM = {
  itemId: '',
  storeId: DEFAULT_STORE,
  acquisitionDate: new Date().toISOString().slice(0, 10),
  cost: '',
  retailPrice: '',
  notes: '',
};

export function InventoryDetail() {
  const { id } = useParams();
  const isCreate = !id;
  const navigate = useNavigate();

  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(!isCreate);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  const [items, setItems] = useState([]);
  const [stores, setStores] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [itemSearch, setItemSearch] = useState('');
  const [itemSearchResults, setItemSearchResults] = useState([]);

  // Load lookups
  useEffect(() => {
    apiFetch('/stores').then(d => setStores(d.results || [])).catch(() => {});
    apiFetch('/item-status').then(d => setStatuses(d.results || [])).catch(() => {});
  }, []);

  // Load inventory item for edit
  useEffect(() => {
    if (isCreate) return;
    setLoading(true);
    setError(null);
    apiFetch(`/inventory/${id}`)
      .then(data => {
        setForm({
          itemId: data.itemId ?? '',
          storeId: data.storeId ?? DEFAULT_STORE,
          acquisitionDate: data.acquisitionDate ? data.acquisitionDate.slice(0, 10) : '',
          cost: data.cost != null ? String(parseFloat(data.cost)) : '',
          retailPrice: data.retailPrice != null ? String(parseFloat(data.retailPrice)) : '',
          notes: data.notes ?? '',
          statusId: data.statusId ?? '',
        });
        setLoading(false);
      })
      .catch(err => {
        setError(err.message || 'Failed to load inventory item');
        setLoading(false);
      });
  }, [id, isCreate]);

  // Item search debounce (create mode only)
  useEffect(() => {
    if (!itemSearch) { setItemSearchResults([]); return; }
    const timer = setTimeout(() => {
      apiFetch(`/items?search=${encodeURIComponent(itemSearch)}&limit=10`)
        .then(d => setItemSearchResults(d.results || []))
        .catch(() => {});
    }, 300);
    return () => clearTimeout(timer);
  }, [itemSearch]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
    if (fieldErrors[name]) setFieldErrors(fe => ({ ...fe, [name]: null }));
  }

  function selectItem(item) {
    setForm(f => ({ ...f, itemId: item.itemId }));
    setItemSearch(item.description + (item.designNo ? ` (${item.designNo})` : ''));
    setItemSearchResults([]);
  }

  async function handleSave() {
    const errs = {};
    if (isCreate && !form.itemId) errs.itemId = 'Select an item.';
    if (!form.storeId) errs.storeId = 'Required.';
    if (!form.acquisitionDate) errs.acquisitionDate = 'Required.';
    if (Object.keys(errs).length) { setFieldErrors(errs); return; }

    setSaving(true);
    setError(null);
    setFieldErrors({});

    try {
      if (isCreate) {
        const body = {
          itemId: form.itemId,
          storeId: form.storeId,
          acquisitionDate: form.acquisitionDate,
          cost: form.cost ? parseFloat(form.cost) : null,
          retailPrice: form.retailPrice ? parseFloat(form.retailPrice) : null,
          notes: form.notes || '',
        };
        await apiFetch('/inventory', { method: 'POST', body });
      } else {
        const body = {
          storeId: form.storeId,
          cost: form.cost ? parseFloat(form.cost) : null,
          retailPrice: form.retailPrice ? parseFloat(form.retailPrice) : null,
          notes: form.notes || '',
        };
        if (form.statusId) body.statusId = form.statusId;
        await apiFetch(`/inventory/${id}`, { method: 'PUT', body });
      }
      navigate('/inventory');
    } catch (err) {
      if (err.data?.fields) {
        setFieldErrors(err.data.fields);
      } else {
        setError(err.message || 'Save failed');
      }
    } finally {
      setSaving(false);
    }
  }

  const title = isCreate ? 'Add to Stock' : 'Edit Stock Item';

  return (
    <>
      <div className="dr-head">
        <span className="dr-title">{title}</span>
        <button className="dr-close" onClick={() => navigate('/inventory')} aria-label="Close">
          <svg viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" /></svg>
        </button>
      </div>

      <div className="dr-body">
        {loading && (
          <div role="status" aria-label="Loading"
            style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text2)', fontSize: 13 }}>
            <span className="spinner" /> Loading…
          </div>
        )}

        {!loading && error && (
          <div role="alert" className="alert-err" style={{ marginBottom: 16 }}>{error}</div>
        )}

        {!loading && !error && (
          <>
            {/* Item search — create only */}
            {isCreate && (
              <div className="fg" style={{ position: 'relative' }}>
                <label className="fl">Item design</label>
                <input
                  className={`fi${fieldErrors.itemId ? ' invalid' : ''}`}
                  placeholder="Search by description or design no…"
                  value={itemSearch}
                  onChange={e => { setItemSearch(e.target.value); setForm(f => ({ ...f, itemId: '' })); }}
                  autoComplete="off"
                />
                {fieldErrors.itemId && <p className="field-err">{fieldErrors.itemId}</p>}
                {itemSearchResults.length > 0 && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0,
                    background: 'var(--card)', border: '1px solid var(--border)',
                    borderRadius: 6, zIndex: 20, maxHeight: 200, overflowY: 'auto',
                  }}>
                    {itemSearchResults.map(item => (
                      <button
                        key={item.itemId}
                        onClick={() => selectItem(item)}
                        style={{
                          display: 'block', width: '100%', textAlign: 'left',
                          padding: '8px 12px', fontSize: 13, background: 'none',
                          border: 'none', cursor: 'pointer', color: 'var(--text)',
                        }}
                      >
                        <strong style={{ color: 'var(--gold-dim)', marginRight: 6, fontSize: 11 }}>
                          {item.designNo}
                        </strong>
                        {item.description}
                        <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--muted)' }}>
                          ${Number(item.retailPrice).toFixed(2)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Store */}
            <div className="fg">
              <label className="fl" htmlFor="storeId">Store</label>
              <select
                id="storeId"
                name="storeId"
                className={`fs${fieldErrors.storeId ? ' invalid' : ''}`}
                value={form.storeId}
                onChange={handleChange}
              >
                <option value="">— select —</option>
                {stores.map(s => (
                  <option key={s.storeId} value={s.storeId}>{s.storeName}</option>
                ))}
              </select>
              {fieldErrors.storeId && <p className="field-err">{fieldErrors.storeId}</p>}
            </div>

            {/* Acquisition date — create only */}
            {isCreate && (
              <div className="fg">
                <label className="fl" htmlFor="acquisitionDate">Acquisition date</label>
                <input
                  id="acquisitionDate"
                  name="acquisitionDate"
                  type="date"
                  className={`fi${fieldErrors.acquisitionDate ? ' invalid' : ''}`}
                  value={form.acquisitionDate}
                  onChange={handleChange}
                />
                {fieldErrors.acquisitionDate && <p className="field-err">{fieldErrors.acquisitionDate}</p>}
              </div>
            )}

            {/* Status — edit only */}
            {!isCreate && statuses.length > 0 && (
              <div className="fg">
                <label className="fl" htmlFor="statusId">Status</label>
                <select
                  id="statusId"
                  name="statusId"
                  className="fs"
                  value={form.statusId || ''}
                  onChange={handleChange}
                >
                  <option value="">— unchanged —</option>
                  {statuses.map(s => (
                    <option key={s.itemStatusId} value={s.itemStatusId}>{s.statusName}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Price overrides */}
            <div className="fg-row">
              <div className="fg">
                <label className="fl" htmlFor="retailPrice">Retail price override</label>
                <input
                  id="retailPrice"
                  name="retailPrice"
                  type="number"
                  className="fi"
                  placeholder="Leave blank to inherit"
                  value={form.retailPrice}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                />
              </div>
              <div className="fg">
                <label className="fl" htmlFor="cost">Cost override</label>
                <input
                  id="cost"
                  name="cost"
                  type="number"
                  className="fi"
                  placeholder="Leave blank to inherit"
                  value={form.cost}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                />
              </div>
            </div>

            {/* Notes */}
            <div className="fg">
              <label className="fl" htmlFor="notes">Notes</label>
              <textarea
                id="notes"
                name="notes"
                className="fi"
                rows={3}
                placeholder="Any notes about this piece…"
                value={form.notes}
                onChange={handleChange}
                style={{ resize: 'vertical' }}
              />
            </div>
          </>
        )}
      </div>

      <div className="dr-foot">
        <button className="btn btn-ghost flex1" onClick={() => navigate('/inventory')}>
          Close
        </button>
        {!loading && !error && (
          <button
            className="btn btn-gold"
            style={{ minWidth: 120 }}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        )}
      </div>
    </>
  );
}
