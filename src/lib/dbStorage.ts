/**
 * Database storage for IBAN records using Supabase
 */
import { supabase } from '@/integrations/supabase/client';

export interface IBANRecord {
  id: string;
  iban: string;
  owner_name: string | null;
  is_valid: boolean;
  created_at: string;
  source: 'camera' | 'gallery' | 'manual';
  error_message?: string | null;
  country_code?: string | null;
}

/**
 * Save a new IBAN record to the database
 */
export async function saveIBANRecord(record: {
  iban: string;
  ownerName: string;
  isValid: boolean;
  source: 'camera' | 'gallery' | 'manual';
  errorMessage?: string;
  countryCode?: string;
}): Promise<{ data: IBANRecord | null; error: Error | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('User must be authenticated');
    }

    const { data, error } = await supabase
      .from('iban_records')
      .insert({
        user_id: user.id,
        iban: record.iban,
        owner_name: record.ownerName || null,
        is_valid: record.isValid,
        source: record.source,
        error_message: record.errorMessage || null,
        country_code: record.countryCode || null,
      })
      .select()
      .single();

    if (error) throw error;

    return { data: data as IBANRecord, error: null };
  } catch (error) {
    return { data: null, error: error as Error };
  }
}

/**
 * Get all IBAN records for the current user
 */
export async function getAllRecords(): Promise<{ data: IBANRecord[]; error: Error | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { data: [], error: null };
    }

    const { data, error } = await supabase
      .from('iban_records')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return { data: (data || []) as IBANRecord[], error: null };
  } catch (error) {
    return { data: [], error: error as Error };
  }
}

/**
 * Delete an IBAN record
 */
export async function deleteRecord(id: string): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase
      .from('iban_records')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return { error: null };
  } catch (error) {
    return { error: error as Error };
  }
}

/**
 * Export records to CSV format
 */
export function exportToCSV(records: IBANRecord[]): string {
  const headers = ['الرقم', 'IBAN', 'اسم المالك', 'الحالة', 'المصدر', 'التاريخ'];
  const rows = records.map((r, i) => [
    i + 1,
    r.iban,
    r.owner_name || '-',
    r.is_valid ? 'صحيح' : 'غير صحيح',
    r.source === 'camera' ? 'كاميرا' : r.source === 'gallery' ? 'معرض' : 'يدوي',
    new Date(r.created_at).toLocaleString('ar-SA')
  ]);
  
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');
  
  return csvContent;
}

/**
 * Search records by IBAN or owner name
 */
export async function searchRecords(query: string): Promise<{ data: IBANRecord[]; error: Error | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { data: [], error: null };
    }

    const lowercaseQuery = query.toLowerCase();

    const { data, error } = await supabase
      .from('iban_records')
      .select('*')
      .eq('user_id', user.id)
      .or(`iban.ilike.%${lowercaseQuery}%,owner_name.ilike.%${lowercaseQuery}%`)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return { data: (data || []) as IBANRecord[], error: null };
  } catch (error) {
    return { data: [], error: error as Error };
  }
}
