
interface ProxyQuery {
  select?: string;
  options?: Record<string, unknown>;
  filters?: Record<string, unknown>;
}

export async function fetchWithProxy(table: string, query: ProxyQuery = {}) {
  const sessionToken = localStorage.getItem('edunexa_token');
  const sbToken = localStorage.getItem('sb-zclwokyzsqzitqwmugtt-auth-token'); // Supabase standard token
  
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (sessionToken) headers['x-session-token'] = sessionToken;
  
  // Try to extract access token from Supabase storage if it exists
  let authToken = null;
  if (sbToken) {
    try {
      const parsed = JSON.parse(sbToken);
      authToken = parsed.access_token;
    } catch (e) {
       console.error("Failed to parse SB token", e);
    }
  }

  const response = await fetch('/api/proxy/fetch', {
    method: 'POST',
    headers: {
       ...headers,
       ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
    },
    body: JSON.stringify({
      table,
      query,
      sessionToken: sessionToken?.startsWith('DB_SESSION_') ? sessionToken : undefined
    })
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || 'Proxy fetch failed');
  }

  return result; // returns { data, count }
}

export async function writeWithProxy(table: string, operation: 'insert' | 'update' | 'delete' | 'upsert', payload?: unknown, filters?: Record<string, unknown>, onConflict?: string) {
  const sessionToken = localStorage.getItem('edunexa_token');
  const sbToken = localStorage.getItem('sb-zclwokyzsqzitqwmugtt-auth-token');
  
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  
  let authToken = null;
  if (sbToken) {
    try {
      const parsed = JSON.parse(sbToken);
      authToken = parsed.access_token;
    } catch (e) {
       console.error("Failed to parse SB token", e);
    }
  }

  const response = await fetch('/api/proxy/write', {
    method: 'POST',
    headers: {
      ...headers,
       ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
    },
    body: JSON.stringify({
      table,
      operation,
      payload,
      filters,
      onConflict,
      sessionToken: sessionToken?.startsWith('DB_SESSION_') ? sessionToken : undefined
    })
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || 'Proxy write failed');
  }

  return result; // returns { data }
}
