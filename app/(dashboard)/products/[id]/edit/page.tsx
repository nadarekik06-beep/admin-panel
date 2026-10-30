'use client'

import { useParams } from 'next/navigation'
import ProductEditorForm from './_components/ProductEditorForm'

/** /products/{id}/edit — the shared admin product form in edit mode. */
export default function ProductEditorPage() {
  const { id } = useParams<{ id: string }>()
  return <ProductEditorForm mode="edit" productId={Number(id)} />
}
