import React, { useState } from 'react';
import { useEvents, SchoolEvent, EventFormData } from '../hooks/useEvents';
import { useAuth } from '../context/AuthContext';

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmt(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-KE', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function daysFromNow(dateStr: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + 'T00:00:00');
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff < 0) return `${Math.abs(diff)}d ago`;
  return `In ${diff}d`;
}

const CATEGORY_COLORS: Record<string, string> = {
  Academic:  'bg-blue-100 text-blue-700',
  Sports:    'bg-green-100 text-green-700',
  Cultural:  'bg-purple-100 text-purple-700',
  Meeting:   'bg-yellow-100 text-yellow-700',
  Holiday:   'bg-red-100 text-red-700',
  Exam:      'bg-orange-100 text-orange-700',
  Other:     'bg-gray-100 text-gray-600',
};

const EMPTY_FORM: EventFormData = {
  title: '',
  description: '',
  event_date: '',
  event_time: '',
  category: 'Academic',
};

// ─── Modal ────────────────────────────────────────────────────────────────────

interface ModalProps {
  mode: 'add' | 'edit';
  initial: EventFormData;
  categories: string[];
  onSave: (form: EventFormData) => Promise<void>;
  onClose: () => void;
  saving: boolean;
  saveError: string | null;
}

function EventModal({ mode, initial, categories, onSave, onClose, saving, saveError }: ModalProps) {
  const [form, setForm] = useState<EventFormData>(initial);

  const set = (field: keyof EventFormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.event_date) return;
    await onSave(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800">
            {mode === 'add' ? 'Add New Event' : 'Edit Event'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.title}
              onChange={set('title')}
              placeholder="e.g. End of Term Exam"
              required
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Date + Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={form.event_date}
                onChange={set('event_date')}
                required
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
              <input
                type="time"
                value={form.event_time}
                onChange={set('event_time')}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              value={form.category}
              onChange={set('category')}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            >
              {categories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={set('description')}
              placeholder="Optional details about this event…"
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          {saveError && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{saveError}</p>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >
              {saving ? 'Saving…' : mode === 'add' ? 'Add Event' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Delete Confirm ───────────────────────────────────────────────────────────

function DeleteConfirm({
  event,
  onConfirm,
  onCancel,
  deleting,
}: {
  event: SchoolEvent;
  onConfirm: () => void;
  onCancel: () => void;
  deleting: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-gray-800">Delete Event</h3>
            <p className="text-sm text-gray-500 mt-0.5">This action cannot be undone.</p>
          </div>
        </div>
        <p className="text-sm text-gray-700 mb-5">
          Are you sure you want to delete <strong>"{event.title}"</strong>?
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-60 transition-colors"
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main EventsManager ───────────────────────────────────────────────────────

interface EventsManagerProps {
  /** If true, shows full CRUD management view (school admin).
   *  If false, shows compact read-only upcoming list (dashboard widget). */
  adminMode?: boolean;
}

export function EventsManager({ adminMode = false }: EventsManagerProps) {
  const { role } = useAuth();
  const isAdmin = adminMode || role === 'school_admin' || role === 'admin';

  const {
    events,
    upcomingEvents,
    loading,
    error,
    addEvent,
    updateEvent,
    deleteEvent,
    EVENT_CATEGORIES,
  } = useEvents();

  const [showAdd, setShowAdd]       = useState(false);
  const [editTarget, setEditTarget] = useState<SchoolEvent | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SchoolEvent | null>(null);
  const [saving, setSaving]         = useState(false);
  const [deleting, setDeleting]     = useState(false);
  const [saveError, setSaveError]   = useState<string | null>(null);
  const [filter, setFilter]         = useState<'upcoming' | 'all'>('upcoming');

  const displayEvents = filter === 'upcoming' ? upcomingEvents : events;

  const handleAdd = async (form: EventFormData) => {
    setSaving(true);
    setSaveError(null);
    const { error: err } = await addEvent(form);
    setSaving(false);
    if (err) { setSaveError(err); return; }
    setShowAdd(false);
  };

  const handleEdit = async (form: EventFormData) => {
    if (!editTarget) return;
    setSaving(true);
    setSaveError(null);
    const { error: err } = await updateEvent(editTarget.id, form);
    setSaving(false);
    if (err) { setSaveError(err); return; }
    setEditTarget(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    await deleteEvent(deleteTarget.id);
    setDeleting(false);
    setDeleteTarget(null);
  };

  // ── Compact widget for dashboard (read-only) ──────────────────────────────
  if (!isAdmin) {
    return (
      <div className="space-y-2">
        {loading && (
          <div className="flex items-center gap-2 py-4 text-sm text-gray-500">
            <div className="w-4 h-4 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
            Loading events…
          </div>
        )}
        {!loading && error && (
          <p className="text-sm text-red-500 py-2">{error}</p>
        )}
        {!loading && !error && upcomingEvents.length === 0 && (
          <p className="text-sm text-gray-400 py-4 text-center">No upcoming events.</p>
        )}
        {!loading && upcomingEvents.map(ev => (
          <EventRow key={ev.id} event={ev} />
        ))}
      </div>
    );
  }

  // ── Full admin management view ────────────────────────────────────────────
  return (
    <>
      {/* Modals */}
      {showAdd && (
        <EventModal
          mode="add"
          initial={EMPTY_FORM}
          categories={EVENT_CATEGORIES}
          onSave={handleAdd}
          onClose={() => { setShowAdd(false); setSaveError(null); }}
          saving={saving}
          saveError={saveError}
        />
      )}
      {editTarget && (
        <EventModal
          mode="edit"
          initial={{
            title:       editTarget.title,
            description: editTarget.description ?? '',
            event_date:  editTarget.event_date,
            event_time:  editTarget.event_time ?? '',
            category:    editTarget.category ?? 'Other',
          }}
          categories={EVENT_CATEGORIES}
          onSave={handleEdit}
          onClose={() => { setEditTarget(null); setSaveError(null); }}
          saving={saving}
          saveError={saveError}
        />
      )}
      {deleteTarget && (
        <DeleteConfirm
          event={deleteTarget}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          deleting={deleting}
        />
      )}

      {/* Panel */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="font-semibold text-gray-800">Events</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {events.length} total · {upcomingEvents.length} upcoming
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Filter tabs */}
            <div className="flex bg-gray-100 rounded-lg p-0.5 text-xs">
              {(['upcoming', 'all'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-md font-medium transition-all capitalize ${
                    filter === f
                      ? 'bg-white text-gray-800 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
            {/* Add button */}
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              Add Event
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="divide-y divide-gray-50">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-400">
              <div className="w-4 h-4 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
              Loading…
            </div>
          )}
          {!loading && error && (
            <p className="text-sm text-red-500 text-center py-8">{error}</p>
          )}
          {!loading && !error && displayEvents.length === 0 && (
            <div className="text-center py-12">
              <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-sm text-gray-400">
                {filter === 'upcoming' ? 'No upcoming events.' : 'No events yet.'}
              </p>
              <button
                onClick={() => setShowAdd(true)}
                className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                + Add the first event
              </button>
            </div>
          )}
          {!loading && !error && displayEvents.map(ev => (
            <EventRow
              key={ev.id}
              event={ev}
              onEdit={() => setEditTarget(ev)}
              onDelete={() => setDeleteTarget(ev)}
            />
          ))}
        </div>
      </div>
    </>
  );
}

// ─── Shared row ───────────────────────────────────────────────────────────────

function EventRow({
  event,
  onEdit,
  onDelete,
}: {
  event: SchoolEvent;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const badge = CATEGORY_COLORS[event.category ?? 'Other'] ?? CATEGORY_COLORS['Other'];
  const relative = daysFromNow(event.event_date);
  const isPast = event.event_date < new Date().toISOString().split('T')[0];

  return (
    <div className={`flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors ${isPast ? 'opacity-60' : ''}`}>
      {/* Date badge */}
      <div className="flex-shrink-0 w-11 text-center">
        <div className="text-lg font-bold text-gray-800 leading-none">
          {new Date(event.event_date + 'T00:00:00').getDate()}
        </div>
        <div className="text-[10px] uppercase tracking-wide text-gray-400 font-medium">
          {new Date(event.event_date + 'T00:00:00').toLocaleDateString('en-KE', { month: 'short' })}
        </div>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium text-gray-800 truncate">{event.title}</p>
          {event.category && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${badge}`}>
              {event.category}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <p className="text-xs text-gray-400">{fmt(event.event_date)}</p>
          {event.event_time && (
            <span className="text-xs text-gray-400">· {event.event_time}</span>
          )}
          {event.description && (
            <span className="text-xs text-gray-400 truncate hidden sm:inline">
              · {event.description}
            </span>
          )}
        </div>
      </div>

      {/* Relative time */}
      <span className={`text-xs font-medium flex-shrink-0 ${
        relative === 'Today' ? 'text-green-600' :
        relative === 'Tomorrow' ? 'text-blue-600' :
        isPast ? 'text-gray-400' : 'text-gray-500'
      }`}>
        {relative}
      </span>

      {/* Admin actions */}
      {(onEdit || onDelete) && (
        <div className="flex items-center gap-1 flex-shrink-0">
          {onEdit && (
            <button
              onClick={onEdit}
              className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
              title="Edit"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
              title="Delete"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Compact dashboard widget (for the dashboard card) ───────────────────────

export function UpcomingEventsWidget({ isAdmin }: { isAdmin: boolean }) {
  const {
    upcomingEvents,
    loading,
    error,
    addEvent,
    updateEvent,
    deleteEvent,
    EVENT_CATEGORIES,
  } = useEvents();

  const [showAdd, setShowAdd]       = useState(false);
  const [editTarget, setEditTarget] = useState<SchoolEvent | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SchoolEvent | null>(null);
  const [saving, setSaving]         = useState(false);
  const [deleting, setDeleting]     = useState(false);
  const [saveError, setSaveError]   = useState<string | null>(null);

  const handleAdd = async (form: EventFormData) => {
    setSaving(true); setSaveError(null);
    const { error: err } = await addEvent(form);
    setSaving(false);
    if (err) { setSaveError(err); return; }
    setShowAdd(false);
  };

  const handleEdit = async (form: EventFormData) => {
    if (!editTarget) return;
    setSaving(true); setSaveError(null);
    const { error: err } = await updateEvent(editTarget.id, form);
    setSaving(false);
    if (err) { setSaveError(err); return; }
    setEditTarget(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    await deleteEvent(deleteTarget.id);
    setDeleting(false);
    setDeleteTarget(null);
  };

  return (
    <>
      {showAdd && (
        <EventModal mode="add" initial={EMPTY_FORM} categories={EVENT_CATEGORIES}
          onSave={handleAdd} onClose={() => { setShowAdd(false); setSaveError(null); }}
          saving={saving} saveError={saveError} />
      )}
      {editTarget && (
        <EventModal mode="edit"
          initial={{ title: editTarget.title, description: editTarget.description ?? '',
            event_date: editTarget.event_date, event_time: editTarget.event_time ?? '',
            category: editTarget.category ?? 'Other' }}
          categories={EVENT_CATEGORIES}
          onSave={handleEdit} onClose={() => { setEditTarget(null); setSaveError(null); }}
          saving={saving} saveError={saveError} />
      )}
      {deleteTarget && (
        <DeleteConfirm event={deleteTarget} onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)} deleting={deleting} />
      )}

      {/* Widget header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">Upcoming Events</h3>
        {isAdmin && (
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Add
          </button>
        )}
      </div>

      {/* List */}
      <div className="space-y-1.5">
        {loading && (
          <div className="flex items-center gap-2 py-3 text-xs text-gray-400">
            <div className="w-3.5 h-3.5 border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
            Loading…
          </div>
        )}
        {!loading && error && <p className="text-xs text-red-400">{error}</p>}
        {!loading && !error && upcomingEvents.length === 0 && (
          <div className="text-center py-6">
            <p className="text-xs text-gray-400">No upcoming events</p>
            {isAdmin && (
              <button onClick={() => setShowAdd(true)}
                className="mt-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium">
                + Schedule one
              </button>
            )}
          </div>
        )}
        {!loading && !error && upcomingEvents.map(ev => {
          const badge = CATEGORY_COLORS[ev.category ?? 'Other'] ?? CATEGORY_COLORS['Other'];
          const relative = daysFromNow(ev.event_date);
          return (
            <div key={ev.id}
              className="flex items-start gap-2.5 p-2.5 rounded-lg hover:bg-gray-50 transition-colors group">
              {/* left colour strip */}
              <div className={`w-1 self-stretch rounded-full flex-shrink-0 ${
                ev.category === 'Exam' ? 'bg-orange-400' :
                ev.category === 'Meeting' ? 'bg-yellow-400' :
                ev.category === 'Sports' ? 'bg-green-400' :
                ev.category === 'Holiday' ? 'bg-red-400' :
                'bg-blue-400'
              }`} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-700 truncate">{ev.title}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] text-gray-400">{fmt(ev.event_date)}</span>
                  {ev.category && (
                    <span className={`text-[10px] px-1 py-px rounded font-semibold ${badge}`}>
                      {ev.category}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <span className={`text-[10px] font-semibold flex-shrink-0 ${
                  relative === 'Today' ? 'text-green-600' :
                  relative === 'Tomorrow' ? 'text-blue-600' : 'text-gray-400'
                }`}>{relative}</span>
                {isAdmin && (
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => setEditTarget(ev)}
                      className="p-1 rounded text-gray-300 hover:text-blue-500 transition-colors">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button onClick={() => setDeleteTarget(ev)}
                      className="p-1 rounded text-gray-300 hover:text-red-500 transition-colors">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

export default EventsManager;
