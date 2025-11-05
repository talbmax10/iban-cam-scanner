import { useState, useRef } from 'react';
import { Camera as CameraIcon, Upload, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import Tesseract from 'tesseract.js';
import { extractIBANFromText } from '@/lib/ibanValidator';

interface CameraScannerProps {
  onIBANDetected: (iban: string, source: 'camera' | 'gallery') => void;
  onClose: () => void;
}

const CameraScanner = ({ onIBANDetected, onClose }: CameraScannerProps) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const processImage = async (imageFile: File, source: 'camera' | 'gallery') => {
    setIsProcessing(true);
    setProgress(0);

    try {
      const result = await Tesseract.recognize(imageFile, 'eng', {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setProgress(Math.round(m.progress * 100));
          }
        },
      });

      const extractedText = result.data.text;
      console.log('Extracted text:', extractedText);

      const iban = extractIBANFromText(extractedText);

      if (iban) {
        onIBANDetected(iban, source);
      } else {
        toast({
          title: 'لم يتم العثور على IBAN',
          description: 'لم نتمكن من استخراج رقم IBAN من الصورة. حاول التقاط صورة أوضح.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('OCR error:', error);
      toast({
        title: 'خطأ في المعالجة',
        description: 'حدث خطأ أثناء معالجة الصورة. حاول مرة أخرى.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      processImage(file, 'gallery');
    }
  };

  const handleCameraCapture = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="fixed inset-0 bg-background/95 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">مسح IBAN</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            disabled={isProcessing}
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-8 text-center border-2 border-dashed border-border">
            <CameraIcon className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mb-2">
              ضع المستند بشكل واضح في الإطار
            </p>
            <p className="text-xs text-muted-foreground">
              تأكد من الإضاءة الجيدة ووضوح النص
            </p>
          </div>

          {isProcessing && (
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                <span className="text-sm font-medium">جاري المعالجة...</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-center text-xs text-muted-foreground">
                {progress}% مكتمل
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={handleCameraCapture}
              disabled={isProcessing}
              size="lg"
              className="w-full"
            >
              <CameraIcon className="w-5 h-5 ml-2" />
              التقط صورة
            </Button>
            
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              size="lg"
              className="w-full"
            >
              <Upload className="w-5 h-5 ml-2" />
              اختر من المعرض
            </Button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>

        <div className="bg-accent/10 rounded-lg p-4 space-y-2">
          <h3 className="font-semibold text-sm">نصائح للحصول على أفضل نتيجة:</h3>
          <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
            <li>استخدم إضاءة جيدة</li>
            <li>تأكد من وضوح النص</li>
            <li>تجنب الانعكاسات والظلال</li>
            <li>التقط الصورة بشكل مستقيم</li>
          </ul>
        </div>
      </Card>
    </div>
  );
};

export default CameraScanner;
