// Computes the {contract_pdf_url, contract_pdf_archive_urls} update fields for
// a contract whose signed PDF must be archived before regeneration. Same
// pattern used by the financing conversion flow — extracted because every
// post-sale modify endpoint that materially changes contract content needs it.

export function archivePdfUrls(
  currentUrl: string | null | undefined,
  priorArchive: unknown
): { contract_pdf_url: null; contract_pdf_archive_urls: string[] } {
  const archive: string[] = Array.isArray(priorArchive) ? (priorArchive as string[]) : [];
  return {
    contract_pdf_url: null,
    contract_pdf_archive_urls: currentUrl ? [currentUrl, ...archive] : archive,
  };
}
