'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function BannedBanner() {
  const [banned, setBanned] = useState(false);

  useEffect(() => {
    async function check() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from('profiles')
        .select('banned')
        .eq('id', user.id)
        .single();
      setBanned(!!profile?.banned);
    }
    check();
  }, []);

  if (!banned) return null;

  return (
    <div className="bg-clay text-sand text-sm text-center px-4 py-2">
      Your account is restricted. You can still browse, but you can't post,
      message, comment, like, or follow. Contact support if you think this
      is a mistake.
    </div>
  );
}
