/**
 * assets/img/ に置いた画像から Web 用の軽量版（.webp）を作ります。
 *
 *   npm run images
 *
 * - 元ファイルは書き換えません（.webp を隣に作るだけ）
 * - 横幅が大きすぎる画像は上限まで縮小します
 * - logo.png は透過を保ったまま変換します
 */
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const DIR = path.resolve('assets/img');

/** ファイル名ごとの最大幅（スマホ表示に十分なサイズ） */
const MAX_WIDTH = {
  'logo.png': 720,
  'product-hero.jpg': 1080,
  'brand-01.jpg': 1080,
  'brand-02.jpg': 1080
};
const DEFAULT_MAX_WIDTH = 1080;

const SOURCE_EXT = new Set(['.jpg', '.jpeg', '.png']);

/** logo.png は透過PNGのまま使うため変換しない（_source/ の原本も対象外） */
const SKIP = new Set(['logo.png']);

const files = await readdir(DIR).catch(() => []);
const targets = files
  .filter((f) => SOURCE_EXT.has(path.extname(f).toLowerCase()))
  .filter((f) => !SKIP.has(f));

if (targets.length === 0) {
  console.log('assets/img/ に画像がありません。5枚を置いてから実行してください。');
  process.exit(0);
}

for (const file of targets) {
  const src = path.join(DIR, file);
  const out = path.join(DIR, path.basename(file, path.extname(file)) + '.webp');
  const maxWidth = MAX_WIDTH[file] ?? DEFAULT_MAX_WIDTH;

  const image = sharp(src).rotate();
  const meta = await image.metadata();
  const pipeline = meta.width && meta.width > maxWidth
    ? image.resize({ width: maxWidth, withoutEnlargement: true })
    : image;

  await pipeline.webp({ quality: 82, effort: 5 }).toFile(out);

  const before = (await stat(src)).size;
  const after = (await stat(out)).size;
  const cut = Math.round((1 - after / before) * 100);
  console.log(
    `${file} → ${path.basename(out)}  ` +
    `${(before / 1024).toFixed(0)}KB → ${(after / 1024).toFixed(0)}KB (-${cut}%)`
  );
}

console.log('\n完了しました。このまま公開できます。');
