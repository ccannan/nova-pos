import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiFetch } from '../../api';

const EMPTY_FORM = { firstName: '', lastName: '', notes: '' };
const EMPTY_CONTACT = { contactType: 'Phone', label: '', value: '' };

function formatContactValue(c) {
  if (c.contactType === 'Address') {
    const parts = [c.addressLine1, c.addressLine2].filter(Boolean);
    const cityState = [c.city, c.state, c.postcode].filter(Boolean).join(' ');
    if (cityState) parts.push(cityState);
    if (c.country) parts.push(c.country);
    return parts.join(', ');
  }
  return c.value;
}

export function CustomerDetail() {
  const { id } = useParams();
  const isCreate = !id;
  const navigate = useNavigate();

  const [form, setForm] = useState(EMPTY_FORM);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(!isCreate);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  const [showContactForm, setShowContactForm] = useState(false);
  const [contactForm, setContactForm] = useState(EMPTY_CONTACT);
  const [contactFieldErrors, setContactFieldErrors] = useState({});
  const [contactSaving, setContactSaving] = useState(false);

  useEffect(() => {
    if (isCreate) return;
    setLoading(true);
    setError(null);
    apiFetch(`/customers/${id}`)
      .then(data => {
        setForm({
          firstName: data.firstName ?? '',
          lastName: data.lastName ?? '',
          notes: data.notes ?? '',
        });
        setContacts(data.contacts ?? []);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message || 'Failed to load customer');
        setLoading(false);
      });
  }, [id, isCreate]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
    if (fieldErrors[name]) setFieldErrors(fe => ({ ...fe, [name]: null }));
  }

  async function handleSave() {
    const errs = {};
    if (!form.lastName.trim()) errs.lastName = 'Required.';
    if (Object.keys(errs).length) { setFieldErrors(errs); return; }

    setSaving(true);
    setError(null);
    setFieldErrors({});
    try {
      if (isCreate) {
        await apiFetch('/customers', { method: 'POST', body: form });
      } else {
        await apiFetch(`/customers/${id}`, { method: 'PUT', body: form });
      }
      navigate('/customers');
    } catch (err) {
      setError(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  function handleContactChange(e) {
    const { name, value } = e.target;
    setContactForm(f => ({ ...f, [name]: value }));
    if (contactFieldErrors[name]) setContactFieldErrors(fe => ({ ...fe, [name]: null }));
  }

  async function handleAddContact() {
    const errs = {};
    if (!contactForm.value.trim()) errs.value = 'Value is required.';
    if (Object.keys(errs).length) { setContactFieldErrors(errs); return; }

    setContactSaving(true);
    try {
      const payload = {
        contactType: contactForm.contactType,
        label: contactForm.label || undefined,
        value: contactForm.value,
      };
      const created = await apiFetch(`/customers/${id}/contacts`, { method: 'POST', body: payload });
      setContacts(prev => [...prev, created]);
      setContactForm(EMPTY_CONTACT);
      setShowContactForm(false);
    } catch (err) {
      if (err.data?.fields) {
        setContactFieldErrors(err.data.fields);
      } else {
        setContactFieldErrors({ value: err.message || 'Failed to add contact' });
      }
    } finally {
      setContactSaving(false);
    }
  }

  const title = isCreate ? 'New Customer' : 'Edit Customer';

  return (
    <>
      <div className="dr-head">
        <span className="dr-title">{title}</span>
        <button className="dr-close" onClick={() => navigate('/customers')} aria-label="Close">
          <svg viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" /></svg>
        </button>
      </div>

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
            {/* Summary header — visible name text for tests and UX */}
            {!isCreate && (form.firstName || form.lastName) && (
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
                  {form.firstName} {form.lastName}
                </div>
              </div>
            )}

            {/* Customer fields */}
            <div className="fg-row">
              <div className="fg">
                <label className="fl" htmlFor="firstName">First Name</label>
                <input
                  id="firstName"
                  name="firstName"
                  className="fi"
                  placeholder="Jane"
                  value={form.firstName}
                  onChange={handleChange}
                />
              </div>
              <div className="fg">
                <label className="fl" htmlFor="lastName">Last Name</label>
                <input
                  id="lastName"
                  name="lastName"
                  className={`fi${fieldErrors.lastName ? ' invalid' : ''}`}
                  placeholder="Smith"
                  value={form.lastName}
                  onChange={handleChange}
                />
                {fieldErrors.lastName && <p className="field-err">{fieldErrors.lastName}</p>}
              </div>
            </div>

            <div className="fg">
              <label className="fl" htmlFor="notes">Notes</label>
              <textarea
                id="notes"
                name="notes"
                className="fi"
                rows={3}
                placeholder="Any notes about this customer…"
                value={form.notes}
                onChange={handleChange}
                style={{ resize: 'vertical' }}
              />
            </div>

            {/* Contacts section */}
            {!isCreate && (
              <div style={{ marginTop: 24 }}>
                <span className="fsec" style={{ marginTop: 0 }}>Contacts</span>

                {contacts.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                    {contacts.map(c => (
                      <div
                        key={c.custContactId}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 10,
                          fontSize: 13,
                          padding: '6px 0',
                          borderBottom: '1px solid var(--border)',
                        }}
                      >
                        <span
                          style={{
                            minWidth: 52,
                            fontSize: 11,
                            color: 'var(--muted)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            paddingTop: 1,
                          }}
                        >
                          {c.label}
                        </span>
                        <span style={{ color: 'var(--text2)', minWidth: 52, fontSize: 11 }}>
                          {c.contactType}
                        </span>
                        <span style={{ color: 'var(--text)', flex: 1 }}>
                          {formatContactValue(c)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add contact button — hidden while sub-form is open */}
                {!showContactForm && (
                  <button
                    className="btn btn-ghost"
                    style={{ fontSize: 13 }}
                    onClick={() => { setContactForm(EMPTY_CONTACT); setContactFieldErrors({}); setShowContactForm(true); }}
                  >
                    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" strokeWidth="2" strokeLinecap="round">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                    Add Contact
                  </button>
                )}

                {/* Inline contact sub-form */}
                {showContactForm && (
                  <div
                    style={{
                      background: 'var(--card)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      padding: '14px 14px 10px',
                      marginTop: 8,
                    }}
                  >
                    <div className="fg-row">
                      <div className="fg">
                        <label className="fl" htmlFor="contactType">Contact Type</label>
                        <select
                          id="contactType"
                          name="contactType"
                          className="fs"
                          value={contactForm.contactType}
                          onChange={handleContactChange}
                        >
                          <option value="Phone">Phone</option>
                          <option value="Email">Email</option>
                          <option value="Address">Address</option>
                        </select>
                      </div>
                      <div className="fg">
                        <label className="fl" htmlFor="contactLabel">Label</label>
                        <input
                          id="contactLabel"
                          name="label"
                          className="fi"
                          placeholder="Mobile, Work, Home…"
                          value={contactForm.label}
                          onChange={handleContactChange}
                        />
                      </div>
                    </div>

                    <div className="fg">
                      <label className="fl" htmlFor="contactValue">Value</label>
                      <input
                        id="contactValue"
                        name="value"
                        className={`fi${contactFieldErrors.value ? ' invalid' : ''}`}
                        placeholder="e.g. 0412 000 000"
                        value={contactForm.value}
                        onChange={handleContactChange}
                      />
                      {contactFieldErrors.value && (
                        <p className="field-err">{contactFieldErrors.value}</p>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                      <button
                        className="btn btn-ghost"
                        onClick={() => { setShowContactForm(false); setContactFieldErrors({}); }}
                      >
                        Cancel
                      </button>
                      <button
                        className="btn btn-gold"
                        onClick={handleAddContact}
                        disabled={contactSaving}
                      >
                        {contactSaving ? 'Adding…' : 'Add'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer — Save hidden while contact sub-form is open */}
      <div className="dr-foot">
        <button className="btn btn-ghost flex1" onClick={() => navigate('/customers')}>
          Close
        </button>
        {!loading && !error && !showContactForm && (
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
