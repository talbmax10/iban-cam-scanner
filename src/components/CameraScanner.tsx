import { useState, useRef, useEffect } from 'react';
import { Camera as CameraIcon, Upload, X, Loader2, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import Tesseract from 'tesseract.js';
import { extractIBANFromText } from '@/lib/ibanValidator';
import { Camera } from '@capacitor/camera';
import { CameraResultType, CameraSource } from '@capacitor/camera';

interface CameraScannerProps {
  onIBANDetected: (iban: string, source: 'camera' | 'gallery', capturedImage?: string) => void;
  onClose: () => void;
}

const CameraScanner = ({ onIBANDetected, onClose }: CameraScannerProps) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [lastScanTime, setLastScanTime] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<number | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    return () => {
      stopLiveMode();
    };
  }, []);

  const applySharpening = (data: Uint8ClampedArray, width: number, height: number) => {
    const sharpenKernel = [
      0, -1, 0,
      -1, 5, -1,
      0, -1, 0
    ];
    
    const copy = new Uint8ClampedArray(data);
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let r = 0, g = 0, b = 0;
        
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = ((y + ky) * width + (x + kx)) * 4;
            const kernelIdx = (ky + 1) * 3 + (kx + 1);
            const weight = sharpenKernel[kernelIdx];
            
            r += copy[idx] * weight;
            g += copy[idx + 1] * weight;
            b += copy[idx + 2] * weight;
          }
        }
        
        const idx = (y * width + x) * 4;
        data[idx] = Math.max(0, Math.min(255, r));
        data[idx + 1] = Math.max(0, Math.min(255, g));
        data[idx + 2] = Math.max(0, Math.min(255, b));
      }
    }
  };

  const preprocessImage = (imageData: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(imageData);
          return;
        }

        // Increase resolution for better OCR
        const scale = 2;
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        
        // Enable image smoothing for better quality
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const imageDataObj = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageDataObj.data;

        // Apply sharpening filter first
        applySharpening(data, canvas.width, canvas.height);

        // Convert to grayscale with enhanced contrast
        for (let i = 0; i < data.length; i += 4) {
          // Weighted grayscale conversion
          const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
          
          // Enhanced contrast with gamma correction
          const normalized = gray / 255;
          const gamma = 1.5;
          const corrected = Math.pow(normalized, gamma) * 255;
          
          // Strong contrast enhancement
          const contrasted = ((corrected - 128) * 2.5) + 128;
          
          // Adaptive threshold based on local statistics
          const threshold = 140;
          const value = contrasted > threshold ? 255 : 0;
          
          data[i] = data[i + 1] = data[i + 2] = value;
        }

        // Apply noise reduction (median filter simulation)
        const copy = new Uint8ClampedArray(data);
        for (let y = 1; y < canvas.height - 1; y++) {
          for (let x = 1; x < canvas.width - 1; x++) {
            const neighbors = [];
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                const idx = ((y + dy) * canvas.width + (x + dx)) * 4;
                neighbors.push(copy[idx]);
              }
            }
            neighbors.sort((a, b) => a - b);
            const median = neighbors[Math.floor(neighbors.length / 2)];
            
            const idx = (y * canvas.width + x) * 4;
            data[idx] = data[idx + 1] = data[idx + 2] = median;
          }
        }

        ctx.putImageData(imageDataObj, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.src = imageData;
    });
  };

  const processImage = async (imageData: string, source: 'camera' | 'gallery') => {
    setIsProcessing(true);
    setProgress(0);

    try {
      // Preprocess image for better OCR
      const processedImage = await preprocessImage(imageData);
      
      const result = await Tesseract.recognize(processedImage, 'eng+ara', {
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
        onIBANDetected(iban, source, imageData);
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

  const startLiveMode = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setIsLiveMode(true);
        
        // بدء المسح كل 2 ثانية
        scanIntervalRef.current = window.setInterval(() => {
          captureAndProcessFrame();
        }, 2000);
      }
    } catch (error) {
      console.error('Camera error:', error);
      toast({
        title: 'خطأ في الكاميرا',
        description: 'لا يمكن الوصول إلى الكاميرا. تأكد من منح الأذونات.',
        variant: 'destructive',
      });
    }
  };

  const stopLiveMode = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    setIsLiveMode(false);
  };

  const captureAndProcessFrame = async () => {
    if (!videoRef.current || !canvasRef.current || isProcessing) return;
    
    const now = Date.now();
    if (now - lastScanTime < 2000) return;
    
    setLastScanTime(now);
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    
    if (!context) return;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);
    
    const imageData = canvas.toDataURL('image/png');
    await processImage(imageData, 'camera');
  };

  const handleCameraCapture = async () => {
    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
      });

      if (image.dataUrl) {
        await processImage(image.dataUrl, 'camera');
      }
    } catch (error) {
      console.error('Camera capture error:', error);
      toast({
        title: 'خطأ في التقاط الصورة',
        description: 'حدث خطأ أثناء التقاط الصورة. حاول مرة أخرى.',
        variant: 'destructive',
      });
    }
  };

  const handleGalleryPick = async () => {
    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Photos,
      });

      if (image.dataUrl) {
        await processImage(image.dataUrl, 'gallery');
      }
    } catch (error) {
      console.error('Gallery pick error:', error);
      toast({
        title: 'خطأ في اختيار الصورة',
        description: 'حدث خطأ أثناء اختيار الصورة. حاول مرة أخرى.',
        variant: 'destructive',
      });
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
            onClick={() => {
              stopLiveMode();
              onClose();
            }}
            disabled={isProcessing}
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="space-y-4">
          {isLiveMode ? (
            <div className="relative bg-black rounded-lg overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-64 object-cover"
              />
              <canvas ref={canvasRef} className="hidden" />
              <div className="absolute inset-0 border-4 border-primary/50 pointer-events-none">
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-4/5 h-24 border-2 border-accent rounded-lg" />
              </div>
              <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
                <Button
                  onClick={stopLiveMode}
                  variant="destructive"
                  size="sm"
                >
                  إيقاف المسح
                </Button>
              </div>
            </div>
          ) : (
            <div className="bg-muted/50 rounded-lg p-8 text-center border-2 border-dashed border-border">
              <CameraIcon className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-2">
                ضع المستند بشكل واضح في الإطار
              </p>
              <p className="text-xs text-muted-foreground">
                تأكد من الإضاءة الجيدة ووضوح النص
              </p>
            </div>
          )}

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

          {!isLiveMode && (
            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={startLiveMode}
                disabled={isProcessing}
                size="lg"
                className="w-full col-span-2"
              >
                <Video className="w-5 h-5 ml-2" />
                مسح فوري بالكاميرا
              </Button>
              
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
                onClick={handleGalleryPick}
                disabled={isProcessing}
                size="lg"
                className="w-full"
              >
                <Upload className="w-5 h-5 ml-2" />
                اختر من المعرض
              </Button>
            </div>
          )}
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
