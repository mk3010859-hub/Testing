// 🔥 FIXED: Removed ?on_conflict=id from URL
async saveStoreToSupabase(store, data) {
    try {
        if (!data || data.length === 0) {
            return true;
        }
        
        const response = await fetch(`${SUPABASE_URL}/rest/v1/${store}`, {  // ← YAHAN SE ?on_conflict=id HATAYA
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Prefer': 'resolution=merge-duplicates'
            },
            body: JSON.stringify(data)
        });
        // ... rest of code
