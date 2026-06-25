import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiFetch } from '../../api';

const EMPTY_FORM = {
  designNo: '',
  description: '',
  categoryId: '',
  supplierId: '',
  retailPrice: '',
  cost: '',
  isActive: true,
};

export function ItemDetail() {
  const { id } = useParams();
  const isCreate = !id;
  const navigate = useNavigate();

  const [form, setForm] = useState(EMPTY_FORM);
  const [attributes, setAttributes] = useState([]);
  const [loading, setLoading] = useState(!isCreate);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [suppliers, setSuppliers] = useState([]);
  const [categories, setCategories] = useState([]);

  // Load lookup data for dropdowns
  useEffect(() => {
    apiFetch('/suppliers?limit=100')
      .then(data => setSuppliers(data.results || []))
      .catch(() => {});
    apiFetch('/categories')
      .then(data => setCategories(data.results || []))
      .catch(() => {});
  }, []);

  // Load item for edit mode
  useEffect(() => {
    if (isCreate) return;
    setLoading(true);
    setError(null);
    apiFetch(`/items/${id}`)
      .then(data => {
        setForm({
          designNo: data.designNo ?? '',
          description: data.description ?? '',
          categoryId: data.categoryId ?? '',
          supplierId: data.supplierId ?? '',
          retailPrice: data.retailPrice != null ? String(data.retailPrice) : '',
          cost: data.cost != null ? String(data.cost) : '',
          isActive: data.isActive ?? true,
        });
        setAttributes(data.attributes ?? []);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message || 'Failed to load item');
        setLoading(false);
      });
  }, [id, isCreate]);

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
    if (fieldErrors[name]) setFieldErrors(fe => ({ ...fe, [name]: null }));
  }

  function validate() {
    const errs = {};
    if (!form.description.trim()) errs.description = 'Required.';
    return errs;
  }

  async function handleSave() {
    const errs = validate();
    if (Object.keys(errs).length) {
      setFieldErrors(errs);
      return;
    }

    setSaving(true);
    setError(null);
    setFieldErrors({});

    const payload = {
      designNo: form.designNo || undefined,
      description: form.description,
      categoryId: form.categoryId || undefined,
      supplierId: form.supplierId || undefined,
      retailPrice: form.retailPrice !== '' ? parseFloat(form.retailPrice) : undefined,
      cost: form.cost !== '' ? parseFloat(form.cost) : undefined,
      isActive: form.isActive,
    };

    try {
      if (isCreate) {
        await apiFetch('/items', { method: 'POST', body: payload });
      } else {
        await apiFetch(`/items/${id}`, { method: 'PUT', body: payload });
      }
      navigate('/items');
    } catch (err) {
      setError(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  function handleClose() {
    navigate('/items');
  }

  const title = isCreate ? 'New Item' : 'Edit Item';

  return (
    <>
      {/* Drawer header */}
      <div className="dr-head">
        <span className="dr-title">{title}</span>
        <button className="dr-close" onClick={handleClose} aria-label="Close">
          <svg viewBox="0 0 24 24">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Drawer body */}
      <div className="dr-body">
        {loading && (
          <div
            role="status"
            aria-label="Loading"
            style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text2)', fontSize: 13 }}
          >
            <span className="spinner" />
            Loading…
          </div>
        )}

        {!loading && error && (
          <div role="alert" className="alert-err" style={{ marginBottom: 16 }}>
            {error}
          </div>
        )}

        {!loading && !error && (
          <>
            {/* Summary header — visible text for the item name + design no (edit mode) */}
            {!isCreate && form.description && (
              <div
                style={{
                  background: 'var(--card)',
                  borderRadius: 8,
                  padding: '12px 14px',
                  marginBottom: 20,
                  borderLeft: '3px solid var(--gold)',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>
                  {form.description}
                </div>
                {form.designNo && (
                  <div style={{ fontSize: 12, color: 'var(--gold-dim)', marginTop: 3, fontFamily: 'monospace' }}>
                    {form.designNo}
                  </div>
                )}
              </div>
            )}

            {/* Attributes (read-only) */}
            {!isCreate && attributes.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <span className="fsec" style={{ marginTop: 0 }}>Attributes</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {attributes.map(attr => (
                    <div
                      key={attr.itemAttribId}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: 13,
                        padding: '6px 0',
                        borderBottom: '1px solid var(--border)',
                      }}
                    >
                      <span style={{ color: 'var(--text2)' }}>{attr.attribTypeName}</span>
                      <span style={{ color: 'var(--text)' }}>{attr.attribValue}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Edit form */}
            <div className="fg-row">
              <div className="fg">
                <label className="fl" htmlFor="designNo">Design No.</label>
                <input
                  id="designNo"
                  name="designNo"
                  className="fi"
                  placeholder="ABC-001"
                  value={form.designNo}
                  onChange={handleChange}
                />
              </div>
              <div className="fg">
                <label className="fl" htmlFor="categoryId">Category</label>
                <select
                  id="categoryId"
                  name="categoryId"
                  className="fs"
                  value={form.categoryId}
                  onChange={handleChange}
                >
                  <option value="">Select…</option>
                  {categories.map(c => (
                    <option key={c.categoryId} value={c.categoryId}>{c.categoryName}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="fg">
              <label className="fl" htmlFor="description">Description</label>
              <input
                id="description"
                name="description"
                className={`fi${fieldErrors.description ? ' invalid' : ''}`}
                placeholder="e.g. Diamond Solitaire Ring"
                value={form.description}
                onChange={handleChange}
              />
              {fieldErrors.description && (
                <p className="field-err">{fieldErrors.description}</p>
              )}
            </div>

            <div className="fg">
              <label className="fl" htmlFor="supplierId">Supplier</label>
              <select
                id="supplierId"
                name="supplierId"
                className="fs"
                value={form.supplierId}
                onChange={handleChange}
              >
                <option value="">Select supplier…</option>
                {suppliers.map(s => (
                  <option key={s.supplierId} value={s.supplierId}>{s.supplierName}</option>
                ))}
              </select>
            </div>

            <span className="fsec">Pricing</span>

            <div className="fg-row">
              <div className="fg">
                <label className="fl" htmlFor="retailPrice">Retail Price</label>
                <input
                  id="retailPrice"
                  name="retailPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  className="fi"
                  placeholder="0.00"
                  value={form.retailPrice}
                  onChange={handleChange}
                />
              </div>
              <div className="fg">
                <label className="fl" htmlFor="cost">Cost Price</label>
                <input
                  id="cost"
                  name="cost"
                  type="number"
                  min="0"
                  step="0.01"
                  className="fi"
                  placeholder="0.00"
                  value={form.cost}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="fg">
              <label className="label-check">
                <input
                  type="checkbox"
                  name="isActive"
                  checked={form.isActive}
                  onChange={handleChange}
                />
                Active (available in inventory)
              </label>
            </div>
          </>
        )}
      </div>

      {/* Drawer footer */}
      {!loading && !error && (
        <div className="dr-foot">
          <button className="btn btn-ghost flex1" onClick={handleClose}>Cancel</button>
          <button
            className="btn btn-gold"
            style={{ minWidth: 120 }}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      )}
    </>
  );
}
