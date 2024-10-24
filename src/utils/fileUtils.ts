import { glob } from 'glob';

export async function findFiles(
  dir: string,
  extensions: string[]
): Promise<string[]> {
  const pattern = `${dir}/**/*{${extensions.join(',')}}`;
  try {
    const files = await glob(pattern, {
      ignore: ['**/node_modules/**'],
      withFileTypes: false,
    });
    return files;
  } catch (error) {
    console.error('Error finding files:', error);
    return [];
  }
}
