import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';

export interface SchoolEvent {
  id: string;
  school_id: string;
  title: string;
  description: string | null;
  event_date: string;
  event_time: string | null;
  category: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface EventFormData {
  title: string;
  description: string;
  event_date: string;
  event_time: string;
  category: string;
}

const EVENT_CATEGORIES = [
  'Academic',
  'Sports',
  'Cultural',
  'Meeting',
  'Holiday',
  'Exam',
  'Other',
];

export function useEvents() {
  const { user } = useAuth();
  const [events, setEvents] = useState<SchoolEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('events')
        .select('*')
        .order('event_date', { ascending: true });

      if (err) throw err;
      setEvents(data ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load events');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const addEvent = async (form: EventFormData): Promise<{ error: string | null }> => {
    if (!user) return { error: 'Not authenticated' };
    const { error: err } = await supabase.from('events').insert({
      title: form.title,
      description: form.description || null,
      event_date: form.event_date,
      event_time: form.event_time || null,
      category: form.category || null,
      created_by: user.id,
    });
    if (err) return { error: err.message };
    await fetchEvents();
    return { error: null };
  };

  const updateEvent = async (id: string, form: EventFormData): Promise<{ error: string | null }> => {
    const { error: err } = await supabase
      .from('events')
      .update({
        title: form.title,
        description: form.description || null,
        event_date: form.event_date,
        event_time: form.event_time || null,
        category: form.category || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    if (err) return { error: err.message };
    await fetchEvents();
    return { error: null };
  };

  const deleteEvent = async (id: string): Promise<{ error: string | null }> => {
    const { error: err } = await supabase
      .from('events')
      .delete()
      .eq('id', id);
    if (err) return { error: err.message };
    await fetchEvents();
    return { error: null };
  };

  // Upcoming = today onwards, sorted, max 5
  const upcomingEvents = events
    .filter(e => e.event_date >= new Date().toISOString().split('T')[0])
    .slice(0, 5);

  return {
    events,
    upcomingEvents,
    loading,
    error,
    fetchEvents,
    addEvent,
    updateEvent,
    deleteEvent,
    EVENT_CATEGORIES,
  };
}
