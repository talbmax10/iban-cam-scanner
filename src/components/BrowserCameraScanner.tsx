import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, X, FlipHorizontal } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Tesseract from 'tesseract.js';
import { extractIBANFromText } from '@/lib/ibanValidator';

interface BrowserCameraScannerProps {
  onIBANDetected: (iban: string, source: 'camera' | 'manual', imageData?: string) => void;
  onClose: () => void;
}

export function BrowserCameraScanner({ onIBANDetected, onClose }: BrowserCameraScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, [facingMode]);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });
      
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      toast({
        title: "خطأ في الكاميرا",
        description: "لا يمكن الوصول إلى الكاميرا. تأكد من منح الإذن.",
        variant: "destructive"
      });
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const flipCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  const applySharpening = (imageData: ImageData): ImageData => {
    const data = imageData.data;
    const width = imageData.width;
    const kernel = [
      0, -1, 0,
      -1, 5, -1,
      0, -1, 0
    ];
    
    const output = new ImageData(width, imageData.height);
    
    for (let y = 1; y < imageData.height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        for (let c = 0; c < 3; c++) {
          let sum = 0;
          for (let ky = -1; ky <= 1; ky++) {
            for (let kx = -1; kx <= 1; kx++) {
              const idx = ((y + ky) * width + (x + kx)) * 4 + c;
              sum += data[idx] * kernel[(ky + 1) * 3 + (kx + 1)];
            }
          }
          const idx = (y * width + x) * 4 + c;
          output.data[idx] = Math.max(0, Math.min(255, sum));
        }
        output.data[(y * width + x) * 4 + 3] = 255;
      }
    }
    
    return output;
  };

  const preprocessImage = (canvas: HTMLCanvasElement): string => {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return canvas.toDataURL();

    let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Apply sharpening
    imageData = applySharpening(imageData);

    // Increase contrast with gamma correction
    const gamma = 1.5;
    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.pow(data[i] / 255, 1 / gamma) * 255;
      data[i + 1] = Math.pow(data[i + 1] / 255, 1 / gamma) * 255;
      data[i + 2] = Math.pow(data[i + 2] / 255, 1 / gamma) * 255;
    }

    // Convert to grayscale with adjusted weights
    for (let i = 0; i < data.length; i += 4) {
      const gray = data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11;
      data[i] = data[i + 1] = data[i + 2] = gray;
    }

    // Apply binary threshold
    const threshold = 128;
    for (let i = 0; i < data.length; i += 4) {
      const value = data[i] > threshold ? 255 : 0;
      data[i] = data[i + 1] = data[i + 2] = value;
    }

    // Median filter for noise reduction
    const medianFilter = (imageData: ImageData): ImageData => {
      const output = new ImageData(imageData.width, imageData.height);
      const data = imageData.data;
      const width = imageData.width;

      for (let y = 1; y < imageData.height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          const neighbors = [];
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              neighbors.push(data[((y + dy) * width + (x + dx)) * 4]);
            }
          }
          neighbors.sort((a, b) => a - b);
          const median = neighbors[4];
          const idx = (y * width + x) * 4;
          output.data[idx] = output.data[idx + 1] = output.data[idx + 2] = median;
          output.data[idx + 3] = 255;
        }
      }
      return output;
    };

    imageData = medianFilter(imageData);
    ctx.putImageData(imageData, 0, 0);

    return canvas.toDataURL();
  };

  const captureAndProcess = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    setIsScanning(true);

    try {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Cannot get canvas context');

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      const processedImageUrl = preprocessImage(canvas);
      const originalImageUrl = canvas.toDataURL();

      toast({
        title: "جاري المعالجة...",
        description: "يتم الآن تحليل الصورة والبحث عن IBAN",
      });

      const result = await Tesseract.recognize(
        processedImageUrl,
        'eng',
        {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              console.log(`Progress: ${Math.round(m.progress * 100)}%`);
            }
          }
        }
      );

      const text = result.data.text;
      console.log('Detected text:', text);

      const iban = extractIBANFromText(text);

      if (iban) {
        toast({
          title: "تم العثور على IBAN!",
          description: `تم اكتشاف: ${iban}`,
        });
        onIBANDetected(iban, 'camera', originalImageUrl);
      } else {
        toast({
          title: "لم يتم العثور على IBAN",
          description: "حاول التقاط صورة أوضح أو أدخل IBAN يدوياً",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error processing image:', error);
      toast({
        title: "خطأ في المعالجة",
        description: "حدث خطأ أثناء معالجة الصورة",
        variant: "destructive"
      });
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-xl font-bold">مسح IBAN</h2>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={flipCamera}
            disabled={isScanning}
          >
            <FlipHorizontal className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            disabled={isScanning}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="flex-1 relative bg-black">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />
        <canvas ref={canvasRef} className="hidden" />
        
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[90%] max-w-md aspect-[2/1] border-2 border-primary/50 rounded-lg" />
        </div>
      </div>

      <div className="p-6 border-t bg-background">
        <Button
          onClick={captureAndProcess}
          disabled={isScanning || !stream}
          className="w-full"
          size="lg"
        >
          <Camera className="mr-2 h-5 w-5" />
          {isScanning ? 'جاري المعالجة...' : 'التقاط ومسح'}
        </Button>
        <p className="text-center text-sm text-muted-foreground mt-3">
          ضع بطاقة IBAN في الإطار والتقط صورة واضحة
        </p>
      </div>
    </div>
  );
}
