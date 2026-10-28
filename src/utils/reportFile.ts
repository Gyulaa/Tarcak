import { File, Paths } from 'expo-file-system';
import * as FileSystem from 'expo-file-system/legacy';

import { REPORT_FILE_PREFIX, reportFileName } from '../domain/monthlyReport';

/**
 * Removes earlier report files from the cache. Best effort: a failed cleanup must not block the export.
 * A report is deleted on the next export or screen open, not right after sharing: on Android the
 * receiving app may still be reading it.
 */
export async function purgeReportFiles(): Promise<void> {
  const cache = FileSystem.cacheDirectory;
  if (!cache) {
    return;
  }
  const names = await FileSystem.readDirectoryAsync(cache);
  await Promise.all(
    names
      .filter((n) => n.startsWith(REPORT_FILE_PREFIX))
      .map((n) => FileSystem.deleteAsync(`${cache}${n}`, { idempotent: true }))
  );
}

/** Writes the CSV (its BOM becomes the UTF-8 bytes EF BB BF) to the cache and returns the file URI. */
export async function writeReportFile(csv: string): Promise<string> {
  await purgeReportFiles().catch(() => {});
  const outfile = new File(Paths.cache, reportFileName(new Date()));
  outfile.write(new TextEncoder().encode(csv));
  return outfile.uri;
}

/** For a report that was created but could not be shared. */
export async function deleteReportFile(uri: string): Promise<void> {
  await FileSystem.deleteAsync(uri, { idempotent: true });
}
