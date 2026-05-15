export const deleteTeacher = async (teacherId: string, authUserId: string) => {
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-teacher`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        teacherId,
        authUserId,
      }),
    }
  );

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || 'Failed to delete teacher');
  }

  return data;
};