import { readdirSync, lstatSync, readFileSync, readlinkSync } from 'fs-extra';
import { relative, resolve } from 'path';
import JSZip from 'jszip';


/**
 * Lists all file paths in a directory.
 */
function listDirectory(directory: string): string[] {
  const filepaths: string[] = [];
  const entries = readdirSync(directory, { withFileTypes: true });

  for (const entry of entries) {
    const filepath = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      filepaths.push(...listDirectory(filepath));
    } else {
      filepaths.push(filepath);
    }
  }

  return filepaths;
}

export function zipDirectory(directory: string): Promise<Buffer> {
  const zip = new JSZip();
  const filepaths = listDirectory(directory);

  for (const filepath of filepaths) {
    const relativePath = relative(directory, filepath);
    const stat = lstatSync(filepath);
    if (stat.isSymbolicLink()) {
      zip.file(relativePath, readlinkSync(filepath), {
        dir: stat.isDirectory(),
        unixPermissions: parseInt('120755', 8),
      });
    } else {
      zip.file(relativePath, readFileSync(filepath), {
        dir: stat.isDirectory(),
        unixPermissions: stat.mode,
      });
    }
  }

  return zip.generateAsync({
    type: 'nodebuffer',
    platform: 'UNIX',
    compression: 'STORE',
  });
}
