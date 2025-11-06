/**
 * IBAN Validation Library
 * يوفر دوال للتحقق من صحة رقم IBAN وفقاً لمعيار mod97
 */

// قائمة رموز الدول وأطوال IBAN الصحيحة
const IBAN_LENGTHS: Record<string, number> = {
  AD: 24, AE: 23, AL: 28, AT: 20, AZ: 28, BA: 20, BE: 16, BG: 22,
  BH: 22, BR: 29, BY: 28, CH: 21, CR: 22, CY: 28, CZ: 24, DE: 22,
  DK: 18, DO: 28, EE: 20, EG: 29, ES: 24, FI: 18, FO: 18, FR: 27,
  GB: 22, GE: 22, GI: 23, GL: 18, GR: 27, GT: 28, HR: 21, HU: 28,
  IE: 22, IL: 23, IS: 26, IT: 27, JO: 30, KW: 30, KZ: 20, LB: 28,
  LC: 32, LI: 21, LT: 20, LU: 20, LV: 21, MC: 27, MD: 24, ME: 22,
  MK: 19, MR: 27, MT: 31, MU: 30, NL: 18, NO: 15, PK: 24, PL: 28,
  PS: 29, PT: 25, QA: 29, RO: 24, RS: 22, SA: 24, SE: 24, SI: 19,
  SK: 24, SM: 27, TN: 24, TR: 26, UA: 29, VA: 22, VG: 24, XK: 20
};

/**
 * تنظيف نص IBAN من المسافات والرموز غير المطلوبة
 */
export function cleanIBAN(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .trim();
}

/**
 * استخراج IBAN من نص باستخدام Regex مع تصحيح أخطاء OCR الشائعة
 */
export function extractIBANFromText(text: string): string | null {
  // Remove all whitespace and convert to uppercase
  const cleanedText = text.replace(/\s+/g, '').toUpperCase();
  
  // Try original text first
  const ibanRegex = /[A-Z]{2}[0-9]{2}[A-Z0-9]{4,30}/g;
  let matches = cleanedText.match(ibanRegex);
  
  if (matches && matches.length > 0) {
    // Return the first match that passes validation
    for (const match of matches) {
      const validation = validateIBAN(match);
      if (validation.isValid) {
        return match;
      }
    }
  }
  
  // Apply comprehensive OCR error corrections
  let correctedText = cleanedText
    .replace(/O/g, '0')  // O -> 0
    .replace(/Q/g, '0')  // Q -> 0
    .replace(/D/g, '0')  // D -> 0
    .replace(/I/g, '1')  // I -> 1
    .replace(/L/g, '1')  // L -> 1
    .replace(/\|/g, '1') // | -> 1
    .replace(/S/g, '5')  // S -> 5
    .replace(/Z/g, '2')  // Z -> 2
    .replace(/B/g, '8')  // B -> 8
    .replace(/G/g, '6'); // G -> 6
  
  matches = correctedText.match(ibanRegex);
  
  if (matches && matches.length > 0) {
    for (const match of matches) {
      const validation = validateIBAN(match);
      if (validation.isValid) {
        return match;
      }
    }
    // Return longest match for manual correction if no valid one found
    return matches.reduce((a, b) => a.length > b.length ? a : b);
  }
  
  return null;
}

/**
 * تحويل حرف إلى قيمة رقمية (A=10, B=11, ..., Z=35)
 */
function charToNumber(char: string): number {
  return char.charCodeAt(0) - 55; // A=65 -> 10
}

/**
 * حساب mod97 لسلسلة رقمية كبيرة بطريقة آمنة
 */
function mod97(numericString: string): number {
  let remainder = 0;
  
  for (let i = 0; i < numericString.length; i++) {
    remainder = (remainder * 10 + parseInt(numericString[i])) % 97;
  }
  
  return remainder;
}

/**
 * التحقق من صحة IBAN باستخدام خوارزمية mod97
 * @returns { isValid: boolean, error?: string }
 */
export function validateIBAN(iban: string): { isValid: boolean; error?: string; details?: string } {
  const cleaned = cleanIBAN(iban);
  
  // التحقق من الطول الأدنى
  if (cleaned.length < 15) {
    return {
      isValid: false,
      error: 'IBAN قصير جداً',
      details: 'يجب أن يكون طول IBAN 15 حرفاً على الأقل'
    };
  }
  
  // التحقق من أن أول حرفين هما أحرف وثاني حرفين أرقام
  const countryCode = cleaned.substring(0, 2);
  const checkDigits = cleaned.substring(2, 4);
  
  if (!/^[A-Z]{2}$/.test(countryCode)) {
    return {
      isValid: false,
      error: 'رمز الدولة غير صحيح',
      details: 'يجب أن يبدأ IBAN بحرفين يمثلان رمز الدولة'
    };
  }
  
  if (!/^[0-9]{2}$/.test(checkDigits)) {
    return {
      isValid: false,
      error: 'أرقام التحقق غير صحيحة',
      details: 'يجب أن يتبع رمز الدولة رقمين للتحقق'
    };
  }
  
  // التحقق من الطول حسب الدولة
  const expectedLength = IBAN_LENGTHS[countryCode];
  if (expectedLength && cleaned.length !== expectedLength) {
    return {
      isValid: false,
      error: 'طول IBAN غير صحيح للدولة',
      details: `يجب أن يكون طول IBAN لدولة ${countryCode} هو ${expectedLength} حرفاً`
    };
  }
  
  // خوارزمية mod97
  // 1. نقل أول 4 أحرف للنهاية
  const rearranged = cleaned.substring(4) + cleaned.substring(0, 4);
  
  // 2. تحويل الأحرف لأرقام
  let numericString = '';
  for (let i = 0; i < rearranged.length; i++) {
    const char = rearranged[i];
    if (/[A-Z]/.test(char)) {
      numericString += charToNumber(char).toString();
    } else {
      numericString += char;
    }
  }
  
  // 3. حساب mod 97
  const remainder = mod97(numericString);
  
  if (remainder !== 1) {
    return {
      isValid: false,
      error: 'فشل التحقق من checksum',
      details: 'رقم IBAN لا يجتاز خوارزمية التحقق mod97'
    };
  }
  
  return {
    isValid: true,
    details: `IBAN صحيح من ${countryCode}`
  };
}

/**
 * تنسيق IBAN بمسافات كل 4 أحرف للعرض
 */
export function formatIBANForDisplay(iban: string): string {
  const cleaned = cleanIBAN(iban);
  return cleaned.replace(/(.{4})/g, '$1 ').trim();
}
