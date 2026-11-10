/**
 * The public path of a page: "/changelog", never "/changelog.html" or "/changelog/".
 * Pages build to .html files (build.format 'file'), and Astro reports that file name
 * during the build, so canonical URLs and navigation state go through this.
 */
export function publicPath(pathname: string): string {
  const clean = pathname.replace(/(\/index)?\.html$/, '').replace(/\/+$/, '');
  return clean === '' ? '/' : clean;
}
