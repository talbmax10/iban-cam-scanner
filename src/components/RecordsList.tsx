import { useState, useEffect } from 'react';
import { Search, Trash2, Download, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { getAllRecords, deleteRecord, searchRecords, exportToCSV, IBANRecord } from '@/lib/storage';
import { formatIBANForDisplay } from '@/lib/ibanValidator';

interface RecordsListProps {
  onClose: () => void;
  refreshTrigger?: number;
}

const RecordsList = ({ onClose, refreshTrigger }: RecordsListProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [records, setRecords] = useState<IBANRecord[]>(getAllRecords());
  const { toast } = useToast();

  // Update records when refreshTrigger changes
  useEffect(() => {
    setRecords(getAllRecords());
  }, [refreshTrigger]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query.trim()) {
      setRecords(searchRecords(query));
    } else {
      setRecords(getAllRecords());
    }
  };

  const handleDelete = (id: string) => {
    deleteRecord(id);
    setRecords(getAllRecords());
    toast({
      title: 'تم الحذف',
      description: 'تم حذف السجل بنجاح',
    });
  };

  const handleExport = () => {
    const csv = exportToCSV(records);
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `iban_records_${Date.now()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: 'تم التصدير',
      description: 'تم تصدير السجلات بنجاح',
    });
  };

  return (
    <div className="fixed inset-0 bg-background z-50 overflow-y-auto">
      <div className="max-w-4xl mx-auto p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">السجلات المحفوظة</h2>
          <Button variant="ghost" onClick={onClose}>
            إغلاق
          </Button>
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="البحث في السجلات..."
              className="pr-10"
            />
          </div>
          {records.length > 0 && (
            <Button variant="outline" onClick={handleExport}>
              <Download className="w-4 h-4 ml-2" />
              تصدير CSV
            </Button>
          )}
        </div>

        {records.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground">لا توجد سجلات محفوظة</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {records.map((record) => (
              <Card key={record.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      {record.isValid ? (
                        <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0" />
                      ) : (
                        <XCircle className="w-5 h-5 text-destructive flex-shrink-0" />
                      )}
                      <span className="font-mono text-sm break-all" dir="ltr">
                        {formatIBANForDisplay(record.iban)}
                      </span>
                    </div>
                    
                    {record.ownerName && (
                      <p className="text-sm text-muted-foreground">
                        المالك: {record.ownerName}
                      </p>
                    )}

                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>
                        {new Date(record.timestamp).toLocaleDateString('ar-SA')}
                      </span>
                      <span>
                        {record.source === 'camera' ? '📷 كاميرا' : '🖼️ معرض'}
                      </span>
                      {record.countryCode && (
                        <span className="font-semibold">
                          {record.countryCode}
                        </span>
                      )}
                    </div>

                    {!record.isValid && record.errorMessage && (
                      <p className="text-xs text-destructive">
                        {record.errorMessage}
                      </p>
                    )}
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(record.id)}
                    className="flex-shrink-0"
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default RecordsList;
