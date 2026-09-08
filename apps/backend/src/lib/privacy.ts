/** Conservative deterministic guard: redact common identifiers before any provider boundary. */
export function minimizeText(input: string): string {
    if (typeof input !== 'string' || input.length > 16000)
        throw new Error('Text exceeds privacy boundary limits');
    if (/\b(?:password|passcode|otp|pin|secret|bearer|token)\s*(?::|=|is|\s)\s*\S+/i.test(input))
        return '[Sensitive credentials removed]';
    const dates: string[] = [];
    const protectedInput = input.replace(/\b\d{4}-\d{2}-\d{2}\b/g, date => {
        dates.push(date);
        return 'DATEPLACEHOLDER' + String.fromCharCode(65 + dates.length - 1);
    });
    return protectedInput.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[email]')
        .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[token]')
        .replace(/\b[A-Z]{2}\d{2}[A-Z0-9 ]{10,30}\b/g, '[account]')
        .replace(/\+?\d[\d\s().-]{6,}\d/g, '[number]')
        .replace(/\b\d{4,6}\b/g, '[number]')
        .replace(/\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/gi, '[identifier]').replace(/DATEPLACEHOLDER([A-Z])/g, (_match, letter) => dates[letter.charCodeAt(0) - 65]);
}
