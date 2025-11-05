/**
 * مكتبة التخزين المحلي لسجلات IBAN
 */

export interface IBANRecord {
  id: string;
  iban: string;
  ownerName: string;
  isValid: boolean;
  timestamp: number;
  source: 'camera' | 'gallery';
  errorMessage?: string;
  countryCode?: string;
}

const STORAGE_KEY = 'iban_records';

/**
 * حفظ سجل IBAN جديد
 */
export function saveIBANRecord(record: Omit<IBANRecord, 'id' | 'timestamp'>): IBANRecord {
  const records = getAllRecords();
  
  const newRecord: IBANRecord = {
    ...record,
    id: crypto.randomUUID(),
    timestamp: Date.now(),
  };
  
  records.unshift(newRecord); // إضافة في البداية
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  
  return newRecord;
}

/**
 * الحصول على جميع السجلات
 */
export function getAllRecords(): IBANRecord[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error reading records:', error);
    return [];
  }
}

/**
 * حذف سجل
 */
export function deleteRecord(id: string): void {
  const records = getAllRecords();
  const filtered = records.filter(r => r.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

/**
 * تحديث سجل
 */
export function updateRecord(id: string, updates: Partial<IBANRecord>): void {
  const records = getAllRecords();
  const index = records.findIndex(r => r.id === id);
  
  if (index !== -1) {
    records[index] = { ...records[index], ...updates };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }
}

/**
 * تصدير السجلات كـ CSV
 */
export function exportToCSV(records: IBANRecord[]): string {
  const headers = ['الرقم', 'IBAN', 'اسم المالك', 'الحالة', 'المصدر', 'التاريخ'];
  const rows = records.map((r, i) => [
    i + 1,
    r.iban,
    r.ownerName || '-',
    r.isValid ? 'صحيح' : 'غير صحيح',
    r.source === 'camera' ? 'كاميرا' : 'معرض',
    new Date(r.timestamp).toLocaleString('ar-SA')
  ]);
  
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');
  
  return csvContent;
}

/**
 * البحث في السجلات
 */
export function searchRecords(query: string): IBANRecord[] {
  const records = getAllRecords();
  const lowercaseQuery = query.toLowerCase();
  
  return records.filter(r => 
    r.iban.toLowerCase().includes(lowercaseQuery) ||
    r.ownerName.toLowerCase().includes(lowercaseQuery)
  );
}
