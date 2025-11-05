import { useState } from 'react';
import { Camera, History, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import CameraScanner from '@/components/CameraScanner';
import IBANResult from '@/components/IBANResult';
import RecordsList from '@/components/RecordsList';
import { getAllRecords } from '@/lib/storage';

type Screen = 'home' | 'scanner' | 'result' | 'records';

const Index = () => {
  const [currentScreen, setCurrentScreen] = useState<Screen>('home');
  const [scannedIBAN, setScannedIBAN] = useState('');
  const [ibanSource, setIbanSource] = useState<'camera' | 'gallery'>('camera');
  const [refreshRecords, setRefreshRecords] = useState(0);

  const recentRecords = getAllRecords().slice(0, 3);

  const handleIBANDetected = (iban: string, source: 'camera' | 'gallery') => {
    setScannedIBAN(iban);
    setIbanSource(source);
    setCurrentScreen('result');
  };

  const handleRecordSaved = () => {
    setRefreshRecords(prev => prev + 1);
    setCurrentScreen('home');
  };

  if (currentScreen === 'scanner') {
    return (
      <CameraScanner
        onIBANDetected={handleIBANDetected}
        onClose={() => setCurrentScreen('home')}
      />
    );
  }

  if (currentScreen === 'result') {
    return (
      <IBANResult
        iban={scannedIBAN}
        source={ibanSource}
        onClose={() => setCurrentScreen('home')}
        onSaved={handleRecordSaved}
      />
    );
  }

  if (currentScreen === 'records') {
    return (
      <RecordsList
        onClose={() => setCurrentScreen('home')}
        refreshTrigger={refreshRecords}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="max-w-md mx-auto p-6 space-y-8">
        {/* Header */}
        <div className="text-center space-y-2 pt-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-accent mb-4">
            <Camera className="w-10 h-10 text-primary-foreground" />
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            ماسح IBAN
          </h1>
          <p className="text-muted-foreground">
            استخرج وتحقق من رموز IBAN بدقة وسرعة
          </p>
        </div>

        {/* Main Actions */}
        <div className="space-y-4">
          <Button
            size="lg"
            onClick={() => setCurrentScreen('scanner')}
            className="w-full h-16 text-lg font-bold shadow-lg"
          >
            <Camera className="w-6 h-6 ml-3" />
            مسح IBAN جديد
          </Button>

          <Button
            variant="outline"
            size="lg"
            onClick={() => setCurrentScreen('records')}
            className="w-full h-14"
          >
            <History className="w-5 h-5 ml-2" />
            عرض السجلات المحفوظة
          </Button>
        </div>

        {/* Recent Records */}
        {recentRecords.length > 0 && (
          <Card className="p-6 space-y-4">
            <h2 className="font-bold text-lg">السجلات الأخيرة</h2>
            <div className="space-y-3">
              {recentRecords.map((record) => (
                <div
                  key={record.id}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-sm truncate" dir="ltr">
                      {record.iban}
                    </p>
                    {record.ownerName && (
                      <p className="text-xs text-muted-foreground truncate">
                        {record.ownerName}
                      </p>
                    )}
                  </div>
                  <span className={`text-2xl ${record.isValid ? '' : 'opacity-50'}`}>
                    {record.isValid ? '✅' : '❌'}
                  </span>
                </div>
              ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentScreen('records')}
              className="w-full"
            >
              عرض الكل
            </Button>
          </Card>
        )}

        {/* Info Card */}
        <Card className="p-6 bg-accent/5 border-accent/20">
          <div className="flex gap-3">
            <Info className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
            <div className="space-y-2">
              <h3 className="font-semibold">كيف يعمل التطبيق؟</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• التقط صورة للمستند أو اختر من المعرض</li>
                <li>• سيتم استخراج رقم IBAN تلقائياً</li>
                <li>• التحقق الفوري من الصحة باستخدام خوارزمية mod97</li>
                <li>• احفظ السجلات وشاركها بسهولة</li>
              </ul>
            </div>
          </div>
        </Card>

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground pt-4">
          <p>جميع البيانات محفوظة محلياً على جهازك</p>
          <p className="mt-1">نحترم خصوصيتك وأمان معلوماتك 🔒</p>
        </div>
      </div>
    </div>
  );
};

export default Index;
