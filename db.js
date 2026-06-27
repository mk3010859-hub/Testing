// ============================================================
// DATABASE MODULE - Production Ready with Supabase Sync
// ============================================================

const DB_NAME = 'SkyMedDB';
const DB_VERSION = 16;  // 🔥 Version increase for fresh start
const STORES = [
    // ✅ Exact match with Supabase table names
    'vendors',                 // ✅ master.html
    'contracts',               // ✅ contracts.html
    'general_entries',         // ✅ general.html (FIXED: was 'general')
    'receivables',             // ✅ receivables.html
    'payables',                // ✅ payables.html
    'master_ledger',           // ✅ ledger.html (FIXED: was 'master')
    'contract_history',        // ✅ contracts.html (FIXED: was 'contractHistory')
    'deleted_records',         // ✅ deleted.html (FIXED: was 'deletedRecords')
    'app_settings',            // ✅ settings.html (FIXED: was 'settings')
    'provisions',              // ✅ provision.html
    'payroll_entries',         // ✅ payroll.html (FIXED: was 'payroll')
    'employees',               // ✅ payroll.html
    'gst_details',             // ✅ payroll.html, settings.html (FIXED: was 'gstDetails')
    'leave_balances',          // ✅ payroll.html (FIXED: was 'leaveBalances')
    'leave_history',           // ✅ payroll.html (FIXED: was 'leaveHistory')
    'employee_contract_history', // ✅ payroll.html (FIXED: was 'employeeContractHistory')
    'advances',                // ✅ advance.html
    'ledger',                  // ✅ ledger.html
    'assets',                  // ✅ assets.html
    'imprests'                 // ✅ imprest.html
];

// ============================================================
// 🔥 SUPABASE CONFIG - Yahan apni values daalo
// ============================================================
const SUPABASE_URL = 'https://ccwqofruxtvzeqxqmjey.supabase.co';
const SUPABASE_KEY = 'sb_publishable_hOp3KfAh8v3c15l5dr3h8w_2h4dYMbm';

// ============================================================
// XLSX LIBRARY LOADER
// ============================================================
function loadXLSX() {
    return new Promise((resolve) => {
        if (typeof XLSX !== 'undefined') {
            resolve(XLSX);
            return;
        }
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
        script.onload = () => resolve(XLSX);
        script.onerror = () => {
            console.warn('⚠️ XLSX CDN failed');
            resolve(null);
        };
        document.head.appendChild(script);
    });
}

// ============================================================
// MAIN DATABASE CLASS
// ============================================================
class SkyMedDB {
    constructor() {
        this.db = null;
        this.folderHandle = null;
        this.syncInterval = null;
        this.supabaseSyncInterval = null;
        this.forceReloadInterval = null;
        this.isSyncing = false;
        this.isRefreshing = false;
        this.settings = {};
        this.lastSyncTime = null;
        this.lastRefreshTime = null;
        this.XLSX = null;
        this.syncHistory = [];
        this.backupCount = 0;
        this.maxBackups = 1;
        this.isInitialized = false;
        this.dataCache = {};
        this.lastIdMap = {};
        this.loadCacheFromStorage();
        this.init();
    }

    loadCacheFromStorage() {
        try {
            const cached = localStorage.getItem('skymed_cache_v1');
            if (cached) {
                this.dataCache = JSON.parse(cached);
                console.log('📦 Cache loaded from localStorage');
            }
            const idMap = localStorage.getItem('skymed_last_ids');
            if (idMap) {
                this.lastIdMap = JSON.parse(idMap);
            }
        } catch(e) {
            console.warn('Cache load failed:', e);
        }
    }

    saveCacheToStorage() {
        try {
            localStorage.setItem('skymed_cache_v1', JSON.stringify(this.dataCache));
            localStorage.setItem('skymed_last_ids', JSON.stringify(this.lastIdMap));
        } catch(e) {
            console.warn('Cache save failed:', e);
        }
    }

    updateCache(store, data) {
        this.dataCache[store] = data;
        this.saveCacheToStorage();
    }

    generateEmployeeId() {
        const store = 'employees';
        const all = this.dataCache[store] || [];
        let maxNum = 0;
        for (const item of all) {
            if (item.id && item.id.startsWith('PA')) {
                const num = parseInt(item.id.replace('PA', ''));
                if (!isNaN(num) && num > maxNum) {
                    maxNum = num;
                }
            }
        }
        for (const storeName of ['vendors', 'general_entries', 'receivables', 'payables']) {
            const items = this.dataCache[storeName] || [];
            for (const item of items) {
                if (item.empId && item.empId.startsWith('PA')) {
                    const num = parseInt(item.empId.replace('PA', ''));
                    if (!isNaN(num) && num > maxNum) {
                        maxNum = num;
                    }
                }
                if (item.employeeId && item.employeeId.startsWith('PA')) {
                    const num = parseInt(item.employeeId.replace('PA', ''));
                    if (!isNaN(num) && num > maxNum) {
                        maxNum = num;
                    }
                }
            }
        }
        const nextNum = maxNum + 1;
        const id = 'PA' + String(nextNum).padStart(4, '0');
        console.log(`🔑 Generated Employee ID: ${id} (from ${maxNum})`);
        return id;
    }

    generateStoreId(store, prefix = null) {
        const all = this.dataCache[store] || [];
        if (!prefix) {
            const prefixes = {
                'vendors': 'VND',
                'contracts': 'CTR',
                'general_entries': 'GEN',
                'receivables': 'REC',
                'payables': 'PAY',
                'master_ledger': 'MST',
                'contract_history': 'CHS',
                'deleted_records': 'DEL',
                'app_settings': 'SET',
                'provisions': 'PRV',
                'payroll_entries': 'PRL',
                'employees': 'EMP',
                'gst_details': 'GST',
                'leave_balances': 'LVB',
                'leave_history': 'LVH',
                'employee_contract_history': 'ECH',
                'advances': 'ADV',
                'ledger': 'LED',
                'assets': 'AST',
                'imprests': 'IMP'
            };
            prefix = prefixes[store] || store.substring(0, 3).toUpperCase();
        }
        let maxNum = 0;
        for (const item of all) {
            if (item.id && item.id.startsWith(prefix)) {
                const num = parseInt(item.id.replace(prefix, ''));
                if (!isNaN(num) && num > maxNum) {
                    maxNum = num;
                }
            }
        }
        const nextNum = maxNum + 1;
        const id = prefix + String(nextNum).padStart(4, '0');
        console.log(`🔑 Generated ID for ${store}: ${id}`);
        return id;
    }

    async init() {
        try {
            if (this.db) {
                try {
                    this.db.close();
                    this.db = null;
                } catch(e) {
                    console.warn('Database close error:', e);
                }
            }
            
            await this.openDB();
            await this.loadFromLocalStorage();
            await this.loadSettings();
            
            this.XLSX = await loadXLSX();
            if (this.XLSX) {
                console.log('✅ XLSX library loaded');
            } else {
                console.warn('⚠️ XLSX library not loaded');
            }
            
            try {
                const savedHistory = localStorage.getItem('skymed_sync_history');
                if (savedHistory) {
                    this.syncHistory = JSON.parse(savedHistory);
                    if (!Array.isArray(this.syncHistory)) this.syncHistory = [];
                }
            } catch(e) { this.syncHistory = []; }
            
            this.startAutoSync();
            this.startSupabaseSync();
            this.startForceReload();
            
            const savedFolder = sessionStorage.getItem('skymed_folder');
            if (savedFolder) {
                const folderLabel = document.getElementById('folderLabel');
                if (folderLabel) folderLabel.textContent = savedFolder;
            }
            
            await this.syncFromSupabase();
            await this.checkAndRecover();
            
            this.isInitialized = true;
            
            console.log('✅ Database initialized (Production Mode)');
            console.log('⏰ Auto-save every 30 seconds');
            console.log('☁️ Supabase sync every 60 seconds');
            console.log('🔁 Force Reload every 5 seconds');
            console.log('📦 Persistent Cache active');
            console.log('📊 Stores:', STORES.join(', '));
            
            window.addEventListener('beforeunload', () => {
                this.triggerSync();
                this.syncToSupabase();
            });
            
        } catch(e) {
            console.error('❌ Init failed:', e);
            setTimeout(() => this.init(), 5000);
        }
    }

    // ============================================================
    // SUPABASE OPERATIONS - ONLINE SYNC
    // ============================================================
    
    async syncToSupabase() {
        try {
            console.log('☁️ Syncing to Supabase...');
            const allData = {};
            for (const store of STORES) {
                allData[store] = await this.getAll(store);
            }
            
            for (const store of STORES) {
                if (allData[store] && allData[store].length > 0) {
                    await this.saveStoreToSupabase(store, allData[store]);
                } else {
                    console.log(`⏭️ Skipping ${store} - no data`);
                }
            }
            
            console.log('✅ Supabase sync completed');
            return true;
        } catch(e) {
            console.warn('⚠️ Supabase sync failed:', e);
            return false;
        }
    }

    async saveStoreToSupabase(store, data) {
        try {
            if (!data || data.length === 0) {
                return true;
            }
            
            const response = await fetch(`${SUPABASE_URL}/rest/v1/${store}?on_conflict=id`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Prefer': 'resolution=merge-duplicates'
                },
                body: JSON.stringify(data)
            });
            
            if (!response.ok) {
                if (response.status === 404) {
                    console.warn(`⚠️ Table "${store}" not found in Supabase. Please create it.`);
                }
                throw new Error(`HTTP ${response.status}`);
            }
            console.log(`✅ Saved ${data.length} records to ${store}`);
            return true;
        } catch(e) {
            console.warn(`⚠️ Failed to save ${store} to Supabase:`, e);
            return false;
        }
    }

    async loadFromSupabase(store) {
        try {
            const response = await fetch(`${SUPABASE_URL}/rest/v1/${store}`, {
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`
                }
            });
            
            if (!response.ok) {
                if (response.status === 404) {
                    console.warn(`⚠️ Table "${store}" not found in Supabase`);
                    return [];
                }
                throw new Error(`HTTP ${response.status}`);
            }
            
            return await response.json();
        } catch(e) {
            console.warn(`⚠️ Failed to load ${store} from Supabase:`, e);
            return null;
        }
    }

    async syncFromSupabase() {
        try {
            console.log('☁️ Loading data from Supabase...');
            let loaded = 0;
            
            for (const store of STORES) {
                const data = await this.loadFromSupabase(store);
                if (data && data.length > 0) {
                    this.dataCache[store] = data;
                    loaded += data.length;
                    
                    for (const item of data) {
                        const existing = await this.get(store, item.id);
                        if (!existing) {
                            await this.put(store, item);
                        }
                    }
                }
            }
            
            this.saveCacheToStorage();
            console.log(`📂 Loaded ${loaded} records from Supabase`);
            return true;
        } catch(e) {
            console.warn('⚠️ Supabase load failed:', e);
            return false;
        }
    }

    async createSupabaseTable(store) {
        console.warn(`⚠️ Table "${store}" not found in Supabase. Please create it manually.`);
        return false;
    }

    startSupabaseSync() {
        if (this.supabaseSyncInterval) clearInterval(this.supabaseSyncInterval);
        this.supabaseSyncInterval = setInterval(() => {
            this.syncToSupabase();
        }, 60000);
        console.log('☁️ Supabase sync started (every 60 seconds)');
    }

    // ============================================================
    // INDEXEDDB OPERATIONS
    // ============================================================
    openDB() {
        return new Promise((resolve, reject) => {
            if (this.db && this.db.name === DB_NAME) {
                try {
                    this.db.close();
                    this.db = null;
                } catch(e) {
                    console.warn('Database close error:', e);
                }
            }
            
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                const oldVersion = e.oldVersion;
                console.log(`🔄 Database upgrade: ${oldVersion} → ${DB_VERSION}`);
                
                if (oldVersion > 0 && oldVersion < DB_VERSION) {
                    const existingStores = db.objectStoreNames;
                    for (const store of existingStores) {
                        try {
                            db.deleteObjectStore(store);
                            console.log(`🗑️ Deleted old store: ${store}`);
                        } catch(e) {
                            console.warn('Delete store failed:', e);
                        }
                    }
                }
                
                STORES.forEach(store => {
                    if (!db.objectStoreNames.contains(store)) {
                        const objStore = db.createObjectStore(store, { keyPath: 'id' });
                        objStore.createIndex('vendorCode', 'vendorCode', { unique: false });
                        objStore.createIndex('base', 'base', { unique: false });
                        objStore.createIndex('status', 'status', { unique: false });
                        objStore.createIndex('contractId', 'contractId', { unique: false });
                        objStore.createIndex('deletedAt', 'deletedAt', { unique: false });
                        objStore.createIndex('entryType', 'entryType', { unique: false });
                        objStore.createIndex('invoice', 'invoice', { unique: false });
                        objStore.createIndex('fy', 'fy', { unique: false });
                        objStore.createIndex('location', 'location', { unique: false });
                        objStore.createIndex('employeeId', 'employeeId', { unique: false });
                        objStore.createIndex('empId', 'empId', { unique: false });
                        console.log(`✅ Created store: ${store}`);
                    }
                });
            };
            
            request.onsuccess = (e) => {
                this.db = e.target.result;
                console.log('✅ Database opened successfully');
                
                this.db.onversionchange = () => {
                    console.log('🔄 Database version change detected, closing...');
                    if (this.db) {
                        try {
                            this.db.close();
                            this.db = null;
                        } catch(e) {}
                    }
                };
                
                resolve();
            };
            
            request.onerror = (e) => {
                console.error('❌ Database error:', e.target.error);
                reject(e.target.error);
            };
            
            request.onblocked = () => {
                console.warn('⚠️ Database blocked - close other tabs');
                reject(new Error('Database blocked'));
            };
        });
    }

    // ============================================================
    // CRUD OPERATIONS
    // ============================================================
    
    async add(store, data) {
        try {
            if (!data.id) {
                if (store === 'employees' || data.employeeId || data.empId) {
                    data.id = this.generateEmployeeId();
                    if (data.employeeId) data.employeeId = data.id;
                    if (data.empId) data.empId = data.id;
                } else {
                    data.id = this.generateStoreId(store);
                }
            }
            
            const existing = await this.get(store, data.id);
            if (existing) {
                if (store === 'employees' || data.employeeId || data.empId) {
                    data.id = this.generateEmployeeId();
                    if (data.employeeId) data.employeeId = data.id;
                    if (data.empId) data.empId = data.id;
                } else {
                    data.id = this.generateStoreId(store);
                }
            }
            
            if (!data.createdAt) {
                data.createdAt = new Date().toISOString();
            }
            data.updatedAt = new Date().toISOString();
            
            if (!this.dataCache[store]) this.dataCache[store] = [];
            this.dataCache[store].push(data);
            this.saveCacheToStorage();
            
            const result = await this.put(store, data);
            this.scheduleSync();
            this.syncToSupabase();
            
            console.log(`✅ Added to ${store}:`, data.id);
            return result;
            
        } catch(e) {
            console.error(`❌ Error adding to ${store}:`, e);
            throw e;
        }
    }

    async get(store, id) {
        if (this.dataCache[store]) {
            const cached = this.dataCache[store].find(item => item.id === id);
            if (cached) return cached;
        }
        
        return new Promise((resolve, reject) => {
            try {
                if (!this.db) {
                    resolve(null);
                    return;
                }
                const tx = this.db.transaction(store, 'readonly');
                const req = tx.objectStore(store).get(id);
                req.onsuccess = () => resolve(req.result || null);
                req.onerror = () => reject(req.error);
            } catch(e) {
                resolve(null);
            }
        });
    }

    async getAll(store) {
        if (this.dataCache[store] && this.dataCache[store].length > 0) {
            console.log(`📊 ${store}: ${this.dataCache[store].length} records (from cache)`);
            return this.dataCache[store];
        }
        
        return new Promise((resolve, reject) => {
            try {
                if (!this.db) {
                    const saved = localStorage.getItem('skymed_data_v7');
                    if (saved) {
                        try {
                            const data = JSON.parse(saved);
                            if (data[store] && data[store].length) {
                                this.dataCache[store] = data[store];
                                this.saveCacheToStorage();
                                console.log(`📊 ${store}: ${data[store].length} records (from localStorage fallback)`);
                                resolve(data[store]);
                                return;
                            }
                        } catch(e) {}
                    }
                    resolve([]);
                    return;
                }
                const tx = this.db.transaction(store, 'readonly');
                const req = tx.objectStore(store).getAll();
                req.onsuccess = () => {
                    const result = req.result || [];
                    this.dataCache[store] = result;
                    this.saveCacheToStorage();
                    console.log(`📊 ${store}: ${result.length} records`);
                    resolve(result);
                };
                req.onerror = () => {
                    console.warn(`⚠️ Error reading ${store}:`, req.error);
                    resolve([]);
                };
            } catch(e) {
                console.warn(`⚠️ Exception reading ${store}:`, e);
                resolve([]);
            }
        });
    }

    async put(store, data) {
        return new Promise((resolve, reject) => {
            try {
                if (!this.db) {
                    reject(new Error('Database not initialized'));
                    return;
                }
                if (!data.id) {
                    data.id = generateId();
                }
                data.updatedAt = new Date().toISOString();
                
                if (!this.dataCache[store]) this.dataCache[store] = [];
                const idx = this.dataCache[store].findIndex(item => item.id === data.id);
                if (idx !== -1) {
                    this.dataCache[store][idx] = data;
                } else {
                    this.dataCache[store].push(data);
                }
                this.saveCacheToStorage();
                
                const tx = this.db.transaction(store, 'readwrite');
                const req = tx.objectStore(store).put(data);
                req.onsuccess = () => {
                    this.scheduleSync();
                    this.syncToSupabase();
                    resolve(req.result);
                };
                req.onerror = () => reject(req.error);
            } catch(e) {
                reject(e);
            }
        });
    }

    async delete(store, id) {
        return new Promise((resolve, reject) => {
            try {
                if (!this.db) {
                    resolve(false);
                    return;
                }
                
                if (this.dataCache[store]) {
                    this.dataCache[store] = this.dataCache[store].filter(item => item.id !== id);
                    this.saveCacheToStorage();
                }
                
                const tx = this.db.transaction(store, 'readwrite');
                const req = tx.objectStore(store).delete(id);
                req.onsuccess = () => {
                    this.scheduleSync();
                    this.syncToSupabase();
                    resolve(true);
                };
                req.onerror = () => reject(req.error);
            } catch(e) {
                reject(e);
            }
        });
    }

    async clear(store) {
        return new Promise((resolve, reject) => {
            try {
                if (!this.db) {
                    resolve(false);
                    return;
                }
                this.dataCache[store] = [];
                this.saveCacheToStorage();
                
                const tx = this.db.transaction(store, 'readwrite');
                const req = tx.objectStore(store).clear();
                req.onsuccess = () => {
                    this.scheduleSync();
                    this.syncToSupabase();
                    resolve(true);
                };
                req.onerror = () => reject(req.error);
            } catch(e) {
                reject(e);
            }
        });
    }

    async softDelete(store, id) {
        try {
            const item = await this.get(store, id);
            if (!item) return null;
            
            const deletedItem = {
                ...item,
                originalStore: store,
                originalId: id,
                deletedAt: new Date().toISOString(),
                id: 'DEL_' + Date.now().toString(36) + '_' + id
            };
            
            if (item.vendorName) deletedItem.vendorName = item.vendorName;
            else if (item.name) deletedItem.vendorName = item.name;
            else if (item.employeeName) deletedItem.vendorName = item.employeeName;
            
            if (item.invoice) deletedItem.invoice = item.invoice;
            else if (item.base) deletedItem.invoice = item.base;
            else if (item.empId) deletedItem.invoice = item.empId;
            
            if (item.amount) deletedItem.amount = item.amount;
            else if (item.rate) deletedItem.amount = item.rate;
            else if (item.totalSalary) deletedItem.amount = item.totalSalary;
            
            await this.put('deleted_records', deletedItem);
            await this.delete(store, id);
            this.scheduleSync();
            this.syncToSupabase();
            
            console.log(`🗑️ Soft deleted from ${store}:`, id);
            return deletedItem;
            
        } catch(e) {
            console.error(`❌ Soft delete failed:`, e);
            throw e;
        }
    }

    async recoverDeleted(id) {
        try {
            const deleted = await this.get('deleted_records', id);
            if (!deleted) return null;
            
            const { originalStore, originalId, deletedAt, ...rest } = deleted;
            const recoverItem = { 
                ...rest, 
                id: originalId || generateId(),
                recoveredAt: new Date().toISOString()
            };
            
            await this.put(originalStore, recoverItem);
            await this.delete('deleted_records', id);
            this.scheduleSync();
            this.syncToSupabase();
            
            console.log(`♻️ Recovered from deleted:`, id);
            return recoverItem;
            
        } catch(e) {
            console.error(`❌ Recovery failed:`, e);
            throw e;
        }
    }

    async getAllDeleted() {
        return await this.getAll('deleted_records');
    }

    async permanentlyDelete(id) {
        try {
            await this.delete('deleted_records', id);
            this.scheduleSync();
            this.syncToSupabase();
            console.log(`🗑️ Permanently deleted:`, id);
            return true;
        } catch(e) {
            console.error(`❌ Permanent delete failed:`, e);
            throw e;
        }
    }

    // ============================================================
    // LOCAL STORAGE
    // ============================================================
    async saveToLocalStorage() {
        try {
            const data = {};
            for (const store of STORES) {
                data[store] = await this.getAll(store);
            }
            localStorage.setItem('skymed_data_v7', JSON.stringify(data));
            localStorage.setItem('skymed_last_backup', Date.now().toString());
            
            this.saveCacheToStorage();
            await this.saveJSONBackup(data);
            
            console.log('💾 Data saved to LocalStorage');
        } catch(e) { 
            console.warn('LocalStorage save failed:', e); 
        }
    }

    async loadFromLocalStorage() {
        try {
            const saved = localStorage.getItem('skymed_data_v7');
            if (saved) {
                const data = JSON.parse(saved);
                let loaded = 0;
                for (const store of STORES) {
                    if (data[store] && data[store].length) {
                        this.dataCache[store] = data[store];
                        loaded += data[store].length;
                    }
                }
                this.saveCacheToStorage();
                console.log(`📂 Loaded ${loaded} records from LocalStorage to Cache`);
            }
            return true;
        } catch(e) { 
            console.warn('LocalStorage load failed:', e); 
            return false;
        }
    }

    // ============================================================
    // FORCE RELOAD
    // ============================================================
    async forceReload() {
        try {
            console.log('🔄 Force reloading data...');
            
            const saved = localStorage.getItem('skymed_data_v7');
            if (!saved) {
                console.warn('⚠️ No data in localStorage!');
                return false;
            }
            
            const data = JSON.parse(saved);
            let loaded = 0;
            
            for (const store of STORES) {
                if (data[store] && data[store].length) {
                    if (!this.dataCache[store]) this.dataCache[store] = [];
                    
                    for (const item of data[store]) {
                        const exists = this.dataCache[store].some(c => c.id === item.id);
                        if (!exists) {
                            this.dataCache[store].push(item);
                            loaded++;
                        }
                    }
                }
            }
            
            this.saveCacheToStorage();
            
            console.log(`📂 Force reload: ${loaded} new records added to cache`);
            
            this.lastRefreshTime = new Date();
            localStorage.setItem('skymed_last_refresh', this.lastRefreshTime.toISOString());
            
            console.log('✅ Force reload completed at', this.lastRefreshTime.toLocaleString());
            return true;
            
        } catch(e) {
            console.error('❌ Force reload failed:', e);
            return false;
        }
    }

    startForceReload() {
        if (this.forceReloadInterval) clearInterval(this.forceReloadInterval);
        this.forceReloadInterval = setInterval(() => {
            this.forceReload();
        }, 5000);
        console.log('🔁 Force Reload started (every 5 seconds)');
    }

    // ============================================================
    // JSON BACKUP
    // ============================================================
    async saveJSONBackup(data) {
        if (!this.folderHandle) return;
        
        try {
            const fileName = 'SkyMed_Backup.json';
            const fileHandle = await this.folderHandle.getFileHandle(fileName, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(JSON.stringify({version:'7.0',timestamp:new Date().toISOString(),data:data}));
            await writable.close();
            console.log(`✅ JSON Backup saved: ${fileName}`);
        } catch(e) {
            console.warn('⚠️ JSON Backup failed:', e);
        }
    }

    // ============================================================
    // EXCEL BACKUP
    // ============================================================
    async saveExcelBackup() {
        if (!this.folderHandle || !this.XLSX) return false;
        
        try {
            console.log('📊 Creating Excel backup...');
            const allData = {};
            let totalRecords = 0;
            const storeStats = [];
            
            for (const store of STORES) {
                const items = await this.getAll(store);
                allData[store] = items;
                totalRecords += items.length;
                storeStats.push({ Store: store, Count: items.length });
            }
            
            const wb = this.XLSX.utils.book_new();
            
            for (const store of STORES) {
                const items = allData[store] || [];
                if (items.length > 0) {
                    const cleanData = items.map(item => {
                        const clean = {};
                        for (const [key, value] of Object.entries(item)) {
                            if (value !== undefined && value !== null && typeof value !== 'function') {
                                if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                                    try { clean[key] = JSON.stringify(value); } catch(e) { clean[key] = String(value); }
                                } else {
                                    clean[key] = value;
                                }
                            }
                        }
                        return clean;
                    });
                    const ws = this.XLSX.utils.json_to_sheet(cleanData);
                    this.XLSX.utils.book_append_sheet(wb, ws, store.substring(0, 31));
                }
            }
            
            const summaryWs = this.XLSX.utils.json_to_sheet([
                { 'Field': 'Backup Date', 'Value': new Date().toLocaleString() },
                { 'Field': 'Total Records', 'Value': totalRecords },
                { 'Field': '---', 'Value': '---' },
                ...storeStats
            ]);
            this.XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');
            
            const excelData = this.XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
            
            const masterFile = await this.folderHandle.getFileHandle('SkyMed_Data.xlsx', { create: true });
            const writable = await masterFile.createWritable();
            await writable.write(excelData);
            await writable.close();
            
            console.log(`✅ Excel Backup saved: SkyMed_Data.xlsx (${totalRecords} records)`);
            return true;
            
        } catch(e) {
            console.error('❌ Excel Backup failed:', e);
            return false;
        }
    }

    // ============================================================
    // SELECT FOLDER
    // ============================================================
    async selectFolder() {
        try {
            if (!window.showDirectoryPicker) {
                console.log('📁 Folder selection not supported. Using LocalStorage only.');
                await this.saveToLocalStorage();
                const folderLabel = document.getElementById('folderLabel');
                if (folderLabel) {
                    folderLabel.textContent = '💾 Local Storage (Auto-Save)';
                    folderLabel.style.color = '#7bc5f5';
                }
                if (!sessionStorage.getItem('skymed_folder_alert_shown')) {
                    alert(
                        '📁 Folder selection not supported in this browser.\n\n' +
                        '✅ Your data is automatically saved to:\n' +
                        '   • IndexedDB (SQLite-like database)\n' +
                        '   • Local Storage (backup)\n' +
                        '   • Persistent Cache\n' +
                        '   • Auto-save every 30 seconds\n' +
                        '   • Supabase Cloud Sync\n\n' +
                        '✅ No data loss! Everything is saved automatically.'
                    );
                    sessionStorage.setItem('skymed_folder_alert_shown', 'true');
                }
                return null;
            }

            try {
                if (this.db) {
                    try {
                        this.db.close();
                        this.db = null;
                        console.log('🔄 Database closed before folder selection');
                    } catch(e) {
                        console.warn('Database close error:', e);
                    }
                }
                
                this.folderHandle = await window.showDirectoryPicker();
                sessionStorage.setItem('skymed_folder', this.folderHandle.name);
                
                const folderLabel = document.getElementById('folderLabel');
                if (folderLabel) {
                    folderLabel.textContent = this.folderHandle.name;
                    folderLabel.style.color = '';
                }
                
                await this.openDB();
                await this.forceReload();
                await this.syncFromSupabase();
                
                const excelSuccess = await this.saveExcelBackup();
                
                if (excelSuccess) {
                    alert('✅ Folder selected: ' + this.folderHandle.name + 
                          '\n📄 Excel Backup: SkyMed_Data.xlsx' +
                          '\n📄 JSON Backup: SkyMed_Backup.json' +
                          '\n☁️ Supabase Cloud Sync: Active' +
                          '\n💾 All data saved successfully!');
                } else {
                    alert('⚠️ Folder selected but Excel backup failed.\n' +
                          'Data is still saved to LocalStorage and IndexedDB.');
                }
                
                return this.folderHandle;
                
            } catch(e) {
                if (e.name === 'AbortError') {
                    console.log('📁 User cancelled folder selection');
                    if (!this.db) {
                        await this.openDB();
                    }
                    return null;
                }
                throw e;
            }
        } catch(e) {
            console.warn('Folder selection failed:', e);
            if (!this.db) {
                await this.openDB();
            }
            await this.saveToLocalStorage();
            return null;
        }
    }

    // ============================================================
    // RECOVERY
    // ============================================================
    async checkAndRecover() {
        try {
            let hasData = false;
            for (const store of STORES) {
                const items = await this.getAll(store);
                if (items.length > 0) {
                    hasData = true;
                    break;
                }
            }
            
            if (!hasData) {
                console.log('🔄 No data in IndexedDB, attempting recovery...');
                
                const supabaseData = await this.syncFromSupabase();
                if (supabaseData) {
                    console.log('✅ Data recovered from Supabase!');
                    return;
                }
                
                await this.loadFromLocalStorage();
                await this.forceReload();
                
                let recovered = false;
                for (const store of STORES) {
                    const items = await this.getAll(store);
                    if (items.length > 0) {
                        recovered = true;
                        break;
                    }
                }
                
                if (recovered) {
                    console.log('✅ Data recovered from LocalStorage!');
                } else {
                    console.log('⚠️ No data found in any storage layer.');
                }
            }
        } catch(e) {
            console.warn('Recovery check failed:', e);
        }
    }

    // ============================================================
    // SYNC
    // ============================================================
    async syncToFolder() {
        if (!this.folderHandle) {
            await this.saveToLocalStorage();
            console.log('💾 Data saved to LocalStorage');
            return true;
        }
        
        if (this.isSyncing) {
            console.log('⏳ Sync already in progress');
            return false;
        }
        
        this.isSyncing = true;
        let success = false;
        
        try {
            await this.saveToLocalStorage();
            
            const allData = {};
            for (const store of STORES) {
                allData[store] = await this.getAll(store);
            }
            await this.saveJSONBackup(allData);
            
            const excelSuccess = await this.saveExcelBackup();
            await this.syncToSupabase();
            
            this.lastSyncTime = new Date();
            localStorage.setItem('skymed_last_sync', this.lastSyncTime.toISOString());
            
            console.log(`✅ Sync completed at ${this.lastSyncTime.toLocaleString()}`);
            success = true;
            
        } catch(e) {
            console.error('❌ Sync failed:', e);
            success = false;
        }
        
        this.isSyncing = false;
        return success;
    }

    startAutoSync() {
        if (this.syncInterval) clearInterval(this.syncInterval);
        this.syncInterval = setInterval(() => {
            this.scheduleSync();
        }, 30000);
        console.log('⏰ Auto-sync started (every 30 seconds)');
    }

    scheduleSync() {
        clearTimeout(this.saveTimer);
        this.saveTimer = setTimeout(() => { this.triggerSync(); }, 5000);
    }

    async triggerSync() {
        try {
            await this.saveToLocalStorage();
            await this.syncToFolder();
        } catch(e) {
            console.warn('Sync failed:', e);
        }
    }

    // ============================================================
    // SETTINGS
    // ============================================================
    async loadSettings() {
        try {
            const settings = await this.getAll('app_settings');
            if (settings.length) {
                this.settings = settings[0];
            } else {
                this.settings = {
                    id: 'main',
                    autoSync: true,
                    syncInterval: 30,
                    darkMode: false,
                    currencySymbol: '₹',
                    dateFormat: 'DD-MMM-YY',
                    notifications: true,
                    maxBackups: 1,
                    updatedAt: new Date().toISOString()
                };
                await this.put('app_settings', this.settings);
            }
        } catch(e) {
            console.warn('Settings load failed:', e);
            this.settings = { id: 'main' };
        }
        return this.settings;
    }

    async updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings, updatedAt: new Date().toISOString() };
        this.maxBackups = this.settings.maxBackups || 1;
        await this.put('app_settings', this.settings);
        this.scheduleSync();
        this.syncToSupabase();
        return this.settings;
    }

    async getSettings() {
        if (!this.settings.id) await this.loadSettings();
        return this.settings;
    }

    // ============================================================
    // VENDOR CODE
    // ============================================================
    async generateVendorCode() {
        const vendors = await this.getAll('vendors');
        const num = vendors.length + 1;
        const code = 'VND' + String(num).padStart(4, '0');
        const exists = vendors.some(v => v.code === code);
        if (exists) {
            return 'VND' + String(num + 1).padStart(4, '0');
        }
        return code;
    }

    // ============================================================
    // CONTRACT HISTORY
    // ============================================================
    async addContractHistory(contractId, vendorCode, vendorName, type, details, date, oldValues, newValues) {
        const entry = {
            id: generateId(),
            contractId: contractId,
            vendorCode: vendorCode,
            vendorName: vendorName,
            type: type,
            details: details,
            date: date || new Date().toISOString().split('T')[0],
            oldValues: oldValues || {},
            newValues: newValues || {},
            createdAt: new Date().toISOString()
        };
        await this.put('contract_history', entry);
        this.scheduleSync();
        this.syncToSupabase();
        return entry;
    }

    async getContractHistory(contractId) {
        const all = await this.getAll('contract_history');
        return all.filter(h => h.contractId === contractId).sort((a, b) => 
            new Date(b.date) - new Date(a.date)
        );
    }

    // ============================================================
    // MOVE GENERAL TO RECEIVABLE/PAYABLE
    // ============================================================
    async moveGeneralToReceivable(entry) {
        const recData = {
            id: generateId(),
            vendorCode: entry.vendorCode,
            vendorName: entry.vendorName,
            base: entry.base,
            invoice: entry.invoice,
            count: entry.count,
            rate: entry.rate,
            rateType: entry.rateType || 'Fixed',
            amount: entry.amount,
            gst: entry.gst,
            status: 'Pending',
            date: entry.invoiceReceivedDate || new Date().toISOString().split('T')[0],
            dueDate: '',
            receivedOn: '',
            utr: '',
            serviceCategory: entry.serviceType || 'Other',
            entryId: entry.id,
            movedAt: new Date().toISOString()
        };
        const vendor = await this.get('vendors', entry.vendorCode);
        const period = vendor ? vendor.paymentPeriod : 30;
        if (recData.date) {
            const d = new Date(recData.date);
            d.setDate(d.getDate() + period);
            recData.dueDate = d.toISOString().split('T')[0];
        }
        await this.put('receivables', recData);
        await this.addToMaster(recData, 'Receivable');
        await this.delete('general_entries', entry.id);
        this.scheduleSync();
        this.syncToSupabase();
        return recData;
    }

    async moveGeneralToPayable(entry) {
        const payData = {
            id: generateId(),
            vendorCode: entry.vendorCode,
            vendorName: entry.vendorName,
            base: entry.base,
            invoice: entry.invoice,
            count: entry.count,
            rate: entry.rate,
            rateType: entry.rateType || 'Fixed',
            amount: entry.amount,
            gst: entry.gst,
            status: 'Pending',
            date: entry.invoiceReceivedDate || new Date().toISOString().split('T')[0],
            dueDate: '',
            paidOn: '',
            utr: '',
            serviceCategory: entry.serviceType || 'Other',
            entryId: entry.id,
            movedAt: new Date().toISOString()
        };
        const vendor = await this.get('vendors', entry.vendorCode);
        const period = vendor ? vendor.paymentPeriod : 30;
        if (payData.date) {
            const d = new Date(payData.date);
            d.setDate(d.getDate() + period);
            payData.dueDate = d.toISOString().split('T')[0];
        }
        await this.put('payables', payData);
        await this.addToMaster(payData, 'Payable');
        await this.delete('general_entries', entry.id);
        this.scheduleSync();
        this.syncToSupabase();
        return payData;
    }

    async addToMaster(item, type) {
        const month = item.date ? (new Date(item.date).toLocaleString('default', { month: 'short' }) + '-' + new Date(item.date).getFullYear().toString().slice(-2)) : '';
        const masterData = {
            id: generateId(),
            vendorCode: item.vendorCode,
            vendorName: item.vendorName,
            month: month,
            serviceCategory: item.serviceCategory || 'Other',
            base: item.base || '',
            invoice: item.invoice,
            count: item.count || 0,
            rate: item.rate || 0,
            amount: item.amount || 0,
            gst: item.gst || 0,
            status: item.status === 'Received' || item.status === 'Paid' ? 'Received' : 'Pending',
            type: type,
            utr: item.utr || '',
            date: item.date || new Date().toISOString().split('T')[0]
        };
        await this.put('master_ledger', masterData);
        return masterData;
    }

    // ============================================================
    // CSV EXPORT/IMPORT
    // ============================================================
    async exportCSV(store) {
        const data = await this.getAll(store);
        if (!data.length) { 
            alert('No data to export!'); 
            return; 
        }
        const csv = this.arrayToCSV(data);
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${store}_${new Date().toISOString().slice(0,10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    arrayToCSV(data) {
        if (!data.length) return '';
        const headers = Object.keys(data[0]);
        const rows = data.map(obj => headers.map(h => JSON.stringify(obj[h] || '')).join(','));
        return [headers.join(','), ...rows].join('\n');
    }

    async importCSV(store, file) {
        const text = await file.text();
        const lines = text.split('\n').filter(l => l.trim());
        if (!lines.length) { 
            alert('Empty file!'); 
            return; 
        }
        const headers = lines[0].split(',').map(h => h.trim());
        let imported = 0;
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim());
            const obj = {};
            headers.forEach((h, idx) => {
                try { obj[h] = JSON.parse(values[idx] || '""'); } catch(e) { obj[h] = values[idx] || ''; }
            });
            if (!obj.id) obj.id = generateId();
            const existing = await this.get(store, obj.id);
            if (!existing) {
                await this.put(store, obj);
                imported++;
            }
        }
        this.scheduleSync();
        this.syncToSupabase();
        alert(`✅ ${imported} new records imported to ${store}!`);
    }

    // ============================================================
    // RECOVERY FROM FILE
    // ============================================================
    async recoverFromBackupFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const backup = JSON.parse(e.target.result);
                    
                    if (!backup.data) {
                        reject(new Error('Invalid backup format - missing "data" key'));
                        return;
                    }
                    
                    let recovered = 0;
                    for (const store of STORES) {
                        if (backup.data[store] && backup.data[store].length) {
                            for (const item of backup.data[store]) {
                                const existing = await this.get(store, item.id);
                                if (!existing) {
                                    await this.put(store, item);
                                    recovered++;
                                }
                            }
                        }
                    }
                    
                    this.scheduleSync();
                    this.syncToSupabase();
                    resolve(recovered);
                    
                } catch(err) {
                    reject(err);
                }
            };
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }

    // ============================================================
    // CHECK DATA INTEGRITY
    // ============================================================
    async checkDataIntegrity() {
        try {
            const saved = localStorage.getItem('skymed_data_v7');
            if (!saved) {
                console.warn('⚠️ No data in localStorage!');
                return false;
            }
            
            const data = JSON.parse(saved);
            let totalRecords = 0;
            for (const store of STORES) {
                if (data[store]) {
                    totalRecords += data[store].length;
                }
            }
            
            console.log(`📊 Data integrity check: ${totalRecords} total records`);
            return totalRecords > 0;
            
        } catch(e) {
            console.error('❌ Integrity check failed:', e);
            return false;
        }
    }
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================
function formatCurrency(num) {
    if (num === undefined || num === null || isNaN(num)) return '₹0';
    const n = parseFloat(num);
    if (n < 0) return '-₹' + formatCurrency(Math.abs(n));
    const parts = n.toFixed(2).split('.');
    const intPart = parts[0];
    const decPart = parts[1] || '00';
    const lastThree = intPart.slice(-3);
    const otherNumbers = intPart.slice(0, -3);
    const formatted = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + (otherNumbers ? ',' : '') + lastThree;
    return '₹' + formatted + '.' + decPart;
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
}

function getMonthYear(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleString('default', { month: 'short' }) + '-' + d.getFullYear().toString().slice(-2);
}

// ============================================================
// GLOBAL INSTANCE
// ============================================================
const db = new SkyMedDB();
window.db = db;
window.formatCurrency = formatCurrency;
window.generateId = generateId;
window.getMonthYear = getMonthYear;

async function reloadAllData() {
    console.log('🔄 Reloading all data...');
    await db.forceReload();
    await db.loadFromLocalStorage();
    await db.syncFromSupabase();
    console.log('✅ All data reloaded!');
}
window.reloadAllData = reloadAllData;

console.log('✅ Database module loaded! (Production Mode - Supabase Sync)');
console.log('📦 Data safe on tab switch! Cache is persistent.');
console.log('⏰ Auto-save every 30 seconds');
console.log('☁️ Supabase sync every 60 seconds');
console.log('🔁 Force Reload every 5 seconds');
