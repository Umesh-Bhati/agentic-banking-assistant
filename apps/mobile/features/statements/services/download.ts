import { File, Directory, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { request } from '../../../lib/api/client';
import { resourceId } from '../../../lib/api/policy';
const activeExports = new Set<string>();
let generation = 0;
const folder = () => new Directory(Paths.cache, 'banking-statements');
export function clearStatementFiles() {
  generation++;
  if (Platform.OS !== 'web') {
    const directory = folder();
    if (directory.exists) for (const entry of directory.list()) if (!activeExports.has(entry.uri)) entry.delete();
  }
}
export async function downloadStatement(token: string, id: string) {
  const epoch = generation;
  const response = await request('/api/statements/' + resourceId(id) + '/download', token, { headers: { Accept: 'application/pdf' } });
  if (!response.headers.get('content-type')?.includes('application/pdf')) throw new Error('The bank did not return a PDF');
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (epoch !== generation) throw new Error('Session changed. Download cancelled.');
  if (String.fromCharCode(...bytes.slice(0, 5)) !== '%PDF-') throw new Error('Invalid PDF response');
  if (Platform.OS === 'web') {
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    try { const a = document.createElement('a'); a.href = url; a.download = 'statement.pdf'; a.click(); }
    finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
    return;
  }
  if (!await Sharing.isAvailableAsync()) throw new Error('PDF sharing is unavailable on this device');
  if (epoch !== generation) throw new Error('Session changed. Download cancelled.');
  const directory = folder(); directory.create({ intermediates: true, idempotent: true });
  const file = new File(directory, resourceId(id) + '.pdf');
  try {
    file.write(bytes); activeExports.add(file.uri);
    await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Save banking statement' });
  } finally { activeExports.delete(file.uri); if (file.exists) file.delete(); }
}
