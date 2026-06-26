
---

## 🔒 Security

- Session-based authentication
- Anti-inspect protection (Right-click, F12, DevTools disabled)
- Login attempt limiting (5 attempts)
- 8-hour session timeout

---

## ☁️ Supabase Cloud Sync

Data automatically syncs to Supabase for cloud backup and multi-device access.

**Configuration:** Update credentials in `App/db.js`

```javascript
const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_KEY = 'your-anon-key';
