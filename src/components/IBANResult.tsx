import { useState } from 'react';
import { CheckCircle2, XCircle, Copy, Save, Share2, Edit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { validateIBAN, formatIBANForDisplay } from '@/lib/ibanValidator';
import { saveIBANRecord } from '@/lib/storage';
import { Share } from '@capacitor/share';

interface IBANResultProps {
  iban: string;
  source: 'camera' | 'gallery';
  onClose: () => void;
  onSaved: () => void;
}

const IBANResult = ({ iban, source, onClose, onSaved }: IBANResultProps) => {
  const [ownerName, setOwnerName] = useState('');
  const [editedIBAN, setEditedIBAN] = useState(iban);
  const [isEditing, setIsEditing] = useState(false);
  const { toast } = useToast();

  const validation = validateIBAN(editedIBAN);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(editedIBAN);
      toast({
        title: 'تم النسخ',
        description: 'تم نسخ رقم IBAN بنجاح',
      });
    } catch (error) {
      toast({
        title: 'فشل النسخ',
        description: 'حدث خطأ أثناء نسخ IBAN',
        variant: 'destructive',
      });
    }
  };

  const handleSave = () => {
    const record = saveIBANRecord({
      iban: editedIBAN,
      ownerName: ownerName.trim(),
      isValid: validation.isValid,
      source,
      errorMessage: validation.error,
      countryCode: editedIBAN.substring(0, 2),
    });

    toast({
      title: 'تم الحفظ',
      description: 'تم حفظ السجل بنجاح',
    });

    onSaved();
  };

  const handleShare = async () => {
    try {
      const message = `IBAN: ${formatIBANForDisplay(editedIBAN)}${
        ownerName ? `\nالمالك: ${ownerName}` : ''
      }\nالحالة: ${validation.isValid ? 'صحيح ✅' : 'غير صحيح ❌'}`;

      await Share.share({
        title: 'IBAN Scanner',
        text: message,
      });
    } catch (error) {
      // Fallback for web
      if (navigator.share) {
        const message = `IBAN: ${formatIBANForDisplay(editedIBAN)}${
          ownerName ? `\nالمالك: ${ownerName}` : ''
        }\nالحالة: ${validation.isValid ? 'صحيح ✅' : 'غير صحيح ❌'}`;
        
        await navigator.share({
          title: 'IBAN Scanner',
          text: message,
        });
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-background/95 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <Card className="w-full max-w-md p-6 space-y-6 my-8">
        <div className="text-center space-y-4">
          {validation.isValid ? (
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-success/10">
              <CheckCircle2 className="w-12 h-12 text-success" />
            </div>
          ) : (
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-destructive/10">
              <XCircle className="w-12 h-12 text-destructive" />
            </div>
          )}

          <div>
            <h2 className="text-2xl font-bold mb-2">
              {validation.isValid ? 'IBAN صحيح ✅' : 'IBAN غير صحيح ❌'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {validation.details || validation.error}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>رقم IBAN</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditing(!isEditing)}
              >
                <Edit2 className="w-4 h-4 ml-1" />
                {isEditing ? 'إلغاء' : 'تعديل'}
              </Button>
            </div>
            {isEditing ? (
              <Input
                value={editedIBAN}
                onChange={(e) => setEditedIBAN(e.target.value.toUpperCase())}
                className="font-mono text-lg"
                dir="ltr"
              />
            ) : (
              <div className="bg-muted p-4 rounded-lg font-mono text-lg break-all" dir="ltr">
                {formatIBANForDisplay(editedIBAN)}
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="ownerName">اسم صاحب الحساب (اختياري)</Label>
            <Input
              id="ownerName"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              placeholder="أدخل اسم صاحب الحساب"
              className="mt-2"
            />
          </div>

          {!validation.isValid && validation.error && (
            <Card className="bg-destructive/10 border-destructive/20 p-4">
              <h3 className="font-semibold text-sm mb-2 text-destructive">
                سبب الخطأ:
              </h3>
              <p className="text-sm text-destructive/90">{validation.error}</p>
              {validation.details && (
                <p className="text-xs text-muted-foreground mt-2">
                  {validation.details}
                </p>
              )}
            </Card>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Button
            variant="outline"
            onClick={handleCopy}
            className="w-full"
          >
            <Copy className="w-4 h-4 ml-1" />
            نسخ
          </Button>
          
          <Button
            variant="outline"
            onClick={handleShare}
            className="w-full"
          >
            <Share2 className="w-4 h-4 ml-1" />
            مشاركة
          </Button>

          <Button
            onClick={handleSave}
            className="w-full"
          >
            <Save className="w-4 h-4 ml-1" />
            حفظ
          </Button>
        </div>

        <Button
          variant="secondary"
          onClick={onClose}
          className="w-full"
        >
          إغلاق
        </Button>
      </Card>
    </div>
  );
};

export default IBANResult;
