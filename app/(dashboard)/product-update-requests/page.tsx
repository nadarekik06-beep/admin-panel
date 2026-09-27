import { redirect } from 'next/navigation'

// Update requests were replaced by direct seller edits + the change log.
// Old links (e.g. from past notifications) land on the new page.
export default function ProductUpdateRequestsPage() {
  redirect('/product-changes')
}
